import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { HistoryStore, loadHistoryStore } from "../src/history.mjs";

const WINDOWS = { id: "windows-host", name: "Test PC", type: "windows" };
const IPHONE = { id: "iphone-1", name: "Junfei 的 iPhone", type: "iphone" };
const MAC = { id: "mac-1", name: "Junfei 的 Mac", type: "mac" };

test("history keeps newest transfers, preserves Unicode, and filters by device", async () => {
  let sequence = 0;
  const history = new HistoryStore({
    limit: 2,
    now: () => Date.parse(`2026-09-01T12:00:0${sequence}Z`),
    idFactory: () => `entry-${++sequence}`
  });

  await history.add({ text: "你好 🥳", source: IPHONE, target: WINDOWS });
  await history.add({ text: "to Mac", source: WINDOWS, target: MAC });
  await history.add({ text: "latest", source: WINDOWS, target: IPHONE });

  assert.deepEqual(history.list().map(({ id }) => id), ["entry-3", "entry-2"]);
  assert.deepEqual(history.list({ deviceId: IPHONE.id }).map(({ text }) => text), ["latest"]);
  assert.deepEqual(history.list({ deviceId: MAC.id }).map(({ text }) => text), ["to Mac"]);
});

test("history deletion and clear operations respect device scope", async () => {
  let sequence = 0;
  const history = new HistoryStore({ idFactory: () => `entry-${++sequence}` });
  await history.add({ text: "phone", source: IPHONE, target: WINDOWS });
  await history.add({ text: "mac", source: MAC, target: WINDOWS });

  assert.equal(await history.remove("entry-2", { deviceId: IPHONE.id }), false);
  assert.equal(await history.remove("entry-1", { deviceId: IPHONE.id }), true);
  assert.equal(await history.clear({ deviceId: IPHONE.id }), 0);
  assert.equal(await history.clear(), 1);
  assert.deepEqual(history.list(), []);
});

test("history persists locally without changing Unicode text", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "clipbridge-history-"));
  try {
    const history = await loadHistoryStore(directory, { idFactory: () => "entry-1" });
    await history.add({ text: "你好，历史记录 🥳", source: IPHONE, target: WINDOWS });

    const stored = JSON.parse(await readFile(path.join(directory, "history.json"), "utf8"));
    assert.equal(stored.version, 1);
    assert.equal(stored.entries[0].text, "你好，历史记录 🥳");

    const reloaded = await loadHistoryStore(directory);
    assert.equal(reloaded.list()[0].text, "你好，历史记录 🥳");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
