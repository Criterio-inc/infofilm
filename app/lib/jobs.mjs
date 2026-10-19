// Jobs: a sequence of commands run one after the other in a project, with the output kept in
// memory and streamed to the page (server-sent events). One job at a time per project.
import { spawn } from "node:child_process";
import { toolEnv } from "./config.mjs";

const jobs = new Map(); // id → job
const running = new Map(); // project → job id
let seq = 0;
const MAX_LINES = 4000;

/**
 * steps: [{ label, cmd, args, cwd, env?, parse?(line, job) → string|null, after?(job) }]
 * parse turns a raw output line into what the log shows (null hides it). args may be a function,
 * evaluated when the step starts (so it sees what earlier steps wrote).
 */
export function startJob(project, title, steps, { onDone } = {}) {
  if (running.has(project)) {
    const cur = jobs.get(running.get(project));
    throw Object.assign(new Error(`"${cur.title}" körs redan i det här projektet`), { status: 409 });
  }
  const job = { id: String(++seq), project, title, status: "running", lines: [], started: Date.now(), ended: null, listeners: new Set(), data: {}, child: null };
  jobs.set(job.id, job);
  running.set(project, job.id);
  run(job, steps, onDone);
  return job;
}

function push(job, line, kind = "out") {
  const entry = { t: Date.now(), kind, line };
  job.lines.push(entry);
  if (job.lines.length > MAX_LINES) job.lines.splice(0, job.lines.length - MAX_LINES);
  for (const l of job.listeners) l({ type: "line", ...entry });
}

function finish(job, status, onDone) {
  if (job.ended) return;
  job.status = status;
  job.ended = Date.now();
  job.child = null;
  running.delete(job.project);
  try {
    onDone?.(job);
  } catch (e) {
    push(job, `fel efteråt: ${e.message}`, "err");
  }
  for (const l of job.listeners) l({ type: "end", status });
}

async function run(job, steps, onDone) {
  for (const step of steps) {
    if (job.status === "stopped") return finish(job, "stopped", onDone);
    push(job, `▸ ${step.label}`, "step");
    const code = await new Promise((resolve) => {
      let child;
      try {
        const args = typeof step.args === "function" ? step.args() : step.args;
        // its own process group, so Stop also ends what it starts (Chrome, ffmpeg, node)
        child = spawn(step.cmd, args, { cwd: step.cwd, env: toolEnv(step.env), stdio: ["ignore", "pipe", "pipe"], detached: true });
      } catch (e) {
        push(job, e.message, "err");
        return resolve(1);
      }
      job.child = child;
      // a parser that throws on an odd line must not take the server down
      const shown = (raw) => {
        try {
          const s = step.parse ? step.parse(raw, job) : raw;
          return s == null || s === "" ? null : String(s);
        } catch {
          return raw;
        }
      };
      const feed = (stream, kind) => {
        let buf = "";
        stream.on("data", (d) => {
          buf += d.toString();
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const raw = buf.slice(0, i).replace(/\r$/, "");
            buf = buf.slice(i + 1);
            if (shown(raw) != null) push(job, shown(raw), kind);
          }
        });
        stream.on("end", () => {
          if (buf && shown(buf) != null) push(job, shown(buf), kind);
        });
      };
      feed(child.stdout, "out");
      feed(child.stderr, "err");
      child.on("error", (e) => {
        push(job, `kunde inte starta ${step.cmd}: ${e.message}`, "err");
        resolve(127);
      });
      child.on("close", (c) => resolve(c ?? 1));
    });
    if (job.status === "stopped") return finish(job, "stopped", onDone);
    if (code !== 0) {
      push(job, `✗ ${step.label} avslutades med kod ${code}`, "err");
      return finish(job, "failed", onDone);
    }
    try {
      await step.after?.(job);
    } catch (e) {
      push(job, e.message, "err");
      return finish(job, "failed", onDone);
    }
  }
  finish(job, "done", onDone);
}

/** Stop a job: the whole process group gets SIGTERM; run() then finishes it (and onDone logs what was spent). */
export function stopJob(id) {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return false;
  job.status = "stopped";
  push(job, "■ avbrutet", "err");
  const pid = job.child?.pid;
  if (pid) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      job.child?.kill("SIGTERM");
    }
  } else finish(job, "stopped");
  return true;
}

/** A second key for a running job (a resource it holds, like the shared preview film). */
export const lockJob = (key, job) => running.set(key, job.id);
export const unlockJob = (key) => running.delete(key);

export const getJob = (id) => jobs.get(id);
export const runningJob = (project) => (running.has(project) ? jobs.get(running.get(project)) : null);
export const projectJobs = (project) =>
  [...jobs.values()].filter((j) => j.project === project).sort((a, b) => b.started - a.started).map(summary);
export const summary = (j) => ({ id: j.id, title: j.title, status: j.status, started: j.started, ended: j.ended });
export const stopAll = () => [...running.values()].forEach(stopJob);
