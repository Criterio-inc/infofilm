#!/usr/bin/env python3
"""Design the narrator with ElevenLabs Voice Design (eleven_ttv_v3), then save the chosen take.

  python3 voice/design_voice.py preview <tag>                  # 3 takes → voice/previews/<tag>-take<n>.mp3 + listen.html
  python3 voice/design_voice.py create <generated_voice_id> "<name>"   # save a take → voice/voice.json

COSTS MONEY (a preview round is roughly the characters of the sample text). Ask first.
The description and the sample text live in voice/design.json. Write the sample text in the film's
language and in the film's register — numbers, names and exclamations the script will actually use.
"""
import base64
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
D = json.loads((HERE / "design.json").read_text(encoding="utf-8"))


def client():
    from elevenlabs import ElevenLabs
    return ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])


def preview(tag):
    res = client().text_to_voice.design(voice_description=D["description"], text=D["text"],
                                        model_id=D.get("model", "eleven_ttv_v3"), output_format="mp3_44100_192")
    out = HERE / "previews"
    out.mkdir(exist_ok=True)
    takes = []
    for i, p in enumerate(res.previews, 1):
        f = out / f"{tag}-take{i}.mp3"
        f.write_bytes(base64.b64decode(p.audio_base_64))
        takes.append({"take": i, "file": f.name, "generated_voice_id": p.generated_voice_id})
        print(f"take{i}: {p.generated_voice_id}")
    (out / f"{tag}-manifest.json").write_text(json.dumps({**D, "previews": takes}, indent=2, ensure_ascii=False))
    rows = "".join(f'<p><b>{t["file"]}</b><br><audio controls src="{t["file"]}"></audio><br><code>{t["generated_voice_id"]}</code></p>' for t in takes)
    (out / "listen.html").write_text(f"<!doctype html><meta charset=utf-8><title>Voice takes</title><body style='font:16px system-ui;margin:2em'><h1>{tag}</h1><p>{D['description']}</p>{rows}", encoding="utf-8")
    print(f"open {out / 'listen.html'}")


def create(gid, name):
    v = client().text_to_voice.create(voice_name=name, voice_description=D["description"], generated_voice_id=gid)
    (HERE / "voice.json").write_text(json.dumps({"voice_id": v.voice_id, "name": name, "generated_voice_id": gid,
                                                 "description": D["description"]}, indent=2, ensure_ascii=False))
    print(f"voice.json: {v.voice_id} ({name})")


if __name__ == "__main__":
    if sys.argv[1:2] == ["preview"]:
        preview(sys.argv[2])
    elif sys.argv[1:2] == ["create"]:
        create(sys.argv[2], sys.argv[3])
    else:
        sys.exit(__doc__)
