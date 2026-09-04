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
  assert.match(html, /管理端 · Windows 中转/);
  assert.match(html, /管理设备/);
  assert.match(html, /Windows 中转节点 · Test PC/);
  assert.match(html, /节点剪贴板/);
  assert.match(html, /重新读取/);
  assert.match(html, /保存到剪贴板/);
  assert.match(html, /id="local-target"/);
  assert.match(html, /发送给所选设备/);
  assert.match(html, /接收设备（可多选）/);
  assert.match(html, /剪贴板历史/);
  assert.match(html, /id="local-file-input"/);
  assert.match(html, /局域网文件中转/);
  assert.match(html, /aria-label="ClipBridge 功能"/);
  assert.match(html, /id="local-text-mode"/);
  assert.match(html, /id="local-file-mode"/);
  assert.match(html, /id="local-agent-mode"/);
  assert.match(html, /Agent Handoff/);
  assert.match(html, /电脑专用/);
  assert.match(html, /手机和平板不能创建或应用代码补丁/);
  assert.match(html, /id="handoff-repository"/);
  assert.match(html, /id="handoff-environment"/);
  assert.match(html, /id="handoff-connection"/);
  assert.match(html, /id="register-agent-computer"/);
  assert.match(html, /id="handoff-targets"/);
  assert.match(html, /id="github-account"/);
  assert.match(html, /id="github-repository-picker"/);
  assert.match(html, /id="clone-repository-url"/);
  assert.match(html, /id="clone-projects-directory"/);
  assert.match(html, /id="clone-github-project"/);
  assert.match(html, /id="choose-project-directory"/);
  assert.match(html, /id="update-github-project"/);
  assert.match(html, /检查并更新/);
  assert.match(html, /这台电脑还没有这个项目？从 GitHub 拉取/);
  assert.match(html, /选择接收电脑（可多选/);
  assert.match(html, /id="agent-send-role"/);
  assert.match(html, /id="agent-receive-role"/);
  assert.match(html, /id="agent-send-panel"/);
  assert.match(html, /id="agent-receive-panel"/);
  assert.match(html, /发送端/);
  assert.match(html, /接收端/);
  assert.match(html, /获取发给我的任务/);
  assert.match(html, /所有有仓库权限的电脑都可以获取这份交接/);
  assert.match(html, /id="handoff-prompt"/);
  assert.match(html, /id="copy-handoff-prompt"/);
  assert.match(html, /id="handoff-response"/);
  assert.match(html, /CLIPBRIDGE_HANDOFF_V1/);
  assert.match(html, /发布交接到此仓库/);
  assert.match(html, /文件收件箱/);
  assert.match(html, /id="local-file-outbox"/);
  assert.match(html, /共享 Blob · 独立投递/);
  assert.match(html, /id="history-list"/);
  assert.match(html, /放回剪贴板/);
  assert.match(html, /配对新设备/);
  assert.match(html, /已配对设备/);
  assert.match(html, /id="pair-qr"/);
  assert.doesNotMatch(html, /id="send-tab"/);
});

test("renders a Mac relay node separately from the management device", () => {
  const html = renderDashboard({
    deviceName: "Junfei MacBook",
    relayNode: {
      id: "relay-macbook",
      name: "Junfei MacBook",
      type: "mac",
      platform: "darwin",
      role: "relay-node"
    },
    isLocal: true
  });

  assert.match(html, /管理端 · Mac 中转/);
  assert.match(html, /管理设备/);
  assert.match(html, /Mac 中转节点 · Junfei MacBook/);
  assert.match(html, /保存到 Mac 剪贴板/);
  assert.match(html, /const relayLabel = "Mac"/);
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
  assert.match(html, /一次选择一个或多个目标/);
  assert.match(html, /id="send-target"/);
  assert.match(html, /电脑 → 此设备/);
  assert.match(html, /设备收件箱/);
  assert.match(html, /id="inbox-list"/);
  assert.match(html, /id="history-tab"/);
  assert.match(html, /id="file-mode"/);
  assert.match(html, /Agent · 电脑端/);
  assert.match(html, /代码项目交接仅能在中转电脑的管理页面使用/);
  assert.match(html, /id="file-input"/);
  assert.match(html, /上传一次，共享给多台设备/);
  assert.match(html, /id="file-outbox"/);
  assert.match(html, /这台设备的最近传输/);
  assert.match(html, /复制文字/);
  assert.match(html, /取消此设备的配对/);
  assert.match(html, /管理设备/);
  assert.match(html, /Windows 中转节点/);
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
