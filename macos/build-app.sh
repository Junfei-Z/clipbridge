#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$PROJECT_ROOT/dist/ClipBridge.app"
CONTENTS="$APP_DIR/Contents"

mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"
# Objective-C avoids Swift compiler/SDK patch-build mismatches after partial
# Apple Command Line Tools updates while still producing a native AppKit app.
xcrun clang -fobjc-arc "$SCRIPT_DIR/ClipBridgeMenuBar.m" \
  -framework AppKit -framework Foundation \
  -o "$CONTENTS/MacOS/ClipBridge"
cp "$SCRIPT_DIR/Info.plist" "$CONTENTS/Info.plist"
cp "$PROJECT_ROOT/assets/brand-icon-96.png" "$CONTENTS/Resources/brand-icon-96.png"
command -v node > "$CONTENTS/Resources/node-path"
chmod +x "$CONTENTS/MacOS/ClipBridge"

# Copying resources from a browser-downloaded archive can propagate quarantine
# into the generated bundle. Remove it only from this local build artifact;
# the downloaded source tree remains untouched.
if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$APP_DIR" 2>/dev/null || true
fi

# The app is compiled locally, so an ad-hoc signature gives the generated
# bundle a consistent local identity without requiring an Apple Developer ID.
if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "$APP_DIR" >/dev/null
fi

echo "$APP_DIR"
