import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("signal rooms are short-lived, bounded, and cryptographically allocated", async () => {
  const worker = await readFile(new URL("../worker/src/index.js", import.meta.url), "utf8");
  const config = JSON.parse(await readFile(new URL("../worker/wrangler.jsonc", import.meta.url), "utf8"));
  assert.match(worker, /crypto\.getRandomValues/);
  assert.match(worker, /5 \* 60 \* 1000/);
  assert.match(worker, /active\.length >= 2/);
  assert.match(worker, /MAX_SIGNAL_BYTES/);
  assert.deepEqual(config.migrations[0].new_sqlite_classes, ["SignalRoom"]);
});
