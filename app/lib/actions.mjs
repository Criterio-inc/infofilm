// What the buttons do: each action is a job of one or more steps in the project folder.
// Paid steps (voice, images) only run after the page has shown the dry-run and the user approved;
// the approval and the estimate go into notes/log.md, as the skill requires.
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { SKILL_DIR, toolEnv } from "./config.mjs";
import { runningJob, startJob } from "./jobs.mjs";
import { toTrash } from "./trash.mjs";
import { designLinks, logLine, profileDir, projectDir, saveApp, writeBrief } from "./projects.mjs";
import { claudeStep } from "./claude.mjs";
import { loadConfig } from "./config.mjs";

const py = (dir, label, ...args) => ({ label, cmd: "python3", args, cwd: dir });
const build = (dir, format) => ({ ...py(dir, format ? `Tidslinje (${format})` : "Tidslinje", "tools/build_timeline.py"), env: format ? { FORMAT: format } : {} });

function comps(dir) {
  const tl = JSON.parse(readFileSync(path.join(dir, "video/src/timeline/master.json"), "utf8"));
  return tl.scenes.map((s) => `${s.id}-${s.name}`);
}

export function runAction(id, action, args = {}) {
  const dir = projectDir(id);
  // nothing is written or logged while another job runs in the film (it would be refused anyway)
  const busy = runningJob(id);
  if (busy) throw Object.assign(new Error(`"${busy.title}" körs redan i det här projektet`), { status: 409 });
  const film = JSON.parse(readFileSync(path.join(dir, "film.json"), "utf8"));
  const main = (film.formats || ["16:9"])[0];
  const est = args.estimate ? ` (uppskattat: ${String(args.estimate).slice(0, 200)})` : "";

  switch (action) {
    case "build":
      return startJob(id, "Bygg tidslinjen", [build(dir)]);

    case "stills": {
      const fmt = args.format || main;
      if (!(film.formats || ["16:9"]).includes(fmt)) throw Object.assign(new Error(`formatet ${fmt} finns inte i filmen`), { status: 400 });
      const steps = [build(dir, fmt), {
        label: `Stillbilder ${fmt}`,
        cmd: "node",
        // the scene list is read when the step starts, after the timeline has been rebuilt
        args: () => ["tools/review.mjs", String(args.frames || 6), ...comps(dir)],
        cwd: path.join(dir, "video"),
        env: { STILLS_DIR: path.join(dir, "out", `stills-${fmt.replace(":", "x")}`) },
        parse: (l) => (/Detected differing memory|Memory reported|docker run|lower amount/.test(l) ? null : l.replace(dir + "/", "")),
      }];
      if (fmt !== main) steps.push(build(dir));
      return startJob(id, `Stillbilder ${fmt}`, steps);
    }

    case "render": {
      const fmts = args.format ? [args.format] : [];
      return startJob(id, args.format ? `Rendera ${args.format}` : "Rendera alla format", [
        { label: "render.sh", cmd: "bash", args: ["tools/render.sh", ...fmts], cwd: dir, parse: (l) => (/Detected differing memory|Memory reported|docker run|lower amount/.test(l) ? null : l) },
      ], { onDone: (j) => j.status === "done" && logLine(id, `renderad i appen: ${fmts.join(", ") || (film.formats || ["16:9"]).join(", ")}`) });
    }

    case "narrate-dry":
      return startJob(id, "Röst: vad kostar det?", [py(dir, "narrate.py --dry-run", "voice/narrate.py", "--dry-run")]);

    case "narrate":
      logLine(id, `godkänt i appen: berättarröst${est}`);
      return startJob(id, "Röst: läs in", [py(dir, "narrate.py", "voice/narrate.py"), build(dir)], {
        onDone: (j) => {
          const used = j.lines.map((l) => l.line).find((l) => /^credits used/.test(l));
          logLine(id, `röst ${j.status === "done" ? "klar" : "avbruten"}${used ? ": " + used : ""}`);
        },
      });

    case "images-dry":
      return startJob(id, "Bilder: vad kostar det?", [py(dir, "gen.py --dry-run", "art/gen.py", "--dry-run")]);

    case "images":
      if ((args.ids || []).some((x) => !/^film-[A-Za-z0-9_-]+$/.test(String(x)))) throw Object.assign(new Error("ogiltig bild"), { status: 400 });
      logLine(id, `godkänt i appen: illustrationer${est}`);
      return startJob(id, "Bilder: generera", [py(dir, "gen.py", "art/gen.py", ...(args.ids || [])), py(dir, "Till videon", "tools/sync_art.py"), build(dir)], {
        onDone: (j) => {
          const done = j.lines.map((l) => l.line).find((l) => /^done, \$/.test(l));
          logLine(id, `bilder ${j.status === "done" ? "klara" : "avbrutna"}${done ? ": " + done.split(" — ")[0] : ""}`);
        },
      });

    case "voice-preview": {
      const tag = `v${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
      logLine(id, `godkänt i appen: röstdesign, 3 provtagningar (${tag})`);
      return startJob(id, "Röst: tre provtagningar", [py(dir, "design_voice.py preview", "voice/design_voice.py", "preview", tag)]);
    }

    case "voice-create": {
      if (!/^[A-Za-z0-9_-]+$/.test(args.gid || "")) throw Object.assign(new Error("ogiltig röst"), { status: 400 });
      const name = String(args.name || film.title || "narrator").slice(0, 60);
      return startJob(id, "Röst: spara vald röst", [py(dir, "design_voice.py create", "voice/design_voice.py", "create", args.gid, name)], {
        onDone: (j) => j.status === "done" && logLine(id, `röst vald i appen: ${name} (${args.gid})`),
      });
    }

    case "music": {
      // the background loop for the whole film: a key from music/cuts.json, or "" for none
      const key = String(args.key || "");
      const cf = path.join(dir, "music/cuts.json");
      const cuts = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : {};
      if (key && !(key in cuts && existsSync(path.join(dir, "music", cuts[key].file)))) {
        // a loop the client got after this film was made: copy it in from the profile
        const pm = path.join(profileDir(film.profile), "music");
        const pcf = path.join(pm, "cuts.json");
        const pc = existsSync(pcf) ? JSON.parse(readFileSync(pcf, "utf8"))[key] : null;
        if (!pc?.file || !existsSync(path.join(pm, path.basename(pc.file)))) throw Object.assign(new Error("den slingan finns inte hos avsändaren"), { status: 400 });
        mkdirSync(path.join(dir, "music/suno"), { recursive: true });
        copyFileSync(path.join(pm, path.basename(pc.file)), path.join(dir, "music/suno", path.basename(pc.file)));
        cuts[key] = { ...pc, file: `suno/${path.basename(pc.file)}` };
        writeFileSync(cf, JSON.stringify(cuts, null, 2) + "\n");
      }
      film.parts = Object.fromEntries(Object.entries(film.parts || {}).map(([k, v]) => [k, { ...v, bed: key }]));
      film.bed = key; // also for parts the script names later than the template's (film mode)
      writeFileSync(path.join(dir, "film.json"), JSON.stringify(film, null, 2) + "\n");
      logLine(id, `bakgrundsmusik i appen: ${key ? cuts[key].label || key : "ingen"}`);
      return startJob(id, key ? "Musik: byt slinga" : "Musik: ingen", [build(dir)]);
    }

    case "captions": {
      // the narration burned in (the card's caption band, a box in story scenes); the SRT is delivered anyway
      film.captions = Boolean(args.on);
      writeFileSync(path.join(dir, "film.json"), JSON.stringify(film, null, 2) + "\n");
      logLine(id, `textning i bild ${film.captions ? "på" : "av"} i appen`);
      return startJob(id, film.captions ? "Textning i bild: på" : "Textning i bild: av", [build(dir)]);
    }

    case "livecards": {
      // living cards: the picture fills the frame behind the card's bands and drifts with light and dust
      film.liveCards = Boolean(args.on);
      writeFileSync(path.join(dir, "film.json"), JSON.stringify(film, null, 2) + "\n");
      logLine(id, `levande kort ${film.liveCards ? "på" : "av"} i appen`);
      return startJob(id, film.liveCards ? "Levande kort: på" : "Levande kort: av", [build(dir)]);
    }

    case "apply-profile": {
      // the sender's profile as it is now, into this film: its formats, language, music choice and voice stay
      const pdir = profileDir(film.profile);
      const bed = film.bed ?? Object.values(film.parts || {}).map((x) => x.bed).find((b) => b) ?? "";
      const a = [path.join(SKILL_DIR, "scripts/apply_profile.py"), pdir, dir, "--formats", (film.formats || ["16:9"]).join(","), "--keep-voice", "--music", bed || "none"];
      if (film.language) a.push("--lang", film.language);
      if (film.locale) a.push("--locale", film.locale);
      logLine(id, `avsändarens profil (${film.profile}) uppdaterad i filmen i appen`);
      return startJob(id, "Uppdatera filmen med profilen", [{ label: "Profilen in i filmen", cmd: "python3", args: a, cwd: dir }, build(dir)]);
    }

    case "preview": {
      // a quick look at the whole film: the main format at half size, no loudness pass (free, a minute or two)
      const out = path.join(dir, "out", "preview");
      const browser = process.env.BROWSER_EXECUTABLE || loadConfig().browserExecutable;
      return startJob(id, "Snabbförhandsvisning", [build(dir), {
        label: "Förhandsvisning",
        cmd: "npx",
        args: ["remotion", "render", "src/index.ts", "Film", path.join(out, "preview.mp4"), "--scale=0.5", "--crf=26", "--concurrency=4", "--log=error", ...(browser ? [`--browser-executable=${browser}`] : [])],
        cwd: path.join(dir, "video"),
        parse: (l) => (/Detected differing memory|Memory reported|docker run|lower amount/.test(l) ? null : l),
      }]);
    }

    case "claude":
      return startJob(id, args.title || "Claude", [claudeStep(id, dir, args.prompt)], {
        onDone: (j) => saveApp(id, { claudeSession: j.data.session || null, claudeLast: { at: Date.now(), status: j.status, cost: j.data.cost ?? null, result: j.data.result ?? null } }),
      });

    default:
      throw Object.assign(new Error(`okänd åtgärd ${action}`), { status: 400 });
  }
}

/** A new project: new_film.sh with the profile, the brief, then Claude when asked. */
export function createProject(b) {
  const root = loadConfig().filmsPath;
  const slug = String(b.slug || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw Object.assign(new Error("ange en titel"), { status: 400 });
  const dir = path.join(root, slug);
  if (existsSync(dir)) throw Object.assign(new Error(`det finns redan ett projekt som heter ${slug}`), { status: 409 });
  const formats = (b.formats || []).filter((f) => ["16:9", "1:1", "9:16"].includes(f));
  // design systems for this film only, on top of the client's (checked before anything is made)
  const designSystems = designLinks(b.designSystems);
  const args = [path.join(SKILL_DIR, "scripts/new_film.sh"), dir, "--profile", profileDir(b.profile || "critero"), "--mode", b.mode === "film" ? "film" : "klipp", "--slug", slug, "--title", String(b.title || slug)];
  if (formats.length) args.push("--format", formats.join(","));
  // the background loop: a key from the profile, or "none"; empty = the profile's own default
  if (typeof b.music === "string" && /^(none|bed[A-Za-z0-9._-]*)$/.test(b.music)) args.push("--music", b.music);
  const steps = [
    { label: "Nytt projekt från mallen", cmd: "bash", args, cwd: SKILL_DIR, parse: (l) => (/npm notice/.test(l) ? null : l) },
    {
      label: "Brief",
      cmd: "true",
      args: [],
      cwd: SKILL_DIR,
      after: () => {
        // the film's own choices: its mood, end-card line and kicker (the sender's are only a start)
        const mood = String(b.moodOwn || "").trim() || String(b.mood || "saklig");
        writeBrief(dir, { ...b, designSystems, moodText: mood });
        const f = path.join(dir, "film.json");
        const film = JSON.parse(readFileSync(f, "utf8"));
        // living cards for every sender but the newsreel's (its cards are dealt onto a table)
        const filmLook = (() => {
          try {
            return Boolean(JSON.parse(readFileSync(path.join(dir, "brand/profile.json"), "utf8")).filmLook);
          } catch {
            return false;
          }
        })();
        Object.assign(film, { mood, liveCards: !filmLook }, designSystems.length ? { designSystems } : {});
        if (typeof b.endLine === "string") film.endCard = { ...(film.endCard || {}), line: b.endLine.trim() };
        if (String(b.kicker || "").trim()) film.kicker = String(b.kicker).trim();
        writeFileSync(f, JSON.stringify(film, null, 2) + "\n");
        logLine(slug, `projektet skapat i appen (profil ${b.profile || "critero"}, ${b.mode === "film" ? "film" : "klipp"}, ${formats.join(", ") || "profilens format"})`);
      },
    },
  ];
  const job = startJob(slug, "Skapa projekt", steps, {
    onDone: (j) => {
      if (j.status === "done" && b.startClaude) {
        try {
          runAction(slug, "claude", { title: "Research och manus", prompt: PRESETS.script.prompt });
        } catch {
          /* the page shows the project; the user can start Claude there */
        }
      }
    },
  });
  return { job, id: slug };
}

/** Ready-made instructions for Claude, matching the skill's phases. */
export const PRESETS = {
  script: {
    label: "Research och manus",
    prompt:
      "Läs brand/NOTES.md (avsändarens ram), notes/brief.md, filmens stämning (mood i film.json) och de länkade designsystemen (designSystems i brand/profile.json och film.json). Gör fas 1 (research → notes/research.md, med primärkällor) och fas 3 (manus → script/script.md) enligt skillen, i projektets läge och längd. Ersätt demon helt, även data.ts där det behövs. Låt en oberoende subagent granska manus och research mot primärkällorna och åtgärda allt som är MUST. Kör sedan python3 tools/build_timeline.py. Avsluta med en kort sammanfattning av manuset och det jag behöver godkänna.",
  },
  shots: {
    label: "Bildprompter",
    prompt:
      "Skriv art/shots.json för filmens scener: en film-Sxx per scen (inte end-card), från scenens > visual:-rad, i profilens bildstil (art/style.json), färgad av filmens stämning (mood i film.json), och de länkade designsystemens bildspråk. Ta bort demons bilder ur shots.json. Behöver profilen en återkommande figur som saknas, föreslå det i stället för att lägga till den. Kör inte gen.py, det gör jag i appen.",
  },
  scenes: {
    label: "Bygg scenerna",
    prompt:
      "Gör fas 7 och följ de länkade designsystemen. Blanda kort och berättarläge (<Story>, references/scenes.md): berättarläge där bilden bär berättelsen, med kamerastopp på orden (python3 tools/grid.py visar var saker finns i bilden) och fakta ovanpå som plattor, ringar och stämplar; kort för diagram och jämförelser. Lägg stillbilder där appen visar dem: STILLS_DIR=../out/stills-16x9 node tools/review.mjs … från video/ (16x9 byts mot formatet, till exempel 1x1). Ta bort demoscenerna (TheYear, TheRule) och bygg filmens scener, de bärande först. Lägg siffror i data.ts med källa. Lägg ut scenerna efter WIN och WIDE så att de fungerar i alla format i film.json, och kontrollera stillbilder i varje format. Kör lint_cues och tsc. Avsluta med en rad per scen om vad som syns.",
  },
  music: {
    label: "Musikprompt",
    prompt:
      "Skriv en prompt till Suno för bakgrundsmusiken till den här filmen. Utgå från filmens stämning (mood i film.json) inom avsändarens ram. Läs notes/brief.md, script/script.md, brand/NOTES.md (tonalitet, bildspråk och avsnittet Musik om det finns), film.json och de länkade designsystemen. Filmens längd i sekunder är durationInFrames delat med fps i video/src/timeline/master.json. Musiken ska ligga lågt under en berättarröst: instrumental, jämn, utan dramatiska höjningar, drops eller långt intro, och den ska gå att loopa. Anpassa stämning, tempo i BPM, instrument och energi efter filmens budskap, målgrupp och avsändare. Skriv JSON till music/suno-prompt.json med fälten title (kort, på svenska), styles (på engelska, kommaseparerade, högst 900 tecken), exclude (på engelska, kommaseparerade: alltid vocals och choir, plus det som skulle störa just den här filmen), lengthSeconds (filmens längd plus 10, avrundat), instrumental (true) och why (på svenska, en eller två meningar om varför musiken passar filmen). Ändra inget annat i projektet och kör inga betalda steg. Avsluta med en mening om stämningen du valde.",
  },
  review: {
    label: "Granska scenerna",
    prompt:
      "Granska varje scen med STILLS_DIR=../out/stills-16x9 node tools/review.mjs 6 <alla scener> (från video/; 16x9 byts mot formatet) i huvudformatet och, om filmen har fler format, i dem också. Rätta det som är klippt, överlappar, landar fel eller är svårläst. Avsluta med vad du ändrade.",
  },
};

// ── Remotion Studio, one per project while it is open ──
const studios = new Map();

const freePort = (start) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(freePort(start + 1)));
    s.once("listening", () => s.close(() => resolve(start)));
    s.listen(start, "127.0.0.1");
  });

export async function startStudio(id) {
  const dir = projectDir(id);
  if (studios.has(id)) return { port: studios.get(id).port };
  const port = await freePort(3100 + studios.size);
  const child = spawn("npx", ["remotion", "studio", "src/index.ts", "--port", String(port), "--no-open"], { cwd: path.join(dir, "video"), env: toolEnv(), stdio: "ignore" });
  studios.set(id, { child, port });
  child.on("close", () => studios.delete(id));
  child.on("error", () => studios.delete(id));
  // wait until it answers, at most 60 s
  for (let i = 0; i < 120; i++) {
    const ok = await new Promise((r) => {
      const s = net.connect(port, "127.0.0.1", () => (s.destroy(), r(true)));
      s.on("error", () => r(false));
    });
    if (ok) return { port };
    if (!studios.has(id)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Remotion Studio startade inte");
}

export function stopStudio(id) {
  studios.get(id)?.child.kill("SIGTERM");
  studios.delete(id);
}

export const studioPort = (id) => studios.get(id)?.port ?? null;
export const stopStudios = () => [...studios.keys()].forEach(stopStudio);

/** The user's own sound for one film (a loop, a piece of music): saved in music/suno/ and offered as a
 * background choice. It is chosen right away, since that is why it was added. */
export function uploadAudio(id, { name, data }) {
  const dir = projectDir(id);
  const busy = runningJob(id);
  if (busy) throw Object.assign(new Error(`"${busy.title}" körs redan i det här projektet`), { status: 409 });
  const safe = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
  if (!/\.(wav|mp3|m4a|aiff?|flac)$/i.test(safe)) throw Object.assign(new Error("ljudet ska vara WAV, MP3, M4A, AIFF eller FLAC"), { status: 400 });
  mkdirSync(path.join(dir, "music/suno"), { recursive: true });
  writeFileSync(path.join(dir, "music/suno", safe), Buffer.from(String(data || ""), "base64"));
  const cf = path.join(dir, "music/cuts.json");
  const cuts = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : {};
  const stem = path.parse(safe).name;
  const key = "bed-eget-" + stem.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  cuts[key] = { file: `suno/${safe}`, label: `${String(path.parse(String(name)).name).slice(0, 40)} (eget)` };
  writeFileSync(cf, JSON.stringify(cuts, null, 2) + "\n");
  logLine(id, `eget ljud uppladdat i appen: ${name}`);
  return runAction(id, "music", { key });
}

/** A film to the wastebasket (Inställningar → Papperskorgen can restore it). */
export function deleteProject(id) {
  const dir = projectDir(id);
  const busy = runningJob(id);
  if (busy) throw Object.assign(new Error(`"${busy.title}" körs i filmen: avbryt det först`), { status: 409 });
  stopStudio(id);
  const film = JSON.parse(readFileSync(path.join(dir, "film.json"), "utf8"));
  return toTrash("film", id, dir, film.title);
}

/** The user approves a step (the script, the preview); it counts until what it approved changes. */
export function approve(id, step) {
  if (!["document", "script", "review"].includes(step)) throw Object.assign(new Error("okänt steg"), { status: 400 });
  const f = path.join(projectDir(id), ".infofilm-app.json");
  const cur = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
  saveApp(id, { approved: { ...(cur.approved || {}), [step]: Date.now() } });
  logLine(id, `godkänt i appen: ${{ document: "förslaget ur dokumentet", script: "manuset", review: "förhandsvisningen" }[step]}`);
}

/** Show one finished file selected in Finder. */
export function revealFile(id, rel) {
  if (!/^out\/[^/]+\.(mp4|srt)$/.test(rel || "")) throw Object.assign(new Error("kan inte visa den filen"), { status: 400 });
  const f = path.join(projectDir(id), rel);
  if (!existsSync(f)) throw Object.assign(new Error("filen finns inte"), { status: 404 });
  if (process.platform === "darwin") spawn("open", ["-R", f], { stdio: "ignore", detached: true }).unref();
  else spawn("xdg-open", [path.dirname(f)], { stdio: "ignore", detached: true }).unref();
}

/** Open a folder of the project in Finder (macOS) or the file manager: only the project and its known folders. */
export function reveal(id, sub = "") {
  if (!/^(out|music|voice|art|script|notes|brand|video|dokument)?$/.test(String(sub))) throw Object.assign(new Error("kan inte visa den mappen"), { status: 400 });
  const dir = path.join(projectDir(id), sub);
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(cmd, [existsSync(dir) ? dir : projectDir(id)], { stdio: "ignore", detached: true }).unref();
}
