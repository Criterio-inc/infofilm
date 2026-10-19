#!/usr/bin/env python3
"""Generate the film's illustrations with Gemini 3 Pro Image via OpenRouter (2K).

  python3 art/gen.py --dry-run      # list what would be generated and the estimated cost
  python3 art/gen.py                # every shot in shots.json that has no image yet
  python3 art/gen.py id1 id2        # just these ids (regenerates them)

COSTS MONEY (about $0.14 per 2K image). Ask the user before a batch.

A shot in art/shots.json is {"id", "prompt", "kind"?, "aspect"?, "ref"?, "character"?, "photos"?}:
  kind    "film" (default: a scene illustration for the card window, 21:9), "sheet" (model/pose
          sheet, 16:9), "scene" (full-bleed 16:9), "ref" (the mascot reference itself, 1:1)
  ref     "character" (default: attach the mascot reference, keep him identical), "style" (attach
          it only for the ink style, leave him out), "none" (text only — for the reference itself)
  photos  paths under art/ to real photographs of a real place or object (art/ref/*.jpg): attached
          after the mascot reference as a FORM reference, so towers, roofs and windows come out
          right. Record every photo's source and licence in art/ref/SOURCES.md.
Everything about the look lives in art/style.json, so every prompt gets the same style suffix.
Pictures never contain text: titles, numbers and labels are drawn in code.
"""
import base64
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "img"
STYLE = json.loads((HERE / "style.json").read_text(encoding="utf-8"))
MODEL = STYLE.get("model", "google/gemini-3-pro-image")
REF = HERE / STYLE.get("reference", "img/ref-mascot.png")
ASPECT = {"film": "21:9", "sheet": "16:9", "scene": "16:9", "ref": "1:1"}
COST = 0.14
# the default form instruction for shots with "photos"; style.json can override it with "photos"
PHOTOS = ("The attached photographs show the real place. Keep its architecture exactly as the photographs show it: "
          "the outline, the number, placement and shape of the towers, the roof shapes and pitches, the spires, domes "
          "and lanterns, the chimneys, the walls, windows and gates, and the proportions between them. Redraw it in the "
          "drawing style described below, and take nothing else from the photographs: not their colours, light, "
          "people, flags or signs.")


def call(content, aspect):
    body = {"model": MODEL, "messages": [{"role": "user", "content": content}], "modalities": ["image", "text"],
            "image_config": {"aspect_ratio": aspect, "image_size": "2K"}}
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"],
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def prompt_for(shot):
    kind, ref = shot.get("kind", "film"), shot.get("ref", "character")
    lead = shot.get("character") or {"character": STYLE["character"], "style": STYLE["style_only"], "none": ""}[ref]
    if shot.get("photos"):
        if ref != "none":
            lead += "The first attached image is that drawing reference; every other attached image is a photograph. "
        lead += STYLE.get("photos", PHOTOS) + " "
    return lead + shot["prompt"] + " " + STYLE["ink"] + " " + STYLE["kinds"][kind] + " " + STYLE["never"]


def data_url(path):
    mime = "image/jpeg" if path.suffix.lower() in (".jpg", ".jpeg") else "image/png"
    return {"type": "image_url", "image_url": {"url": f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()}}


def generate(shot):
    out = OUT / f"{shot['id']}.png"
    content = [{"type": "text", "text": prompt_for(shot)}]
    if shot.get("ref", "character") != "none":
        if not REF.exists():
            print(f"skip {shot['id']}: no reference image at {REF} — generate the kind 'ref' shot first")
            return 0
        content.append(data_url(REF))
    for p in shot.get("photos", []):
        content.append(data_url(HERE / p))
    aspect = shot.get("aspect") or ASPECT[shot.get("kind", "film")]
    for attempt in range(3):
        try:
            res = call(content, aspect)
            imgs = res["choices"][0]["message"].get("images") or []
            if not imgs:
                raise RuntimeError("no image: " + str(res["choices"][0]["message"].get("content"))[:200])
            out.write_bytes(base64.b64decode(imgs[0]["image_url"]["url"].split(",", 1)[1]))
            cost = res.get("usage", {}).get("cost") or 0
            print(f"ok   {shot['id']}  ${cost:.3f}", flush=True)
            return cost
        except Exception as e:
            print(f"fail {shot['id']} (try {attempt + 1}): {e}", flush=True)
            time.sleep(4)
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    dry = "--dry-run" in args
    ids = [a for a in args if a != "--dry-run"]
    shots = json.loads((HERE / "shots.json").read_text(encoding="utf-8"))
    todo = [s for s in shots if s["id"] in ids] if ids else [s for s in shots if not (OUT / f"{s['id']}.png").exists()]
    print(f"{len(todo)} shots, about ${len(todo) * COST:.2f}: {' '.join(s['id'] for s in todo)}")
    if dry or not todo:
        sys.exit(0)
    OUT.mkdir(exist_ok=True)
    # the reference goes first: every other shot is drawn from it
    refs = [s for s in todo if s.get("ref") == "none"]
    for s in refs:
        generate(s)
    with ThreadPoolExecutor(max_workers=4) as ex:
        total = sum(ex.map(generate, [s for s in todo if s not in refs]))
    print(f"done, ${total:.2f} — LOOK at every image before you use it (text, extra limbs, doubled props)")
