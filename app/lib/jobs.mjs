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
 * parse turns a raw output line into what the log shows (null hides it).
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
    if (job.status !== "running") return;
    push(job, `▸ ${step.label}`, "step");
    const code = await new Promise((resolve) => {
      let child;
      try {
        child = spawn(step.cmd, step.args, { cwd: step.cwd, env: toolEnv(step.env), stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        push(job, e.message, "err");
        return resolve(1);
      }
      job.child = child;
      const feed = (stream, kind) => {
        let buf = "";
        stream.on("data", (d) => {
          buf += d.toString();
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const raw = buf.slice(0, i).replace(/\r$/, "");
            buf = buf.slice(i + 1);
            const shown = step.parse ? step.parse(raw, job) : raw;
            if (shown != null && shown !== "") push(job, shown, kind);
          }
        });
        stream.on("end", () => {
          if (buf) {
            const shown = step.parse ? step.parse(buf, job) : buf;
            if (shown) push(job, shown, kind);
          }
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
    if (job.status !== "running") return;
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

export function stopJob(id) {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return false;
  job.status = "stopped";
  job.child?.kill("SIGTERM");
  push(job, "■ avbrutet", "err");
  running.delete(job.project);
  job.ended = Date.now();
  for (const l of job.listeners) l({ type: "end", status: "stopped" });
  return true;
}

export const getJob = (id) => jobs.get(id);
export const runningJob = (project) => (running.has(project) ? jobs.get(running.get(project)) : null);
export const projectJobs = (project) =>
  [...jobs.values()].filter((j) => j.project === project).sort((a, b) => b.started - a.started).map(summary);
export const summary = (j) => ({ id: j.id, title: j.title, status: j.status, started: j.started, ended: j.ended });
export const stopAll = () => [...running.values()].forEach(stopJob);
