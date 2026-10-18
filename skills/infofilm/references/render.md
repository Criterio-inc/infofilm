# Render and deliver

## The full render
```
OUTDIR=/Volumes/big-disk/my-film tools/render.sh     # CONCURRENCY=4 by default
```
1. `build_timeline.py` reads the current script, voice and music.
2. `lint_cues.py` stops on any broken cue.
3. `tsc` typechecks.
4. `remotion render … Film` makes the h264 video (CRF 19, yuv420p) with AAC 320k audio.
5. Two-pass `loudnorm` brings it to **−14 LUFS integrated, −1 dBTP**, with the video stream copied.
6. `make_srt.py` writes subtitles from the word times (at most 42 characters, 2 lines and 6 s per subtitle; estimated scenes are skipped).

A 13-minute film renders in about 50 minutes at concurrency 4 on a 16 GB laptop. The temp files need several GB; `TMPDIR` is set to `OUTDIR/tmp`. **Never run two renders at once**, and never render while builders are making stills.

## Verify before you hand it over
- `ffprobe` the duration, resolution, frame rate and both streams.
- Measure the loudness of the whole film and of segments: the theme, voice over a bed, each jingle, the ballad. They should all sit within about 1 LU of −14:
  ```
  ffmpeg -ss 600 -t 30 -i film.mp4 -af ebur128 -f null - 2>&1 | tail -12
  ```
- Pull frames from the **mp4 itself** (not from Remotion stills) at the opening, the central infographics, each break and the credits:
  ```
  ffmpeg -ss 125 -i film.mp4 -frames:v 1 frame.png
  ```
  Look at them. Production notes leaking into captions, a missing image or a stale scene show up here.
- Open the film for the user, then report the path, length, size, loudness, the subtitle count and anything still pending (scenes waiting for news, known nits).

## Delivery
- `<slug>.mp4` + `<slug>.srt`, with the SRT language matching film.json.
- For YouTube: −14 LUFS is the target. Upload the SRT as captions, and put the AI disclosure from the credits in the description.
