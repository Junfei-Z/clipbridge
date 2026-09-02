import assert from "node:assert/strict";
import test from "node:test";
import { clientDeviceFromUserAgent, clientDeviceLabelFromUserAgent, renderDashboard } from "../src/ui.mjs";

test("escapes configured and client device names in HTML and inline script data", () => {
  const html = renderDashboard({
    deviceName: "PC <unsafe>",
    clientDevice: { label: "</script><img src=x>", type: "other" },
    legacyToken: "</script><script>alert(1)</script>"
  });
  assert.match(html, /PC &lt;unsafe&gt;/);
  assert.doesNotMatch(html, /PC <unsafe>/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.equal((html.match(/<script>/g) ?? []).length, 1);
  assert.equal((html.match(/<\/script>/g) ?? []).length, 1);
});

test("links high-resolution shared icons and a token-free manifest", () => {
  const html = renderDashboard({ deviceName: "Test PC" });
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /class="brand-icon" src="\/brand-icon-96\.png"/);
  assert.match(html, /srcset="\/brand-icon-96\.png 96w, \/brand-icon-192\.png 192w"/);
});

test("renders clipboard and device pairing management for Windows localhost", () => {
  const html = renderDashboard({ deviceName: "Test PC", isLocal: true });
  assert.match(html, /Windows 本机/);
  assert.match(html, /本机剪贴板/);
  assert.match(html, /重新读取/);
  assert.match(html, /保存到剪贴板/);
  assert.match(html, /剪贴板历史/);
  assert.match(html, /id="history-list"/);
  assert.match(html, /放回剪贴板/);
  assert.match(html, /配对新设备/);
  assert.match(html, /已配对设备/);
  assert.match(html, /id="pair-qr"/);
  assert.doesNotMatch(html, /id="send-tab"/);
});

test("renders a real pairing flow plus send and receive modes remotely", () => {
  const html = renderDashboard({
    deviceName: "Test PC",
    isLocal: false,
    clientDevice: { label: "Junfei 的 iPhone", type: "iphone" },
    pairingCode: "123456"
  });
  assert.match(html, /与 Test PC 配对/);
  assert.match(html, /id="pair-form"/);
  assert.match(html, /安全配对/);
  assert.match(html, /一次性配对码/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /此设备 → 电脑/);
  assert.match(html, /电脑 → 此设备/);
  assert.match(html, /id="history-tab"/);
  assert.match(html, /这台设备的最近传输/);
  assert.match(html, /复制文字/);
  assert.match(html, /取消此设备的配对/);
  assert.match(html, /const initialPairingCode = "123456"/);
  assert.doesNotMatch(html, /id="refresh-local"/);
});

test("generates syntactically valid inline scripts for local and remote panels", () => {
  for (const html of [
    renderDashboard({ deviceName: "Test PC", isLocal: true }),
    renderDashboard({ deviceName: "Test PC", clientDevice: { label: "iPhone", type: "iphone" } })
  ]) {
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => new Function(script));
  }
});

test("labels and types common remote device families without claiming identity", () => {
  assert.deepEqual(clientDeviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), { label: "iPhone", type: "iphone" });
  assert.deepEqual(clientDeviceFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), { label: "Mac", type: "mac" });
  assert.deepEqual(clientDeviceFromUserAgent("Mozilla/5.0 (Macintosh; Mobile/15E148)"), { label: "iPad", type: "ipad" });
  assert.equal(clientDeviceLabelFromUserAgent("unknown client"), "此设备");
});
