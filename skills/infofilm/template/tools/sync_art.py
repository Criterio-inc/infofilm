#!/usr/bin/env python3
"""Copy the scene illustrations into the video: art/img/film-<Sxx>.png → video/public/img/film-<Sxx>.jpg
(2400 px wide JPEG — the card window is 1800 px, the camera zooms in a little).

  python3 tools/sync_art.py          # every film-*.png that is new or changed
  python3 tools/sync_art.py --all    # also every other png in art/img (props, environments)
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DST = ROOT / "art/img", ROOT / "video/public/img"
DST.mkdir(parents=True, exist_ok=True)
pattern = "*.png" if "--all" in sys.argv else "film-*.png"
n = 0
for png in sorted(SRC.glob(pattern)):
    jpg = DST / (png.stem + ".jpg")
    if jpg.exists() and jpg.stat().st_mtime >= png.stat().st_mtime:
        continue
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(png), "-vf", "scale='min(2400,iw)':-2", "-q:v", "3", str(jpg)], check=True)
    n += 1
print(f"{n} images converted into {DST.relative_to(ROOT)} — run tools/build_timeline.py to pick them up")
