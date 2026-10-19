#!/usr/bin/env bash
# One-time setup on a Mac: the tools, the Python packages, the skill and the Dock app.
#   app/macos/setup.sh
# Safe to run again. Needs Homebrew (https://brew.sh).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
[[ "$(uname)" == "Darwin" ]] || { echo "bara på macOS"; exit 1; }
command -v brew >/dev/null || { echo "Installera Homebrew först: https://brew.sh"; exit 1; }

echo "── verktyg (Homebrew)"
for f in node python ffmpeg; do brew list "$f" >/dev/null 2>&1 || brew install "$f"; done

echo "── Python-paket (i ~/.infofilm/venv, som appen använder)"
mkdir -p "$HOME/.infofilm"
[[ -x "$HOME/.infofilm/venv/bin/python3" ]] || python3 -m venv "$HOME/.infofilm/venv"
"$HOME/.infofilm/venv/bin/pip" install -q --upgrade pip numpy elevenlabs

echo "── skillen"
if [[ -e "$HOME/.claude/skills/infofilm" ]]; then echo "finns redan: ~/.claude/skills/infofilm"; else "$REPO/install.sh" --link; fi

echo "── Claude Code"
if command -v claude >/dev/null; then claude --version; else
  npm install -g @anthropic-ai/claude-code
  echo "logga in en gång i Terminalen med: claude"
fi

echo "── Dock-appen"
"$REPO/app/macos/make-app.sh"
echo
echo "Klart. Öppna Infofilm, gå till Inställningar och lägg in API-nycklarna för ElevenLabs och OpenRouter."
