// Review sheet for several scenes in ONE bundle + ONE browser: picks N evenly spaced frames per scene
// (skipping the card's entrance/exit) and writes one contact sheet per scene.
//   node tools/review.mjs <N> <compositionId> [<compositionId> ...]
// Prints one sheet path per scene. Output: $STILLS_DIR/review (default ../out/review).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const [nArg, ...ids] = process.argv.slice(2);
const N = Number(nArg);
const base = process.env.STILLS_DIR ? path.join(process.env.STILLS_DIR, "review") : path.resolve("../out/review");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
process.on("exit", () => rmSync(serveUrl, { recursive: true, force: true }));
for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id });
  const d = composition.durationInFrames;
  const frames = Array.from({ length: N }, (_, i) => Math.round(30 + ((d - 60) * i) / (N - 1)));
  const out = path.join(base, id);
  mkdirSync(out, { recursive: true });
  const files = [];
  for (const f of frames) {
    const output = path.join(out, `${id}_${f}.png`);
    await renderStill({ serveUrl, composition, frame: f, output, overwrite: true, logLevel: "error" });
    files.push(output);
  }
  const cols = 3;
  const cellW = 640;
  const cellH = 360;
  const scaled = files.map((_, i) => `[${i}]scale=${cellW}:${cellH},drawtext=text='${frames[i]}':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6[s${i}]`);
  const padN = files.length % cols ? cols - (files.length % cols) : 0;
  const pads = Array.from({ length: padN }, (_, k) => `color=black:s=${cellW}x${cellH}:d=1[p${k}]`);
  const cells = files.map((_, i) => `[s${i}]`).concat(pads.map((_, k) => `[p${k}]`));
  const rows = [];
  for (let r = 0; r < cells.length / cols; r++) rows.push(`${cells.slice(r * cols, r * cols + cols).join("")}hstack=inputs=${cols}[r${r}]`);
  const graph = [...scaled, ...pads, ...rows].join(";") + (rows.length > 1 ? `;${rows.map((_, r) => `[r${r}]`).join("")}vstack=inputs=${rows.length}[out]` : "");
  const sheet = path.join(base, `${id}_review.jpg`);
  execFileSync("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", graph, "-map", rows.length > 1 ? "[out]" : "[r0]", "-frames:v", "1", "-q:v", "4", sheet]);
  console.log(sheet);
}
