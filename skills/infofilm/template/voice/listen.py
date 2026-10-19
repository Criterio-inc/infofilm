#!/usr/bin/env python3
"""A listening page for the narration: one player per scene with its text beside it.

  python3 voice/listen.py        # → voice/listen.html (open it in a browser)

The user listens and flags lines; nobody transcribes the takes to check them.
"""
import html
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from film import FILM  # noqa: E402
from script_parse import parse  # noqa: E402

_, scenes = parse()
rows = []
for s in scenes:
    mp3 = ROOT / "voice/scenes" / f"{s['id']}.mp3"
    player = f'<audio controls preload="none" src="scenes/{s["id"]}.mp3"></audio>' if mp3.exists() else "<em>ingen inläsning ännu</em>"
    text = "".join(f"<p>{html.escape(p)}</p>" for p in s["text"].split("\n\n"))
    rows.append(f'<section><h2>{s["id"]} · {html.escape(s["name"])}</h2>{player}{text}</section>')
page = f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(FILM.get("title", "Narration"))}</title>
<style>body{{font:17px/1.5 system-ui;max-width:760px;margin:2em auto;padding:0 16px;background:#fcf6ea;color:#121617}}
section{{border-top:2px solid #121617;padding:.6em 0 1em}}h2{{font-size:1em;margin:.2em 0 .5em}}audio{{width:100%}}</style>
<h1>{html.escape(FILM.get("title", ""))}</h1>{''.join(rows)}"""
(ROOT / "voice/listen.html").write_text(page, encoding="utf-8")
print(f"voice/listen.html: {sum(1 for s in scenes if (ROOT / 'voice/scenes' / (s['id'] + '.mp3')).exists())}/{len(scenes)} scenes narrated")
