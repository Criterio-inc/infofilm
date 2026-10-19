#!/usr/bin/env bash
# Scaffold a new film or clip from the template, dressed in a client profile.
#   new_film.sh <project-dir> [--profile kund] [--mode klipp|film] [--format 16:9,1:1]
#               [--slug my-film] [--title "My Film"] [--lang sv] [--locale sv-SE]
#               [--design-system <url>]   (repeatable: this film's own, on top of the profile's)
# --profile  a folder in $INFOFILM_PROFILES or <skill>/profiles, or a path (default: critero)
# --mode     klipp: 30–90 s, one message, ends on the client's end card · film: 2–15 min in parts
# --format   one or more of 16:9, 1:1, 9:16 (the first is the main one); default: the profile's, else 16:9
# Language and locale default to the profile's. Copies the template, puts the profile in, installs
# the video toolchain, synthesises the sound effects, builds a first (estimated) timeline and
# typechecks — so the film renders from minute one.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?usage: new_film.sh <project-dir> [--profile p] [--mode klipp|film] [--format 16:9,1:1] [--slug s] [--title t] [--lang xx] [--locale xx-XX]}"
shift
PROFILE="critero" MODE="film" FORMATS="" SLUG="" TITLE="" LANG_="" LOCALE="" DESIGN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --format|--formats) FORMATS="$2"; shift 2 ;;
    --slug) SLUG="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --lang) LANG_="$2"; shift 2 ;;
    --locale) LOCALE="$2"; shift 2 ;;
    --design-system|--design-systems) DESIGN="${DESIGN:+$DESIGN,}$2"; shift 2 ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done
PDIR=""
for cand in "$PROFILE" "${INFOFILM_PROFILES:-}/$PROFILE" "$SKILL/profiles/$PROFILE"; do
  if [[ -f "$cand/profile.json" ]]; then PDIR="$(cd "$cand" && pwd)"; break; fi
done
[[ -n "$PDIR" ]] || { echo "no profile '$PROFILE' (looked in \$INFOFILM_PROFILES and $SKILL/profiles)"; exit 1; }
[[ "$MODE" == "klipp" || "$MODE" == "film" ]] || { echo "--mode is klipp or film"; exit 1; }
if [[ -e "$DIR" && -n "$(ls -A "$DIR" 2>/dev/null)" ]]; then
  echo "$DIR exists and is not empty — refusing to overwrite"; exit 1
fi
mkdir -p "$DIR"
cp -R "$SKILL/template/." "$DIR/"
cd "$DIR"
if [[ "$MODE" == "klipp" ]]; then mv script/klipp.md script/script.md; else rm script/klipp.md; fi
python3 "$SKILL/scripts/apply_profile.py" "$PDIR" . --mode "$MODE" --formats "$FORMATS" \
  --slug "$SLUG" --title "$TITLE" --lang "$LANG_" --locale "$LOCALE" --design-systems "$DESIGN"
[[ -f brand/fonts/google.json ]] || python3 tools/fetch_fonts.py
python3 tools/make_sfx.py
python3 tools/build_timeline.py
(cd video && (command -v pnpm >/dev/null && pnpm install --silent || npm install --silent) && npx tsc --noEmit -p .)
echo
echo "ready: $DIR  ($MODE, profile $(basename "$PDIR"))"
echo "  the demo (leap years) is in place: replace script/, notes/, data.ts and the golden scenes with your own"
echo "  client notes: brand/NOTES.md · preview: cd $DIR/video && npx remotion studio src/index.ts"
