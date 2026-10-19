#!/usr/bin/env python3
"""Put a client profile into a film project (scripts/new_film.sh runs this; run it again to switch).

  apply_profile.py <profile-dir> <project-dir> [--mode klipp|film] [--formats 16:9,1:1]
                   [--slug s] [--title t] [--lang xx] [--locale xx-XX] [--design-systems url,url]
                   [--music bed-lugn|none] [--keep-voice]

  profile.json, logo, fonts/, NOTES.md → brand/          (what the video reads)
  style.json                         → art/style.json  (the look of the illustrations)
  img/*                              → art/img/        (a recurring character's reference image)
  design.json, voice.json            → voice/          (the narrator: design brief, saved voice id)
  music/*.wav|mp3 + music/cuts.json  → music/suno/ + music/cuts.json (theme, bed, sting, outro …)
film.json gets the slug, title, language, locale, mode and formats (and this film's own design-system
links, on top of the profile's), and its parts and scene hooks
are wired to the profile's music keys: a key without a file is simply skipped. The background loop
(a "bed" key) is the profile's "music.bed", or --music; --music none gives a film without one.
--keep-voice leaves the film's narrator alone (voice/design.json and voice.json): updating the look of
a film that is already narrated must not change its voice, or every scene would be read (and billed) again.
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

# the film's brand/ gets what the video and Claude read: not the client's raw material or the app's own state
TO_BRAND_SKIP = {"style.json", "design.json", "voice.json", "img", "music", "material", ".infofilm-app.json"}
FORMATS = {"16:9", "1:1", "9:16"}
AUDIO = {".wav", ".mp3", ".m4a", ".aif", ".aiff", ".flac"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("profile")
    ap.add_argument("project")
    for k in ("mode", "formats", "slug", "title", "lang", "locale", "design-systems", "music"):
        ap.add_argument(f"--{k}", default="")
    ap.add_argument("--keep-voice", action="store_true")
    a = ap.parse_args()
    prof_dir, proj = Path(a.profile).resolve(), Path(a.project).resolve()
    prof = json.loads((prof_dir / "profile.json").read_text(encoding="utf-8"))

    brand = proj / "brand"
    shutil.rmtree(brand, ignore_errors=True)
    shutil.copytree(prof_dir, brand, ignore=lambda d, names: TO_BRAND_SKIP & set(names) if Path(d) == prof_dir else set())
    (brand / "PROFILE").write_text(prof_dir.name + "\n")
    for name, dst in (("style.json", "art/style.json"), ("design.json", "voice/design.json"), ("voice.json", "voice/voice.json")):
        if a.keep_voice and name != "style.json":
            continue
        if (prof_dir / name).exists():
            shutil.copy2(prof_dir / name, proj / dst)
    if (prof_dir / "img").is_dir():
        shutil.copytree(prof_dir / "img", proj / "art/img", dirs_exist_ok=True)

    cuts_path = proj / "music/cuts.json"
    cuts = json.loads(cuts_path.read_text(encoding="utf-8"))
    if (prof_dir / "music").is_dir():
        for wav in (prof_dir / "music").iterdir():
            if wav.suffix.lower() in AUDIO:
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
    if not set(formats) <= FORMATS:
        sys.exit(f"unknown format {', '.join(sorted(set(formats) - FORMATS))}: use 16:9, 1:1 or 9:16")
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
    links = [u for u in a.design_systems.replace(",", " ").split() if u]
    if links:
        known = {d["url"] for d in film.get("designSystems", [])}
        film["designSystems"] = film.get("designSystems", []) + [{"url": u} for u in links if u not in known]
    # the background loop: --music (a key, or "none"), else the profile's choice ("music": {"bed": …}, null = none)
    pm = prof.get("music") or {}
    bed = "" if a.music == "none" else a.music or (pm.get("bed") or "" if "bed" in pm else "bed")
    if bed and bed not in cuts:
        print(f"  note: no music '{bed}' in this profile, so the film starts without background music")
        bed = "" if a.music else bed
    film["bed"] = bed  # the film's loop, also for parts the script names later
    if not wire:
        if a.music:
            film["parts"] = {p: {**v, "bed": bed} for p, v in film.get("parts", {}).items()}
    elif mode == "klipp":
        # one part, a short sting before the first word, the bed under it all, an outro on the end card
        film["parts"] = {"KLIPP": {"kicker": kicker, "bed": bed}}
        film["scenes"] = {"the-year": {"intro": "sting"}, "end-card": {"after": "outro"}}
    else:
        film["parts"] = {p: {**v, "kicker": kicker if p in ("OPENING", "CLOSING") else v.get("kicker", ""), "bed": bed if a.music else v.get("bed") or bed}
                         for p, v in film.get("parts", {}).items()}
    film_path.write_text(json.dumps(film, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"profile {prof_dir.name} ({prof.get('name', '?')}) → {proj}: {mode}, {', '.join(formats)}")
    ds = len(prof.get("designSystems", [])) + len(film.get("designSystems", []))
    if ds:
        print(f"  {ds} linked design system(s): read them before the script, image prompts and scenes")


if __name__ == "__main__":
    main()
