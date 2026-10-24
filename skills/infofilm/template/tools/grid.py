#!/usr/bin/env python3
"""A scene's illustration with a 10 × 10 grid on it, to read where things are for <Story> (camera stops,
rings, pins): every line is a tenth of the picture's width or height, so the third line from the left is
x = 0.3. Free.

  python3 tools/grid.py S01          # out/grid/film-S01.jpg
  python3 tools/grid.py              # every illustrated scene
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art/img"
OUT = ROOT / "out/grid"


def main():
    ids = sys.argv[1:]
    pics = [SRC / f"film-{i}.png" for i in ids] if ids else sorted(SRC.glob("film-S*.png"))
    OUT.mkdir(parents=True, exist_ok=True)
    for p in pics:
        if not p.exists():
            print(f"{p.relative_to(ROOT)} finns inte")
            continue
        dst = OUT / (p.stem + ".jpg")
        # thin red lines every tenth, a thicker one at the middle
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(p), "-vf",
                        "scale=1600:-2,drawgrid=w=iw/10:h=ih/10:t=1:c=red@0.6,drawgrid=w=iw/2:h=ih/2:t=3:c=red@0.8",
                        "-q:v", "3", str(dst)], check=True)
        print(dst.relative_to(ROOT))


if __name__ == "__main__":
    main()
