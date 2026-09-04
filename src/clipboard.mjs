import * as macosClipboard from "./clipboard-macos.mjs";
import * as windowsClipboard from "./clipboard-windows.mjs";

export function createClipboardAdapter(platform = process.platform, adapters = {}) {
  if (platform === "win32") return adapters.windows ?? {
    readText: windowsClipboard.readClipboardText,
    writeText: windowsClipboard.writeClipboardText
  };
  if (platform === "darwin") return adapters.macos ?? {
    readText: macosClipboard.readClipboardText,
    writeText: macosClipboard.writeClipboardText
  };
  throw new Error(`ClipBridge relay nodes do not support ${platform} yet. Use Windows or macOS.`);
}

export function supportsRelayPlatform(platform = process.platform) {
  return platform === "win32" || platform === "darwin";
}
