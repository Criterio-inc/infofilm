#!/usr/bin/env bash
# Render the whole film: timeline → lint → typecheck → video → loudness-normalised master + subtitles.
#   tools/render.sh
# OUTDIR (default: film.json "outDir", else out/) gets the master and Remotion's temp files — point
# it at a disk with room: a 12-minute film needs ~1.5 GB for the master plus several GB of temp.
# CONCURRENCY (default 4) trades RAM for speed. Never run two renders at once.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 tools/build_timeline.py
python3 tools/lint_cues.py || { echo "fix the cues first"; exit 1; }

SLUG=$(python3 -c "import json;print(json.load(open('film.json')).get('slug','film'))")
OUT=${OUTDIR:-$(python3 -c "import json;print(json.load(open('film.json')).get('outDir','out'))")}
[[ "$OUT" = /* ]] || OUT="$ROOT/$OUT"
mkdir -p "$OUT/tmp"
export TMPDIR="$OUT/tmp/"
FREE=$(df -Pk "$OUT" | awk 'NR==2{print int($4/1048576)}')
echo "rendering to $OUT ($FREE GB free)"
[[ $FREE -ge 8 ]] || echo "WARNING: less than 8 GB free on the output disk"
RAW="$OUT/$SLUG.raw.mp4"
FINAL="$OUT/$SLUG.mp4"
cd video
npx tsc --noEmit -p .
npx remotion render src/index.ts Film "$RAW" \
  --codec=h264 --crf=19 --pixel-format=yuv420p --audio-codec=aac --audio-bitrate=320k \
  --concurrency="${CONCURRENCY:-4}" --log=error
cd "$ROOT"

# YouTube target: -14 LUFS integrated, -1 dBTP. Two-pass loudnorm, the video stream is copied.
STATS=$(ffmpeg -hide_banner -i "$RAW" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$STATS" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i "$RAW" -c:v copy \
  -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):linear=true" \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart "$FINAL"
rm -f "$RAW"
rm -rf "$OUT/tmp"
python3 tools/make_srt.py "$OUT/$SLUG.srt"
ls -la "$FINAL" "$OUT/$SLUG.srt"
