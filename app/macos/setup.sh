#!/usr/bin/env bash
# One-time setup on a Mac: the tools, the Python packages, the skill and the Dock app.
#   app/macos/setup.sh
# Safe to run again; a step that fails is reported and the rest still runs. Needs Homebrew.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
[[ "$(uname)" == "Darwin" ]] || { echo "bara på macOS"; exit 1; }
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
command -v brew >/dev/null || { echo "Installera Homebrew först: https://brew.sh – kör sedan det här skriptet igen."; exit 1; }
FAIL=()

echo "── Xcodes kommandoradsverktyg (för att bygga appen)"
xcode-select -p >/dev/null 2>&1 || { xcode-select --install; echo "Installera verktygen i rutan som öppnades och kör sedan skriptet igen."; }

echo "── verktyg (Homebrew)"
for f in node python ffmpeg; do
  brew list "$f" >/dev/null 2>&1 && { echo "$f finns"; continue; }
  brew install "$f" || FAIL+=("brew install $f")
done

echo "── Python-paket (i ~/.infofilm/venv, som appen använder)"
mkdir -p "$HOME/.infofilm"
PY="$(brew --prefix)/bin/python3"
[[ -x "$PY" ]] || PY=python3
[[ -x "$HOME/.infofilm/venv/bin/python3" ]] || "$PY" -m venv "$HOME/.infofilm/venv" || FAIL+=("python3 -m venv ~/.infofilm/venv")
"$HOME/.infofilm/venv/bin/pip" install -q --upgrade pip numpy elevenlabs || FAIL+=("pip install numpy elevenlabs")

echo "── skillen"
if [[ -e "$HOME/.claude/skills/infofilm" ]]; then echo "finns: ~/.claude/skills/infofilm"; else "$REPO/install.sh" --link || FAIL+=("install.sh --link"); fi

echo "── Claude Code"
if command -v claude >/dev/null; then claude --version; else
  npm install -g @anthropic-ai/claude-code || FAIL+=("npm install -g @anthropic-ai/claude-code")
  echo "logga in en gång i Terminalen med: claude"
fi

echo "── Dock-appen"
"$REPO/app/macos/make-app.sh" || FAIL+=("app/macos/make-app.sh")

echo
echo "── sammanfattning"
ok() { if eval "$2" >/dev/null 2>&1; then echo "✓ $1"; else echo "✗ $1"; fi; }
ok "Node" "command -v node"
ok "ffmpeg" "command -v ffmpeg"
ok "Python-paket (numpy, elevenlabs)" "$HOME/.infofilm/venv/bin/python3 -c 'import numpy, elevenlabs'"
ok "Claude Code" "command -v claude"
ok "Xcodes kommandoradsverktyg" "xcode-select -p"
if ((${#FAIL[@]})); then
  echo
  echo "Det här misslyckades – kör om skriptet, eller skicka utskriften ovan:"
  printf '  %s\n' "${FAIL[@]}"
else
  echo
  echo "Klart. Lägg in API-nycklarna under Inställningar i Infofilm."
fi
