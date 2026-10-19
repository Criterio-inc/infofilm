#!/usr/bin/env python3
"""Put a client profile into a film project (scripts/new_film.sh runs this; run it again to switch).

  apply_profile.py <profile-dir> <project-dir> [--mode klipp|film] [--formats 16:9,1:1]
                   [--slug s] [--title t] [--lang xx] [--locale xx-XX]

  profile.json, logo, fonts/, NOTES.md → brand/          (what the video reads)
  style.json                         → art/style.json  (the look of the illustrations)
  img/*                              → art/img/        (a recurring character's reference image)
  design.json, voice.json            → voice/          (the narrator: design brief, saved voice id)
  music/*.wav + music/cuts.json      → music/suno/ + music/cuts.json (theme, bed, sting, outro …)
film.json gets the slug, title, language, locale, mode and formats, and its parts and scene hooks
are wired to the profile's music keys: a key without a file is simply skipped.
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

TO_BRAND_SKIP = {"style.json", "design.json", "voice.json", "img", "music"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("profile")
    ap.add_argument("project")
    for k in ("mode", "formats", "slug", "title", "lang", "locale"):
        ap.add_argument(f"--{k}", default="")
    a = ap.parse_args()
    prof_dir, proj = Path(a.profile).resolve(), Path(a.project).resolve()
    prof = json.loads((prof_dir / "profile.json").read_text(encoding="utf-8"))

    brand = proj / "brand"
    shutil.rmtree(brand, ignore_errors=True)
    shutil.copytree(prof_dir, brand, ignore=lambda d, names: TO_BRAND_SKIP & set(names) if Path(d) == prof_dir else set())
    (brand / "PROFILE").write_text(prof_dir.name + "\n")
    for name, dst in (("style.json", "art/style.json"), ("design.json", "voice/design.json"), ("voice.json", "voice/voice.json")):
        if (prof_dir / name).exists():
            shutil.copy2(prof_dir / name, proj / dst)
    if (prof_dir / "img").is_dir():
        shutil.copytree(prof_dir / "img", proj / "art/img", dirs_exist_ok=True)

    cuts_path = proj / "music/cuts.json"
    cuts = json.loads(cuts_path.read_text(encoding="utf-8"))
    if (prof_dir / "music").is_dir():
        for wav in (prof_dir / "music").glob("*.wav"):
            shutil.copy2(wav, proj / "music/suno" / wav.name)
        if (prof_dir / "music/cuts.json").exists():
            cuts.update(json.loads((prof_dir / "music/cuts.json").read_text(encoding="utf-8")))
    cuts_path.write_text(json.dumps(cuts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    film_path = proj / "film.json"
    film = json.loads(film_path.read_text(encoding="utf-8"))
    mode = a.mode or film.get("mode", "film")
    if mode not in ("klipp", "film"):
        sys.exit(f"--mode is klipp or film, not {mode}")
    formats = [f.strip() for f in a.formats.split(",") if f.strip()] or prof.get("formats") or film.get("formats", ["16:9"])
    kicker = prof.get("kicker", "")
    # parts and scene hooks are wired for a new project (or a new mode); a switch keeps the film's own
    wire = "profile" not in film or mode != film.get("mode")
    film.update({"profile": prof_dir.name, "mode": mode, "formats": formats,
                 "language": a.lang or prof.get("language", film.get("language")),
                 "locale": a.locale or prof.get("locale", film.get("locale"))})
    if a.slug:
        film["slug"] = a.slug
    if a.title:
        film["title"] = a.title
    if not wire:
        pass
    elif mode == "klipp":
        # one part, a short sting before the first word, the bed under it all, an outro on the end card
        film["parts"] = {"KLIPP": {"kicker": kicker, "bed": "bed"}}
        film["scenes"] = {"the-year": {"intro": "sting"}, "end-card": {"after": "outro"}}
    else:
        film["parts"] = {p: {**v, "kicker": kicker if p in ("OPENING", "CLOSING") else v.get("kicker", ""), "bed": v.get("bed") or "bed"}
                         for p, v in film.get("parts", {}).items()}
    film_path.write_text(json.dumps(film, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"profile {prof_dir.name} ({prof.get('name', '?')}) → {proj}: {mode}, {', '.join(formats)}")


if __name__ == "__main__":
    main()
