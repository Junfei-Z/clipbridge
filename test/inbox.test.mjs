import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { InboxStore, loadInboxStore } from "../src/inbox.mjs";

const IPHONE = { id: "iphone", name: "iPhone", type: "iphone" };
const MAC = { id: "mac", name: "MacBook", type: "mac" };
const WINDOWS = { id: "windows-host", name: "Windows PC", type: "windows" };

test("inboxes isolate targets and cap queued transfers per device", async () => {
  let sequence = 0;
  const inbox = new InboxStore({ limitPerDevice: 2, idFactory: () => `transfer-${++sequence}` });
  await inbox.deliver({ text: "one", source: WINDOWS, target: IPHONE });
  await inbox.deliver({ text: "for Mac", source: WINDOWS, target: MAC });
  await inbox.deliver({ text: "two", source: MAC, target: IPHONE });
  await inbox.deliver({ text: "three", source: WINDOWS, target: IPHONE });

  assert.deepEqual(inbox.list(IPHONE.id).map(({ text }) => text), ["three", "two"]);
  assert.deepEqual(inbox.list(MAC.id).map(({ text }) => text), ["for Mac"]);
});

test("only the target can consume a queued transfer", async () => {
  const inbox = new InboxStore({ idFactory: () => "transfer-1" });
  await inbox.deliver({ text: "private", source: IPHONE, target: MAC });
  assert.equal(await inbox.consume("transfer-1", IPHONE.id), null);
  assert.equal((await inbox.consume("transfer-1", MAC.id)).text, "private");
  assert.deepEqual(inbox.list(MAC.id), []);
});

test("queued transfers persist locally with Unicode intact", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "clipbridge-inbox-"));
  try {
    const inbox = await loadInboxStore(directory, { idFactory: () => "transfer-1" });
    await inbox.deliver({ text: "发给 Mac 🥳", source: IPHONE, target: MAC });
    const stored = JSON.parse(await readFile(path.join(directory, "inbox.json"), "utf8"));
    assert.equal(stored.transfers[0].text, "发给 Mac 🥳");
    const reloaded = await loadInboxStore(directory);
    assert.equal(reloaded.list(MAC.id)[0].source.id, IPHONE.id);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
