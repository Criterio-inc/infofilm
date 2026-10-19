"""Shared settings for the tools: film.json at the project root, the client profile in brand/."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILM = json.loads((ROOT / "film.json").read_text(encoding="utf-8"))
FPS = FILM.get("fps", 30)
SCRIPT = ROOT / FILM.get("script", "script/script.md")
SLUG = FILM.get("slug", "film")
BRAND_DIR = ROOT / "brand"
BRAND = json.loads((BRAND_DIR / "profile.json").read_text(encoding="utf-8")) if (BRAND_DIR / "profile.json").exists() else {}
MODE = FILM.get("mode", "film")  # "klipp" (30–90 s, one message) or "film" (2–15 min, parts)
# film.json "formats": the first is the main one (studio, stills); render.sh renders them all.
# FORMAT=1:1 in the environment picks another one for this run.
FORMATS = FILM.get("formats", ["16:9"])
FORMAT = os.environ.get("FORMAT") or FORMATS[0]
SIZES = {"16:9": (1920, 1080), "1:1": (1080, 1080), "9:16": (1080, 1920)}
