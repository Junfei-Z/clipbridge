import { loadConfig } from "./config.mjs";
import { createClipboardAdapter, supportsRelayPlatform } from "./clipboard.mjs";
import { createClipBridgeServer } from "./http.mjs";
import { localIPv4Addresses } from "./network.mjs";
import { loadDeviceRegistry } from "./devices.mjs";
import { loadHistoryStore } from "./history.mjs";
import { loadInboxStore } from "./inbox.mjs";
import { loadFileTransferStore } from "./files.mjs";
import { relayNodeIdentity, relayPlatformLabel } from "./identity.mjs";

if (!supportsRelayPlatform(process.platform)) {
  console.error(`ClipBridge relay nodes currently support Windows and macOS, not ${process.platform}.`);
  process.exit(1);
}

const config = await loadConfig();
const relayNode = relayNodeIdentity(config);
const clipboard = createClipboardAdapter(process.platform);
const addresses = localIPv4Addresses();
const devices = await loadDeviceRegistry(config.stateDir);
const history = await loadHistoryStore(config.stateDir);
const inbox = await loadInboxStore(config.stateDir);
const files = await loadFileTransferStore(config.stateDir, {
  maxFileBytes: config.maxFileBytes,
  maxTotalBytes: config.maxFileTotalBytes,
  ttlMs: config.fileTtlMs
});
const fileCleanupTimer = setInterval(() => {
  files.cleanupExpired().catch(() => {});
}, 60 * 60 * 1000);
fileCleanupTimer.unref();
const server = createClipBridgeServer({
  config,
  instanceId: process.env.CLIPBRIDGE_INSTANCE_ID || null,
  devices,
  history,
  inbox,
  files,
  pairingAddresses: addresses,
  clipboard
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`ClipBridge is running as ${relayNode.name} (${relayPlatformLabel(relayNode)} relay node).`);
  console.log("Use only on a trusted private network. This prototype does not encrypt HTTP traffic.");
  if (!['tray', 'menubar'].includes(process.env.CLIPBRIDGE_LAUNCH_MODE)) {
    console.log("");
    for (const address of addresses) {
      console.log(`Pairing base URL: http://${address}:${config.port}`);
      console.log(`Quick panel: http://${address}:${config.port}/ui`);
    }
    console.log("Open ClipBridge on this PC to pair a device with a one-time code or QR code.");
    console.log(`Config: ${config.configPath}`);
  }
});

function stop() {
  clearInterval(fileCleanupTimer);
  server.close(() => process.exit(0));
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
