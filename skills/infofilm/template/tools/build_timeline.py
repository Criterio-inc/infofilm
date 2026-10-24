#!/usr/bin/env python3
"""Build video/src/timeline/master.json from the manuscript, the narration that exists and the music.

  python3 tools/build_timeline.py

For each scene:
  • narration exists (voice/scenes/<Sxx>.mp3 + alignment for the CURRENT text) → copied to
    video/public/audio/, exact per-word times from the ElevenLabs alignment;
  • otherwise → estimated duration and proportional word times, marked "estimated", so the film
    can be built, cued and reviewed before a single credit is spent.
film.json "parts" gives each part its kicker and music bed; film.json "scenes" gives a scene an
opening theme ("intro") or a jingle after its speech ("after"). Music cut points come from
music/cuts.json; the files are copied to video/public/music/. Illustrations are picked up from
video/public/img/film-<Sxx>.jpg (tools/sync_art.py puts them there).

It also writes video/src/timeline/brand.json from the client profile in brand/ (palette, fonts,
card, motion, logo) and the format (film.json "formats", or FORMAT=1:1 for this run), and copies
the logo and font files to video/public/brand/.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from film import BRAND, BRAND_DIR, FILM, FORMAT, FPS, MODE, ROOT, SIZES  # noqa: E402
from script_parse import parse  # noqa: E402

EST_WPM = FILM.get("estWpm", 130)  # replace with the measured median once the narration exists
LEAD, TAIL = FILM.get("lead", 24), FILM.get("tail", 18)  # frames before / after the speech: the card lands
INTRO_AT = 8  # the opening theme starts 8 frames into its scene
# every film ends softly, never cut off: the last card stays a while after the last word, and the
# music and the picture fade out over the final seconds (film.json "endHold" / "fadeOut", in seconds)
END_HOLD = round(FILM.get("endHold", 2.5) * FPS)
FADE_OUT = round(FILM.get("fadeOut", 2.0) * FPS)
TAG = re.compile(r"\[[^\]]*\]\s*")
CUTS = {k: v for k, v in json.loads((ROOT / "music/cuts.json").read_text()).items() if not k.startswith("_")}
PARTS = FILM.get("parts", {})
SPECIAL = FILM.get("scenes", {})


def ffdur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True).stdout.strip()
    return float(out)


def alignment_words(seg_dir, lines):
    """Per-word times from the cached chunks. The API glues the lines of a chunk together without
    spaces ("majority.Remember"), so a word boundary is forced at every line start."""
    m = json.loads((seg_dir / "manifest.json").read_text())
    chars, st, en, offset = [], [], [], 0.0
    for ch in m["chunks"]:
        if not ch.get("alignment_file"):
            return None
        al = json.loads((seg_dir / ch["alignment_file"]).read_text())["alignment"]
        chars += al["characters"]
        st += [t + offset for t in al["character_start_times_seconds"]]
        en += [t + offset for t in al["character_end_times_seconds"]]
        offset += ffdur(seg_dir / ch["audio_file"])
    if "".join(chars) != "".join(lines):
        return None  # the narration is for an older text
    breaks, acc = set(), 0
    for line in lines:
        breaks.add(acc)
        acc += len(line)
    words, cur, ws, we = [], "", 0.0, 0.0
    for i, (c, s, e) in enumerate(zip(chars, st, en)):
        if c.isspace() or (i in breaks and cur):
            if cur:
                words.append((cur, ws, we))
            cur = ""
            if c.isspace():
                continue
        if not cur:
            ws = s
        cur += c
        we = e
    if cur:
        words.append((cur, ws, we))
    return [{"w": w, "s": round(s, 3), "e": round(e, 3)} for w, s, e in words if not re.fullmatch(r"\[[^\]]*\]", w)]


def estimated_words(text):
    toks = re.findall(r"\S+", TAG.sub("", text))
    total = len(toks) / EST_WPM * 60
    weights = [len(t) + 2 for t in toks]
    acc, out, W = 0.0, [], sum(weights) or 1
    for t, w in zip(toks, weights):
        d = total * w / W
        out.append({"w": t, "s": round(acc, 3), "e": round(acc + d * 0.9, 3)})
        acc += d
    return out, total


def same_file(src, dst):
    """dst is an up-to-date copy of src (a new file with the same name but an older date is not)."""
    return dst.exists() and int(dst.stat().st_mtime) == int(src.stat().st_mtime) and dst.stat().st_size == src.stat().st_size


def copy_audio(src, dst):
    stamp = dst.with_suffix(dst.suffix + ".src")
    key = f"{src.stat().st_size}:{int(src.stat().st_mtime)}"
    if dst.exists() and stamp.exists() and stamp.read_text() == key:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ar", "48000", "-b:a", "192k", str(dst)], check=True)
    stamp.write_text(key)


def copy_file(src, dst):
    if same_file(src, dst):
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def logo_aspect(path):
    """Width / height of a PNG (its header) or an SVG (viewBox, else width/height), so the card
    leaves the title room for the logo it really has. None when it cannot tell."""
    try:
        if path.suffix.lower() == ".png":
            head = path.read_bytes()[:24]
            w, h = int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
            return round(w / h, 3) if h else None
        svg = path.read_text(encoding="utf-8", errors="ignore")
        vb = re.search(r'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', svg)
        wh = re.search(r'<svg[^>]*\bwidth="([\d.]+)[^"]*"[^>]*\bheight="([\d.]+)', svg)
        m = vb or wh
        return round(float(m.group(1)) / float(m.group(2)), 3) if m and float(m.group(2)) else None
    except OSError:
        return None


def build_brand():
    """brand/profile.json + the format → video/src/timeline/brand.json; logo and fonts → public/brand/."""
    if not BRAND:
        sys.exit("brand/profile.json is missing: copy a profile in (scripts/new_film.sh --profile does this)")
    if FORMAT not in SIZES:
        sys.exit(f"unknown format {FORMAT}: use one of {', '.join(SIZES)}")
    pub = ROOT / "video/public/brand"
    faces = []
    gfile = BRAND_DIR / "fonts/google.json"
    if gfile.exists():
        faces += json.loads(gfile.read_text(encoding="utf-8"))
    fonts = {}
    for role, spec in BRAND.get("fonts", {}).items():
        for f in spec.get("files", []):
            faces.append({"family": spec["family"], "weight": f.get("weight", 400), "style": f.get("style", "normal"), "file": f["file"]})
        fonts[role] = {k: v for k, v in spec.items() if k not in ("files", "google", "weights")}
        # the weight titles and numbers are set in: "weight", else the heaviest one the profile loads
        fonts[role]["weight"] = spec.get("weight") or max(spec.get("weights") or [f.get("weight", 400) for f in spec.get("files", [])] or [400])
    for role, spec in BRAND.get("fonts", {}).items():
        if spec.get("google") and not any(f["family"] == spec["family"] for f in faces):
            print(f"  WARNING: font {spec['family']} ({role}) is not fetched: run python3 tools/fetch_fonts.py, or the film uses a system font")
    for face in faces:
        src = BRAND_DIR / face["file"]
        if not src.exists():
            sys.exit(f"font file {src.relative_to(ROOT)} is missing (run python3 tools/fetch_fonts.py)")
        copy_file(src, pub / face["file"])
        face["src"] = "brand/" + face.pop("file")
    logo = BRAND.get("logo") or None
    if logo:
        copy_file(BRAND_DIR / logo["file"], pub / logo["file"])
        logo = {**logo, "src": "brand/" + logo["file"], "aspect": logo.get("aspect") or logo_aspect(BRAND_DIR / logo["file"])}
    w, h = SIZES[FORMAT]
    out = {"format": FORMAT, "width": w, "height": h, "mode": MODE, "name": BRAND.get("name", ""),
           **{k: BRAND[k] for k in ("palette", "card", "plate", "motion", "backdrop", "filmLook", "ground", "endCard") if k in BRAND},
           # the film's own end-card line wins over the sender's (film.json "endCard")
           **({"endCard": {**BRAND.get("endCard", {}), **FILM["endCard"]}} if FILM.get("endCard") else {}),
           "fonts": {**fonts, "faces": faces}, "logo": logo}
    dst = ROOT / "video/src/timeline/brand.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return f"{BRAND.get('name', '?')}, {FORMAT} {w}×{h}"


def img_size(p):
    """[width, height] of an illustration, for the story camera (None when it cannot be read)."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    try:
        w, h = (int(x) for x in r.stdout.strip().split(",")[:2])
        return [w, h]
    except ValueError:
        return None


def main():
    brand = build_brand()
    _, scenes = parse()
    pub = ROOT / "video/public"
    music = {}
    for key, c in CUTS.items():
        src = ROOT / "music" / c["file"]
        if not src.exists():
            print(f"  music '{key}': {src.relative_to(ROOT)} is missing — skipped")
            continue
        dst = pub / "music" / (Path(c["file"]).stem + ".mp3")
        copy_audio(src, dst)
        music[key] = {"src": f"music/{dst.name}", "inFrames": round(c.get("in", 0) * FPS),
                      "outFrames": round(c.get("out", ffdur(src)) * FPS), "fadeFrames": round(c.get("fade", 1.5) * FPS)}

    out, frame, n_real = [], 0, 0
    for s in scenes:
        lines = s["text"].split("\n\n")
        audio_rel, words, estimated = None, None, True
        mp3 = ROOT / "voice/scenes" / f"{s['id']}.mp3"
        seg = ROOT / "voice/scenes/.segments" / s["id"]
        if mp3.exists() and (seg / "manifest.json").exists():
            words = alignment_words(seg, lines)
            if words is not None:
                copy_audio(mp3, pub / "audio" / f"{s['id']}.mp3")
                audio_rel = f"audio/{s['id']}.mp3"
                dur = ffdur(pub / "audio" / f"{s['id']}.mp3")
                estimated = False
                n_real += 1
            else:
                print(f"  {s['id']}: the narration is for an older text — estimated (re-run voice/narrate.py {s['id']})")
        if estimated:
            words, dur = estimated_words(s["text"])
        sp = SPECIAL.get(s["name"], {})
        lead, intro, after = LEAD, None, None
        if sp.get("intro") in music:
            c = CUTS[sp["intro"]]
            intro = {"key": sp["intro"], "at": INTRO_AT}
            # the speech starts after the sung part of the theme (the rest plays under it, ducked)
            # without sung timing (a short sting), the speech waits for the whole cut
            m = music[sp["intro"]]
            sung = c["sungEnd"] - c.get("in", 0) if "sungEnd" in c else (m["outFrames"] - m["inFrames"]) / FPS
            lead = INTRO_AT + round((sung + 0.4) * FPS)
        if "lead_s" in sp:
            lead = round(sp["lead_s"] * FPS)
        audio_frames = round(dur * FPS)
        total = lead + audio_frames + TAIL
        if sp.get("after") in music:
            m = music[sp["after"]]
            after = {"key": sp["after"], "at": lead + audio_frames + 6}
            total = after["at"] + (m["outFrames"] - m["inFrames"]) + 12
        part = s["part"] or ""
        pconf = PARTS.get(part, {})
        img = f"img/film-{s['id']}.jpg"
        size = img_size(pub / img) if (pub / img).exists() else None
        out.append({
            "id": s["id"], "name": s["name"], "part": part, "kicker": FILM["kicker"] if "kicker" in FILM else pconf.get("kicker", part),
            # a part without its own bed gets the film's loop (film.json "bed", set by the app's music choice)
            "title": s["title"], "bed": (lambda b: b if b in music else None)(pconf.get("bed", FILM.get("bed"))),
            "from": frame, "durationInFrames": total, "lead": lead,
            "audio": audio_rel, "audioFrames": audio_frames, "intro": intro, "after": after,
            "text": TAG.sub("", s["text"]), "words": words, "estimated": estimated,
            "img": img if (pub / img).exists() else None,
            **({"imgSize": size} if size else {}),
        })
        frame += total

    if out:
        # the last card holds and stays: it fades with the film instead of leaving
        out[-1]["durationInFrames"] += END_HOLD
        out[-1]["last"] = True
        frame += END_HOLD
    tl = {"title": FILM.get("title", ""), "locale": FILM.get("locale", "en-US"), "fps": FPS,
          "durationInFrames": frame, "fadeOutFrames": min(FADE_OUT, frame), "music": music,
          # how much the film moves (video/src/mood.ts) and whether the narration is burned in
          "mood": FILM.get("mood", "saklig"), "captions": bool(FILM.get("captions", False)), "scenes": out}
    dst = ROOT / "video/src/timeline/master.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{dst.relative_to(ROOT)}: {len(out)} scenes, {frame} frames = {frame / FPS / 60:.1f} min "
          f"({n_real} narrated, {len(out) - n_real} estimated, {sum(1 for o in out if o['img'])} with an illustration) · {brand}")


if __name__ == "__main__":
    main()
