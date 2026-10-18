#!/usr/bin/env python3
"""Parse the manuscript (film.json "script", default script/script.md) into scenes.

  python3 tools/script_parse.py              # words and estimated seconds per scene
  python3 tools/script_parse.py --json out   # write the scenes as JSON

Format:
  ---front matter---          title, language, status …
  # PART heading              starts a part (kicker + music bed come from film.json "parts")
  ## S01 · scene-name         one scene = one narration file; components are looked up by name
  <!-- title: CARD TITLE -->  the card's title (default: the scene name in capitals)
  <!-- facts: 1.2 3.4 -->     sections of notes/research.md the scene rests on
  > visual: …                 direction for picture and graphics (never read aloud)
  <!-- … -->                  any other comment, on one line or many: never read aloud
  everything else             narration, read exactly as written; [tag] = a delivery tag
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from film import FILM, SCRIPT  # noqa: E402

WPM = FILM.get("estWpm", 130)


def parse(path=SCRIPT):
    text = Path(path).read_text(encoding="utf-8")
    meta = {}
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]

    scenes, part, cur, in_comment = [], None, None, False
    for line in text.splitlines():
        if in_comment:  # inside a multi-line comment: production notes are never narration
            in_comment = "-->" not in line
            continue
        if line.lstrip().startswith("<!--"):
            if "-->" not in line:
                in_comment = True
                continue
            if cur is not None:
                kv = re.match(r"^\s*<!--\s*(title|facts):(.*?)-->", line)
                if kv and kv.group(1) == "title":
                    cur["title"] = kv.group(2).strip()
                elif kv:
                    cur["facts"] = kv.group(2).split()
            continue
        if line.startswith("# "):
            part = line[2:].strip()
            continue
        h = re.match(r"^## (S\d+[a-z]?)\s*·\s*(.+)$", line)
        if h:
            cur = {"id": h.group(1), "name": h.group(2).strip(), "part": part, "title": None,
                   "facts": [], "visual": [], "narration": []}
            scenes.append(cur)
            continue
        if cur is None:
            continue
        if line.startswith(">"):
            cur["visual"].append(re.sub(r"^>\s*(visual:\s*)?", "", line).strip())
        elif line.strip():
            cur["narration"].append(re.sub(r"<!--.*?-->", "", line).strip())

    for s in scenes:
        s["text"] = "\n\n".join(p for p in s["narration"] if p)
        spoken = re.sub(r"\[[^\]]*\]", "", s["text"])
        s["words"] = len(re.findall(r"[\w'’\-]+", spoken))
        s["est_sec"] = round(s["words"] / WPM * 60, 1)
        s["visual"] = " ".join(s["visual"])
        s["title"] = s["title"] or s["name"].replace("-", " ").upper()
        del s["narration"]
    return meta, scenes


def main():
    meta, scenes = parse()
    if "--json" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--json") + 1])
        out.write_text(json.dumps({"meta": meta, "scenes": scenes}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {out}")
    total_w = sum(s["words"] for s in scenes)
    print(f"{meta.get('title', '?')}: {len(scenes)} scenes, {total_w} words, ~{total_w / WPM:.1f} min at {WPM} wpm, "
          f"{sum(len(s['text']) for s in scenes)} characters of narration")
    for s in scenes:
        print(f"  {s['id']} {s['name']:<30} {s['words']:4d} w  ~{s['est_sec']:5.1f}s  facts {' '.join(s['facts']) or '-'}")


if __name__ == "__main__":
    main()
