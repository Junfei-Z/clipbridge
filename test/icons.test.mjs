import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const asset = (name) => new URL(`../assets/${name}`, import.meta.url);

async function pngSize(name) {
  const data = await readFile(asset(name));
  assert.equal(data.subarray(1, 4).toString(), "PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

test("keeps every replaced logo asset at its established dimensions", async () => {
  for (const [name, size] of [
    ["clipbridge-icon-master.png", 1024],
    ["brand-icon-96.png", 96],
    ["brand-icon-192.png", 192],
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["favicon-16.png", 16],
    ["favicon-32.png", 32],
  ]) assert.deepEqual(await pngSize(name), [size, size], name);

  const favicon = await readFile(asset("favicon.ico"));
  const tray = await readFile(asset("clipbridge-tray.ico"));
  assert.equal(favicon.readUInt16LE(4), 3);
  assert.equal(tray.readUInt16LE(4), 9);
  assert.ok((await readFile(asset("ClipBridge.icns"))).length > 100_000);
});
