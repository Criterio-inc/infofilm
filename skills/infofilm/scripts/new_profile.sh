#!/usr/bin/env bash
# Create a client profile from the starting point in profiles/_mall (or another profile).
#   new_profile.sh <id> [--name "Kundnamn AB"] [--from _mall]
# Writes to $INFOFILM_PROFILES/<id> when INFOFILM_PROFILES is set (e.g. a private repo for client
# material), else to <skill>/profiles/<id>. Then fill in profile.json (colours, fonts, logo),
# style.json (illustration look), design.json (narrator) and NOTES.md from the client's brand book,
# and run python3 <skill>/template/tools/fetch_fonts.py <profile-dir> after changing the fonts.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
ID="${1:?usage: new_profile.sh <id> [--name \"Kundnamn AB\"] [--from _mall]}"
shift
NAME="" FROM="_mall"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --from) FROM="$2"; shift 2 ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done
ROOT="${INFOFILM_PROFILES:-$SKILL/profiles}"
SRC="$ROOT/$FROM"
[[ -f "$SRC/profile.json" ]] || SRC="$SKILL/profiles/$FROM"
[[ -f "$SRC/profile.json" ]] || { echo "no profile '$FROM' to start from"; exit 1; }
DST="$ROOT/$ID"
[[ -e "$DST" ]] && { echo "$DST already exists"; exit 1; }
mkdir -p "$ROOT"
cp -R "$SRC" "$DST"
python3 - "$DST" "${NAME:-$ID}" <<'PY'
import json, sys
from pathlib import Path
d, name = Path(sys.argv[1]), sys.argv[2]
p = json.loads((d / "profile.json").read_text(encoding="utf-8"))
p["name"] = p["kicker"] = name
(d / "profile.json").write_text(json.dumps(p, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
n = d / "NOTES.md"
if n.exists():
    n.write_text(n.read_text(encoding="utf-8").replace("Kundnamn", name, 1), encoding="utf-8")
PY
python3 "$SKILL/template/tools/fetch_fonts.py" "$DST"
echo "profile: $DST"
echo "  next: colours, fonts and logo in profile.json · look in style.json · narrator in design.json · NOTES.md"
