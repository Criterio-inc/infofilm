#!/usr/bin/env node
// Infofilm: a small local app around the infofilm skill. Listens on 127.0.0.1 only.
//   node server.mjs            (or ./start.sh, which also opens the window)
import { execFile } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { createProject, PRESETS, reveal, runAction, startStudio, stopStudio, stopStudios, studioPort } from "./lib/actions.mjs";
import { APP_DIR, KEYS, SKILL_DIR, loadConfig, loadSecrets, saveConfig, saveSecrets, toolEnv } from "./lib/config.mjs";
import { getJob, projectJobs, runningJob, stopAll, stopJob, summary as jobSummary } from "./lib/jobs.mjs";
import { detail, listProfiles, listProjects, projectDir, saveApp } from "./lib/projects.mjs";

const PORT = Number(process.env.INFOFILM_PORT || loadConfig().port || 4747);
const PUBLIC = path.join(APP_DIR, "public");
// files of a project the page may load: renders, stills, illustrations, narration, voice takes
const SERVABLE = [/^out\/[^/]+\.(mp4|srt)$/, /^out\/stills-[^/]+\/review\/[^/]+_review\.jpg$/, /^video\/public\/img\/[^/]+\.jpg$/, /^video\/public\/audio\/[^/]+\.mp3$/, /^voice\/previews\/[^/]+\.mp3$/];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".srt": "text/plain; charset=utf-8", ".json": "application/json" };

// ── checks: what the computer has, cached for a minute ──
let checks = null;
let checksAt = 0;
const run = (cmd, args) =>
  new Promise((resolve) => execFile(cmd, args, { env: toolEnv(), timeout: 15000 }, (err, out, errOut) => resolve(err ? null : (out || errOut).trim().split("\n")[0])));

async function getChecks(force = false) {
  if (checks && !force && Date.now() - checksAt < 60000) return checks;
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

// ── helpers ──
const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};
const body = (req) =>
  new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (d) => {
      b += d;
      if (b.length > 2e6) reject(Object.assign(new Error("för stor"), { status: 413 }));
    });
    req.on("end", () => {
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch {
        reject(Object.assign(new Error("ogiltig JSON"), { status: 400 }));
      }
    });
  });

/** Serve a file with Range support (video and audio need it to seek). */
function sendFile(req, res, file) {
  const st = statSync(file);
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (range) {
    const start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${st.size}` });
      return res.end();
    }
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-cache" });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
  createReadStream(file).pipe(res);
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
  if (parts[0] === "projects" && parts[1]) {
    const id = parts[1];
    if (m === "GET" && !parts[2]) {
      const d = detail(id);
      return json(res, 200, { ...d, jobs: projectJobs(id), running: runningJob(id) ? jobSummary(runningJob(id)) : null, studio: studioPort(id) });
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
      const prompt = b.extra ? `${p.prompt}\n\nDessutom: ${b.extra}` : p.prompt;
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
    if (m === "POST" && parts[2] === "claude-reset") {
      saveApp(id, { claudeSession: null, claudeLast: null });
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // only this machine, and only pages served by the app itself may change things
    const host = (req.headers.host || "").split(":")[0];
    if (!["localhost", "127.0.0.1"].includes(host)) return json(res, 403, { error: "fel värd" });
    if (req.method !== "GET" && req.headers["x-infofilm"] !== "1") return json(res, 403, { error: "saknar appens huvud" });

    if (url.pathname.startsWith("/api/")) return await api(req, res, url);

    if (url.pathname.startsWith("/files/")) {
      const [, , id, ...rest] = url.pathname.split("/");
      const rel = decodeURIComponent(rest.join("/"));
      if (!SERVABLE.some((r) => r.test(rel)) || rel.includes("..")) return json(res, 403, { error: "inte tillåtet" });
      const file = path.join(projectDir(id), rel);
      if (!existsSync(file)) return json(res, 404, { error: "finns inte" });
      return sendFile(req, res, file);
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
