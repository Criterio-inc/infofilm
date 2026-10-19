// Client profiles in the app: read, edit, upload material, let Claude build one, render test stills.
// Edits always go to the user's own profiles folder (~/Kundprofiler by default): a built-in profile
// from the skill is copied there first, so the repo stays clean and `git pull` never clashes.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { claudeStep } from "./claude.mjs";
import { HOME_DIR, SKILL_DIR, loadConfig } from "./config.mjs";
import { startJob } from "./jobs.mjs";
import { SAFE_ID, listProfiles } from "./projects.mjs";

const PREVIEW = path.join(HOME_DIR, "preview");
const readJson = (f, fb = null) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return fb;
  }
};
const readText = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const writeJson = (f, o) => writeFileSync(f, JSON.stringify(o, null, 2) + "\n");
const err = (msg, status = 400) => Object.assign(new Error(msg), { status });

export const ownRoot = () => loadConfig().profilesPath;
export const jobKey = (id) => `kund:${id}`;

function find(id) {
  if (!SAFE_ID.test(id || "") && !/^_[A-Za-z0-9._-]+$/.test(id || "")) throw err("ogiltig profil");
  const p = listProfiles().find((x) => x.id === id);
  if (!p) throw err(`hittar ingen profil "${id}"`, 404);
  return { ...p, own: path.dirname(p.dir) === ownRoot() };
}

/** The profile's folder, copied into the own profiles folder first when it is a built-in one. */
export function writableDir(id) {
  const p = find(id);
  if (p.own) return p.dir;
  const dst = path.join(ownRoot(), id);
  mkdirSync(ownRoot(), { recursive: true });
  cpSync(p.dir, dst, { recursive: true });
  return dst;
}

function files(dir, sub) {
  const d = path.join(dir, sub);
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => !f.startsWith(".") && statSync(path.join(d, f)).isFile())
    .map((f) => ({ name: f, path: `${sub}/${f}`, size: statSync(path.join(d, f)).size }));
}

export function readProfile(id) {
  const p = find(id);
  const d = p.dir;
  const prof = readJson(path.join(d, "profile.json"), {});
  const app = readJson(path.join(d, ".infofilm-app.json"), {});
  const formats = prof.formats || ["16:9", "1:1"];
  const stills = {};
  for (const fmt of formats) {
    const rel = `out/stills-${fmt.replace(":", "x")}/review`;
    const dir = path.join(PREVIEW, rel);
    if (app.previewOf === id && existsSync(dir))
      stills[fmt] = readdirSync(dir).filter((f) => f.endsWith("_review.jpg")).sort().map((f) => ({ path: `${rel}/${f}`, mtime: statSync(path.join(dir, f)).mtimeMs }));
  }
  return {
    id,
    own: p.own,
    dir: d,
    profile: prof,
    style: readJson(path.join(d, "style.json"), {}),
    design: readJson(path.join(d, "design.json"), {}),
    voice: readJson(path.join(d, "voice.json"), null),
    notes: readText(path.join(d, "NOTES.md")),
    links: readText(path.join(d, "material/LINKS.md")),
    material: files(d, "material").filter((f) => f.name !== "LINKS.md"),
    fonts: files(d, "fonts").filter((f) => /\.(woff2?|ttf|otf)$/i.test(f.name)),
    images: files(d, "img"),
    stills,
    claudeSession: app.claudeSession || null,
    claudeLast: app.claudeLast || null,
  };
}

/** Save what the profile page edits. Each part is optional; only what is sent changes. */
export function saveProfile(id, b) {
  const d = writableDir(id);
  let fontsChanged = false;
  if (b.profile) {
    const f = path.join(d, "profile.json");
    const cur = readJson(f, {});
    const before = JSON.stringify(cur.fonts || {});
    const next = { ...cur };
    for (const k of ["name", "kicker", "language", "locale", "formats", "motion", "backdrop", "filmLook", "ground"]) if (k in b.profile) next[k] = b.profile[k];
    for (const k of ["palette", "card", "plate", "endCard"]) if (b.profile[k]) next[k] = { ...(cur[k] || {}), ...b.profile[k] };
    if ("logo" in b.profile) next.logo = b.profile.logo;
    if (b.profile.fonts) {
      next.fonts = { ...(cur.fonts || {}) };
      for (const [role, spec] of Object.entries(b.profile.fonts)) next.fonts[role] = { ...(cur.fonts?.[role] || {}), ...spec };
    }
    // the placeholder note goes once the profile has been edited by hand or by Claude
    if (/PLACEHOLDER/i.test(next._doc || "")) next._doc = "Client profile. See profiles/README.md in the infofilm skill.";
    writeJson(f, next);
    fontsChanged = JSON.stringify(next.fonts || {}) !== before;
  }
  if (b.style) {
    const f = path.join(d, "style.json");
    writeJson(f, { ...readJson(f, {}), ...b.style });
  }
  if (b.design) {
    const f = path.join(d, "design.json");
    writeJson(f, { model: "eleven_ttv_v3", ...readJson(f, {}), ...b.design });
  }
  if (b.voice !== undefined) {
    const f = path.join(d, "voice.json");
    if (b.voice && b.voice.voice_id) writeJson(f, { ...readJson(f, {}), ...b.voice });
    else rmSync(f, { force: true });
  }
  if (typeof b.notes === "string") writeFileSync(path.join(d, "NOTES.md"), b.notes);
  if (typeof b.links === "string") {
    mkdirSync(path.join(d, "material"), { recursive: true });
    writeFileSync(path.join(d, "material/LINKS.md"), b.links);
  }
  return { fontsChanged };
}

const KINDS = { material: "material", logo: ".", font: "fonts", image: "img" };

/** A file from the page (base64). Logos land next to profile.json, fonts in fonts/, the rest in material/. */
export function upload(id, { kind, name, data }) {
  if (!KINDS[kind]) throw err("okänd filtyp");
  const safe = String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "");
  if (!safe) throw err("filen saknar namn");
  if (kind === "logo" && !/\.(svg|png)$/i.test(safe)) throw err("loggan ska vara SVG eller PNG");
  if (kind === "font" && !/\.(woff2|woff|ttf|otf)$/i.test(safe)) throw err("typsnitt ska vara woff2, woff, ttf eller otf");
  const d = writableDir(id);
  const dir = path.join(d, KINDS[kind]);
  mkdirSync(dir, { recursive: true });
  const fileName = kind === "logo" ? `logo${path.extname(safe).toLowerCase()}` : safe;
  writeFileSync(path.join(dir, fileName), Buffer.from(String(data || ""), "base64"));
  if (kind === "logo") {
    const f = path.join(d, "profile.json");
    const cur = readJson(f, {});
    writeJson(f, { ...cur, logo: { height: 56, ...(cur.logo || {}), file: fileName } });
  }
  return { path: path.posix.join(KINDS[kind], fileName) };
}

export function removeFile(id, rel) {
  if (!/^(material|img|fonts)\/[^/]+$/.test(rel || "") || rel.includes("..")) throw err("kan inte ta bort den filen");
  rmSync(path.join(writableDir(id), rel), { force: true });
}

/** A new profile from _mall, in the own profiles folder. */
export function createProfile(name) {
  const id = String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!id) throw err("ange kundens namn");
  if (listProfiles().some((p) => p.id === id)) throw err(`det finns redan en profil som heter ${id}`, 409);
  mkdirSync(ownRoot(), { recursive: true });
  const job = startJob(jobKey(id), "Ny kundprofil", [
    { label: "Ny profil från _mall", cmd: "bash", args: [path.join(SKILL_DIR, "scripts/new_profile.sh"), id, "--name", String(name)], cwd: SKILL_DIR, env: { INFOFILM_PROFILES: ownRoot() } },
  ]);
  return { id, job };
}

/** Claude builds or adjusts the profile from what is in material/ (and the links). */
export function profileClaude(id, prompt, title) {
  const d = writableDir(id);
  const step = claudeStep(id, d, prompt, { kind: "profile" });
  return startJob(jobKey(id), title || "Claude: profilen", [step], {
    onDone: (j) => {
      const f = path.join(d, ".infofilm-app.json");
      writeJson(f, { ...readJson(f, {}), claudeSession: j.data.session || null, claudeLast: { at: Date.now(), status: j.status, result: j.data.result ?? null } });
    },
  });
}

export const profilePrompt = () => PROFILE_PROMPT.replace("<skill>", SKILL_DIR);
const PROFILE_PROMPT =
  "Bygg den här kundprofilen från kundens material: allt i material/ (grafisk manual, loggor, exempel, presentationer), länkarna i material/LINKS.md och anteckningarna i NOTES.md. Läs skillens profiles/README.md och references/style.md först. Fyll i profile.json (färger per roll, typsnitt, logga, kortform, rörelse, slutkort), style.json (bildstilen för illustrationerna och never-listan), design.json (berättarrösten) och NOTES.md (tonalitet, tilltal, ord, regler). Ta färger, typsnitt och logga ur materialet, gissa aldrig: det som saknas skriver du som en fråga sist i NOTES.md och i ditt svar. Kontrollera kontrasten (bandText på band, ink på surfaceLight, minst 4,5:1). Kör sedan python3 <skill>/template/tools/fetch_fonts.py . för Google-typsnitten. Avsluta med en kort sammanfattning av profilen och vad du behöver från mig.";

/** Test stills: one small preview film (made once), switched to this profile, stills per format. */
export function previewProfile(id) {
  const p = find(id);
  const prof = readJson(path.join(p.dir, "profile.json"), {});
  const formats = (prof.formats || ["16:9", "1:1"]).join(",");
  const steps = [];
  if (!existsSync(path.join(p.dir, "fonts/google.json")))
    steps.push({ label: "Typsnitt", cmd: "python3", args: [path.join(SKILL_DIR, "template/tools/fetch_fonts.py"), p.dir], cwd: p.dir });
  if (!existsSync(path.join(PREVIEW, "film.json")))
    steps.push({ label: "Testfilm (första gången, ca en minut)", cmd: "bash", args: [path.join(SKILL_DIR, "scripts/new_film.sh"), PREVIEW, "--profile", p.dir, "--mode", "klipp", "--format", formats, "--slug", "test", "--title", "Test"], cwd: SKILL_DIR, parse: (l) => (/npm notice/.test(l) ? null : l) });
  steps.push({ label: "Profilen i testfilmen", cmd: "python3", args: [path.join(SKILL_DIR, "scripts/apply_profile.py"), p.dir, PREVIEW, "--formats", formats], cwd: PREVIEW });
  const fmts = formats.split(",");
  for (const fmt of fmts) {
    steps.push({ label: `Tidslinje ${fmt}`, cmd: "python3", args: ["tools/build_timeline.py"], cwd: PREVIEW, env: { FORMAT: fmt } });
    steps.push({
      label: `Testbilder ${fmt}`,
      cmd: "node",
      args: ["tools/review.mjs", "3", "S01-the-year", "S02-the-rule", "S03-end-card"],
      cwd: path.join(PREVIEW, "video"),
      env: { STILLS_DIR: path.join(PREVIEW, "out", `stills-${fmt.replace(":", "x")}`) },
      parse: (l) => (/Detected differing memory|Memory reported|docker run|lower amount/.test(l) ? null : l),
    });
  }
  return startJob(jobKey(id), "Testbilder", steps, {
    onDone: (j) => {
      if (j.status !== "done") return;
      const f = path.join(p.dir, ".infofilm-app.json");
      writeJson(f, { ...readJson(f, {}), previewOf: id, previewAt: Date.now() });
    },
  });
}

/** Files the page may show: the profile's logo, images and material, and the preview stills. */
export function profileFile(id, rel) {
  if (rel.startsWith("preview/")) {
    const r = rel.slice("preview/".length);
    if (!/^out\/stills-[^/]+\/review\/[^/]+_review\.jpg$/.test(r)) throw err("inte tillåtet", 403);
    return path.join(PREVIEW, r);
  }
  if (!/^(logo\.(svg|png)|img\/[^/]+|material\/[^/]+)$/.test(rel) || rel.includes("..")) throw err("inte tillåtet", 403);
  return path.join(find(id).dir, rel);
}

/** A project's voice → the profile, so the client's next films get the same narrator. */
export function voiceToProfile(projectDir, profileId) {
  const d = writableDir(profileId);
  for (const [src, dst] of [["voice/voice.json", "voice.json"], ["voice/design.json", "design.json"]]) {
    if (existsSync(path.join(projectDir, src))) cpSync(path.join(projectDir, src), path.join(d, dst));
  }
  return d;
}
