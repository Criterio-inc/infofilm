#!/usr/bin/env bash
# Start Infofilm (unless it is already running) and open its window.
#   ./start.sh            the app's server on http://localhost:4747 + a window
#   ./start.sh --no-open  only the server
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${INFOFILM_PORT:-4747}"
URL="http://localhost:$PORT"
mkdir -p "$HOME/.infofilm"

# started from the Dock, PATH is bare: add Homebrew, ~/.local/bin and the newest nvm Node
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin"
NVM_NODE=$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)
[[ -n "$NVM_NODE" ]] && export PATH="$NVM_NODE:$PATH"
command -v node >/dev/null || { osascript -e 'display alert "Infofilm" message "Hittar inte Node. Installera med: brew install node"' 2>/dev/null; echo "node saknas"; exit 1; }

up() { curl -fs "$URL/icon.png" -o /dev/null --max-time 1; }
if ! up; then
  nohup node "$DIR/server.mjs" >> "$HOME/.infofilm/server.log" 2>&1 &
  for _ in $(seq 1 40); do up && break; sleep 0.25; done
  up || { echo "servern startade inte, se ~/.infofilm/server.log"; exit 1; }
fi
[[ "${1:-}" == "--no-open" ]] && { echo "$URL"; exit 0; }

# an app window without tabs when a Chromium browser is installed, else the default browser
if [[ "$(uname)" == "Darwin" ]]; then
  for b in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
    if [[ -d "/Applications/$b.app" || -d "$HOME/Applications/$b.app" ]]; then
      open -na "$b" --args --app="$URL" && exit 0
    fi
  done
  open "$URL"
else
  xdg-open "$URL" >/dev/null 2>&1 || echo "$URL"
fi
