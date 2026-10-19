// Infofilm, the page: projects, a new-film guide, one page per film, settings.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const app = $("#app");
let state = null; // /api/state
let stream = null; // the open job stream
let refreshTimer = null;

async function api(path, opts = {}) {
  const res = await fetch(`/api/${path}`, {
    method: opts.body ? "POST" : "GET",
    headers: opts.body ? { "Content-Type": "application/json", "X-Infofilm": "1" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `fel ${res.status}`);
  return data;
}

/** An in-page dialog (instead of confirm/prompt, which a native app window may not show).
 * Resolves to true/false, or to the typed text (null on cancel) when `input` is given. */
function ask({ title, text = "", ok = "OK", input = null, pay = false }) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "ask";
    d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${text ? `<p class="muted">${esc(text)}</p>` : ""}${input != null ? `<input type="text" name="v" value="${esc(input)}">` : ""}
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button value="no" type="submit">Avbryt</button><button value="yes" type="submit" class="${pay ? "pay" : "primary"}">${esc(ok)}</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener("close", () => {
      const yes = d.returnValue === "yes";
      resolve(input != null ? (yes ? d.querySelector("input").value.trim() || null : null) : yes);
      d.remove();
    });
    d.showModal();
    (d.querySelector("input") || d.querySelector("button[value=yes]")).focus();
  });
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 3500);
}

const fileUrl = (id, rel, v) => `/files/${encodeURIComponent(id)}/${rel.split("/").map(encodeURIComponent).join("/")}${v ? `?v=${Math.round(v)}` : ""}`;
const swatch = (p = {}) => `<span class="swatch">${[p.band, p.primary, p.accent, p.surface ?? p.surfaceLight, p.backdrop].filter(Boolean).map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</span>`;
/** Just enough Markdown for Claude's answers: paragraphs, lists, **bold**, `code`. */
const md = (t) =>
  esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .split(/\n{2,}/)
    .map((block) =>
      /^\s*[-*] /m.test(block) ? `<ul>${block.split("\n").filter(Boolean).map((l) => `<li>${l.replace(/^\s*[-*] /, "")}</li>`).join("")}</ul>` : `<p>${block.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
const modeName = (m) => (m === "klipp" ? "Klipp" : "Film");
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 90) return "nyss";
  if (s < 3600) return `${Math.round(s / 60)} min sedan`;
  if (s < 86400) return `${Math.round(s / 3600)} h sedan`;
  return new Date(t).toLocaleDateString("sv-SE");
};

// ── router ──
async function route() {
  closeStream();
  clearInterval(refreshTimer);
  const h = location.hash.slice(1) || "/";
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${h}`));
  try {
    state = await api("state");
    if (h === "/") return await projectsPage();
    if (h === "/new") return newPage();
    if (h === "/settings") return settingsPage();
    const m = h.match(/^\/p\/([^/]+)$/);
    if (m) return await projectPage(decodeURIComponent(m[1]));
    app.innerHTML = `<p class="pad">Sidan finns inte. <a href="#/">Till filmerna</a></p>`;
  } catch (e) {
    app.innerHTML = `<div class="panel"><h2>Något gick fel</h2><p class="bad">${esc(e.message)}</p><p><a href="#/">Till filmerna</a></p></div>`;
  }
}
window.addEventListener("hashchange", route);

// ── projects ──
function checksBanner() {
  const missing = state.checks.filter((c) => !c.ok);
  if (!missing.length) return "";
  return `<div class="panel banner small"><b>${missing.length} sak${missing.length > 1 ? "er" : ""} saknas</b> för att allt ska fungera: ${missing.map((c) => esc(c.label)).join(", ")}. <a href="#/settings">Se Inställningar</a></div>`;
}

async function projectsPage() {
  const list = await api("projects");
  const steps = (p) => {
    const on = [p.brief && !p.demo, p.scenes && p.narrated >= p.scenes, p.illustrated && p.images >= p.illustrated, p.renders.length > 0];
    return `<div class="steps" title="Manus · Röst · Bilder · Renderad">${on.map((x) => `<span class="${x ? "on" : ""}"></span>`).join("")}</div>`;
  };
  app.innerHTML = `
    <div class="stack">
      <div class="spread"><div><h1>Filmer</h1><p class="muted">${esc(state.config.filmsPath)}</p></div><a class="btn" href="#/new" style="background:var(--primary);color:#fff;border-color:var(--primary)">+ Ny film</a></div>
      ${checksBanner()}
      ${list.length ? `<div class="grid">${list.map((p) => `
        <a class="panel card" href="#/p/${encodeURIComponent(p.id)}">
          <div class="thumb" style="${p.thumb ? `background-image:linear-gradient(transparent 50%,rgba(0,0,0,.55)),url('${fileUrl(p.id, p.thumb)}')` : `background:linear-gradient(135deg,${esc(p.palette.band || "#0b3d5c")},${esc(p.palette.accent || "#1e9bd7")})`}">${esc(p.title)}</div>
          <div class="body">
            <div class="spread"><span class="small muted">${esc(p.profileName)} · ${modeName(p.mode)} · ${p.formats.join(" + ")}</span>
            ${p.running ? `<span class="badge run">${esc(p.running.title)} …</span>` : `<span class="badge ${p.stage.key === "done" ? "done" : "next"}">${p.stage.key === "done" ? "Klar" : "Nästa: " + esc(p.stage.label)}</span>`}</div>
            ${steps(p)}
            <div class="small muted" style="margin-top:6px">${p.scenes ? `${p.scenes} scener · ${p.seconds} s` : ""} · ändrad ${ago(p.modified)}</div>
          </div>
        </a>`).join("")}</div>`
      : `<div class="panel" style="text-align:center;padding:48px"><h2>Inga filmer än</h2><p class="muted">Börja med en kund, ett ämne och ett format, så tar Claude det därifrån.</p><a class="btn" href="#/new">+ Skapa din första film</a></div>`}
    </div>`;
  if (list.some((p) => p.running)) refreshTimer = setInterval(() => location.hash.slice(1) === "/" || !location.hash ? projectsPage() : null, 5000);
}

// ── new film ──
function newPage() {
  const profiles = state.profiles.filter((p) => !p.template || p.id === "_mall");
  app.innerHTML = `
    <form class="panel stack" id="newf" style="max-width:820px;margin:0 auto">
      <div><h1>Ny film</h1><p class="muted">Projektet skapas i ${esc(state.config.filmsPath)}, i kundens profil.</p></div>
      <div>
        <label>Titel</label><input type="text" name="title" required placeholder="Budgeten på en minut">
        <label>Kund <span class="hint">– profilen styr färger, typsnitt, logga, bildstil och röst</span></label>
        <select name="profile">${profiles.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.placeholder ? " (platshållare)" : ""}${p.template ? " – mall" : ""}</option>`).join("")}</select>
        <div class="small muted" id="profinfo" style="margin-top:6px"></div>
      </div>
      <div>
        <label>Typ</label>
        <div class="choice">
          <label><input type="radio" name="mode" value="klipp" checked><span><b>Klipp</b><span class="small muted">30–90 s, ett budskap: krok, 1–3 scener, slutkort med logga</span></span></label>
          <label><input type="radio" name="mode" value="film"><span><b>Film</b><span class="small muted">2–15 min i delar</span></span></label>
        </div>
        <label>Format</label>
        <div class="choice">
          <label><input type="checkbox" name="formats" value="16:9" checked><span><b>16:9 liggande</b><span class="small muted">webb, YouTube, presentationer</span></span></label>
          <label><input type="checkbox" name="formats" value="1:1" checked><span><b>1:1 kvadrat</b><span class="small muted">LinkedIn, Facebook</span></span></label>
          <label><input type="checkbox" name="formats" value="9:16"><span><b>9:16 stående</b><span class="small muted">Reels, Stories</span></span></label>
        </div>
      </div>
      <div>
        <h2>Brief</h2>
        <label>Ämne <span class="hint">– vad filmen handlar om</span></label><textarea name="topic" required placeholder="Hur kommunens budget fördelas och vad som ändras 2027"></textarea>
        <div class="two">
          <div><label>Målgrupp</label><input type="text" name="audience" placeholder="Medborgare, chefer, medarbetare …"></div>
          <div><label>Kanal</label><select name="channel"><option>LinkedIn</option><option>Webbplats</option><option>Intranät</option><option>Möte / presentation</option><option>YouTube</option><option>Annat</option></select></div>
          <div><label>Längd</label><select name="length" id="len"></select></div>
          <div><label>Syfte <span class="hint">– det tittaren ska ta med sig</span></label><input type="text" name="purpose"></div>
        </div>
        <label>Underlag <span class="hint">– länkar, siffror, källor, vad som måste med eller inte får sägas</span></label><textarea name="notes"></textarea>
      </div>
      <label class="row" style="font-weight:400"><input type="checkbox" name="startClaude" checked> Låt Claude börja direkt med research och manus (kostar inget extra utöver ditt Claude-abonnemang)</label>
      <div class="row"><button class="primary" type="submit">Skapa filmen</button><span class="muted small" id="newstatus"></span></div>
      <div id="newlog"></div>
    </form>`;
  const f = $("#newf");
  const lengths = () => {
    const klipp = f.mode.value === "klipp";
    $("#len").innerHTML = (klipp ? ["30 sekunder", "45 sekunder", "60 sekunder", "90 sekunder"] : ["3 minuter", "5 minuter", "8 minuter", "12 minuter"]).map((x, i) => `<option ${i === 2 - (klipp ? 0 : 1) ? "selected" : ""}>${x}</option>`).join("");
  };
  const prof = () => {
    const p = state.profiles.find((x) => x.id === f.profile.value);
    $("#profinfo").innerHTML = p ? `${swatch(p.palette)} ${p.placeholder ? `<span class="warn">Profilen har platshållare för färger och logga – fyll i den innan filmen ska ut.</span>` : esc(p.language || "")}` : "";
  };
  f.addEventListener("change", (e) => {
    if (e.target.name === "mode") lengths();
    if (e.target.name === "profile") prof();
  });
  lengths();
  prof();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const b = Object.fromEntries(fd.entries());
    b.formats = fd.getAll("formats");
    b.slug = b.title;
    b.startClaude = fd.has("startClaude");
    if (!b.formats.length) return toast("Välj minst ett format");
    f.querySelector("button[type=submit]").disabled = true;
    try {
      const { id, job } = await api("projects", { body: b });
      $("#newstatus").textContent = "Skapar projektet (installerar verktygen, ca en minut) …";
      watchJob(job.id, $("#newlog"), (status) => {
        if (status === "done") location.hash = `#/p/${encodeURIComponent(id)}`;
        else {
          $("#newstatus").textContent = "Det gick inte – se loggen.";
          f.querySelector("button[type=submit]").disabled = false;
        }
      });
    } catch (err) {
      toast(err.message);
      f.querySelector("button[type=submit]").disabled = false;
    }
  });
}

// ── one film ──
async function projectPage(id) {
  const p = await api(`projects/${encodeURIComponent(id)}`);
  const busy = Boolean(p.running);
  const dis = busy ? "disabled" : "";
  const main = p.formats[0];
  const narratedAll = p.scenes.length && p.scenes.every((s) => s.narrated);
  const illus = p.scenes.filter((s) => s.name !== "end-card");
  const imagesAll = illus.length && illus.every((s) => s.img);
  const n = (ok, i) => `<span class="step-n ${ok ? "ok" : ""}">${ok ? "✓" : i}</span>`;

  app.innerHTML = `
    <div class="stack">
      <div class="spread">
        <div><h1>${esc(p.title)}</h1>
          <div class="muted">${swatch(p.palette)} ${esc(p.profileName)} · ${modeName(p.mode)} · ${p.formats.join(" + ")} ${p.scenes.length ? `· ${p.scenes.length} scener · ${p.seconds} s` : ""}</div></div>
        <div class="row">
          <button data-studio ${p.studio ? 'class="primary"' : ""}>${p.studio ? "Öppna förhandsvisning" : "▶ Förhandsgranska"}</button>
          ${p.studio ? `<button data-studio-stop class="link">stäng</button>` : ""}
          <button data-reveal="">Visa i ${state.platform === "darwin" ? "Finder" : "mappen"}</button>
        </div>
      </div>
      <div class="cols">
        <div class="panel">
          <div class="section">
            <div class="step-h">${n(p.brief && !p.demo, 1)}<h2 style="margin:0">Brief och manus</h2></div>
            ${p.brief ? `<details><summary>Brief</summary><div class="log-md">${esc(p.brief)}</div></details>` : `<p class="warn">Ingen brief – skriv en i notes/brief.md eller be Claude nedan.</p>`}
            ${p.demo ? `<p class="small muted">Manuset är fortfarande mallens demo om skottår.</p>` : ""}
            <div class="row" style="margin-top:8px"><button data-preset="script" ${dis}>✦ Claude: research och manus</button></div>
            ${p.scenes.length ? `<table style="margin-top:12px"><tr><th>Scen</th><th>Titel</th><th>Tid</th><th>Röst</th><th>Bild</th></tr>
              ${p.scenes.map((s) => `<tr><td>${esc(s.id)}</td><td>${esc(s.title)}<div class="small muted">${esc(s.text.slice(0, 110))}${s.text.length > 110 ? "…" : ""}</div></td><td>${s.seconds}s</td><td>${s.narrated ? '<span class="ok">✓</span>' : '<span class="muted">–</span>'}</td><td>${s.name === "end-card" ? '<span class="muted small">logga</span>' : s.img ? '<span class="ok">✓</span>' : '<span class="muted">–</span>'}</td></tr>`).join("")}</table>` : ""}
          </div>

          <div class="section">
            <div class="step-h">${n(narratedAll, 2)}<h2 style="margin:0">Röst</h2></div>
            ${p.voice.id ? `<p class="small">Berättare: <b>${esc(p.voice.name || p.voice.id)}</b></p>
              <div class="row"><button data-act="narrate-dry" ${dis}>Vad kostar det?</button><span class="small muted">Visar vad som skulle debiteras, utan att något debiteras.</span></div>`
            : `<p class="small muted">Ingen berättarröst vald ännu. Gör tre provtagningar utifrån profilens röstbeskrivning (voice/design.json) och välj en.</p>
              <div class="row"><button class="pay" data-pay="voice-preview" data-what="Tre provtagningar av berättarrösten (ElevenLabs Voice Design, ca några hundra krediter)" ${dis}>Designa röst: 3 provtagningar</button></div>
              ${p.voice.previews.length ? `<div class="stack" style="margin-top:10px">${p.voice.previews.map((v) => `<div class="row"><span class="small" style="width:120px">${esc(v.tag)} · tagning ${v.take}</span><audio controls preload="none" src="${fileUrl(id, v.src)}" style="flex:1;min-width:180px"></audio><button data-pick="${esc(v.generated_voice_id)}" ${dis}>Välj</button></div>`).join("")}</div>` : ""}`}
            <div id="gate-narrate"></div>
            ${p.scenes.some((s) => s.audio) ? `<details style="margin-top:10px"><summary>Lyssna scen för scen</summary>${p.scenes.filter((s) => s.audio).map((s) => `<h3>${esc(s.id)} · ${esc(s.title)}</h3><audio controls preload="none" src="${fileUrl(id, s.audio)}"></audio><p class="small muted">${esc(s.text)}</p>`).join("")}</details>` : ""}
          </div>

          <div class="section">
            <div class="step-h">${n(imagesAll, 3)}<h2 style="margin:0">Bilder</h2></div>
            <p class="small muted">${p.shots} bildbeskrivningar i art/shots.json. Bilderna innehåller aldrig text; siffror och rubriker ritas i kod.</p>
            <div class="row"><button data-preset="shots" ${dis}>✦ Claude: bildprompter</button><button data-act="images-dry" ${dis}>Vad kostar det?</button></div>
            <div id="gate-images"></div>
            ${p.scenes.some((s) => s.img) ? `<div class="thumbs" style="margin-top:10px">${p.scenes.filter((s) => s.img).map((s) => `<figure><img loading="lazy" src="${fileUrl(id, s.img)}" alt=""><figcaption>${esc(s.id)} · ${esc(s.title)}</figcaption></figure>`).join("")}</div>` : ""}
          </div>

          <div class="section">
            <div class="step-h">${n(false, 4)}<h2 style="margin:0">Scener</h2></div>
            <div class="row"><button data-preset="scenes" ${dis}>✦ Claude: bygg scenerna</button><button data-preset="review" ${dis}>✦ Claude: granska</button></div>
            <div class="row" style="margin-top:8px">${p.formats.map((f) => `<button data-stills="${f}" ${dis}>Stillbilder ${f}</button>`).join("")}</div>
            ${p.formats.map((f) => (Object.keys(p.stills[f] || {}).length ? `<details ${f === main ? "open" : ""} style="margin-top:10px"><summary>Stillbilder ${f}</summary><div class="sheets stack" style="margin-top:8px">${Object.entries(p.stills[f]).map(([sid, st]) => `<figure style="margin:0"><figcaption class="small muted">${esc(sid)}</figcaption><img loading="lazy" src="${fileUrl(id, st.path, st.mtime)}" alt=""></figure>`).join("")}</div></details>` : "")).join("")}
          </div>

          <div class="section">
            <div class="step-h">${n(p.renders.length > 0, 5)}<h2 style="margin:0">Rendera och leverera</h2></div>
            <div class="row"><button class="primary" data-render="" ${dis}>Rendera ${p.formats.length > 1 ? "alla format" : main}</button>${p.formats.length > 1 ? p.formats.map((f) => `<button data-render="${f}" ${dis}>Bara ${f}</button>`).join("") : ""}<button data-reveal="out">Öppna leveransmappen</button></div>
            ${p.renders.length ? `<div class="stack" style="margin-top:12px">${p.renders.map((r) => `<div><div class="spread small"><b>${esc(r.name)}</b><span class="muted">${(r.size / 1e6).toFixed(1)} MB · ${ago(r.mtime)}</span></div><video controls preload="metadata" src="${fileUrl(id, "out/" + r.name, r.mtime)}"></video></div>`).join("")}</div>` : `<p class="small muted">Renderingen bygger tidslinjen, kontrollerar cues och normaliserar ljudet till −14 LUFS. Ett klipp tar några minuter.</p>`}
          </div>
        </div>

        <div class="stack">
          <div class="panel">
            <h2>✦ Be Claude</h2>
            <form id="ask"><textarea name="prompt" placeholder="T.ex. ”Gör scen 2 luftigare och byt rubriken till Så fördelas pengarna”" ${dis}></textarea>
              <div class="row" style="margin-top:8px"><button class="primary" ${dis}>Skicka</button>${p.claudeSession ? `<button type="button" class="link small" data-reset>Börja ett nytt samtal</button>` : ""}</div></form>
            ${p.claudeLast?.result ? `<details open style="margin-top:12px"><summary>Claudes senaste svar <span class="muted small">${ago(p.claudeLast.at)}</span></summary><div class="answer">${md(p.claudeLast.result)}</div></details>` : ""}
          </div>
          <div class="panel">
            <div class="spread"><h2>Aktivitet</h2>${busy ? `<button class="danger" data-stop="${p.running.id}">Avbryt</button>` : ""}</div>
            <div id="console" class="console">${busy ? "" : p.jobs.length ? "Välj ett jobb nedan för att se dess logg." : "Inget har körts ännu."}</div>
            ${p.jobs.length ? `<div class="small" style="margin-top:8px">${p.jobs.slice(0, 8).map((j) => `<div class="spread"><button class="link" data-job="${j.id}">${esc(j.title)}</button><span class="${j.status === "done" ? "ok" : j.status === "running" ? "warn" : "bad"}">${{ done: "klart", running: "körs", failed: "misslyckades", stopped: "avbrutet" }[j.status]} · ${ago(j.started)}</span></div>`).join("")}</div>` : ""}
          </div>
          <div class="panel"><details><summary>Produktionslogg (notes/log.md)</summary><div class="log-md">${esc(p.log)}</div></details></div>
        </div>
      </div>
    </div>`;

  const reload = () => projectPage(id).catch((e) => toast(e.message));
  const act = async (action, args = {}) => {
    try {
      const { job } = await api(`projects/${encodeURIComponent(id)}/action`, { body: { action, args } });
      await reload();
      return job;
    } catch (e) {
      toast(e.message);
    }
  };

  // a paid step: run the dry-run, show what it says, then ask for an explicit yes
  const gate = async (dry, real, box, what) => {
    const job = await act(dry);
    if (!job) return;
    watchJob(job.id, $("#console"), async (status) => {
      await reload();
      if (status !== "done") return;
      const j = await (await fetch(`/api/jobs/${job.id}/stream`)).text();
      const lines = j.split("\n\n").filter((x) => x.startsWith("data: ")).flatMap((x) => {
        const ev = JSON.parse(x.slice(6));
        return ev.type === "hello" ? ev.lines.map((l) => l.line) : [];
      }).filter((l) => !l.startsWith("▸"));
      const out = lines.join("\n");
      const nothing = /^0 (scenes|shots)/m.test(out);
      $(box).innerHTML = `<div class="gate"><b>${esc(what)}</b><pre>${esc(out)}</pre>${nothing ? `<span class="small muted">Inget att göra.</span>` : `<div class="row"><button class="pay" data-go>Godkänn och kör</button><button data-no>Avbryt</button></div>`}</div>`;
      $(`${box} [data-no]`)?.addEventListener("click", () => ($(box).innerHTML = ""));
      $(`${box} [data-go]`)?.addEventListener("click", () => act(real, { estimate: lines[0] }));
    });
  };

  app.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", async () => {
    try {
      await api(`projects/${encodeURIComponent(id)}/preset`, { body: { preset: b.dataset.preset } });
      reload();
    } catch (e) {
      toast(e.message);
    }
  }));
  app.querySelector("[data-act=narrate-dry]")?.addEventListener("click", () => gate("narrate-dry", "narrate", "#gate-narrate", "Berättarröst (ElevenLabs) – det här skulle debiteras:"));
  app.querySelector("[data-act=images-dry]")?.addEventListener("click", () => gate("images-dry", "images", "#gate-images", "Illustrationer (Gemini via OpenRouter, ca 0,14 USD per bild):"));
  app.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", async () => {
    if (await ask({ title: "Det kostar pengar", text: b.dataset.what, ok: "Godkänn och kör", pay: true })) act(b.dataset.pay, { estimate: b.dataset.what });
  }));
  app.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", async () => {
    const name = await ask({ title: "Spara rösten", text: "Namnet sparas i ElevenLabs och i projektet.", input: `${p.profileName || "Berättare"} – berättare`, ok: "Spara" });
    if (name) act("voice-create", { gid: b.dataset.pick, name });
  }));
  app.querySelectorAll("[data-stills]").forEach((b) => b.addEventListener("click", () => act("stills", { format: b.dataset.stills })));
  app.querySelectorAll("[data-render]").forEach((b) => b.addEventListener("click", () => act("render", b.dataset.render ? { format: b.dataset.render } : {})));
  app.querySelectorAll("[data-reveal]").forEach((b) => b.addEventListener("click", () => api(`projects/${encodeURIComponent(id)}/reveal`, { body: { sub: b.dataset.reveal } }).catch((e) => toast(e.message))));
  app.querySelector("[data-studio]")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Startar förhandsvisningen …";
    try {
      const { port } = await api(`projects/${encodeURIComponent(id)}/studio`, { body: {} });
      window.open(`http://localhost:${port}`, `studio-${id}`);
    } catch (err) {
      toast(err.message);
    }
    reload();
  });
  app.querySelector("[data-studio-stop]")?.addEventListener("click", () => api(`projects/${encodeURIComponent(id)}/studio`, { body: { stop: true } }).then(reload));
  app.querySelector("[data-stop]")?.addEventListener("click", (e) => api(`jobs/${e.target.dataset.stop}/stop`, { body: {} }).then(reload));
  app.querySelector("[data-reset]")?.addEventListener("click", () => api(`projects/${encodeURIComponent(id)}/claude-reset`, { body: {} }).then(reload));
  app.querySelectorAll("[data-job]").forEach((b) => b.addEventListener("click", () => watchJob(b.dataset.job, $("#console"))));
  $("#ask").addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = e.target.prompt.value.trim();
    if (!prompt) return;
    await act("claude", { prompt, title: `Claude: ${prompt.slice(0, 40)}${prompt.length > 40 ? "…" : ""}` });
  });
  if (busy) watchJob(p.running.id, $("#console"), () => reload());
}

/** Follow a job's log in a console element; done(status) when it ends. */
function watchJob(jobId, el, done) {
  closeStream();
  el.classList.add("console");
  el.innerHTML = "";
  const add = (l) => {
    const d = document.createElement("div");
    d.className = l.kind === "step" ? "step" : l.kind === "err" ? "err" : l.line.startsWith("💬") ? "say" : "";
    d.textContent = l.line;
    const stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    el.appendChild(d);
    if (stick) el.scrollTop = el.scrollHeight;
  };
  stream = new EventSource(`/api/jobs/${jobId}/stream`);
  stream.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === "hello") ev.lines.forEach(add);
    if (ev.type === "line") add(ev);
    if (ev.type === "end") {
      add({ kind: ev.status === "done" ? "step" : "err", line: ev.status === "done" ? "✓ klart" : `✗ ${ev.status}` });
      closeStream();
      done?.(ev.status);
    }
  };
  stream.onerror = () => closeStream();
}

function closeStream() {
  stream?.close();
  stream = null;
}

// ── settings ──
function settingsPage() {
  const c = state.config;
  app.innerHTML = `
    <div class="stack" style="max-width:820px;margin:0 auto">
      <h1>Inställningar</h1>
      <div class="panel">
        <div class="spread"><h2>Det här behövs</h2><button class="link small" data-recheck>Kontrollera igen</button></div>
        <ul class="checks">${state.checks.map((x) => `<li><span class="${x.ok ? "ok" : "bad"}">${x.ok ? "✓" : "✗"}</span> <b>${esc(x.label)}</b> <span class="muted small">${x.ok ? esc(x.value || "") + (x.where ? ` · ${esc(x.where)}` : "") : "– " + esc(x.fix)}</span></li>`).join("")}</ul>
      </div>
      <form class="panel" id="setf">
        <h2>Mappar</h2>
        <label>Filmer <span class="hint">– där projekten skapas</span></label><input type="text" name="filmsDir" value="${esc(c.filmsDir)}">
        <label>Egna kundprofiler <span class="hint">– valfritt, t.ex. en privat mapp eller ett privat repo (INFOFILM_PROFILES)</span></label><input type="text" name="profilesDir" value="${esc(c.profilesDir)}" placeholder="~/Kundprofiler">
        <h2 style="margin-top:20px">API-nycklar</h2>
        <p class="small muted">Sparas bara på den här datorn, i ~/.infofilm/secrets.json (läsbar endast för dig). Lämna tomt för att behålla.</p>
        <label>ElevenLabs <span class="hint">– berättarröst · ${esc(state.keys.ELEVENLABS_API_KEY || "saknas")}</span></label><input type="password" name="ELEVENLABS_API_KEY" autocomplete="off">
        <label>OpenRouter <span class="hint">– illustrationer (Gemini) · ${esc(state.keys.OPENROUTER_API_KEY || "saknas")}</span></label><input type="password" name="OPENROUTER_API_KEY" autocomplete="off">
        <details style="margin-top:14px"><summary>Avancerat</summary>
          <label>Webbläsare för stillbilder <span class="hint">– lämna tomt (Remotion hämtar sin egen)</span></label><input type="text" name="browserExecutable" value="${esc(c.browserExecutable)}">
          <p class="small muted">Skillen: ${esc(c.skillDir)}</p>
          <p class="small muted" style="word-break:break-all">Sökväg för verktygen (PATH): ${esc(state.path || "")}</p>
        </details>
        <div class="row" style="margin-top:16px"><button class="primary">Spara</button><button type="button" class="danger" data-quit>Avsluta appen</button></div>
      </form>
      <div class="panel small"><h2>Kundprofiler</h2>${state.profiles.map((p) => `<div class="spread" style="padding:4px 0"><span>${swatch(p.palette)} <b>${esc(p.name)}</b> <span class="muted">${esc(p.id)}</span></span>${p.placeholder ? '<span class="warn">platshållare</span>' : ""}</div>`).join("")}
        <p class="muted" style="margin-top:10px">Ny kund: be Claude i en film, eller kör <code>scripts/new_profile.sh</code>. Profilredigering i appen kommer i nästa version.</p></div>
    </div>`;
  $("[data-recheck]").addEventListener("click", async () => {
    state = await api("state?recheck=1");
    settingsPage();
  });
  $("[data-quit]").addEventListener("click", async () => {
    if (!(await ask({ title: "Avsluta Infofilm?", text: "Pågående jobb avbryts.", ok: "Avsluta" }))) return;
    await api("quit", { body: {} }).catch(() => {});
    app.innerHTML = `<div class="panel pad"><h2>Infofilm är avslutad</h2><p class="muted">Starta igen från Dock.</p></div>`;
  });
  $("#setf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const keys = {};
    for (const k of ["ELEVENLABS_API_KEY", "OPENROUTER_API_KEY"]) if (fd[k]) keys[k] = fd[k];
    try {
      await api("settings", { body: { filmsDir: fd.filmsDir, profilesDir: fd.profilesDir, browserExecutable: fd.browserExecutable, keys } });
      toast("Sparat");
      route();
    } catch (err) {
      toast(err.message);
    }
  });
}

route();
