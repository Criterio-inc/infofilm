// Settings live in ~/.infofilm/: config.json (folders, port). API keys live encrypted in the macOS
// keychain (service "infofilm", one item per key); elsewhere, or for an old install, in secrets.json (mode 600).
import { execFileSync } from "node:child_process";
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

const KEYCHAIN = "infofilm";
const MAC = process.platform === "darwin";
let kc = null;
let kcAt = 0;

/** The keys in the keychain, read with Apple's own security tool (no prompt for its own items). */
function keychain() {
  if (!MAC) return {};
  if (kc && Date.now() - kcAt < 30000) return kc;
  kc = {};
  for (const k of KEYS) {
    try {
      const v = execFileSync("security", ["find-generic-password", "-s", KEYCHAIN, "-a", k, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (v) kc[k] = v;
    } catch {
      /* not in the keychain */
    }
  }
  kcAt = Date.now();
  return kc;
}

/** The keys the tools get: the keychain first, then an old secrets.json (the environment comes after, in toolEnv). */
export function loadSecrets() {
  return { ...readJson(SECRETS, {}), ...keychain() };
}

// a free call per service that tells a working key from a wrong one (no credits used)
const KEY_CHECKS = {
  ELEVENLABS_API_KEY: { name: "ElevenLabs", url: "https://api.elevenlabs.io/v1/user/subscription", headers: (k) => ({ "xi-api-key": k }) },
  OPENROUTER_API_KEY: { name: "OpenRouter", url: "https://openrouter.ai/api/v1/key", headers: (k) => ({ Authorization: `Bearer ${k}` }) },
};

/** Throws a readable error when the service turns the key down; offline counts as fine. */
export async function checkKey(k, value) {
  const c = KEY_CHECKS[k];
  if (!c || !value.trim()) return;
  let res;
  try {
    res = await fetch(c.url, { headers: c.headers(value.trim()), signal: AbortSignal.timeout(10000) });
  } catch {
    return; // no network: save it, the first real call will tell
  }
  if (res.status === 401 || res.status === 403)
    throw Object.assign(new Error(`${c.name} godtar inte nyckeln (${res.status}). Kontrollera att du kopierat hela nyckeln${k === "ELEVENLABS_API_KEY" ? ", den börjar med sk_" : ""}. Inget sparades.`), { status: 400 });
}

export function saveSecrets(patch) {
  mkdirSync(HOME_DIR, { recursive: true });
  const file = readJson(SECRETS, {});
  for (const k of KEYS) {
    if (typeof patch[k] !== "string") continue;
    const v = patch[k].trim();
    if (MAC) {
      // the keychain holds it; the old plain-text copy goes
      if (v) execFileSync("security", ["add-generic-password", "-U", "-s", KEYCHAIN, "-a", k, "-l", `Infofilm ${k}`, "-w", v], { stdio: "ignore" });
      else {
        try {
          execFileSync("security", ["delete-generic-password", "-s", KEYCHAIN, "-a", k], { stdio: "ignore" });
        } catch {
          /* was not there */
        }
      }
      delete file[k];
    } else if (v) file[k] = v;
    else delete file[k];
  }
  kc = null;
  writeFileSync(SECRETS, JSON.stringify(file, null, 2) + "\n", { mode: 0o600 });
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
  // plain text in the app's log: Python 3.13+ colours its tracebacks otherwise
  env.NO_COLOR = "1";
  env.PYTHON_COLORS = "0";
  for (const [k, v] of Object.entries(env)) if (v === "") delete env[k]; // "" in extra = remove
  return env;
}

export const exists = (p) => existsSync(p);
