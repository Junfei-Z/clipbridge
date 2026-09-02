import assert from "node:assert/strict";
import test from "node:test";
import { DeviceRegistry } from "../src/devices.mjs";
import { HistoryStore } from "../src/history.mjs";
import { createClipBridgeServer } from "../src/http.mjs";
import { PairingManager } from "../src/pairing.mjs";

const LEGACY_TOKEN = "a".repeat(32);
const LOCAL_HEADERS = { "X-ClipBridge-Test-Local": "1" };

async function withServer(run) {
  let value = "from Windows";
  const now = () => Date.parse("2026-09-01T12:00:00Z");
  const devices = new DeviceRegistry({ now });
  const history = new HistoryStore({ now });
  const server = createClipBridgeServer({
    config: { token: LEGACY_TOKEN, deviceName: "Test PC", maxTextBytes: 1024, port: 39393 },
    clipboard: {
      readText: async () => value,
      writeText: async (next) => { value = next; }
    },
    now,
    devices,
    history,
    pairing: new PairingManager({ now }),
    pairingAddresses: ["192.168.1.23"],
    isLocalRequest: (_address, request) => request.headers["x-clipbridge-test-local"] === "1"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`, () => value, { devices, history });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("rejects clipboard requests from an unpaired remote device", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/clip`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "PAIRING_REQUIRED");
  });
});

test("lets the Windows host manage its clipboard without putting a token in the URL", async () => {
  await withServer(async (baseUrl, currentValue) => {
    const getResponse = await fetch(`${baseUrl}/api/v1/clip`, { headers: LOCAL_HEADERS });
    assert.equal(getResponse.status, 200);
    assert.equal((await getResponse.json()).text, "from Windows");

    const postResponse = await fetch(`${baseUrl}/api/v1/clip`, {
      method: "POST",
      headers: { ...LOCAL_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", text: "本机保存的文字" })
    });
    assert.equal(postResponse.status, 200);
    assert.equal(currentValue(), "本机保存的文字");
  });
});

test("completes one-time device pairing and supports individual revocation", async () => {
  await withServer(async (baseUrl, currentValue) => {
    const sessionResponse = await fetch(`${baseUrl}/api/v1/pairing/sessions`, {
      method: "POST",
      headers: LOCAL_HEADERS
    });
    assert.equal(sessionResponse.status, 201);
    const pairing = await sessionResponse.json();
    assert.match(pairing.code, /^\d{6}$/);
    assert.equal(pairing.urls[0], `http://192.168.1.23:39393/ui?pair=${pairing.code}`);
    assert.match(pairing.qrSvg, /^<svg/);
    assert.equal(pairing.options[0].url, pairing.urls[0]);

    const pairResponse = await fetch(`${baseUrl}/api/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: pairing.code, name: "Junfei 的 iPhone", type: "iphone" })
    });
    assert.equal(pairResponse.status, 201);
    const paired = await pairResponse.json();
    assert.ok(paired.token.length >= 40);
    assert.equal(paired.device.name, "Junfei 的 iPhone");
    assert.equal(paired.device.type, "iphone");

    const auth = { Authorization: `Bearer ${paired.token}` };
    const identityResponse = await fetch(`${baseUrl}/api/v1/session`, { headers: auth });
    assert.equal(identityResponse.status, 200);
    const identity = await identityResponse.json();
    assert.equal(identity.device.id, paired.device.id);
    assert.equal(identity.device.kind, "paired");
    assert.equal(identity.computer.name, "Test PC");

    const clipResponse = await fetch(`${baseUrl}/api/v1/clip`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", text: "你好，安全配对" })
    });
    assert.equal(clipResponse.status, 200);
    assert.equal((await clipResponse.json()).source.name, "Junfei 的 iPhone");
    assert.equal(currentValue(), "你好，安全配对");

    const receiveResponse = await fetch(`${baseUrl}/api/v1/clip`, { headers: auth });
    assert.equal(receiveResponse.status, 200);
    assert.equal((await receiveResponse.json()).text, "你好，安全配对");

    const historyResponse = await fetch(`${baseUrl}/api/v1/history`, { headers: auth });
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json();
    assert.equal(history.scope, "device");
    assert.equal(history.entries.length, 2);
    assert.equal(history.entries[0].source.id, "windows-host");
    assert.equal(history.entries[0].target.id, paired.device.id);
    assert.equal(history.entries[1].source.id, paired.device.id);
    assert.equal(history.entries[1].target.id, "windows-host");
    assert.equal(history.entries[1].text, "你好，安全配对");

    const removeHistoryResponse = await fetch(`${baseUrl}/api/v1/history/${history.entries[0].id}`, {
      method: "DELETE",
      headers: auth
    });
    assert.equal(removeHistoryResponse.status, 200);
    const clearHistoryResponse = await fetch(`${baseUrl}/api/v1/history`, { method: "DELETE", headers: auth });
    assert.deepEqual(await clearHistoryResponse.json(), { ok: true, removed: 1 });

    const devicesResponse = await fetch(`${baseUrl}/api/v1/devices`, { headers: LOCAL_HEADERS });
    assert.deepEqual((await devicesResponse.json()).devices.map(({ id }) => id), [paired.device.id]);

    const revokeResponse = await fetch(`${baseUrl}/api/v1/devices/${paired.device.id}`, {
      method: "DELETE",
      headers: LOCAL_HEADERS
    });
    assert.equal(revokeResponse.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/v1/session`, { headers: auth })).status, 401);
  });
});

test("a pairing code can only be used once", async () => {
  await withServer(async (baseUrl) => {
    const created = await fetch(`${baseUrl}/api/v1/pairing/sessions`, { method: "POST", headers: LOCAL_HEADERS });
    const { code } = await created.json();
    const body = JSON.stringify({ code, name: "iPhone", type: "iphone" });
    assert.equal((await fetch(`${baseUrl}/api/v1/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body })).status, 201);
    assert.equal((await fetch(`${baseUrl}/api/v1/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body })).status, 401);
  });
});

test("paired devices can only read and delete their own transfer history", async () => {
  await withServer(async (baseUrl, _currentValue, { devices, history }) => {
    const iphone = await devices.register({ name: "Junfei 的 iPhone", type: "iphone" });
    const mac = await devices.register({ name: "Junfei 的 Mac", type: "mac" });
    const windows = { id: "windows-host", name: "Test PC", type: "windows" };
    const iphoneEntry = await history.add({ text: "phone only", source: iphone.device, target: windows });
    const macEntry = await history.add({ text: "mac only", source: mac.device, target: windows });
    const iphoneAuth = { Authorization: `Bearer ${iphone.token}` };
    const macAuth = { Authorization: `Bearer ${mac.token}` };

    const iphoneHistory = await (await fetch(`${baseUrl}/api/v1/history`, { headers: iphoneAuth })).json();
    const macHistory = await (await fetch(`${baseUrl}/api/v1/history`, { headers: macAuth })).json();
    assert.deepEqual(iphoneHistory.entries.map(({ id }) => id), [iphoneEntry.id]);
    assert.deepEqual(macHistory.entries.map(({ id }) => id), [macEntry.id]);

    assert.equal((await fetch(`${baseUrl}/api/v1/history/${macEntry.id}`, { method: "DELETE", headers: iphoneAuth })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/v1/history/${iphoneEntry.id}`, { method: "DELETE", headers: iphoneAuth })).status, 200);

    const localHistory = await (await fetch(`${baseUrl}/api/v1/history`, { headers: LOCAL_HEADERS })).json();
    assert.deepEqual(localHistory.entries.map(({ id }) => id), [macEntry.id]);
    assert.equal(localHistory.scope, "all");
  });
});

test("keeps v0.1 bearer links working during migration", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/session`, {
      headers: { Authorization: `Bearer ${LEGACY_TOKEN}`, "User-Agent": "Mozilla/5.0 (iPhone)" }
    });
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.equal(session.legacy, true);
    assert.equal(session.device.name, "iPhone");
  });
});

test("serves the Windows device manager locally and the pairing screen remotely", async () => {
  await withServer(async (baseUrl) => {
    const remote = await fetch(`${baseUrl}/ui`, { headers: { "User-Agent": "Mozilla/5.0 (iPhone)" } });
    assert.equal(remote.status, 200);
    assert.match(await remote.text(), /id="pair-form"/);

    const local = await fetch(`${baseUrl}/ui`, { headers: LOCAL_HEADERS });
    assert.equal(local.status, 200);
    const html = await local.text();
    assert.match(html, /Windows 本机/);
    assert.match(html, /配对新设备/);
    assert.match(html, /已配对设备/);
    assert.doesNotMatch(html, /id="pair-form"/);
  });
});

test("serves unified app icons and a token-free installable manifest", async () => {
  await withServer(async (baseUrl) => {
    const favicon = await fetch(`${baseUrl}/favicon.ico`);
    assert.equal(favicon.status, 200);
    assert.equal(favicon.headers.get("content-type"), "image/x-icon");
    assert.ok((await favicon.arrayBuffer()).byteLength > 1000);

    const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifestResponse.status, 200);
    const manifest = await manifestResponse.json();
    assert.equal(manifest.start_url, "/ui");
    assert.equal(manifest.display, "standalone");
    assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ["192x192", "512x512"]);
  });
});

test("reports v0.2.1 and the runtime instance on the health endpoint", async () => {
  const server = createClipBridgeServer({
    config: { token: LEGACY_TOKEN, deviceName: "Test PC", maxTextBytes: 1024 },
    clipboard: { readText: async () => "", writeText: async () => {} },
    instanceId: "tray-launch-123"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.deepEqual(await response.json(), {
      ok: true,
      device: "Test PC",
      version: "0.2.1",
      instanceId: "tray-launch-123"
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
