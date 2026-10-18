#!/usr/bin/env python3
"""Subtitles for the narration from the timeline's word times.   python3 tools/make_srt.py [out.srt]

Lines of at most 42 characters, at most two lines and 6 seconds per cue, broken at sentence ends
first. Estimated scenes (no narration yet) and sung jingles are not subtitled.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from film import ROOT, SLUG  # noqa: E402

tl = json.loads((ROOT / "video/src/timeline/master.json").read_text())
FPS = tl["fps"]
MAXC, MAXL, MAXS = 42, 2, 6.0


def ts(sec):
    ms = round(sec * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


cues = []
for sc in tl["scenes"]:
    if sc["estimated"]:
        continue
    base = (sc["from"] + sc["lead"]) / FPS
    words = [(w["w"], base + w["s"], base + w["e"]) for w in sc["words"]]
    cur, lines = [], [""]
    for w, s, e in words:
        cand = (lines[-1] + " " + w).strip()
        if len(cand) > MAXC:
            if len(lines) == MAXL or (cur and e - cur[0][1] > MAXS):
                cues.append((cur[0][1], cur[-1][2], lines))
                cur, lines = [], [""]
                cand = w
            else:
                lines.append("")
                cand = w
        lines[-1] = cand
        cur.append((w, s, e))
        if w.endswith((".", "!", "?")) and (len(lines) == MAXL or e - cur[0][1] > 2.5):
            cues.append((cur[0][1], cur[-1][2], lines))
            cur, lines = [], [""]
    if cur:
        cues.append((cur[0][1], cur[-1][2], lines))

out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "out" / f"{SLUG}.srt"
out.parent.mkdir(parents=True, exist_ok=True)
# hold each cue 0.25 s after its last word, but never into the next cue
ends = [min(b + 0.25, cues[i + 1][0] - 0.05) if i + 1 < len(cues) else b + 0.25 for i, (a, b, _) in enumerate(cues)]
out.write_text("".join(f"{i}\n{ts(a)} --> {ts(e)}\n" + "\n".join(l for l in ls if l) + "\n\n"
                       for i, ((a, b, ls), e) in enumerate(zip(cues, ends), 1)), encoding="utf-8")
print(f"{out}: {len(cues)} subtitles")
