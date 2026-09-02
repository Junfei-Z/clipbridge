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

test("serves the quick panel only to a paired request", async () => {
  await withServer(async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/ui`);
    assert.equal(denied.status, 401);

    const allowed = await fetch(`${baseUrl}/ui?token=${"a".repeat(32)}`);
    assert.equal(allowed.status, 200);
    assert.match(await allowed.text(), /发送到 Windows/);
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
      version: "0.1.1",
      instanceId: "tray-launch-123"
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
