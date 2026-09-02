import assert from "node:assert/strict";
import test from "node:test";
import { renderDashboard } from "../src/ui.mjs";

test("escapes a configured device name in HTML", () => {
  const html = renderDashboard({ deviceName: "PC <unsafe>", token: "safe-token" });
  assert.match(html, /PC &lt;unsafe&gt;/);
  assert.doesNotMatch(html, /PC <unsafe>/);
});
