import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DeviceRegistry } from "../src/devices.mjs";
import { FileTransferStore } from "../src/files.mjs";
import { HistoryStore } from "../src/history.mjs";
import { InboxStore } from "../src/inbox.mjs";
import { createClipBridgeServer } from "../src/http.mjs";
import { PairingManager } from "../src/pairing.mjs";

const LEGACY_TOKEN = "a".repeat(32);
const LOCAL_HEADERS = { "X-ClipBridge-Test-Local": "1" };

async function withServer(run) {
  let value = "from Windows";
  const now = () => Date.parse("2026-09-01T12:00:00Z");
  const devices = new DeviceRegistry({ now });
  const history = new HistoryStore({ now });
  const inbox = new InboxStore({ now });
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "clipbridge-http-files-"));
  const files = new FileTransferStore({ stateDir, now, maxFileBytes: 1024 * 1024, maxTotalBytes: 4 * 1024 * 1024, ttlMs: 60_000 });
  const server = createClipBridgeServer({
    config: { token: LEGACY_TOKEN, deviceName: "Test PC", maxTextBytes: 1024, maxFileBytes: 1024 * 1024, maxFileTotalBytes: 4 * 1024 * 1024, fileTtlMs: 60_000, port: 39393, stateDir },
    clipboard: {
      readText: async () => value,
      writeText: async (next) => { value = next; }
    },
    now,
    devices,
    history,
    inbox,
    files,
    pairing: new PairingManager({ now }),
    pairingAddresses: ["192.168.1.23"],
    isLocalRequest: (_address, request) => request.headers["x-clipbridge-test-local"] === "1"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`, () => value, { devices, history, inbox, files });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(stateDir, { recursive: true, force: true });
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
    assert.equal(identity.relayNode.role, "relay-node");
    assert.equal(identity.session.role, "management-device");
    assert.equal(identity.session.access, "paired");
    assert.equal(identity.session.canManagePairing, false);

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

test("routes text between paired devices through isolated local inboxes", async () => {
  await withServer(async (baseUrl, currentValue, { devices, inbox }) => {
    const iphone = await devices.register({ name: "Junfei 的 iPhone", type: "iphone" });
    const mac = await devices.register({ name: "Junfei 的 MacBook", type: "mac" });
    const iphoneAuth = { Authorization: `Bearer ${iphone.token}` };
    const macAuth = { Authorization: `Bearer ${mac.token}` };

    const peers = await (await fetch(`${baseUrl}/api/v1/peers`, { headers: iphoneAuth })).json();
    assert.equal(peers.self.id, iphone.device.id);
    assert.deepEqual(peers.targets.map(({ id }) => id).sort(), ["windows-host", mac.device.id].sort());

    const routedResponse = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: "POST",
      headers: { ...iphoneAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", text: "iPhone 发给 Mac 🥳", targetId: mac.device.id })
    });
    assert.equal(routedResponse.status, 201);
    const routed = await routedResponse.json();
    assert.equal(routed.delivery, "inbox");
    assert.equal(currentValue(), "from Windows");

    assert.deepEqual((await (await fetch(`${baseUrl}/api/v1/inbox`, { headers: iphoneAuth })).json()).transfers, []);
    const macInbox = await (await fetch(`${baseUrl}/api/v1/inbox`, { headers: macAuth })).json();
    assert.equal(macInbox.transfers[0].text, "iPhone 发给 Mac 🥳");
    assert.equal(macInbox.transfers[0].source.id, iphone.device.id);
    assert.equal((await fetch(`${baseUrl}/api/v1/inbox/${routed.transfer.id}`, { method: "DELETE", headers: iphoneAuth })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/v1/inbox/${routed.transfer.id}`, { method: "DELETE", headers: macAuth })).status, 200);

    const windowsResponse = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: "POST",
      headers: { ...iphoneAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", text: "direct to Windows", targetId: "windows-host" })
    });
    assert.equal((await windowsResponse.json()).delivery, "clipboard");
    assert.equal(currentValue(), "direct to Windows");

    const fromWindowsResponse = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: "POST",
      headers: { ...LOCAL_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", text: "Windows 发给 Mac", targetId: mac.device.id })
    });
    assert.equal(fromWindowsResponse.status, 201);
    assert.equal((await (await fetch(`${baseUrl}/api/v1/inbox`, { headers: macAuth })).json()).transfers[0].source.id, "windows-host");

    assert.equal((await fetch(`${baseUrl}/api/v1/devices/${mac.device.id}`, { method: "DELETE", headers: LOCAL_HEADERS })).status, 200);
    assert.deepEqual(inbox.list(mac.device.id), []);
    assert.equal((await fetch(`${baseUrl}/api/v1/inbox`, { headers: macAuth })).status, 401);
  });
});

test("sends one text payload to Windows and multiple paired-device inboxes", async () => {
  await withServer(async (baseUrl, currentValue, { devices }) => {
    const android = await devices.register({ name: "Android 手机", type: "android" });
    const iphone = await devices.register({ name: "Junfei 的 iPhone", type: "iphone" });
    const mac = await devices.register({ name: "Junfei 的 MacBook", type: "mac" });
    const androidAuth = { Authorization: `Bearer ${android.token}` };

    const response = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: "POST",
      headers: { ...androidAuth, "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "text",
        text: "同时发送给三台设备",
        targetIds: ["windows-host", iphone.device.id, mac.device.id]
      })
    });
    assert.equal(response.status, 201);
    const batch = await response.json();
    assert.equal(batch.deliveries.length, 3);
    assert.deepEqual(batch.deliveries.map(({ status }) => status), ["delivered", "queued", "queued"]);
    assert.equal(currentValue(), "同时发送给三台设备");

    const iphoneInbox = await (await fetch(`${baseUrl}/api/v1/inbox`, {
      headers: { Authorization: `Bearer ${iphone.token}` }
    })).json();
    const macInbox = await (await fetch(`${baseUrl}/api/v1/inbox`, {
      headers: { Authorization: `Bearer ${mac.token}` }
    })).json();
    assert.equal(iphoneInbox.transfers[0].text, "同时发送给三台设备");
    assert.equal(macInbox.transfers[0].text, "同时发送给三台设备");
  });
});

test("relays files between paired devices with isolated one-time downloads", async () => {
  await withServer(async (baseUrl, _currentValue, { devices }) => {
    const android = await devices.register({ name: "Android 手机", type: "android" });
    const iphone = await devices.register({ name: "Junfei 的 iPhone", type: "iphone" });
    const androidAuth = { Authorization: `Bearer ${android.token}` };
    const iphoneAuth = { Authorization: `Bearer ${iphone.token}` };
    const content = Buffer.from("来自 Android 的文件 🥳", "utf8");

    const upload = await fetch(`${baseUrl}/api/v1/file-transfers?targetId=${encodeURIComponent(iphone.device.id)}&name=${encodeURIComponent("测试文件.svg")}`, {
      method: "POST",
      headers: { ...androidAuth, "Content-Type": "image/svg+xml" },
      body: content
    });
    assert.equal(upload.status, 201);
    const uploaded = await upload.json();
    assert.equal(uploaded.transfer.name, "测试文件.svg");
    assert.equal(uploaded.transfer.previewKind, "text");

    assert.deepEqual((await (await fetch(`${baseUrl}/api/v1/file-inbox`, { headers: androidAuth })).json()).transfers, []);
    const iphoneInbox = await (await fetch(`${baseUrl}/api/v1/file-inbox`, { headers: iphoneAuth })).json();
    assert.equal(iphoneInbox.transfers[0].source.id, android.device.id);
    assert.equal(iphoneInbox.transfers[0].sha256, uploaded.transfer.sha256);

    assert.equal((await fetch(`${baseUrl}/api/v1/file-transfers/${uploaded.transfer.id}/download`, { method: "POST", headers: androidAuth })).status, 404);
    const ticketResponse = await fetch(`${baseUrl}/api/v1/file-transfers/${uploaded.transfer.id}/download?inline=1`, { method: "POST", headers: iphoneAuth });
    assert.equal(ticketResponse.status, 201);
    const ticket = await ticketResponse.json();
    assert.doesNotMatch(ticket.url, /token|Bearer|device/i);

    const download = await fetch(`${baseUrl}${ticket.url}`);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(download.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), content);
    assert.equal((await fetch(`${baseUrl}${ticket.url}`)).status, 404);

    assert.equal((await fetch(`${baseUrl}/api/v1/file-transfers/${uploaded.transfer.id}`, { method: "DELETE", headers: androidAuth })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/v1/file-transfers/${uploaded.transfer.id}`, { method: "DELETE", headers: iphoneAuth })).status, 200);
    assert.deepEqual((await (await fetch(`${baseUrl}/api/v1/file-inbox`, { headers: iphoneAuth })).json()).transfers, []);
  });
});

test("uploads one shared file blob with independent delivery status per target", async () => {
  await withServer(async (baseUrl, _currentValue, { devices, files }) => {
    const android = await devices.register({ name: "Android 手机", type: "android" });
    const iphone = await devices.register({ name: "Junfei 的 iPhone", type: "iphone" });
    const mac = await devices.register({ name: "Junfei 的 MacBook", type: "mac" });
    const androidAuth = { Authorization: `Bearer ${android.token}` };
    const iphoneAuth = { Authorization: `Bearer ${iphone.token}` };
    const macAuth = { Authorization: `Bearer ${mac.token}` };
    const content = Buffer.from("shared across devices", "utf8");

    const query = new URLSearchParams({ name: "shared.txt" });
    query.append("targetId", iphone.device.id);
    query.append("targetId", mac.device.id);
    const upload = await fetch(`${baseUrl}/api/v1/file-transfers?${query}`, {
      method: "POST",
      headers: { ...androidAuth, "Content-Type": "text/plain" },
      body: content
    });
    assert.equal(upload.status, 201);
    const batch = await upload.json();
    assert.equal(batch.deliveries.length, 2);
    assert.equal(batch.deliveries[0].transfer.blobId, batch.blobId);
    assert.equal(batch.deliveries[1].transfer.blobId, batch.blobId);

    const iphoneEntry = (await (await fetch(`${baseUrl}/api/v1/file-inbox`, { headers: iphoneAuth })).json()).transfers[0];
    const macEntry = (await (await fetch(`${baseUrl}/api/v1/file-inbox`, { headers: macAuth })).json()).transfers[0];
    assert.notEqual(iphoneEntry.id, macEntry.id);
    assert.equal(iphoneEntry.blobId, macEntry.blobId);

    const ticket = await (await fetch(`${baseUrl}/api/v1/file-transfers/${iphoneEntry.id}/download`, {
      method: "POST",
      headers: iphoneAuth
    })).json();
    assert.deepEqual(Buffer.from(await (await fetch(`${baseUrl}${ticket.url}`)).arrayBuffer()), content);

    const outbox = await (await fetch(`${baseUrl}/api/v1/file-outbox`, { headers: androidAuth })).json();
    assert.deepEqual(outbox.transfers[0].deliveries.map(({ status }) => status), ["downloaded", "pending"]);

    assert.equal((await fetch(`${baseUrl}/api/v1/file-transfers/${iphoneEntry.id}`, { method: "DELETE", headers: iphoneAuth })).status, 200);
    assert.equal(files.list(mac.device.id).length, 1);
    const macTicket = await (await fetch(`${baseUrl}/api/v1/file-transfers/${macEntry.id}/download`, { method: "POST", headers: macAuth })).json();
    assert.deepEqual(Buffer.from(await (await fetch(`${baseUrl}${macTicket.url}`)).arrayBuffer()), content);
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
    const peersResponse = await fetch(`${baseUrl}/api/v1/peers`, {
      headers: { Authorization: `Bearer ${LEGACY_TOKEN}`, "User-Agent": "Mozilla/5.0 (iPhone)" }
    });
    assert.equal(peersResponse.status, 403);
    assert.equal((await peersResponse.json()).code, "SECURE_PAIRING_REQUIRED");
  });
});

test("serves relay-node management locally and the pairing screen remotely", async () => {
  await withServer(async (baseUrl) => {
    const remote = await fetch(`${baseUrl}/ui`, { headers: { "User-Agent": "Mozilla/5.0 (iPhone)" } });
    assert.equal(remote.status, 200);
    assert.match(await remote.text(), /id="pair-form"/);

    const local = await fetch(`${baseUrl}/ui`, { headers: LOCAL_HEADERS });
    assert.equal(local.status, 200);
    const html = await local.text();
    assert.match(html, /管理端 · Windows 中转/);
    assert.match(html, /管理设备/);
    assert.match(html, /Windows 中转节点/);
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

test("reports v0.7.11, relay identity, URLs, and the runtime instance on health", async () => {
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
      version: "0.7.11",
      relayNode: {
        id: "windows-host",
        name: "Test PC",
        type: "windows",
        platform: "win32",
        role: "relay-node",
        kind: "relay",
        capabilities: ["clipboard", "files", "pairing"]
      },
      urls: [],
      instanceId: "tray-launch-123"
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("uses a Mac relay node as a first-class transfer target and accepts the legacy alias", async () => {
  let value = "from Mac";
  const now = () => Date.parse("2026-09-03T12:00:00Z");
  const devices = new DeviceRegistry({ now });
  const iphone = await devices.register({ name: "Junfei iPhone", type: "iphone" });
  const server = createClipBridgeServer({
    config: {
      token: LEGACY_TOKEN,
      deviceName: "Junfei MacBook",
      nodeId: "relay-macbook",
      nodeName: "Junfei MacBook",
      nodePlatform: "darwin",
      nodeType: "mac",
      maxTextBytes: 1024,
      port: 39393
    },
    clipboard: {
      readText: async () => value,
      writeText: async (next) => { value = next; }
    },
    devices,
    pairingAddresses: ["192.168.1.88"],
    isLocalRequest: () => false,
    now
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const auth = { Authorization: `Bearer ${iphone.token}` };
    const peers = await (await fetch(`http://127.0.0.1:${port}/api/v1/peers`, { headers: auth })).json();
    assert.deepEqual(peers.targets[0], { id: "relay-macbook", name: "Junfei MacBook", type: "mac" });

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/transfers`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", text: "发到 Mac", targetId: "windows-host" })
    });
    assert.equal(response.status, 201);
    assert.equal(value, "发到 Mac");
    assert.equal((await response.json()).deliveries[0].target.id, "relay-macbook");

    const session = await (await fetch(`http://127.0.0.1:${port}/api/v1/node`, { headers: auth })).json();
    assert.equal(session.relayNode.type, "mac");
    assert.equal(session.session.role, "management-device");
    assert.deepEqual(session.urls, ["http://192.168.1.88:39393/ui"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
