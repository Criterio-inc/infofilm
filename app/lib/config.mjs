// Settings live in ~/.infofilm/: config.json (folders, port) and secrets.json (API keys, mode 600).
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SKILL_DIR = path.resolve(APP_DIR, "../skills/infofilm");
export const HOME_DIR = path.join(os.homedir(), ".infofilm");
const CONFIG = path.join(HOME_DIR, "config.json");
const SECRETS = path.join(HOME_DIR, "secrets.json");
export const KEYS = ["ELEVENLABS_API_KEY", "OPENROUTER_API_KEY"];

const expand = (p) => (p && p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);
const readJson = (f, fallback) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return fallback;
  }
};

export function loadConfig() {
  const c = { filmsDir: "~/Filmer", profilesDir: "", port: 4747, browserExecutable: "", ...readJson(CONFIG, {}) };
  // client profiles live outside the repo (no client material on GitHub, no clash with git pull)
  if (!c.profilesDir) c.profilesDir = "~/Kundprofiler";
  return { ...c, filmsPath: path.resolve(expand(c.filmsDir)), profilesPath: path.resolve(expand(c.profilesDir)) };
}

export function saveConfig(patch) {
  mkdirSync(HOME_DIR, { recursive: true });
  const cur = readJson(CONFIG, {});
  for (const k of ["filmsDir", "profilesDir", "browserExecutable"]) if (typeof patch[k] === "string") cur[k] = patch[k].trim();
  writeFileSync(CONFIG, JSON.stringify(cur, null, 2) + "\n");
}

export function loadSecrets() {
  return readJson(SECRETS, {});
}

export function saveSecrets(patch) {
  mkdirSync(HOME_DIR, { recursive: true });
  const cur = loadSecrets();
  for (const k of KEYS) {
    if (typeof patch[k] !== "string") continue;
    if (patch[k].trim()) cur[k] = patch[k].trim();
    else delete cur[k];
  }
  writeFileSync(SECRETS, JSON.stringify(cur, null, 2) + "\n", { mode: 0o600 });
  chmodSync(SECRETS, 0o600);
}

/** The environment every tool runs in: the user's, plus the keys, the profiles folder and a PATH
 * that also finds Homebrew and ~/.local/bin when the app was started from the Dock. */
export function toolEnv(extra = {}) {
  const c = loadConfig();
  const env = { ...process.env, ...loadSecrets(), ...extra };
  for (const k of KEYS) if (process.env[k] && !env[k]) env[k] = process.env[k];
  const more = ["/opt/homebrew/bin", "/usr/local/bin", path.join(os.homedir(), ".local/bin"), path.join(os.homedir(), ".npm-global/bin")];
  // the Python packages live in ~/.infofilm/venv (macos/setup.sh): its python3 goes first
  const venv = path.join(HOME_DIR, "venv/bin");
  env.PATH = [...new Set([...(existsSync(venv) ? [venv] : []), ...(env.PATH || "").split(":"), ...more])].filter(Boolean).join(":");
  if (c.profilesPath) env.INFOFILM_PROFILES = c.profilesPath;
  if (c.browserExecutable) env.BROWSER_EXECUTABLE = c.browserExecutable;
  env.FORCE_COLOR = "0";
  for (const [k, v] of Object.entries(env)) if (v === "") delete env[k]; // "" in extra = remove
  return env;
}

export const exists = (p) => existsSync(p);
