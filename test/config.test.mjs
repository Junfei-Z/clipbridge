import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config.mjs";

test("loadConfig creates and reuses a secure token", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "clipbridge-config-"));
  const first = await loadConfig(root);
  const second = await loadConfig(root);

  assert.equal(first.token, second.token);
  assert.ok(first.token.length >= 24);
  const saved = JSON.parse(await readFile(first.configPath, "utf8"));
  assert.equal(saved.token, first.token);
});
