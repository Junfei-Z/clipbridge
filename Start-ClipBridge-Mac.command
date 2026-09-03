#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "ClipBridge requires Node.js 20 or later." as critical'
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  osascript -e 'display alert "ClipBridge requires Node.js 20 or later." as critical'
  exit 1
fi

if ! command -v swiftc >/dev/null 2>&1; then
  osascript -e 'display alert "Install Apple Command Line Tools first: xcode-select --install" as critical'
  exit 1
fi

BUILD_SCRIPT="$PROJECT_ROOT/macos/build-app.sh"
# Files extracted from a browser download can retain macOS quarantine metadata.
# Let the trusted system shell read the build script instead of asking Launch
# Services to execute that quarantined child file as a standalone program.
APP_PATH="$(/bin/bash "$BUILD_SCRIPT")"
open "$APP_PATH"
