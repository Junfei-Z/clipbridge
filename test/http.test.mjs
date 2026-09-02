import assert from "node:assert/strict";
import test from "node:test";
import { createClipBridgeServer } from "../src/http.mjs";

async function withServer(run) {
  let value = "from Windows";
  const server = createClipBridgeServer({
    config: { token: "a".repeat(32), deviceName: "Test PC", maxTextBytes: 1024 },
    clipboard: {
      readText: async () => value,
      writeText: async (next) => { value = next; }
    },
    now: () => Date.parse("2026-09-01T12:00:00Z")
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`, () => value);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("rejects unpaired requests", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/clip`);
    assert.equal(response.status, 401);
  });
});

test("gets and sets text clipboard content", async () => {
  await withServer(async (baseUrl, currentValue) => {
    const headers = { Authorization: `Bearer ${"a".repeat(32)}` };
    const getResponse = await fetch(`${baseUrl}/api/v1/clip`, { headers });
    assert.equal(getResponse.status, 200);
    assert.equal((await getResponse.json()).text, "from Windows");

    const postResponse = await fetch(`${baseUrl}/api/v1/clip`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", text: "from iPhone" })
    });
    assert.equal(postResponse.status, 200);
    assert.equal(currentValue(), "from iPhone");
  });
});

test("serves the local Windows panel only to a paired loopback request", async () => {
  await withServer(async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/ui`);
    assert.equal(denied.status, 401);

    const allowed = await fetch(`${baseUrl}/ui?token=${"a".repeat(32)}`);
    assert.equal(allowed.status, 200);
    const html = await allowed.text();
    assert.match(html, /Windows 本机/);
    assert.match(html, /保存到剪贴板/);
    assert.doesNotMatch(html, /id="send-tab"/);
  });
});

test("serves unified app icons to devices on the private network", async () => {
  await withServer(async (baseUrl) => {
    const favicon = await fetch(`${baseUrl}/favicon.ico`);
    assert.equal(favicon.status, 200);
    assert.equal(favicon.headers.get("content-type"), "image/x-icon");
    assert.ok((await favicon.arrayBuffer()).byteLength > 1000);

    const appleIcon = await fetch(`${baseUrl}/apple-touch-icon.png`);
    assert.equal(appleIcon.status, 200);
    assert.equal(appleIcon.headers.get("content-type"), "image/png");

    const brandIcon = await fetch(`${baseUrl}/brand-icon-192.png`);
    assert.equal(brandIcon.status, 200);
    assert.equal(brandIcon.headers.get("content-type"), "image/png");
    assert.ok((await brandIcon.arrayBuffer()).byteLength > 10000);
  });
});

test("serves a paired installable web app manifest", async () => {
  await withServer(async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/manifest.webmanifest?token=wrong`);
    assert.equal(denied.status, 401);

    const allowed = await fetch(`${baseUrl}/manifest.webmanifest?token=${"a".repeat(32)}`);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("content-type"), "application/manifest+json; charset=utf-8");
    const manifest = await allowed.json();
    assert.equal(manifest.start_url, `/ui?token=${"a".repeat(32)}`);
    assert.equal(manifest.display, "standalone");
    assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ["192x192", "512x512"]);
  });
});

test("reports the runtime instance on the health endpoint", async () => {
  const server = createClipBridgeServer({
    config: { token: "a".repeat(32), deviceName: "Test PC", maxTextBytes: 1024 },
    clipboard: { readText: async () => "", writeText: async () => {} },
    instanceId: "tray-launch-123"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      device: "Test PC",
      version: "0.1.5",
      instanceId: "tray-launch-123"
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
