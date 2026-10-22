#!/usr/bin/env node
// Infofilm: a small local app around the infofilm skill. Listens on 127.0.0.1 only.
//   node server.mjs            (or ./start.sh, which also opens the window)
import { execFile } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { emptyTrash, listTrash, restore, trashSize } from "./lib/trash.mjs";
import { chooseVoice, libraryVoices, myVoices, previewClip } from "./lib/voices.mjs";
import { documents, readDocuments, removeDocument, SCRIPT_DOC, setRights, SHOTS_DOC, uploadDocument, usePicture } from "./lib/documents.mjs";
import { approve, createProject, deleteProject, PRESETS, reveal, revealFile, runAction, uploadAudio, startStudio, stopStudio, stopStudios, studioPort } from "./lib/actions.mjs";
import { APP_DIR, KEYS, SKILL_DIR, checkKey, loadConfig, loadSecrets, saveConfig, saveSecrets, toolEnv } from "./lib/config.mjs";
import { getJob, projectJobs, runningJob, stopAll, stopJob, summary as jobSummary } from "./lib/jobs.mjs";
import { detail, listProfiles, listProjects, profileDiff, projectDir, saveApp } from "./lib/projects.mjs";
import { createProfile, jobKey, ownRoot, previewProfile, profileClaude, profileFile, profilePrompt, readProfile, deleteProfile, syncPrompt, removeFile, saveProfile, upload, voiceToProfile } from "./lib/profiles.mjs";
import { startJob } from "./lib/jobs.mjs";

const PORT = Number(process.env.INFOFILM_PORT || loadConfig().port || 4747);
const PUBLIC = path.join(APP_DIR, "public");
// files of a project the page may load: renders, stills, illustrations, narration, voice takes
const SERVABLE = [/^out\/[^/]+\.(mp4|srt)$/, /^out\/preview\/preview\.mp4$/, /^music\/suno\/[^/]+\.(wav|mp3|m4a|aiff?|flac)$/i, /^out\/stills-[^/]+\/review\/[^/]+_review\.jpg$/, /^video\/public\/img\/[^/]+\.jpg$/, /^video\/public\/audio\/[^/]+\.mp3$/, /^voice\/previews\/[^/]+\.mp3$/, /^dokument\/(sidor\/[^/]+\.png|oversikt-[^/]+\.png|bilder\/[^/]+\.(jpe?g|png|gif|webp|tiff?|bmp))$/i];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".tif": "image/tiff", ".tiff": "image/tiff", ".bmp": "image/bmp", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aif": "audio/aiff", ".aiff": "audio/aiff", ".flac": "audio/flac", ".srt": "text/plain; charset=utf-8", ".json": "application/json" };

// ── checks: what the computer has, cached for a minute ──
let checks = null;
let checksAt = 0;
const run = (cmd, args) =>
  new Promise((resolve) => execFile(cmd, args, { env: toolEnv(), timeout: 15000 }, (err, out, errOut) => resolve(err ? null : (out || errOut).trim().split("\n")[0])));

let checking = null;
async function getChecks(force = false) {
  // the page never waits for a re-check: it gets the last result, and a stale one is refreshed behind it
  if (checks && !force) {
    if (Date.now() - checksAt > 60000 && !checking) checking = runChecks().finally(() => (checking = null));
    return checks;
  }
  return (checking ||= runChecks().finally(() => (checking = null)));
}

async function runChecks() {
  const secrets = loadSecrets();
  const [node, python, ffmpeg, claude, numpy, eleven] = await Promise.all([
    run("node", ["--version"]),
    run("python3", ["--version"]),
    run("ffmpeg", ["-version"]),
    run("claude", ["--version"]),
    run("python3", ["-c", "import numpy; print(numpy.__version__)"]),
    run("python3", ["-c", "import elevenlabs; print('ok')"]),
  ]);
  const key = (k) => Boolean(secrets[k] || process.env[k]);
  const where = Object.fromEntries(await Promise.all(["node", "python3", "ffmpeg", "claude"].map(async (t) => [t, await run("/bin/sh", ["-c", `command -v ${t}`])])));
  checks = [
    { id: "node", label: "Node 20+", ok: Boolean(node && Number(node.replace(/^v/, "").split(".")[0]) >= 20), value: node, fix: "brew install node", where: where["node"] },
    { id: "python", label: "Python 3", ok: Boolean(python), value: python, fix: "brew install python", where: where["python3"] },
    { id: "ffmpeg", label: "ffmpeg", ok: Boolean(ffmpeg), value: ffmpeg?.split(" ").slice(0, 3).join(" "), fix: "brew install ffmpeg", where: where["ffmpeg"] },
    { id: "numpy", label: "Python: numpy", ok: Boolean(numpy), value: numpy, fix: "kör app/macos/setup.sh" },
    { id: "claude", label: "Claude Code", ok: Boolean(claude), value: claude, fix: "npm install -g @anthropic-ai/claude-code, logga sedan in med: claude", where: where["claude"] },
    { id: "elevenlabs", label: "Python: elevenlabs (för röst)", ok: Boolean(eleven), value: eleven && "installerat", fix: "kör app/macos/setup.sh" },
    { id: "eleven-key", label: "ElevenLabs-nyckel (för röst)", ok: key("ELEVENLABS_API_KEY"), fix: "lägg in under Inställningar" },
    { id: "openrouter-key", label: "OpenRouter-nyckel (för bilder)", ok: key("OPENROUTER_API_KEY"), fix: "lägg in under Inställningar" },
  ];
  checksAt = Date.now();
  return checks;
}

// ── what is left on the paid services, cached for a minute (free calls) ──
let credits = null;
let creditsAt = 0;
async function getCredits() {
  if (credits && Date.now() - creditsAt < 60000) return credits;
  const env = toolEnv();
  const get = async (url, headers) => {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const [el, or] = await Promise.all([
    env.ELEVENLABS_API_KEY ? get("https://api.elevenlabs.io/v1/user/subscription", { "xi-api-key": env.ELEVENLABS_API_KEY }) : null,
    env.OPENROUTER_API_KEY ? get("https://openrouter.ai/api/v1/credits", { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` }) : null,
  ]);
  credits = {
    eleven: el ? { left: el.character_limit - el.character_count, limit: el.character_limit, tier: el.tier } : null,
    openrouter: or?.data ? { left: Math.round((or.data.total_credits - or.data.total_usage) * 100) / 100 } : null,
  };
  creditsAt = Date.now();
  return credits;
}

// ── helpers ──
const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};
const body = (req, max = 2e6) =>
  new Promise((resolve, reject) => {
    // collect bytes, not strings: a chunk boundary may fall inside å, ä or ö
    const parts = [];
    let size = 0;
    req.on("data", (d) => {
      size += d.length;
      if (size > max) {
        reject(Object.assign(new Error("för stor fil (högst 60 MB)"), { status: 413 }));
        req.destroy();
        return;
      }
      parts.push(d);
    });
    req.on("end", () => {
      const b = Buffer.concat(parts).toString("utf8");
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch {
        reject(Object.assign(new Error("ogiltig JSON"), { status: 400 }));
      }
    });
  });

/** Serve a file with Range support (video and audio need it to seek). */
function sendFile(req, res, file, { untrusted = false } = {}) {
  const st = statSync(file);
  if (!st.isFile()) return json(res, 404, { error: "finns inte" });
  // files that came from outside (client material, logos, renders) never run as pages in the app's origin
  if (untrusted) {
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'");
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${st.size}` });
      return res.end();
    }
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-cache" });
    return createReadStream(file, { start, end }).on("error", () => res.destroy()).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
  createReadStream(file).on("error", () => res.destroy()).pipe(res);
}

// ── routes ──
async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // after "api"
  const m = req.method;

  if (m === "GET" && parts[0] === "state") {
    const c = loadConfig();
    const secrets = loadSecrets();
    return json(res, 200, {
      config: { filmsDir: c.filmsDir, filmsPath: c.filmsPath, profilesDir: c.profilesDir, browserExecutable: c.browserExecutable, skillDir: SKILL_DIR },
      keys: Object.fromEntries(KEYS.map((k) => [k, secrets[k] ? "sparad" : process.env[k] ? "från miljön" : ""])),
      checks: await getChecks(url.searchParams.has("recheck")),
      profiles: listProfiles().map(({ dir, ...p }) => p),
      presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.label])),
      platform: process.platform,
      path: toolEnv().PATH,
    });
  }
  if (m === "GET" && parts[0] === "projects" && !parts[1]) {
    return json(res, 200, listProjects().map((p) => ({ ...p, running: runningJob(p.id) ? jobSummary(runningJob(p.id)) : null })));
  }
  if (m === "POST" && parts[0] === "projects" && !parts[1]) {
    const { job, id } = createProject(await body(req));
    return json(res, 202, { id, job: jobSummary(job) });
  }
  if (parts[0] === "profiles") return profilesApi(req, res, parts.slice(1));
  // voices for a narrator: the user's own and the Swedish voice library (free to list and to hear)
  if (m === "GET" && parts[0] === "voices" && parts[1] === "mine") return json(res, 200, await myVoices(url.searchParams.has("fresh")));
  if (m === "GET" && parts[0] === "voices" && parts[1] === "preview") {
    const clip = await previewClip(url.searchParams.get("url"));
    res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": clip.length, "Cache-Control": "max-age=86400" });
    return res.end(clip);
  }
  if (m === "GET" && parts[0] === "voices" && parts[1] === "library") return json(res, 200, await libraryVoices(Object.fromEntries(url.searchParams)));
  // the wastebasket: what was deleted, put back, or empty for good
  if (m === "GET" && parts[0] === "trash") return json(res, 200, { items: listTrash(), bytes: trashSize() });
  if (m === "POST" && parts[0] === "trash" && parts[1] === "restore") return json(res, 200, restore((await body(req)).entry));
  if (m === "POST" && parts[0] === "trash" && parts[1] === "empty") return json(res, 200, { removed: emptyTrash((await body(req)).entry) });
  if (m === "GET" && parts[0] === "credits") return json(res, 200, await getCredits());
  if (parts[0] === "projects" && parts[1]) {
    const id = parts[1];
    if (m === "GET" && !parts[2]) {
      const d = detail(id);
      return json(res, 200, { ...d, documents: documents(d.dir, d.approved), jobs: projectJobs(id), running: runningJob(id) ? jobSummary(runningJob(id)) : null, studio: studioPort(id) });
    }
    if (m === "POST" && parts[2] === "action") {
      const b = await body(req);
      const job = runAction(id, b.action, b.args || {});
      return json(res, 202, { job: jobSummary(job) });
    }
    if (m === "POST" && parts[2] === "preset") {
      const b = await body(req);
      const p = PRESETS[b.preset];
      if (!p) return json(res, 400, { error: "okänd förinställning" });
      // a film made from a document: the script follows the approved proposal, with the document as its main source
      const docRule = documents(projectDir(id)).files.length ? { script: SCRIPT_DOC, shots: SHOTS_DOC }[b.preset] : null;
      const base = docRule ? `${p.prompt}\n\n${docRule}` : p.prompt;
      const prompt = b.extra ? `${base}\n\nDessutom: ${b.extra}` : base;
      return json(res, 202, { job: jobSummary(runAction(id, "claude", { title: p.label, prompt })) });
    }
    if (m === "POST" && parts[2] === "studio") {
      const b = await body(req);
      if (b.stop) {
        stopStudio(id);
        return json(res, 200, { port: null });
      }
      return json(res, 200, await startStudio(id));
    }
    if (m === "POST" && parts[2] === "voice") {
      // the narrator of this film: the design brief (design.json) and/or a ready ElevenLabs voice (voice.json)
      const b = await body(req);
      const dir = projectDir(id);
      const rj = (f, fb) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : fb);
      if (b.description !== undefined || b.text !== undefined) {
        const f = path.join(dir, "voice/design.json");
        const cur = rj(f, { model: "eleven_ttv_v3" });
        writeFileSync(f, JSON.stringify({ ...cur, ...(b.description !== undefined ? { description: String(b.description) } : {}), ...(b.text !== undefined ? { text: String(b.text) } : {}) }, null, 2) + "\n");
      }
      if (b.voice_id !== undefined) {
        const vid = String(b.voice_id).trim();
        if (vid && !/^[A-Za-z0-9]{8,40}$/.test(vid)) return json(res, 400, { error: "Voice ID ser inte rätt ut (bokstäver och siffror från ElevenLabs)" });
        writeFileSync(path.join(dir, "voice/voice.json"), JSON.stringify(vid ? { voice_id: vid, name: String(b.name || "Berättare").slice(0, 60) } : { voice_id: "PUT-YOUR-VOICE-ID-HERE", name: "narrator" }, null, 2) + "\n");
      }
      return json(res, 200, { ok: true });
    }
    if (m === "POST" && parts[2] === "voice-to-profile") {
      const film = JSON.parse(readFileSync(path.join(projectDir(id), "film.json"), "utf8"));
      if (!film.profile) return json(res, 400, { error: "filmen har ingen profil" });
      const d = voiceToProfile(projectDir(id), film.profile);
      return json(res, 200, { ok: true, dir: d });
    }
    if (m === "POST" && parts[2] === "claude-reset") {
      saveApp(id, { claudeSession: null, claudeLast: null });
      return json(res, 200, { ok: true });
    }
    if (m === "POST" && parts[2] === "delete") return json(res, 200, { entry: deleteProject(id) });
    if (m === "POST" && parts[2] === "voice-choose") return json(res, 200, await chooseVoice(id, await body(req)));
    if (m === "GET" && parts[2] === "profile-diff") return json(res, 200, profileDiff(id));
    if (m === "POST" && parts[2] === "documents") return json(res, 200, uploadDocument(id, await body(req, 8e7)));
    if (m === "POST" && parts[2] === "documents-remove") {
      removeDocument(id, (await body(req)).name);
      return json(res, 200, { ok: true });
    }
    if (m === "POST" && parts[2] === "documents-rights") {
      setRights(id, await body(req));
      return json(res, 200, { ok: true });
    }
    if (m === "POST" && parts[2] === "documents-use") return json(res, 202, { job: jobSummary(usePicture(id, await body(req))) });
    if (m === "POST" && parts[2] === "documents-read") return json(res, 202, { job: jobSummary(readDocuments(id, await body(req))) });
    if (m === "POST" && parts[2] === "upload-audio") {
      return json(res, 202, { job: jobSummary(uploadAudio(id, await body(req, 8e7))) });
    }
    if (m === "POST" && parts[2] === "approve") {
      approve(id, (await body(req)).step);
      return json(res, 200, { ok: true });
    }
    if (m === "POST" && parts[2] === "reveal-file") {
      revealFile(id, (await body(req)).path);
      return json(res, 200, { ok: true });
    }
    if (m === "POST" && parts[2] === "reveal") {
      reveal(id, (await body(req)).sub || "");
      return json(res, 200, { ok: true });
    }
  }
  if (parts[0] === "jobs" && parts[1]) {
    const job = getJob(parts[1]);
    if (!job) return json(res, 404, { error: "inget sådant jobb" });
    if (m === "POST" && parts[2] === "stop") return json(res, 200, { stopped: stopJob(job.id) });
    if (m === "GET" && parts[2] === "stream") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
      send({ type: "hello", job: jobSummary(job), lines: job.lines });
      if (job.status !== "running") {
        send({ type: "end", status: job.status });
        return res.end();
      }
      const l = (ev) => {
        send(ev);
        if (ev.type === "end") res.end();
      };
      job.listeners.add(l);
      const ping = setInterval(() => res.write(": ping\n\n"), 20000);
      req.on("close", () => {
        clearInterval(ping);
        job.listeners.delete(l);
      });
      return;
    }
  }
  if (m === "POST" && parts[0] === "settings") {
    const b = await body(req);
    // a key the service turns down is never saved (it would win over a working one from the environment)
    for (const k of KEYS) if (typeof b.keys?.[k] === "string") await checkKey(k, b.keys[k]);
    saveConfig(b);
    if (b.keys) saveSecrets(b.keys);
    checks = null;
    return json(res, 200, { ok: true });
  }
  if (m === "POST" && parts[0] === "quit") {
    json(res, 200, { ok: true });
    return setTimeout(shutdown, 200);
  }
  json(res, 404, { error: "finns inte" });
}

// ── client profiles ──
async function profilesApi(req, res, parts) {
  const m = req.method;
  const id = parts[0] ? decodeURIComponent(parts[0]) : null;
  const withJobs = (pid) => {
    const r = runningJob(jobKey(pid));
    return { jobs: projectJobs(jobKey(pid)), running: r ? jobSummary(r) : null };
  };
  if (!id && m === "GET") {
    return json(res, 200, { root: ownRoot(), profiles: listProfiles().map(({ dir, ...p }) => ({ ...p, own: path.dirname(dir) === ownRoot(), running: runningJob(jobKey(p.id)) ? jobSummary(runningJob(jobKey(p.id))) : null })) });
  }
  if (!id && m === "POST") {
    const { id: nid, job } = createProfile((await body(req)).name);
    return json(res, 202, { id: nid, job: jobSummary(job) });
  }
  if (m === "GET" && !parts[1]) {
    const { dir, ...p } = readProfile(id);
    return json(res, 200, { ...p, ...withJobs(id) });
  }
  if (m !== "POST") return json(res, 404, { error: "finns inte" });
  const act = parts[1];
  if (act === "save") {
    const { fontsChanged } = saveProfile(id, await body(req));
    let job = null;
    if (fontsChanged) {
      const { dir } = readProfile(id);
      job = startJob(jobKey(id), "Hämta typsnitt", [{ label: "fetch_fonts.py", cmd: "python3", args: [path.join(SKILL_DIR, "template/tools/fetch_fonts.py"), dir], cwd: dir }]);
    }
    return json(res, 200, { ok: true, job: job && jobSummary(job) });
  }
  if (act === "upload") return json(res, 200, upload(id, await body(req, 8e7)));
  if (act === "remove") {
    removeFile(id, (await body(req)).path);
    return json(res, 200, { ok: true });
  }
  if (act === "claude") {
    const b = await body(req);
    const presets = { build: [profilePrompt, "Claude: bygg profilen"], sync: [syncPrompt, "Claude: synka designsystemet"] };
    const pre = presets[b.preset];
    const prompt = pre ? pre[0]() + (b.extra ? `\n\nDessutom: ${b.extra}` : "") : b.prompt;
    return json(res, 202, { job: jobSummary(profileClaude(id, prompt, pre ? pre[1] : `Claude: ${String(prompt).slice(0, 40)}`)) });
  }
  if (act === "claude-reset") {
    const f = path.join(readProfile(id).dir, ".infofilm-app.json");
    if (existsSync(f)) writeFileSync(f, JSON.stringify({ ...JSON.parse(readFileSync(f, "utf8")), claudeSession: null, claudeLast: null }, null, 2) + "\n");
    return json(res, 200, { ok: true });
  }
  if (act === "preview") return json(res, 202, { job: jobSummary(previewProfile(id)) });
  if (act === "delete") return json(res, 200, deleteProfile(id));
  return json(res, 404, { error: "finns inte" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // only this machine, and only pages served by the app itself may change things
    const host = (req.headers.host || "").split(":")[0];
    if (!["localhost", "127.0.0.1"].includes(host)) return json(res, 403, { error: "fel värd" });
    if (req.method !== "GET" && req.headers["x-infofilm"] !== "1") return json(res, 403, { error: "saknar appens huvud" });

    if (url.pathname.startsWith("/api/")) return await api(req, res, url);

    if (url.pathname.startsWith("/pfiles/")) {
      const [, , id, ...rest] = url.pathname.split("/");
      const file = profileFile(decodeURIComponent(id), decodeURIComponent(rest.join("/")));
      if (!existsSync(file)) return json(res, 404, { error: "finns inte" });
      return sendFile(req, res, file, { untrusted: true });
    }

    if (url.pathname.startsWith("/files/")) {
      const [, , id, ...rest] = url.pathname.split("/");
      const rel = decodeURIComponent(rest.join("/"));
      if (!SERVABLE.some((r) => r.test(rel)) || rel.includes("..")) return json(res, 403, { error: "inte tillåtet" });
      const file = path.join(projectDir(id), rel);
      if (!existsSync(file)) return json(res, 404, { error: "finns inte" });
      return sendFile(req, res, file, { untrusted: true });
    }

    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = path.join(PUBLIC, path.normalize(rel));
    if (!file.startsWith(PUBLIC) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(200, { "Content-Type": TYPES[".html"] });
      return res.end(readFileSync(path.join(PUBLIC, "index.html")));
    }
    sendFile(req, res, file);
  } catch (e) {
    json(res, e.status || 500, { error: e.message });
  }
});

function shutdown() {
  stopAll();
  stopStudios();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `porten ${PORT} används redan – körs appen redan?` : e.message);
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => console.log(`Infofilm: http://localhost:${PORT}`));
