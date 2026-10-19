// Voices for the film's narrator, straight from ElevenLabs: the user's own voices and the Swedish voices of
// the public voice library, with preview clips. Listing and listening are free; only narration costs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { toolEnv } from "./config.mjs";
import { logLine, projectDir } from "./projects.mjs";
import { runningJob } from "./jobs.mjs";

const API = "https://api.elevenlabs.io";
const err = (msg, status = 400) => Object.assign(new Error(msg), { status });

async function call(url, { method = "GET", body } = {}) {
  const key = toolEnv().ELEVENLABS_API_KEY;
  if (!key) throw err("ingen ElevenLabs-nyckel: lägg in den under Inställningar", 400);
  let r;
  try {
    r = await fetch(API + url, { method, headers: { "xi-api-key": key, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  } catch {
    throw err("ingen kontakt med ElevenLabs: kontrollera internetanslutningen", 502);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw err(`ElevenLabs svarade ${r.status}: ${j?.detail?.message || j?.detail?.status || "okänt fel"}`, r.status === 401 ? 400 : 502);
  return j;
}

// the same fields for both lists, so the page draws one kind of row
const row = (v, extra = {}) => ({
  voice_id: v.voice_id,
  name: v.name,
  gender: v.gender || v.labels?.gender || "",
  age: v.age || v.labels?.age || "",
  accent: v.accent || v.labels?.accent || "",
  use_case: v.use_case || v.labels?.use_case || "",
  description: String(v.description || v.labels?.descriptive || v.descriptive || "").trim().slice(0, 240),
  preview_url: v.preview_url || null,
  category: v.category || "",
  ...extra,
});

// preview clips come from ElevenLabs' storage as text/plain, which Safari's engine (the app window) will not
// play: the app passes them on as audio, and only from that storage, never any other address
const PREVIEW_HOST = /^https:\/\/storage\.googleapis\.com\/eleven-public-(prod|cdn)\//;
export async function previewClip(url) {
  if (!PREVIEW_HOST.test(String(url || ""))) throw err("inte ett röstprov från ElevenLabs", 403);
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!r?.ok) throw err("röstprovet gick inte att hämta", 502);
  return Buffer.from(await r.arrayBuffer());
}

let mineCache = null;
let mineAt = 0;
/** The user's own voices (designed, cloned, saved from the library), then the premade ones. */
export async function myVoices(fresh = false) {
  if (mineCache && !fresh && Date.now() - mineAt < 300000) return mineCache;
  const out = [];
  let token = "";
  for (let i = 0; i < 10; i++) {
    const j = await call(`/v2/voices?page_size=100${token ? `&next_page_token=${encodeURIComponent(token)}` : ""}`);
    out.push(...(j.voices || []).map((v) => row(v)));
    if (!j.has_more || !j.next_page_token) break;
    token = j.next_page_token;
  }
  const own = out.filter((v) => v.category !== "premade");
  mineCache = { voices: [...own, ...out.filter((v) => v.category === "premade")], own: own.length };
  mineAt = Date.now();
  return mineCache;
}

const USE = new Set(["narrative_story", "informative_educational", "advertisement", "social_media", "conversational", "characters_animation", "entertainment_tv"]);
/** Swedish voices from the public voice library, filtered, a page at a time. */
export async function libraryVoices({ gender = "", age = "", use_case = "", search = "", page = 0 } = {}) {
  const q = new URLSearchParams({ language: "sv", page_size: "30", page: String(Math.max(0, Number(page) || 0)), sort: "trending" });
  if (["male", "female", "neutral"].includes(gender)) q.set("gender", gender);
  if (["young", "middle_aged", "old"].includes(age)) q.set("age", age);
  if (USE.has(use_case)) q.set("use_cases", use_case);
  if (String(search).trim()) q.set("search", String(search).trim().slice(0, 60));
  const j = await call(`/v1/shared-voices?${q}`);
  return { voices: (j.voices || []).map((v) => row(v, { public_owner_id: v.public_owner_id })), has_more: Boolean(j.has_more) };
}

/** The film's narrator. A library voice is first added to the user's account (that is how ElevenLabs lets it
 * read); the narration of scenes already read with another voice is redone (and billed) on the next reading. */
export async function chooseVoice(id, { voice_id, name, public_owner_id }) {
  const dir = projectDir(id);
  const busy = runningJob(id);
  if (busy) throw err(`"${busy.title}" körs redan i det här projektet`, 409);
  if (!/^[A-Za-z0-9]{8,40}$/.test(String(voice_id || ""))) throw err("ogiltig röst");
  let vid = voice_id;
  const label = String(name || "Berättare").slice(0, 60);
  if (public_owner_id) {
    if (!/^[A-Za-z0-9]{8,100}$/.test(String(public_owner_id))) throw err("ogiltig röst");
    // already in the account? then use it as it is
    const mine = await myVoices(true);
    const have = mine.voices.find((v) => v.voice_id === voice_id || v.name === label);
    if (have) vid = have.voice_id;
    else {
      const j = await call(`/v1/voices/add/${public_owner_id}/${voice_id}`, { method: "POST", body: { new_name: label } });
      vid = j.voice_id || voice_id;
      mineCache = null;
    }
  }
  const f = path.join(dir, "voice/voice.json");
  const before = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
  writeFileSync(f, JSON.stringify({ voice_id: vid, name: label }, null, 2) + "\n");
  logLine(id, `berättarröst vald i appen: ${label} (${vid})${before.voice_id && before.voice_id !== vid && !/PUT-YOUR/.test(before.voice_id) ? `, tidigare ${before.name || before.voice_id}` : ""}`);
  return { voice_id: vid, name: label };
}
