import * as macosClipboard from "./clipboard-macos.mjs";
import * as windowsClipboard from "./clipboard-windows.mjs";

export function createClipboardAdapter(platform = process.platform, adapters = {}) {
  if (platform === "win32") return adapters.windows ?? windowsClipboard;
  if (platform === "darwin") return adapters.macos ?? macosClipboard;
  throw new Error(`ClipBridge relay nodes do not support ${platform} yet. Use Windows or macOS.`);
}

export function supportsRelayPlatform(platform = process.platform) {
  return platform === "win32" || platform === "darwin";
}
