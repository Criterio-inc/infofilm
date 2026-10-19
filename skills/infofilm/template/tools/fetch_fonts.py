#!/usr/bin/env python3
"""Download the profile's Google fonts into the profile, so renders use local files only.

  python3 tools/fetch_fonts.py            # the film's brand/ folder
  python3 tools/fetch_fonts.py <dir>      # any profile folder (scripts/new_profile.sh runs this)

Reads <dir>/profile.json "fonts": every role with "google": true is fetched as woff2 (latin and
latin-ext, the weights listed) into <dir>/fonts/google/, with a manifest <dir>/fonts/google.json
that tools/build_timeline.py merges with the profile's own font files. Free, no API key.
A client font that is not on Google Fonts goes in as files instead:
  "display": {"family": "Brand Sans", "files": [{"file": "fonts/BrandSans-Bold.woff2", "weight": 700}]}
"""
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
SUBSETS = ("latin", "latin-ext")
FACE = re.compile(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", re.S)


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return r.read()


def fetch(brand: Path):
    prof = json.loads((brand / "profile.json").read_text(encoding="utf-8"))
    wanted = {}
    for role in prof.get("fonts", {}).values():
        if role.get("google"):
            wanted.setdefault(role["family"], set()).update(role.get("weights", [400]))
    out_dir = brand / "fonts/google"
    faces = []
    for family, weights in wanted.items():
        q = urllib.parse.quote_plus(family) + ":wght@" + ";".join(str(w) for w in sorted(weights))
        css = get(f"https://fonts.googleapis.com/css2?family={q}&display=swap").decode()
        for subset, body in FACE.findall(css):
            if subset not in SUBSETS:
                continue
            weight = int(re.search(r"font-weight:\s*(\d+)", body).group(1))
            style = re.search(r"font-style:\s*(\w+)", body).group(1)
            url = re.search(r"url\((.*?)\)", body).group(1)
            rng = re.search(r"unicode-range:\s*([^;]+);", body).group(1).strip()
            # a variable font serves several weights from one file: download it once
            name = f"{re.sub(r'[^a-z0-9]+', '-', family.lower()).strip('-')}-{subset}-{hashlib.sha1(url.encode()).hexdigest()[:8]}.woff2"
            out_dir.mkdir(parents=True, exist_ok=True)
            if not (out_dir / name).exists():
                (out_dir / name).write_bytes(get(url))
            faces.append({"family": family, "weight": weight, "style": style, "file": f"fonts/google/{name}", "unicodeRange": rng})
    (brand / "fonts").mkdir(exist_ok=True)
    (brand / "fonts/google.json").write_text(json.dumps(faces, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{brand}: {len(faces)} font faces ({', '.join(wanted) or 'none from Google'})")


if __name__ == "__main__":
    fetch(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "brand")
