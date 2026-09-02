import { loadConfig } from "./config.mjs";
import { readClipboardText, writeClipboardText } from "./clipboard-windows.mjs";
import { createClipBridgeServer } from "./http.mjs";
import { localIPv4Addresses } from "./network.mjs";
import { loadDeviceRegistry } from "./devices.mjs";
import { loadHistoryStore } from "./history.mjs";

if (process.platform !== "win32") {
  console.error("ClipBridge 0.2 currently runs on Windows only.");
  process.exit(1);
}

const config = await loadConfig();
const addresses = localIPv4Addresses();
const devices = await loadDeviceRegistry(config.stateDir);
const history = await loadHistoryStore(config.stateDir);
const server = createClipBridgeServer({
  config,
  instanceId: process.env.CLIPBRIDGE_INSTANCE_ID || null,
  devices,
  history,
  pairingAddresses: addresses,
  clipboard: {
    readText: readClipboardText,
    writeText: writeClipboardText
  }
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`ClipBridge is running as ${config.deviceName}.`);
  console.log("Use only on a trusted private network. This prototype does not encrypt HTTP traffic.");
  if (process.env.CLIPBRIDGE_LAUNCH_MODE !== "tray") {
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
  server.close(() => process.exit(0));
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
