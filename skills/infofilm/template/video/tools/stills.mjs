// Render several stills of one composition in ONE bundle + ONE browser, then a contact sheet.
//   node tools/stills.mjs <compositionId> <frame,frame,...> [outDir]
// Prints the sheet path. Use this instead of repeated `remotion still` calls (saves minutes and RAM).
// Also prints [cue-missing] lines seen while rendering. Output: $STILLS_DIR (default ../out/stills)/<id>/.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const [id, framesArg, outArg] = process.argv.slice(2);
if (!id || !framesArg) {
  console.error("usage: node tools/stills.mjs <compositionId> <f1,f2,...> [outDir]");
  process.exit(1);
}
const frames = framesArg.split(",").map(Number);
const out = outArg ?? path.join(process.env.STILLS_DIR ?? path.resolve("../out/stills"), id);
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), enableCaching: process.env.STILLS_CACHE !== "0" });
// every bundle is a fresh temp dir with a full copy of public/ (~90 MB) — remove it on exit, or
// a day of stills fills the disk (2026-10-02: 326 leftover bundles = 28 GB)
const cleanup = () => rmSync(serveUrl, { recursive: true, force: true });
process.on("exit", cleanup);
const composition = await selectComposition({ serveUrl, id });
const files = [];
const done = []; // frame numbers that rendered (labels)
// report missing cues seen while rendering
const warnings = new Set();
const onBrowserLog = (log) => {
  if (/\[(i18n-missing|cue-unmapped|cue-missing)\]/.test(log.text)) warnings.add(log.text);
};
for (const frame of frames) {
  const f = Math.min(frame, composition.durationInFrames - 1);
  const output = path.join(out, `${id}_${f}.png`);
  try {
    await renderStill({ serveUrl, composition, frame: f, output, overwrite: true, logLevel: "error", onBrowserLog });
    files.push(output);
    done.push(f);
  } catch (e) {
    // keep going: one broken frame should not hide the others
    console.log(`frame ${f} FAILED: ${String(e.message ?? e).split("\n")[0]}`);
  }
}
for (const w of [...warnings].sort()) console.log(w);
if (!files.length) process.exit(1);
// contact sheet: 2 columns of 960 px (widescreen) or 4 columns of 400 px (vertical 9:16)
const tall = composition.height > composition.width;
const cols = tall ? 4 : 2;
const cellW = tall ? 400 : 960;
const cellH = Math.round((cellW * composition.height) / composition.width / 2) * 2;
const inputs = files.flatMap((f) => ["-i", f]);
const scaled = files.map((_, i) => `[${i}]scale=${cellW}:${cellH},drawtext=text='${done[i]}':x=12:y=12:fontsize=28:fontcolor=yellow:box=1:boxcolor=black@0.6[s${i}]`);
const pad = files.length % cols ? Array.from({ length: cols - (files.length % cols) }, (_, k) => `color=black:s=${cellW}x${cellH}:d=1[pad${k}]`) : [];
const cells = files.map((_, i) => `[s${i}]`).concat(pad.map((_, k) => `[pad${k}]`));
const rows = [];
for (let r = 0; r < cells.length / cols; r++) rows.push(`${cells.slice(r * cols, r * cols + cols).join("")}hstack=inputs=${cols}[r${r}]`);
const stack = rows.length > 1 ? `;${rows.map((_, r) => `[r${r}]`).join("")}vstack=inputs=${rows.length}[out]` : "";
const graph = [...scaled, ...pad, ...rows].join(";") + (stack || "");
const sheet = path.join(out, `${id}_sheet.png`);
execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", graph, "-map", rows.length > 1 ? "[out]" : "[r0]", "-frames:v", "1", sheet]);
console.log(sheet);
