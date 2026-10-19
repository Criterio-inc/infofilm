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
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${h}` || (a.dataset.nav === "kunder" && h.startsWith("/kund"))));
  try {
    state = await api("state");
    if (h === "/") return await projectsPage();
    if (h === "/new") return newPage();
    if (h === "/settings") return settingsPage();
    if (h === "/kunder") return await customersPage();
    const k = h.match(/^\/kund\/([^/]+)$/);
    if (k) return await customerPage(decodeURIComponent(k[1]));
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
        <label>Designsystem <span class="hint">– valfritt: länkar för just den här filmen, utöver kundens (en per rad). Claude läser dem före manus, bildprompter och scener.</span></label><textarea name="designSystems" rows="2" placeholder="https://claude.ai/…"></textarea>
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
    const ds = p?.designSystems ? ` · ${p.designSystems === 1 ? "ett länkat designsystem" : `${p.designSystems} länkade designsystem`}` : "";
    $("#profinfo").innerHTML = p ? `${swatch(p.palette)} ${p.placeholder ? `<span class="warn">Profilen har platshållare för färger och logga – fyll i den innan filmen ska ut.</span>` : esc(p.language || "")}${ds}` : "";
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
            <details style="margin-top:10px" ${p.voice.id ? "" : "open"}><summary>Röstinställningar</summary>
              <form id="voicef" class="stack" style="margin-top:8px">
                <div><label>Beskrivning av berättaren <span class="hint">– på engelska: kön, ålder, klang, tempo, dialekt, tonläge</span></label>
                  <textarea name="description" rows="4">${esc(p.voice.design.description || "")}</textarea></div>
                <div><label>Provtext <span class="hint">– på filmens språk och i dess ton, läses i provtagningarna</span></label>
                  <textarea name="text" rows="3">${esc(p.voice.design.text || "")}</textarea></div>
                <div class="two"><div><label>… eller en färdig röst: Voice ID <span class="hint">– från ElevenLabs</span></label><input type="text" name="voice_id" value="${esc(p.voice.id || "")}" placeholder="t.ex. 21m00Tcm4TlvDq8ikWAM"></div>
                  <div><label>Namn</label><input type="text" name="name" value="${esc(p.voice.name || "")}" placeholder="Berättare"></div></div>
                <div class="row"><button class="primary" ${dis}>Spara rösten</button>${p.voice.id ? `<button type="button" data-voice-profile ${dis}>Spara som ${esc(p.profileName || "kundens")} standardröst</button>` : ""}</div>
              </form>
            </details>
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
  $("#voicef")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`projects/${encodeURIComponent(id)}/voice`, { body: fd });
      toast(fd.voice_id ? "Rösten är sparad" : "Röstbeskrivningen är sparad");
      reload();
    } catch (err) {
      toast(err.message);
    }
  });
  app.querySelector("[data-voice-profile]")?.addEventListener("click", async () => {
    if (!(await ask({ title: "Spara som kundens standardröst?", text: `Kommande filmer för ${p.profileName} får samma berättare, utan ny röstdesign.`, ok: "Spara" }))) return;
    try {
      await api(`projects/${encodeURIComponent(id)}/voice-to-profile`, { body: {} });
      toast("Sparad i kundprofilen");
    } catch (err) {
      toast(err.message);
    }
  });
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

// ── clients (profiles) ──
const pfileUrl = (id, rel, v) => `/pfiles/${encodeURIComponent(id)}/${rel.split("/").map(encodeURIComponent).join("/")}${v ? `?v=${Math.round(v)}` : ""}`;

// every colour role, in the order the editor shows them, with what it is for
const ROLES = [
  ["band", "Titel- och textband"], ["bandText", "Text i banden"], ["kicker", "Liten etikett i titelbandet"],
  ["primary", "Huvudfärg: etiketter, ▲ ▼, viktiga former"], ["accent", "Accent"], ["accentDark", "Mörkare accent"], ["highlight", "Framhävning"],
  ["signal", "Signal (sparsamt)"], ["positive", "Neutralt ”ja”"], ["ink", "Linjer och huvudtext"],
  ["surfaceLight", "Plattor (ljusast)"], ["surface", "Kortet"], ["surfaceDark", "Mörkare yta"],
  ["backdrop", "Bakgrunden bakom kortet"], ["backdropLight", "Bakgrund, ljusare del"], ["dim", "Bilden tonas mot (under plattor)"],
];

async function customersPage() {
  const { root, profiles } = await api("profiles");
  app.innerHTML = `
    <div class="stack">
      <div class="spread"><div><h1>Kunder</h1><p class="muted">En profil per kund: färger, typsnitt, logga, bildstil, röst och tonalitet. Egna profiler sparas i ${esc(root)}.</p></div></div>
      <form class="panel row" id="newk"><input type="text" name="name" placeholder="Ny kund, t.ex. Borås Stad" style="flex:1;min-width:220px" required><button class="primary">+ Skapa kundprofil</button></form>
      <div id="newklog"></div>
      <div class="grid">${profiles.map((p) => `
        <a class="panel card" href="#/kund/${encodeURIComponent(p.id)}">
          <div class="thumb" style="background:linear-gradient(135deg,${esc(p.palette.band || "#0b3d5c")},${esc(p.palette.accent || "#1e9bd7")})">${esc(p.name)}</div>
          <div class="body"><div class="spread"><span>${swatch(p.palette)}</span>
            <span class="badge ${p.placeholder ? "run" : p.own ? "done" : ""}">${p.placeholder ? "platshållare" : p.template ? "mall" : p.own ? "egen" : "inbyggd"}</span></div>
            <div class="small muted" style="margin-top:6px">${esc(p.id)} · ${esc(p.language || "")}${p.running ? ` · ${esc(p.running.title)} …` : ""}</div></div>
        </a>`).join("")}</div>
    </div>`;
  $("#newk").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const { id, job } = await api("profiles", { body: { name: e.target.name.value } });
      watchJob(job.id, $("#newklog"), (st) => (st === "done" ? (location.hash = `#/kund/${encodeURIComponent(id)}`) : toast("Det gick inte, se loggen")));
    } catch (err) {
      toast(err.message);
    }
  });
}

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

async function customerPage(id) {
  const k = await api(`profiles/${encodeURIComponent(id)}`);
  const P = k.profile;
  const pal = P.palette || {};
  const F = P.fonts || {};
  const busy = Boolean(k.running);
  const dis = busy ? "disabled" : "";
  const sel = (name, value, opts) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(value) === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : "#000000");
  const fontFiles = (role) => (F[role]?.files || []).map((f) => f.file);
  const logoUrl = P.logo?.file ? pfileUrl(id, P.logo.file, Date.now()) : null;
  const DS = (P.designSystems || []).map((d) => (typeof d === "string" ? { url: d } : d));

  app.innerHTML = `
    <div class="stack">
      <div class="spread">
        <div><h1>${esc(P.name || id)}</h1><div class="muted">${swatch({ band: pal.band, primary: pal.primary, accent: pal.accent, surface: pal.surfaceLight, backdrop: pal.backdrop })} ${esc(id)} · ${k.own ? "egen profil" : "inbyggd – sparas som egen kopia när du ändrar"}</div></div>
        <div class="row"><a class="btn" href="#/kunder">← Kunder</a><a class="btn" href="#/new">+ Ny film</a></div>
      </div>
      ${/PLACEHOLDER/i.test(P._doc || "") ? `<div class="panel banner small"><b>Platshållare.</b> Färger, typsnitt och logga är inte kundens egna än. Ladda upp kundens material nedan och låt Claude bygga profilen, eller fyll i själv.</div>` : ""}
      <div class="cols">
        <form class="panel" id="kf">
          <div class="section">
            <h2>1 · Kundens material</h2>
            <p class="small muted">Grafisk manual (PDF), loggor, typsnitt, exempelbilder, presentationer – det Claude ska bygga profilen av. Sparas bara på den här datorn.</p>
            <div class="drop" id="drop">Släpp filer här eller <label class="link" style="display:inline;margin:0;font-weight:600;cursor:pointer">välj filer<input type="file" id="mat" multiple hidden></label></div>
            ${k.material.length ? `<table style="margin-top:8px">${k.material.map((m) => `<tr><td>${/\.(png|jpe?g|svg|gif|webp)$/i.test(m.name) ? `<img src="${pfileUrl(id, m.path)}" style="height:28px;vertical-align:middle;margin-right:8px;border-radius:4px">` : "📄 "}${esc(m.name)}</td><td class="muted small">${m.size < 1e6 ? `${Math.max(1, Math.round(m.size / 1e3))} kB` : `${(m.size / 1e6).toFixed(1)} MB`}</td><td><button type="button" class="link danger small" data-rm="${esc(m.path)}">ta bort</button></td></tr>`).join("")}</table>` : ""}
            <label>Länkar <span class="hint">– kundens webbplats, grafisk profil online, exempel (en per rad)</span></label>
            <textarea name="links" rows="2" placeholder="https://www.exempel.se">${esc(k.links)}</textarea>
            <label>Designsystem <span class="hint">– länkar till kundens designsystem i Claude Design eller på webben (en per rad). Claude läser dem när profilen byggs och före varje manus, bildprompt och scen. En claude.ai-länk synkas från Claude Code, som sparar en ögonblicksbild i profilen.</span></label>
            <textarea name="design_systems" rows="2" placeholder="https://claude.ai/…">${esc(DS.map((d) => d.url).join("\n"))}</textarea>
            ${DS.length ? `<div class="small muted">${DS.map((d) => `${esc(d.name || d.url)}: ${d.syncedAt ? `synkat ${esc(d.syncedAt)}` : "inte synkat än"}`).join("<br>")}</div>` : ""}
          </div>

          <div class="section">
            <h2>2 · Logga och typsnitt</h2>
            <div class="row">
              <div class="logo-prev" style="background:${esc(pal.band || "#0b3d5c")}">${logoUrl ? `<img src="${logoUrl}" alt="">` : `<span class="small" style="color:${esc(pal.bandText || "#fff")}">ingen logga</span>`}</div>
              <label class="btn" style="margin:0">Byt logga (SVG/PNG)<input type="file" id="logo" accept=".svg,.png" hidden></label>
              <span class="small muted">Loggan står på bandfärgen – välj varianten för den bakgrunden.</span>
            </div>
            <div class="two">
              <div><label>Rubriktypsnitt</label><input type="text" name="f_display" value="${esc(F.display?.family || "")}"></div>
              <div><label>Brödtext</label><input type="text" name="f_ui" value="${esc(F.ui?.family || "")}"></div>
              <div><label>Rubrikvikt</label>${sel("f_weight", (F.display?.weights || [F.display?.weight || 700])[0], [["400", "400 normal"], ["500", "500"], ["600", "600"], ["700", "700 fet"], ["800", "800"], ["900", "900 svart"]])}</div>
              <div><label>Källa</label>${sel("f_source", F.display?.google === false || F.display?.files ? "files" : "google", [["google", "Google Fonts (hämtas automatiskt)"], ["files", "Egna typsnittsfiler"]])}</div>
            </div>
            <label class="row" style="font-weight:400"><input type="checkbox" name="f_upper" ${F.display?.uppercase ? "checked" : ""}> Rubriker i versaler</label>
            <div class="row" style="margin-top:6px"><label class="btn" style="margin:0">Ladda upp typsnittsfiler<input type="file" id="fontf" accept=".woff2,.woff,.ttf,.otf" multiple hidden></label>
              <span class="small muted">${k.fonts.length ? k.fonts.map((f) => esc(f.name)).join(", ") : "inga egna filer"}${fontFiles("display").length ? " · kopplade av Claude/profilen" : ""}</span></div>
          </div>

          <div class="section">
            <h2>3 · Färger</h2>
            <div class="colors">${ROLES.map(([r, label]) => `<label class="color"><input type="color" name="c_${r}" value="${hex(pal[r])}"><span><b>${esc(label)}</b><code>${esc(pal[r] || "")}</code></span></label>`).join("")}</div>
          </div>

          <div class="section">
            <h2>4 · Form och rörelse</h2>
            <div class="two">
              <div><label>Rörelse</label>${sel("motion", P.motion || "slide", [["slide", "Lugn glidning (de flesta kunder)"], ["deal", "Kort som delas ut (journalfilm)"]])}</div>
              <div><label>Bakgrund</label>${sel("backdrop", P.backdrop || "plain", [["plain", "Enkel gradient"], ["starbursts", "Stjärnor (journalfilm)"]])}</div>
              <div><label>Utan bild</label>${sel("ground", P.ground || "soft", [["soft", "Mjuka cirklar i profilens färger"], ["starburst", "Solfjäder (journalfilm)"]])}</div>
              <div><label>Kortets hörn</label>${sel("radius", String(P.card?.radius ?? 14), [["0", "Raka"], ["2", "Nästan raka"], ["8", "Lätt rundade"], ["14", "Rundade"], ["26", "Mycket rundade"]])}</div>
              <div><label>Kantlinje</label>${sel("border", String(P.card?.border ?? 0), [["0", "Ingen"], ["2", "Tunn"], ["5", "Tjock (journalfilm)"]])}</div>
              <div><label>Filmkorn</label>${sel("filmLook", String(Boolean(P.filmLook)), [["false", "Av"], ["true", "På (gammal film)"]])}</div>
              <div><label>Kicker <span class="hint">– liten text i titelbandet</span></label><input type="text" name="kicker" value="${esc(P.kicker || "")}"></div>
              <div><label>Namn</label><input type="text" name="name" value="${esc(P.name || "")}"></div>
              <div><label>Slutkortets rad</label><input type="text" name="end_line" value="${esc(P.endCard?.line || "")}"></div>
              <div><label>Slutkortets adress</label><input type="text" name="end_url" value="${esc(P.endCard?.url || "")}"></div>
              <div><label>Språk</label>${sel("lang", P.language === "en" ? "en" : "sv", [["sv", "Svenska (sv-SE)"], ["en", "Engelska (en-GB)"]])}</div>
              <div><label>Standardformat</label><div class="row">${["16:9", "1:1", "9:16"].map((f) => `<label class="row" style="margin:0;font-weight:400"><input type="checkbox" name="fmt" value="${f}" ${(P.formats || ["16:9", "1:1"]).includes(f) ? "checked" : ""}> ${f}</label>`).join("")}</div></div>
            </div>
          </div>

          <div class="section">
            <h2>5 · Bildstil</h2>
            <label>Så ska illustrationerna se ut <span class="hint">– på engelska, läggs till i varje bildprompt</span></label>
            <textarea name="ink" rows="4">${esc(k.style.ink || "")}</textarea>
            <label>Aldrig i bilderna</label>
            <textarea name="never" rows="2">${esc(k.style.never || "")}</textarea>
          </div>

          <div class="section">
            <h2>6 · Röst</h2>
            <label>Beskrivning av berättaren <span class="hint">– på engelska</span></label>
            <textarea name="v_description" rows="3">${esc(k.design.description || "")}</textarea>
            <label>Provtext</label>
            <textarea name="v_text" rows="2">${esc(k.design.text || "")}</textarea>
            <div class="two"><div><label>Färdig röst: Voice ID <span class="hint">– kundens standardröst</span></label><input type="text" name="v_id" value="${esc(k.voice?.voice_id || "")}"></div>
              <div><label>Röstens namn</label><input type="text" name="v_name" value="${esc(k.voice?.name || "")}"></div></div>
          </div>

          <div class="section">
            <h2>7 · Tonalitet och regler</h2>
            <p class="small muted">NOTES.md – Claude läser den före varje manus och bildprompt.</p>
            <textarea name="notes" rows="12" class="mono">${esc(k.notes)}</textarea>
          </div>
          <div class="savebar"><button class="primary" ${dis}>Spara profilen</button><span class="small muted">Testbilderna visar hur det blir.</span></div>
        </form>

        <div class="stack">
          <div class="panel">
            <h2>✦ Claude</h2>
            <p class="small muted">Claude läser materialet och fyller i färger, typsnitt, logga, bildstil, röst och tonalitet. Det som inte framgår skriver Claude som frågor till dig.</p>
            <div class="row"><button class="primary" data-build ${dis}>✦ Bygg profilen från materialet</button>${DS.length ? `<button data-sync ${dis}>✦ Synka designsystemet</button>` : ""}</div>
            <form id="kask" style="margin-top:12px"><textarea name="prompt" placeholder="T.ex. ”Använd den mörkgröna varianten av loggan” eller ”Gör bildstilen mer fotografisk”" ${dis}></textarea>
              <div class="row" style="margin-top:8px"><button ${dis}>Skicka</button>${k.claudeSession ? `<button type="button" class="link small" data-kreset>Nytt samtal</button>` : ""}</div></form>
            ${k.claudeLast?.result ? `<details open style="margin-top:12px"><summary>Claudes senaste svar <span class="muted small">${ago(k.claudeLast.at)}</span></summary><div class="answer">${md(k.claudeLast.result)}</div></details>` : ""}
          </div>
          <div class="panel">
            <div class="spread"><h2>Testbilder</h2><button data-preview ${dis}>Rendera testbilder</button></div>
            <p class="small muted">Demon om skottår i profilen, i ${(P.formats || ["16:9", "1:1"]).join(" och ")}. Första gången tar det någon minut.</p>
            ${Object.entries(k.stills).map(([f, list]) => (list.length ? `<h3>${f}</h3><div class="sheets stack">${list.map((st) => `<img loading="lazy" src="${pfileUrl(id, "preview/" + st.path, st.mtime)}" alt="">`).join("")}</div>` : "")).join("")}
          </div>
          <div class="panel">
            <div class="spread"><h2>Aktivitet</h2>${busy ? `<button class="danger" data-stop="${k.running.id}">Avbryt</button>` : ""}</div>
            <div id="console" class="console">${busy ? "" : k.jobs.length ? "Välj ett jobb nedan för att se dess logg." : "Inget har körts ännu."}</div>
            ${k.jobs.length ? `<div class="small" style="margin-top:8px">${k.jobs.slice(0, 6).map((j) => `<div class="spread"><button class="link" data-job="${j.id}">${esc(j.title)}</button><span class="${j.status === "done" ? "ok" : j.status === "running" ? "warn" : "bad"}">${{ done: "klart", running: "körs", failed: "misslyckades", stopped: "avbrutet" }[j.status]} · ${ago(j.started)}</span></div>`).join("")}</div>` : ""}
          </div>
        </div>
      </div>
    </div>`;

  const reload = () => customerPage(id).catch((e) => toast(e.message));
  const base = `profiles/${encodeURIComponent(id)}`;
  const send = async (files, kind) => {
    for (const file of files) {
      if (file.size > 60e6) {
        toast(`${file.name} är för stor (högst 60 MB)`);
        continue;
      }
      toast(`Laddar upp ${file.name} …`);
      try {
        await api(`${base}/upload`, { body: { kind, name: file.name, data: await fileToBase64(file) } });
      } catch (e) {
        toast(e.message);
      }
    }
    reload();
  };
  $("#mat").addEventListener("change", (e) => send([...e.target.files], "material"));
  $("#logo").addEventListener("change", (e) => send([...e.target.files], "logo"));
  $("#fontf").addEventListener("change", (e) => send([...e.target.files], "font"));
  const drop = $("#drop");
  drop.addEventListener("dragover", (e) => (e.preventDefault(), drop.classList.add("over")));
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    send([...e.dataTransfer.files], "material");
  });
  app.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", async () => {
    if (await ask({ title: "Ta bort filen?", text: b.dataset.rm, ok: "Ta bort" })) api(`${base}/remove`, { body: { path: b.dataset.rm } }).then(reload, (e) => toast(e.message));
  }));

  $("#kf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData(f);
    const v = (n) => String(fd.get(n) ?? "");
    const palette = Object.fromEntries(ROLES.map(([r]) => [r, v(`c_${r}`)]));
    const weight = Number(v("f_weight"));
    const google = v("f_source") === "google";
    const fonts = {
      display: { family: v("f_display"), uppercase: fd.has("f_upper"), ...(google ? { google: true, weights: [weight] } : { google: false, weight }) },
      ui: { family: v("f_ui"), ...(google ? { google: true, weights: [400, 600, 700] } : { google: false }) },
    };
    // script falls back to display when not set; keep a client's display font for slogans too
    if (!F.script || F.script.family === F.display?.family) fonts.script = { ...fonts.display };
    const sv = v("lang") === "sv";
    const body = {
      profile: {
        name: v("name"), kicker: v("kicker"), language: sv ? "sv" : "en", locale: sv ? "sv-SE" : "en-GB",
        formats: fd.getAll("fmt"), motion: v("motion"), backdrop: v("backdrop"), ground: v("ground"), filmLook: v("filmLook") === "true",
        palette, fonts, card: { radius: Number(v("radius")), border: Number(v("border")) }, endCard: { line: v("end_line"), url: v("end_url") },
        designSystems: v("design_systems"),
      },
      style: { ink: v("ink"), never: v("never") },
      design: { description: v("v_description"), text: v("v_text") },
      voice: v("v_id").trim() ? { voice_id: v("v_id").trim(), name: v("v_name") || "Berättare" } : null,
      notes: v("notes"),
      links: v("links"),
    };
    if (!body.profile.formats.length) return toast("Välj minst ett standardformat");
    try {
      const r = await api(`${base}/save`, { body });
      toast(r.job ? "Sparat – hämtar typsnitten" : "Sparat");
      if (id !== "_mall" && !k.own) toast("Sparat som egen kopia i dina kundprofiler");
      reload();
    } catch (err) {
      toast(err.message);
    }
  });

  const claude = async (b) => {
    try {
      await api(`${base}/claude`, { body: b });
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  app.querySelector("[data-build]")?.addEventListener("click", () => {
    if (!k.material.length && !k.links.trim() && !DS.length) return toast("Ladda upp kundens material eller skriv en länk först");
    claude({ preset: "build" });
  });
  app.querySelector("[data-sync]")?.addEventListener("click", () => claude({ preset: "sync" }));
  $("#kask").addEventListener("submit", (e) => {
    e.preventDefault();
    const prompt = e.target.prompt.value.trim();
    if (prompt) claude({ prompt });
  });
  app.querySelector("[data-kreset]")?.addEventListener("click", () => api(`${base}/claude-reset`, { body: {} }).then(reload));
  app.querySelector("[data-preview]")?.addEventListener("click", () => api(`${base}/preview`, { body: {} }).then(reload, (e) => toast(e.message)));
  app.querySelector("[data-stop]")?.addEventListener("click", (e) => api(`jobs/${e.target.dataset.stop}/stop`, { body: {} }).then(reload));
  app.querySelectorAll("[data-job]").forEach((b) => b.addEventListener("click", () => watchJob(b.dataset.job, $("#console"))));
  if (busy) watchJob(k.running.id, $("#console"), () => reload());
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
