#!/usr/bin/env bash
# Build Infofilm.app (a small launcher with its own icon) so the app can live in the Dock.
#   app/macos/make-app.sh            → ~/Applications/Infofilm.app
#   app/macos/make-app.sh /Applications
# The launcher starts the app's server from THIS checkout and opens the window. Drag it to the
# Dock (or right-click its Dock icon → Options → Keep in Dock). Run again after moving the repo.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APPDIR="$(cd "$HERE/.." && pwd)"
DEST="${1:-$HOME/Applications}"
APP="$DEST/Infofilm.app"
[[ "$(uname)" == "Darwin" ]] || { echo "bara på macOS"; exit 1; }
mkdir -p "$DEST"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Infofilm</string>
  <key>CFBundleDisplayName</key><string>Infofilm</string>
  <key>CFBundleIdentifier</key><string>se.criterio.infofilm</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>Infofilm</string>
  <key>CFBundleIconFile</key><string>Infofilm</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>
PLIST

cat > "$APP/Contents/MacOS/Infofilm" <<LAUNCH
#!/bin/zsh -l
# Infofilm launcher: starts the server in $APPDIR and opens the window.
exec "$APPDIR/start.sh" >> "\$HOME/.infofilm/launcher.log" 2>&1
LAUNCH
chmod +x "$APP/Contents/MacOS/Infofilm"

# the icon: icon.png (1024 px) → Infofilm.icns
SET="$(mktemp -d)/Infofilm.iconset"
mkdir -p "$SET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$HERE/icon.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$HERE/icon.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$APP/Contents/Resources/Infofilm.icns"
rm -rf "$(dirname "$SET")"
touch "$APP"
mkdir -p "$HOME/.infofilm"
echo "klart: $APP"
echo "dra den till Dock, eller öppna den en gång och välj Behåll i Dock"
open -R "$APP"
