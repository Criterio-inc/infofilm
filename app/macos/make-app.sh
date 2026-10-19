#!/usr/bin/env bash
# Build Infofilm.app: a real Mac app with its own window and Dock icon (main.swift, compiled here
# with the Xcode command line tools). Without them it falls back to a launcher that opens the
# app in a Chrome/Edge window.
#   app/macos/make-app.sh                → ~/Applications/Infofilm.app
#   app/macos/make-app.sh /Applications
# Run it again after `git pull` or after moving the repo. Then right-click the Dock icon →
# Options → Keep in Dock.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APPDIR="$(cd "$HERE/.." && pwd)"
DEST="${1:-$HOME/Applications}"
APP="$DEST/Infofilm.app"
LOG="$HOME/.infofilm/build.log"
[[ "$(uname)" == "Darwin" ]] || { echo "bara på macOS"; exit 1; }
mkdir -p "$DEST" "$HOME/.infofilm"

# an open Infofilm and a running server would keep the old code: close both
osascript -e 'tell application id "se.criterio.infofilm" to quit' >/dev/null 2>&1 || true
curl -fs -X POST -H "X-Infofilm: 1" -H "Content-Type: application/json" -d '{}' --max-time 2 http://localhost:4747/api/quit >/dev/null 2>&1 || true
sleep 1

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
echo "$APPDIR" > "$APP/Contents/Resources/appdir"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Infofilm</string>
  <key>CFBundleDisplayName</key><string>Infofilm</string>
  <key>CFBundleIdentifier</key><string>se.criterio.infofilm</string>
  <key>CFBundleVersion</key><string>2</string>
  <key>CFBundleShortVersionString</key><string>1.1</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>Infofilm</string>
  <key>CFBundleIconFile</key><string>Infofilm</string>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.video</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHumanReadableCopyright</key><string>Criterio AB</string>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST

# the icon: icon.png (1024 px, macOS icon grid) → Infofilm.icns
SET="$(mktemp -d)/Infofilm.iconset"
mkdir -p "$SET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$HERE/icon.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$HERE/icon.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$APP/Contents/Resources/Infofilm.icns"
rm -rf "$(dirname "$SET")"

# the program: the native window when Swift is available, else the launcher script
NATIVE=0
if xcode-select -p >/dev/null 2>&1 && xcrun --find swiftc >/dev/null 2>&1; then
  echo "bygger appen (Swift) …"
  if xcrun swiftc -swift-version 5 -O -o "$APP/Contents/MacOS/Infofilm" "$HERE/main.swift" -framework Cocoa -framework WebKit >"$LOG" 2>&1; then
    NATIVE=1
  else
    echo "⚠ Swift-bygget misslyckades (se $LOG) – använder startskriptet i stället"
  fi
else
  echo "⚠ Xcodes kommandoradsverktyg saknas (installera med: xcode-select --install) – använder startskriptet i stället"
fi
if [[ $NATIVE == 0 ]]; then
  cat > "$APP/Contents/MacOS/Infofilm" <<LAUNCH
#!/bin/zsh -l
# Infofilm launcher: starts the server in $APPDIR and opens the window.
exec "$APPDIR/start.sh" >> "\$HOME/.infofilm/launcher.log" 2>&1
LAUNCH
  chmod +x "$APP/Contents/MacOS/Infofilm"
fi

# an ad-hoc signature, so macOS runs the locally built app without complaint
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true

echo
if [[ $NATIVE == 1 ]]; then
  echo "klart: $APP (egen app med eget fönster)"
else
  echo "klart: $APP (startskript: fönstret öppnas i webbläsaren)"
fi
echo "öppna den, högerklicka på ikonen i Dock → Alternativ → Behåll i Dock"
open "$APP"
