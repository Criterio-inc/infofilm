#!/usr/bin/env python3
"""Print scene-relative frames for cue phrases, exactly as useScene().cue() resolves them.

  python3 tools/cues.py <scene-name> "phrase one" "phrase two" ...
  python3 tools/cues.py <scene-name>            # every word with its frame
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
tl = json.loads((ROOT / "video/src/timeline/master.json").read_text())
name = sys.argv[1]
sc = next(s for s in tl["scenes"] if s["name"] == name)
norm = lambda t: re.sub(r"[^\w'%]+", " ", t.lower().replace("’", "'")).split()
toks = [(t, i) for i, w in enumerate(sc["words"]) for t in norm(w["w"])]
fr = lambda sec: sc["lead"] + round(sec * tl["fps"])
print(f"{sc['id']} {name}: {sc['durationInFrames']} frames, lead {sc['lead']}, speech ends {sc['lead'] + sc['audioFrames']}"
      f"{' (ESTIMATED times)' if sc['estimated'] else ''}{', jingle from ' + str(sc['after']['at']) if sc.get('after') else ''}")
if len(sys.argv) == 2:
    print(" ".join(f"{w['w']}@{fr(w['s'])}" for w in sc["words"]))
for ph in sys.argv[2:]:
    tg = norm(ph)
    hit = next((i for i in range(len(toks) - len(tg) + 1)
                if all(toks[i + j][0] == tg[j] or (j == len(tg) - 1 and toks[i + j][0].startswith(tg[j]))
                       for j in range(len(tg)))), None)
    print(f"  {ph!r}: {fr(sc['words'][toks[hit][1]]['s']) if hit is not None else 'NOT FOUND'}")
