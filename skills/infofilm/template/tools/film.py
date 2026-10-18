"""Shared settings for the tools: film.json at the project root."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILM = json.loads((ROOT / "film.json").read_text(encoding="utf-8"))
FPS = FILM.get("fps", 30)
SCRIPT = ROOT / FILM.get("script", "script/script.md")
SLUG = FILM.get("slug", "film")
