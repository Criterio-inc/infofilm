#!/usr/bin/env bash
# Install the infofilm skill for Claude Code.
#   ./install.sh            copy into ~/.claude/skills/infofilm
#   ./install.sh --link     symlink instead (follows this checkout; good for hacking on the skill)
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/skills/infofilm"
DST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/infofilm"
mkdir -p "$(dirname "$DST")"
if [[ -e "$DST" || -L "$DST" ]]; then
  echo "$DST already exists — remove it first to reinstall"; exit 1
fi
if [[ "${1:-}" == "--link" ]]; then ln -s "$SRC" "$DST"; else cp -R "$SRC" "$DST"; fi
echo "installed: $DST"
echo "new clip:  $DST/scripts/new_film.sh ~/films/my-clip --mode klipp --format 16:9,1:1 --slug my-clip --title \"My Clip\""
echo "new client: $DST/scripts/new_profile.sh my-client --name \"My Client\""
