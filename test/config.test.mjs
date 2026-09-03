import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_FILE_TTL_MS, DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_FILE_TOTAL_BYTES, loadConfig } from "../src/config.mjs";

test("loadConfig creates and reuses a secure token", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "clipbridge-config-"));
  const first = await loadConfig(root);
  const second = await loadConfig(root);

  assert.equal(first.token, second.token);
  assert.ok(first.token.length >= 24);
  const saved = JSON.parse(await readFile(first.configPath, "utf8"));
  assert.equal(saved.token, first.token);
  assert.equal(first.nodeId, second.nodeId);
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.nodePlatform, process.platform);
  assert.equal(first.maxFileBytes, DEFAULT_MAX_FILE_BYTES);
  assert.equal(first.maxFileTotalBytes, DEFAULT_MAX_FILE_TOTAL_BYTES);
  assert.equal(first.fileTtlMs, DEFAULT_FILE_TTL_MS);
});

test("loadConfig applies file defaults to an existing pre-0.4 config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "clipbridge-old-config-"));
  const stateDir = path.join(root, ".clipbridge");
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, "config.json"), JSON.stringify({
    port: 39393,
    token: "a".repeat(32),
    maxTextBytes: 65536,
    deviceName: "Old ClipBridge"
  }));
  const config = await loadConfig(root, { platform: "win32", hostname: "Old ClipBridge" });
  assert.equal(config.maxFileBytes, DEFAULT_MAX_FILE_BYTES);
  assert.equal(config.maxFileTotalBytes, DEFAULT_MAX_FILE_TOTAL_BYTES);
  assert.equal(config.fileTtlMs, DEFAULT_FILE_TTL_MS);
  assert.equal(config.schemaVersion, 2);
  assert.equal(config.nodeId, "windows-host");
  assert.equal(config.nodeName, "Old ClipBridge");
  assert.equal(config.nodeType, "windows");
  const migrated = JSON.parse(await readFile(config.configPath, "utf8"));
  assert.equal(migrated.nodeId, "windows-host");
});

test("loadConfig creates a stable native Mac relay identity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "clipbridge-mac-config-"));
  const first = await loadConfig(root, { platform: "darwin", hostname: "Junfei-MacBook" });
  const second = await loadConfig(root, { platform: "darwin", hostname: "ignored-after-create" });

  assert.match(first.nodeId, /^relay-[0-9a-f-]{36}$/);
  assert.equal(second.nodeId, first.nodeId);
  assert.equal(first.nodeName, "Junfei-MacBook");
  assert.equal(first.nodePlatform, "darwin");
  assert.equal(first.nodeType, "mac");
  assert.equal(first.deviceName, first.nodeName);
});

test("loadConfig bounds an automatically discovered relay hostname", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "clipbridge-long-host-"));
  const config = await loadConfig(root, { platform: "darwin", hostname: "mac-runner-".repeat(12) });
  assert.equal(config.nodeName.length, 48);
  assert.equal(config.deviceName, config.nodeName);
});
