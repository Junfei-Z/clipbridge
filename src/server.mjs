import { loadConfig } from "./config.mjs";
import { readClipboardText, writeClipboardText } from "./clipboard-windows.mjs";
import { createClipBridgeServer } from "./http.mjs";
import { localIPv4Addresses } from "./network.mjs";

if (process.platform !== "win32") {
  console.error("ClipBridge 0.1 currently runs on Windows only.");
  process.exit(1);
}

const config = await loadConfig();
const server = createClipBridgeServer({
  config,
  instanceId: process.env.CLIPBRIDGE_INSTANCE_ID || null,
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
    for (const address of localIPv4Addresses()) {
      console.log(`Pairing base URL: http://${address}:${config.port}`);
      console.log(`Quick panel: http://${address}:${config.port}/ui?token=${encodeURIComponent(config.token)}`);
    }
    console.log(`Pairing token: ${config.token}`);
    console.log(`Config: ${config.configPath}`);
  }
});

function stop() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
