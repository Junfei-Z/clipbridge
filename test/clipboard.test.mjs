import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { createClipboardAdapter, supportsRelayPlatform } from "../src/clipboard.mjs";
import { createMacClipboard } from "../src/clipboard-macos.mjs";

test("selects a clipboard adapter for Windows and macOS relay nodes", () => {
  const windows = { readText: async () => "windows", writeText: async () => {} };
  const macos = { readText: async () => "mac", writeText: async () => {} };

  assert.equal(createClipboardAdapter("win32", { windows, macos }), windows);
  assert.equal(createClipboardAdapter("darwin", { windows, macos }), macos);
  assert.equal(supportsRelayPlatform("win32"), true);
  assert.equal(supportsRelayPlatform("darwin"), true);
  assert.equal(supportsRelayPlatform("linux"), false);
  assert.throws(() => createClipboardAdapter("linux", { windows, macos }), /do not support linux/);
});

test("uses pbpaste and pbcopy without changing Unicode text", async () => {
  const calls = [];
  const spawnProcess = (command) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const input = [];
    child.stdin = new Writable({ write(chunk, _encoding, done) { input.push(Buffer.from(chunk)); done(); } });
    child.stdin.on("finish", () => {
      calls.push({ command, input: Buffer.concat(input).toString("utf8") });
      if (command.endsWith("pbpaste")) child.stdout.end("你好，来自 Mac 🥳");
      else child.stdout.end();
      queueMicrotask(() => child.emit("close", 0));
    });
    return child;
  };
  const clipboard = createMacClipboard({ spawnProcess });

  assert.equal(await clipboard.readText(), "你好，来自 Mac 🥳");
  await clipboard.writeText("写入 Mac 剪贴板 ✅");
  assert.deepEqual(calls, [
    { command: "/usr/bin/pbpaste", input: "" },
    { command: "/usr/bin/pbcopy", input: "写入 Mac 剪贴板 ✅" }
  ]);
});
