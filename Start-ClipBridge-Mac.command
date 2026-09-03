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

APP_PATH="$("$PROJECT_ROOT/macos/build-app.sh")"
open "$APP_PATH"
