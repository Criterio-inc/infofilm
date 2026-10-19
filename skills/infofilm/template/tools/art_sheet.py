#!/usr/bin/env python3
"""A contact sheet of every scene illustration, so you can inspect them all at once.

  python3 tools/art_sheet.py [out.jpg]      # default out/art-sheet.jpg

Look for text the model wrote anyway, doubled props (two hats), extra limbs, the wrong outfit,
and subjects too close to the top or bottom (the card window is ~2.4:1). Then zoom into suspects.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
imgs = sorted((ROOT / "art/img").glob("film-*.png"))
if not imgs:
    sys.exit("no art/img/film-*.png yet")
out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "out/art-sheet.jpg"
out.parent.mkdir(parents=True, exist_ok=True)
cols, w, h = 4, 640, 272
cells = [f"[{i}]scale={w}:{h},drawtext=text='{p.stem[5:]}':x=8:y=8:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.6[s{i}]" for i, p in enumerate(imgs)]
pads = (-len(imgs)) % cols
cells += [f"color=black:s={w}x{h}:d=1[p{k}]" for k in range(pads)]
names = [f"[s{i}]" for i in range(len(imgs))] + [f"[p{k}]" for k in range(pads)]
rows = [f"{''.join(names[r:r + cols])}hstack={cols}[r{r // cols}]" for r in range(0, len(names), cols)]
n = len(rows)
graph = ";".join(cells + rows) + (f";{''.join(f'[r{i}]' for i in range(n))}vstack={n}[out]" if n > 1 else "")
args = [a for p in imgs for a in ("-i", str(p))]
subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", graph, "-map", "[out]" if n > 1 else "[r0]", "-frames:v", "1", "-q:v", "3", str(out)], check=True)
print(out)
