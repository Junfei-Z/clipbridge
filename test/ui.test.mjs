import assert from "node:assert/strict";
import test from "node:test";
import { clientDeviceLabelFromUserAgent, renderDashboard } from "../src/ui.mjs";

test("escapes a configured device name in HTML", () => {
  const html = renderDashboard({ deviceName: "PC <unsafe>", token: "safe-token" });
  assert.match(html, /PC &lt;unsafe&gt;/);
  assert.doesNotMatch(html, /PC <unsafe>/);
});

test("links the shared app icons and a token-preserving manifest", () => {
  const html = renderDashboard({ deviceName: "Test PC", token: "paired token&value" });
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest\?token=paired%20token%26value"/);
  assert.match(html, /class="brand-icon" src="\/brand-icon-96\.png"/);
  assert.match(html, /srcset="\/brand-icon-96\.png 96w, \/brand-icon-192\.png 192w"/);
});

test("renders a Windows clipboard manager for a local request", () => {
  const html = renderDashboard({ deviceName: "Test PC", token: "safe-token", isLocal: true });
  assert.match(html, /Windows 本机/);
  assert.match(html, /本机剪贴板/);
  assert.match(html, /重新读取/);
  assert.match(html, /保存到剪贴板/);
  assert.doesNotMatch(html, /id="send-tab"/);
});

test("renders send and receive modes for a remote device", () => {
  const html = renderDashboard({ deviceName: "Test PC", token: "safe-token", isLocal: false, clientDevice: "iPhone" });
  assert.match(html, /当前连接：iPhone 与 Test PC/);
  assert.match(html, /<strong>iPhone<\/strong>/);
  assert.match(html, /<strong>Test PC<\/strong>/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /此设备 → 电脑/);
  assert.match(html, /电脑 → 此设备/);
  assert.match(html, /发送到电脑/);
  assert.match(html, /获取最新内容/);
  assert.match(html, /复制到此设备/);
  assert.doesNotMatch(html, /id="refresh-local"/);
});

test("labels common remote device families without claiming a persistent identity", () => {
  assert.equal(clientDeviceLabelFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "iPhone");
  assert.equal(clientDeviceLabelFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "Mac");
  assert.equal(clientDeviceLabelFromUserAgent("Mozilla/5.0 (Macintosh; Mobile/15E148)"), "iPad");
  assert.equal(clientDeviceLabelFromUserAgent("unknown client"), "此设备");
});
