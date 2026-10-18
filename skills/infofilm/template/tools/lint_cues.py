#!/usr/bin/env python3
"""Check that every cue("…") / cueEnd("…") phrase used by a registered scene exists in that
scene's narration. Run after editing scenes or the script.   python3 tools/lint_cues.py

Registries are the .ts files in video/src/scenes/ with lines like `"scene-name": Component,`.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SC = ROOT / "video/src/scenes"
tl = json.loads((ROOT / "video/src/timeline/master.json").read_text())
by_name = {s["name"]: s for s in tl["scenes"]}
norm = lambda t: re.sub(r"[^\w'%]+", " ", t.lower().replace("’", "'")).split()


def found(scene, phrase, nth):
    toks = [t for w in scene["words"] for t in norm(w["w"])]
    tg, seen = norm(phrase), 0
    for i in range(len(toks) - len(tg) + 1):
        if all(toks[i + j] == tg[j] or (j == len(tg) - 1 and toks[i + j].startswith(tg[j])) for j in range(len(tg))):
            seen += 1
            if seen == nth:
                return True
    return False


registry = {}
for reg in SC.glob("*.ts"):
    for name, comp in re.findall(r'^\s*"?([a-z0-9-]+)"?\s*:\s*([A-Z][A-Za-z0-9_]*)\s*,?\s*$', reg.read_text(), re.M):
        registry[name] = comp
files = {p: p.read_text() for p in SC.glob("*.tsx")}
missing = checked = 0
for name, comp in sorted(registry.items()):
    scene = by_name.get(name)
    if not scene:
        print(f"UNKNOWN SCENE NAME in a registry: {name}")
        missing += 1
        continue
    src = next((t for p, t in files.items() if re.search(rf"export const {comp}\b", t)), None)
    if src is None:
        print(f"{name}: component {comp} not found")
        missing += 1
        continue
    for fn, q, phrase, nth in re.findall(r"\b(cue|cueEnd)\(\s*([\"'])(.+?)\2\s*(?:,\s*(\d+))?\s*\)", src):
        checked += 1
        if not found(scene, phrase, int(nth or 1)):
            print(f"MISSING  {scene['id']} {name}: {fn}({phrase!r}{', ' + nth if nth else ''})")
            missing += 1
print(f"{len(registry)} scenes, {checked} cues checked, {missing} problems")
sys.exit(1 if missing else 0)
