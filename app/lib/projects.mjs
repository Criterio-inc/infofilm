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

/** The folders among a profile's or film's design systems, with ~ expanded (Claude may read them). */
export const designFolders = (list) =>
  (list || []).map((d) => (typeof d === "string" ? d : d?.url)).filter((u) => /^(~|\/)/.test(u || "")).map((u) => (u.startsWith("~") ? path.join(os.homedir(), u.slice(1)) : u)).filter((p) => existsSync(p));

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

/** Where the film is: the next thing to do, judged from the files. */
function stage(s) {
  if (!s.brief) return { key: "brief", label: "Skriv en brief" };
  if (s.demo) return { key: "script", label: "Research och manus" };
  if (!s.scenes) return { key: "script", label: "Bygg tidslinjen" };
  if (s.narrated < s.scenes) return { key: "voice", label: "Röst" };
  if (s.images < s.illustrated) return { key: "images", label: "Bilder" };
  if (!s.renders.length) return { key: "render", label: "Rendera" };
  return { key: "done", label: "Klar" };
}

export function summary(id) {
  const dir = path.join(loadConfig().filmsPath, id);
  const film = readJson(path.join(dir, "film.json"), {});
  const brand = readJson(path.join(dir, "brand/profile.json"), {});
  const tl = readJson(path.join(dir, "video/src/timeline/master.json"), null);
  const scenes = tl?.scenes ?? [];
  const script = read(path.join(dir, film.script || "script/script.md"), "");
  const renders = files(path.join(dir, film.outDir || "out"), /\.mp4$/).filter((f) => !f.name.endsWith(".raw.mp4"));
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
    narrated: scenes.filter((x) => !x.estimated).length,
    // the built-in end card needs no illustration
    illustrated: scenes.filter((x) => x.name !== "end-card").length,
    images: scenes.filter((x) => x.img && x.name !== "end-card").length,
    thumb: scenes.find((x) => x.img)?.img ? `video/public/${scenes.find((x) => x.img).img}` : null,
    renders,
    modified: Math.max(statSync(path.join(dir, "film.json")).mtimeMs, ...renders.map((r) => r.mtime), existsSync(path.join(dir, "video/src/timeline/master.json")) ? statSync(path.join(dir, "video/src/timeline/master.json")).mtimeMs : 0),
  };
  s.stage = stage(s);
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
    "",
    "## Underlag och övrigt",
    "",
    b.notes || "",
    "",
    ...(b.designSystems?.length ? ["## Designsystem för den här filmen", "", "Utöver kundens (brand/profile.json). Läs dem före manus, bildprompter och scener.", "", ...b.designSystems.map((d) => `- ${d.url}`), ""] : []),
  ];
  writeFileSync(path.join(dir, "notes/brief.md"), lines.join("\n"));
}
