// Claude Code, headless, in a film project: `claude -p` with the infofilm skill, a fixed set of
// allowed tools and no paid steps. Each project keeps one conversation (--resume), so a follow-up
// instruction ("gör scen 2 luftigare") continues where the last one ended.
import { readFileSync } from "node:fs";
import path from "node:path";
import { SKILL_DIR } from "./config.mjs";

const ALLOWED = [
  "Read", "Edit", "Write", "Glob", "Grep", "WebSearch", "WebFetch", "Agent", "Skill", "TodoWrite",
  "Bash(python3 tools/*)", "Bash(python3 voice/listen.py*)", "Bash(node tools/*)", "Bash(npx tsc*)",
  "Bash(cd *)", "Bash(ls*)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)", "Bash(grep *)",
  "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)", "Bash(ffprobe *)", "Bash(rm -rf ../out/stills*)",
];
// the paid steps are the app's buttons, never Claude's
const DENIED = ["Bash(python3 voice/narrate.py*)", "Bash(python3 voice/design_voice.py*)", "Bash(python3 art/gen.py*)", "Bash(rm -rf /*)"];

const SYSTEM = (dir) => `You are running headless from the Infofilm app on the user's computer, in the film project ${dir}, made with the infofilm skill (${SKILL_DIR}: read SKILL.md and the references you need before working, and follow them).
- You cannot ask questions while you work. When something is the user's decision (a ⛔ gate in the skill, a fact you cannot verify, a missing brand asset), finish what you can and end with the question; the user answers in the app.
- Never run the paid steps (voice/narrate.py, voice/design_voice.py, art/gen.py, Suno), not even with --dry-run: the user estimates, approves and runs them with the app's buttons.
- Free tools are fine: tools/build_timeline.py, cues.py, lint_cues.py, sync_art.py, node tools/stills.mjs and review.mjs, npx tsc.
- Write to the user in Swedish, short, and end with what they should do next in the app (for example: "Granska manuset och tryck på Röst → Vad kostar det?").`;

// a client profile: read the client's material, write the profile files, fetch fonts and assets
const ALLOWED_PROFILE = () => [
  "Read", "Edit", "Write", "Glob", "Grep", "WebSearch", "WebFetch", "TodoWrite",
  `Bash(python3 ${SKILL_DIR}/template/tools/fetch_fonts.py*)`, "Bash(curl *)", "Bash(ls*)", "Bash(mkdir *)", "Bash(cp *)",
  "Bash(mv *)", "Bash(file *)", "Bash(unzip *)", "Bash(sips *)", "Bash(cat *)", "Bash(head *)", "Bash(grep *)",
];

const SYSTEM_PROFILE = (dir) => `You are running headless from the Infofilm app on the user's computer, in the client profile folder ${dir} of the infofilm skill (${SKILL_DIR}: read profiles/README.md and references/style.md, and look at profiles/_mall and profiles/newsreel as examples).
- The profile decides how every film for this client looks and sounds: profile.json (palette by role, fonts, logo, card, motion, end card), style.json (the illustration style and its never-list), design.json (the narrator brief, in English, for ElevenLabs Voice Design) and NOTES.md (tone of voice, address, words, approvals, allowed services).
- The client's material is in material/ (brand manual PDFs, logos, example images, presentations) and material/LINKS.md (websites). Read all of it. Take colours, fonts and the logo from it; never invent a brand value. What the material does not settle goes, as a question, at the end of NOTES.md and of your answer.
- The logo for the title band and the end card is logo.svg or logo.png in the profile folder (profile.json "logo.file"); it sits on the "band" colour, so pick the variant made for that background. You may download a logo or a font from the client's own website with curl.
- A licensed font that is not on Google Fonts: use its files if they are in material/ or fonts/ (as "files" in profile.json); otherwise pick the closest Google font and note the substitution in NOTES.md.
- You cannot ask questions while you work. Write to the user in Swedish, short, and end with what they should check or send next (for example: "Tryck på Testbilder och se om färgerna stämmer").`;

export function claudeStep(id, dir, prompt, { kind = "film" } = {}) {
  if (!prompt || !String(prompt).trim()) throw Object.assign(new Error("skriv en instruktion"), { status: 400 });
  let session = null;
  try {
    session = JSON.parse(readFileSync(path.join(dir, ".infofilm-app.json"), "utf8")).claudeSession || null;
  } catch {
    /* first conversation in this project */
  }
  const args = [
    "-p", String(prompt),
    "--output-format", "stream-json", "--verbose",
    "--permission-mode", "dontAsk",
    "--allowedTools", (kind === "profile" ? ALLOWED_PROFILE() : ALLOWED).join(","),
    "--disallowedTools", DENIED.join(","),
    "--add-dir", SKILL_DIR,
    "--append-system-prompt", kind === "profile" ? SYSTEM_PROFILE(dir) : SYSTEM(dir),
  ];
  if (session) args.push("--resume", session);
  // a server started from a terminal inside Claude Code must not hand that session's identity on
  const env = { CLAUDECODE: "", CLAUDE_CODE_SESSION_ID: "", CLAUDE_CODE_CHILD_SESSION: "", CLAUDE_PID: "", CLAUDE_CODE_ENTRYPOINT: "" };
  return { label: session ? "Claude (fortsätter samtalet)" : "Claude", cmd: "claude", args, cwd: dir, env, parse: (line, job) => parseEvent(line, job, dir) };
}

const short = (s, n = 140) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

/** One stream-json line → one readable log line (or nothing). */
function parseEvent(line, job, dir) {
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    return line.trim() ? line : null;
  }
  if (ev.session_id) job.data.session = ev.session_id;
  if (ev.type === "assistant") {
    const out = [];
    for (const c of ev.message?.content ?? []) {
      if (c.type === "text" && c.text.trim()) out.push(`💬 ${c.text.trim()}`);
      if (c.type === "tool_use") {
        const t = toolLine(c.name, c.input || {}, dir);
        if (t) out.push(`→ ${t}`);
      }
    }
    return out.join("\n") || null;
  }
  if (ev.type === "user") {
    const denied = (ev.message?.content ?? []).find((c) => c.type === "tool_result" && c.is_error && /permission|denied|not allowed/i.test(JSON.stringify(c.content)));
    return denied ? "  ⚠ ett verktyg nekades (appens säkerhetsregler)" : null;
  }
  if (ev.type === "result") {
    job.data.result = ev.result ?? null;
    job.data.cost = ev.total_cost_usd ?? null;
    return `✓ klart${ev.num_turns ? ` efter ${ev.num_turns} steg` : ""}${ev.is_error ? " (med fel)" : ""}`;
  }
  return null;
}

function toolLine(name, input, dir) {
  const rel = (p) => String(p || "").replace(dir + "/", "").replace(SKILL_DIR + "/", "skill/");
  switch (name) {
    case "Bash":
      return `kör: ${short(input.command, 160)}`;
    case "Read":
      return `läser ${rel(input.file_path)}`;
    case "Edit":
    case "Write":
      return `skriver ${rel(input.file_path)}`;
    case "Glob":
    case "Grep":
      return `söker ${short(input.pattern, 60)}`;
    case "WebSearch":
      return `söker på webben: ${short(input.query, 100)}`;
    case "WebFetch":
      return `läser ${short(input.url, 100)}`;
    case "Agent":
      return `startar en hjälpagent: ${short(input.description, 80)}`;
    case "Skill":
      return `laddar skillen ${input.skill || ""}`;
    case "TodoWrite":
      return null;
    default:
      return name;
  }
}
