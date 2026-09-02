import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDeviceRegistry } from "../src/devices.mjs";

test("paired device tokens are persisted only as hashes and can be revoked", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "clipbridge-devices-"));
  try {
    const registry = await loadDeviceRegistry(directory, { now: () => Date.parse("2026-09-01T12:00:00Z") });
    const registered = await registry.register({ name: "  Junfei   iPhone  ", type: "iphone" });
    assert.equal(registered.device.name, "Junfei iPhone");
    assert.equal((await registry.authenticate(registered.token)).id, registered.device.id);
    assert.equal(await registry.authenticate("wrong-token"), null);

    const stored = await readFile(path.join(directory, "devices.json"), "utf8");
    assert.doesNotMatch(stored, new RegExp(registered.token));
    assert.match(stored, /"tokenHash": "[a-f0-9]{64}"/);

    const reloaded = await loadDeviceRegistry(directory);
    assert.equal((await reloaded.authenticate(registered.token)).id, registered.device.id);
    assert.equal(await reloaded.revoke(registered.device.id), true);
    assert.equal(await reloaded.authenticate(registered.token), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
