// Film projects in the films folder: listing, status, and the actions the app can run on one.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, SKILL_DIR } from "./config.mjs";

const read = (f, fallback = null) => {
  try {
    return readFileSync(f, "utf8");
  } catch {
    return fallback;
  }
};
const readJson = (f, fallback = null) => {
  const t = read(f);
  if (t == null) return fallback;
  try {
    return JSON.parse(t);
  } catch {
    return fallback;
  }
};

export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The background loops in a music folder: cuts.json keys that start with "bed" and whose file exists.
 * In a profile the files lie next to cuts.json; in a film they lie in music/suno/ (as cuts.json says). */
export function musicLoops(musicDir, { profile = false } = {}) {
  const cuts = readJson(path.join(musicDir, "cuts.json"), {}) || {};
  return Object.entries(cuts)
    .filter(([k, c]) => /^bed/.test(k) && c?.file)
    .map(([key, c]) => ({ key, label: c.label || key, file: profile ? path.basename(c.file) : c.file }))
    .filter((m) => existsSync(path.join(musicDir, m.file)));
}

/** A profile's default loop: "music": {"bed": key} (null = no music); without the setting, "bed" if it exists. */
export const defaultLoop = (prof, loops) => {
  if (prof?.music && "bed" in prof.music) return loops.some((l) => l.key === prof.music.bed) ? prof.music.bed : "";
  return loops.some((l) => l.key === "bed") ? "bed" : "";
};

/** Design systems (Claude Design, the web, or a folder on this computer), from a textarea or a list,
 * as [{ url, name?, syncedAt?, file? }]: url is a link (https://…) or a folder (~/… or /…).
 * What is already known about one (its name, when it was synced, its snapshot) is kept. */
export function designLinks(input, current = []) {
  const known = new Map((current || []).map((d) => (typeof d === "string" ? { url: d } : d)).filter((d) => d?.url).map((d) => [d.url, d]));
  const raw = Array.isArray(input) ? input.map((d) => (typeof d === "string" ? d : d?.url)) : String(input || "").split(/\n+/);
  const urls = [...new Set(raw.map((u) => String(u || "").trim().replace(/\/+$/, "")).filter(Boolean))];
  const bad = urls.find((u) => !/^https?:\/\/[^\s/]+\.\S+$/i.test(u) && !/^(~|\/)\S/.test(u));
  if (bad) throw Object.assign(new Error(`"${bad.slice(0, 80)}" är varken en webblänk (https://…) eller en mapp (~/… eller /…)`), { status: 400 });
  return urls.map((url) => known.get(url) || { url });
}

/** The folders among a profile's or film's design systems, with ~ expanded (Claude may read them). Only
 * real project folders: at least two levels inside the home folder and none of its hidden folders, so a
 * stray "~" or "/Users" never opens the whole disk to Claude. */
export const designFolders = (list) =>
  (list || [])
    .map((d) => (typeof d === "string" ? d : d?.url))
    .filter((u) => /^(~|\/)/.test(u || ""))
    .map((u) => path.resolve(u.startsWith("~") ? path.join(os.homedir(), u.slice(1)) : u))
    .filter((p) => {
      const rel = path.relative(os.homedir(), p);
      return rel && !rel.startsWith("..") && !path.isAbsolute(rel) && rel.split(path.sep).length >= 2 && !rel.split(path.sep).some((s) => s.startsWith("."));
    })
    .filter((p) => existsSync(p) && statSync(p).isDirectory());

/** The project folder for an id, or a 404. Ids are folder names directly under the films folder. */
export function projectDir(id) {
  if (!SAFE_ID.test(id || "")) throw Object.assign(new Error("ogiltigt projekt"), { status: 400 });
  const dir = path.join(loadConfig().filmsPath, id);
  if (!existsSync(path.join(dir, "film.json"))) throw Object.assign(new Error(`hittar inget projekt "${id}"`), { status: 404 });
  return dir;
}

/** Profiles: the skill's own, plus the private profiles folder (which wins on a name clash). */
export function listProfiles() {
  const out = new Map();
  const roots = [path.join(SKILL_DIR, "profiles"), loadConfig().profilesPath].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const p = readJson(path.join(root, name, "profile.json"));
      if (!p) continue;
      out.set(name, {
        id: name,
        name: p.name || name,
        template: name.startsWith("_"),
        dir: path.join(root, name),
        language: p.language,
        formats: p.formats || null,
        palette: { band: p.palette?.band, primary: p.palette?.primary, accent: p.palette?.accent, surface: p.palette?.surfaceLight, backdrop: p.palette?.backdrop },
        placeholder: /PLACEHOLDER/i.test(p._doc || ""),
        designSystems: (p.designSystems || []).length,
        endLine: p.endCard?.line || "",
        ...(() => {
          const loops = musicLoops(path.join(root, name, "music"), { profile: true });
          return { loops: loops.map(({ key, label }) => ({ key, label })), loop: defaultLoop(p, loops) };
        })(),
      });
    }
  }
  return [...out.values()].sort((a, b) => (a.id === "critero" ? -1 : b.id === "critero" ? 1 : a.template - b.template || a.name.localeCompare(b.name, "sv")));
}

export function profileDir(id) {
  const p = listProfiles().find((x) => x.id === id);
  if (!p) throw Object.assign(new Error(`hittar ingen profil "${id}"`), { status: 400 });
  return p.dir;
}

function files(dir, re) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => ({ name: f, mtime: statSync(path.join(dir, f)).mtimeMs, size: statSync(path.join(dir, f)).size }))
    .sort((a, b) => b.mtime - a.mtime);
}

export const STEP_NAMES = { script: "Manus", voice: "Röst", images: "Bilder", review: "Titta igenom", deliver: "Leverera" };

/** The five steps of a film, each done or not, judged from the files and the user's approvals.
 * An approval counts only while what it approved is unchanged (the script, the timeline). */
function steps(s) {
  const ok = (k) => (s.approved?.[k] || 0) >= (k === "script" ? s.scriptMtime : s.timelineMtime);
  const done = {
    script: !s.demo && s.scenes > 0 && ok("script"),
    voice: s.scenes > 0 && s.narrated >= s.scenes,
    images: s.scenes > 0 && s.images >= s.illustrated,
    review: s.scenesBuilt && Boolean(s.preview) && ok("review"),
  };
  // the finished films count once everything before them is done, and only if made after the last change
  // …and every format of the film has a render made after the last change
  const fresh = s.renders.filter((r) => r.mtime >= s.timelineMtime).length;
  done.deliver = done.script && done.voice && done.images && done.review && fresh >= (s.formats || ["16:9"]).length;
  const list = Object.keys(STEP_NAMES).map((key) => ({ key, label: STEP_NAMES[key], done: done[key] }));
  const current = list.find((x) => !x.done)?.key || "done";
  return { list, current };
}

/** Claude has built the film's scenes when every scene (but the end card) has a component in the
 * registries and the demo's scenes are no longer in them; the demo's files may stay on disk. */
function scenesBuilt(dir, scenes) {
  const reg = ["golden.ts", "registry.ts"].map((f) => read(path.join(dir, "video/src/scenes", f), "")).join("\n");
  const names = scenes.map((s) => s.name).filter((n) => n && n !== "end-card");
  return names.length > 0 && !/\b(TheYear|TheRule)\b/.test(reg) && names.every((n) => reg.includes(`"${n}"`) || new RegExp(`\\b${n.replace(/-/g, "_")}\\b`).test(reg));
}

/** The newest change to what the film is made of: script, film.json, profile, pictures, narration,
 * music and the scenes' code. Generated files (the timeline, renders, stills) do not count. */
function changedAt(dir) {
  const skip = new Set(["node_modules", "timeline", "previews"]);
  const newest = (p) => {
    if (!existsSync(p)) return 0;
    const st = statSync(p);
    if (!st.isDirectory()) return st.mtimeMs;
    return Math.max(0, ...readdirSync(p).filter((n) => !n.startsWith(".") && !skip.has(n)).map((n) => newest(path.join(p, n))));
  };
  return Math.max(...["script", "film.json", "brand", "art/img", "art/shots.json", "voice/scenes", "voice/voice.json", "music/cuts.json", "music/suno", "video/src"].map((r) => newest(path.join(dir, r))));
}

/** What differs between the film's copy of its sender's profile (brand/, art/style.json) and the profile
 * as it is now, in words for the page. The film's formats, language, music choice and voice stay the film's. */
export function profileDiff(id) {
  const dir = projectDir(id);
  const film = readJson(path.join(dir, "film.json"), {});
  let pdir;
  try {
    pdir = profileDir(film.profile);
  } catch {
    return { profile: film.profile || "", missing: true, changes: [] };
  }
  const a = readJson(path.join(dir, "brand/profile.json"), {});
  const b = readJson(path.join(pdir, "profile.json"), {});
  const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
  const changes = [];
  const roles = [...new Set([...Object.keys(a.palette || {}), ...Object.keys(b.palette || {})])].filter((r) => !same(a.palette?.[r], b.palette?.[r]));
  if (roles.length) changes.push(`Färger: ${roles.slice(0, 6).map((r) => `${r} ${a.palette?.[r] || "–"} → ${b.palette?.[r] || "–"}`).join(", ")}${roles.length > 6 ? ` och ${roles.length - 6} till` : ""}`);
  for (const [role, label] of [["display", "Rubriktypsnitt"], ["ui", "Texttypsnitt"], ["mono", "Etikettypsnitt"]]) {
    const fa = a.fonts?.[role], fb = b.fonts?.[role];
    if (!same(fa, fb)) changes.push(`${label}: ${fa?.family || "–"} → ${fb?.family || "–"}${fb?.files?.length ? ` (${fb.files.length} egna filer)` : ""}`);
  }
  const logoA = a.logo?.file && path.join(dir, "brand", a.logo.file);
  const logoB = b.logo?.file && path.join(pdir, b.logo.file);
  const bytes = (f) => (f && existsSync(f) ? readFileSync(f) : null);
  if (!same(a.logo, b.logo) || (logoA && logoB && !bytes(logoA)?.equals(bytes(logoB) || Buffer.alloc(0)))) changes.push("Logga");
  const parts = { name: "Namn", kicker: "Kicker", card: "Kortets form", plate: "Plattornas form", motion: "Rörelse", backdrop: "Bakgrund", ground: "Bakgrund utan bild", filmLook: "Filmkorn", endCard: "Slutkortet", designSystems: "Designsystem" };
  for (const [k, label] of Object.entries(parts)) if (!same(a[k], b[k])) changes.push(label);
  const sa = readJson(path.join(dir, "art/style.json"), {}), sb = readJson(path.join(pdir, "style.json"), {});
  if (!same(sa.ink, sb.ink) || !same(sa.never, sb.never)) changes.push("Bildstil (gäller nya bilder, befintliga görs inte om)");
  if (read(path.join(dir, "brand/NOTES.md"), "") !== read(path.join(pdir, "NOTES.md"), "")) changes.push("Tonalitet och regler (NOTES.md)");
  return { profile: film.profile, name: b.name || film.profile, changes };
}

const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0);

export function summary(id) {
  const dir = path.join(loadConfig().filmsPath, id);
  const film = readJson(path.join(dir, "film.json"), {});
  const brand = readJson(path.join(dir, "brand/profile.json"), {});
  const tl = readJson(path.join(dir, "video/src/timeline/master.json"), null);
  const scenes = tl?.scenes ?? [];
  const script = read(path.join(dir, film.script || "script/script.md"), "");
  const outDir = path.join(dir, film.outDir || "out");
  const renders = files(outDir, /\.mp4$/).filter((f) => !f.name.endsWith(".raw.mp4"));
  const app = readJson(path.join(dir, ".infofilm-app.json"), {});
  const preview = path.join(outDir, "preview", "preview.mp4");
  const s = {
    id,
    title: film.title || id,
    slug: film.slug,
    mode: film.mode || "film",
    formats: film.formats || ["16:9"],
    profile: film.profile || "",
    profileName: brand.name || film.profile || "",
    palette: brand.palette || {},
    brief: existsSync(path.join(dir, "notes/brief.md")),
    demo: /^status:\s*demo/m.test(script),
    scenes: scenes.length,
    seconds: tl ? Math.round(tl.durationInFrames / (tl.fps || 30)) : 0,
    // a scene without words (a silent card) has nothing to narrate
    narrated: scenes.filter((x) => !x.estimated || !String(x.text || "").trim()).length,
    // the built-in end card needs no illustration
    illustrated: scenes.filter((x) => x.name !== "end-card").length,
    images: scenes.filter((x) => x.img && x.name !== "end-card").length,
    thumb: scenes.find((x) => x.img)?.img ? `video/public/${scenes.find((x) => x.img).img}` : null,
    renders,
    subtitles: files(outDir, /\.srt$/).filter((f) => f.size > 0),
    approved: app.approved || {},
    scriptMtime: mtime(path.join(dir, film.script || "script/script.md")),
    // when the film last really changed: the timeline file itself is rebuilt by every render and preview
    timelineMtime: changedAt(dir),
    scenesBuilt: scenesBuilt(dir, scenes),
    // the sender's profile was edited after it was put into this film (brand/PROFILE is written then)
    profileNewer: (() => {
      try {
        const pdir = profileDir(film.profile);
        const newest = Math.max(...["profile.json", "style.json", "NOTES.md", "logo.svg", "logo.png", "fonts", "design-systems"].map((f) => mtime(path.join(pdir, f))));
        return newest > mtime(path.join(dir, "brand/PROFILE")) + 1000;
      } catch {
        return false;
      }
    })(),
    preview: existsSync(preview) ? { path: path.relative(dir, preview), mtime: mtime(preview) } : null,
    modified: Math.max(statSync(path.join(dir, "film.json")).mtimeMs, ...renders.map((r) => r.mtime), existsSync(path.join(dir, "video/src/timeline/master.json")) ? statSync(path.join(dir, "video/src/timeline/master.json")).mtimeMs : 0),
  };
  s.steps = steps(s);
  s.stage = s.steps.current === "done" ? { key: "done", label: "Klar" } : { key: s.steps.current, label: STEP_NAMES[s.steps.current] };
  return s;
}

export function listProjects() {
  const root = loadConfig().filmsPath;
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((n) => SAFE_ID.test(n) && existsSync(path.join(root, n, "film.json")))
    .map((n) => {
      try {
        return summary(n);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.modified - a.modified);
}

export function detail(id) {
  const dir = projectDir(id);
  const s = summary(id);
  const tl = readJson(path.join(dir, "video/src/timeline/master.json"), null);
  const stills = {};
  for (const fmt of s.formats) {
    const base = path.join(dir, "out", `stills-${fmt.replace(":", "x")}`, "review");
    stills[fmt] = Object.fromEntries(
      (tl?.scenes ?? [])
        .map((sc) => [sc.id, `out/stills-${fmt.replace(":", "x")}/review/${sc.id}-${sc.name}_review.jpg`])
        .filter(([, rel]) => existsSync(path.join(dir, rel)))
        .map(([k, rel]) => [k, { path: rel, mtime: statSync(path.join(dir, rel)).mtimeMs }]),
    );
  }
  const voice = readJson(path.join(dir, "voice/voice.json"), {});
  const previews = files(path.join(dir, "voice/previews"), /-manifest\.json$/).flatMap((m) => {
    const man = readJson(path.join(dir, "voice/previews", m.name), {});
    return (man.previews || []).map((p) => ({ ...p, src: `voice/previews/${p.file}`, tag: m.name.replace(/-manifest\.json$/, "") }));
  });
  const app = readJson(path.join(dir, ".infofilm-app.json"), {});
  return {
    ...s,
    dir,
    film: readJson(path.join(dir, "film.json"), {}),
    brief: read(path.join(dir, "notes/brief.md"), ""),
    log: read(path.join(dir, "notes/log.md"), ""),
    scenes: (tl?.scenes ?? []).map((x) => ({
      id: x.id,
      name: x.name,
      title: x.title,
      seconds: Math.round((x.durationInFrames / (tl.fps || 30)) * 10) / 10,
      narrated: !x.estimated,
      img: x.img ? `video/public/${x.img}` : null,
      audio: x.audio ? `video/public/${x.audio}` : null,
      text: x.text,
    })),
    stills,
    voice: {
      id: voice.voice_id && !/PUT-YOUR/.test(voice.voice_id) ? voice.voice_id : null,
      name: voice.name || null,
      previews,
      design: readJson(path.join(dir, "voice/design.json"), {}),
    },
    shots: (readJson(path.join(dir, "art/shots.json"), []) || []).length,
    sunoPrompt: (() => {
      const f = path.join(dir, "music/suno-prompt.json");
      const j = readJson(f, null);
      return j && j.styles ? { ...j, at: statSync(f).mtimeMs } : null;
    })(),
    shotList: (readJson(path.join(dir, "art/shots.json"), []) || []).map((x) => ({ id: x.id, prompt: x.prompt })),
    music: {
      // the film's own loops, plus the client's that the film does not have yet (copied in when chosen)
      loops: (() => {
        const own = musicLoops(path.join(dir, "music")).map((m) => ({ ...m, src: `music/${m.file}` }));
        let fromProfile = [];
        try {
          fromProfile = musicLoops(path.join(profileDir(s.profile), "music"), { profile: true }).filter((m) => !own.some((o) => o.key === m.key)).map(({ key, label }) => ({ key, label, src: null }));
        } catch {
          /* the film's profile is gone: its own loops are enough */
        }
        return [...own, ...fromProfile];
      })(),
      bed: ((fj) => ("bed" in fj ? fj.bed : Object.values(fj.parts || {}).map((x) => x.bed).find((b) => b)) || "")(readJson(path.join(dir, "film.json"), {})),
    },
    claudeSession: app.claudeSession || null,
    claudeLast: app.claudeLast || null,
  };
}

export function saveApp(id, patch) {
  const f = path.join(projectDir(id), ".infofilm-app.json");
  writeFileSync(f, JSON.stringify({ ...readJson(f, {}), ...patch }, null, 2) + "\n");
}

/** One line in notes/log.md: the skill's rule is that every approval and cost is logged. */
export function logLine(id, text) {
  const f = path.join(projectDir(id), "notes/log.md");
  const d = new Date().toISOString().slice(0, 10);
  appendFileSync(f, `- ${d} · ${text}\n`);
}

export function writeBrief(dir, b) {
  const lines = [
    "# Brief",
    "",
    `- **Ämne:** ${b.topic || ""}`,
    `- **Målgrupp:** ${b.audience || ""}`,
    `- **Kanal:** ${b.channel || ""}`,
    `- **Längd:** ${b.length || ""}`,
    `- **Syfte / det tittaren ska ta med sig:** ${b.purpose || ""}`,
    `- **Stämning:** ${b.moodText || ""}`,
    ...(b.approver ? [`- **Godkänner filmen:** ${b.approver}`] : []),
    "",
    "## Underlag och övrigt",
    "",
    b.notes || "",
    "",
    ...(b.designSystems?.length ? ["## Designsystem för den här filmen", "", "Utöver avsändarens (brand/profile.json). Läs dem före manus, bildprompter och scener.", "", ...b.designSystems.map((d) => `- ${d.url}`), ""] : []),
  ];
  writeFileSync(path.join(dir, "notes/brief.md"), lines.join("\n"));
}
