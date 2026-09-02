import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeClipboardPayload,
  encodeClipboardPayload
} from "../src/clipboard-windows.mjs";

const samples = [
  "你好，你好，我只是来做个测试",
  "Emoji 🧪🚀 and café",
  "第一行\r\n第二行\n第三行",
  "",
  "null byte: \u0000"
];

test("clipboard payload preserves Unicode text exactly", () => {
  for (const sample of samples) {
    const payload = encodeClipboardPayload(sample);
    assert.match(payload, /^[A-Za-z0-9+/]*={0,2}$/);
    assert.equal(decodeClipboardPayload(payload), sample);
  }
});
