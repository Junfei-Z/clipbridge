import assert from "node:assert/strict";
import test from "node:test";
import { renderDashboard } from "../src/ui.mjs";

test("escapes a configured device name in HTML", () => {
  const html = renderDashboard({ deviceName: "PC <unsafe>", token: "safe-token" });
  assert.match(html, /PC &lt;unsafe&gt;/);
  assert.doesNotMatch(html, /PC <unsafe>/);
});

test("links the shared app icons and a token-preserving manifest", () => {
  const html = renderDashboard({ deviceName: "Test PC", token: "paired token&value" });
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest\?token=paired%20token%26value"/);
  assert.match(html, /class="brand-icon" src="\/favicon-32\.png"/);
});
