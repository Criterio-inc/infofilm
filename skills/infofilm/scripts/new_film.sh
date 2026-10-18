#!/usr/bin/env bash
# Scaffold a new infofilm project from the template.
#   new_film.sh <project-dir> [--slug my-film] [--title "My Film"] [--lang sv] [--locale sv-SE]
# Copies the template, writes film.json, installs the video toolchain, synthesises the sound
# effects, builds a first (estimated) timeline and typechecks — so the film renders from minute one.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?usage: new_film.sh <project-dir> [--slug s] [--title t] [--lang xx] [--locale xx-XX]}"
shift
SLUG="" TITLE="" LANG_="" LOCALE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --lang) LANG_="$2"; shift 2 ;;
    --locale) LOCALE="$2"; shift 2 ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done
if [[ -e "$DIR" && -n "$(ls -A "$DIR" 2>/dev/null)" ]]; then
  echo "$DIR exists and is not empty — refusing to overwrite"; exit 1
fi
mkdir -p "$DIR"
cp -R "$SKILL/template/." "$DIR/"
cd "$DIR"
python3 - "$SLUG" "$TITLE" "$LANG_" "$LOCALE" <<'PY'
import json, sys
slug, title, lang, locale = sys.argv[1:]
f = json.load(open("film.json"))
for k, v in (("slug", slug), ("title", title), ("language", lang), ("locale", locale)):
    if v:
        f[k] = v
json.dump(f, open("film.json", "w"), ensure_ascii=False, indent=2)
open("film.json", "a").write("\n")
PY
python3 tools/make_sfx.py
python3 tools/build_timeline.py
(cd video && (command -v pnpm >/dev/null && pnpm install --silent || npm install --silent) && npx tsc --noEmit -p .)
echo
echo "ready: $DIR"
echo "  the demo film (leap years) is in place: replace script/, notes/, film.json, data.ts and the golden scenes with your own"
echo "  preview: cd $DIR/video && npx remotion studio src/index.ts"
