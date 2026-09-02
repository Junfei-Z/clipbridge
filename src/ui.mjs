export function renderDashboard({ deviceName, token, isLocal = false, clientDevice = "此设备" }) {
  const safeDeviceName = escapeHtml(deviceName);
  const safeClientDevice = escapeHtml(clientDevice);
  const safeToken = JSON.stringify(token);
  const manifestHref = escapeHtml(`/manifest.webmanifest?token=${encodeURIComponent(token)}`);
  const connectionLabel = isLocal ? "Windows 本机" : "连接正常";
  const panel = isLocal ? renderLocalPanel() : renderRemotePanel(safeDeviceName, safeClientDevice);
  const modeScript = isLocal ? localModeScript() : remoteModeScript();

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#6636f4">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="ClipBridge">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="manifest" href="${manifestHref}">
  <title>ClipBridge · ${safeDeviceName}</title>
  <style>
    :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f3f5f8; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(680px, 100%); }
    header { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 18px; }
    .brand { display: inline-flex; align-items: center; gap: 9px; }
    .brand-icon { width: 36px; height: 36px; object-fit: contain; image-rendering: auto; filter: drop-shadow(0 4px 8px #5f35f233); }
    h1 { font-size: 20px; margin: 0; }
    h2 { margin: 3px 0 0; font-size: 19px; line-height: 1.3; }
    .status { display: inline-flex; align-items: center; gap: 7px; color: #657086; font-size: 14px; text-align: right; }
    .dot { flex: 0 0 auto; width: 9px; height: 9px; border-radius: 50%; background: #20b26b; box-shadow: 0 0 0 4px #20b26b22; }
    .card { background: #fff; border: 1px solid #e5e8ef; border-radius: 22px; padding: 20px; box-shadow: 0 14px 45px #26334d12; }
    .section-heading { margin-bottom: 18px; }
    .eyebrow { color: #7b8497; font-size: 13px; }
    .helper { margin: 7px 0 0; color: #7b8497; font-size: 13px; line-height: 1.45; }
    textarea { width: 100%; min-height: 158px; resize: vertical; border: 1px solid #e5e8ef; border-radius: 16px; outline: 0; padding: 14px; color: inherit; background: #fafbfc; font: 16px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; transition: border-color .16s, box-shadow .16s; }
    textarea:focus { border-color: #8c70f7; box-shadow: 0 0 0 4px #6b45f21a; }
    textarea[readonly] { color: #39445a; }
    .actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    button { appearance: none; border: 0; border-radius: 13px; padding: 12px 16px; font: inherit; font-weight: 650; cursor: pointer; transition: transform .12s, opacity .12s, background .12s; }
    button:active:not(:disabled) { transform: scale(.98); }
    button:focus-visible { outline: 3px solid #7655f455; outline-offset: 2px; }
    button:disabled { cursor: not-allowed; opacity: .48; }
    .primary { background: #5f35f2; color: #fff; box-shadow: 0 8px 18px #5f35f229; }
    .secondary { background: #eef0f5; color: #273147; }
    .button-icon { display: inline-block; min-width: 1.1em; margin-right: 5px; font-weight: 800; }
    .pairing { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px; margin-bottom: 18px; padding: 13px 14px; border: 1px solid #e8e4fb; border-radius: 17px; background: linear-gradient(135deg, #faf8ff, #f4f9ff); }
    .pair-device { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .pair-device:last-child { justify-content: flex-end; text-align: right; }
    .device-badge { flex: 0 0 auto; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 11px; color: #fff; background: linear-gradient(145deg, #9b4df5, #366cff); font-size: 11px; font-weight: 800; box-shadow: 0 6px 14px #5f35f229; }
    .device-copy { min-width: 0; }
    .device-copy small { display: block; margin-bottom: 2px; color: #8a93a6; font-size: 11px; }
    .device-copy strong { display: block; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .pair-route { display: flex; align-items: center; gap: 5px; color: #20a767; font-size: 11px; white-space: nowrap; }
    .pair-route::before, .pair-route::after { content: ""; width: 12px; height: 1px; background: #8bd5af; }
    .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 22px; padding: 4px; border-radius: 15px; background: #eef0f5; }
    .tab { padding: 10px 14px; color: #657086; background: transparent; box-shadow: none; }
    .tab[aria-selected="true"] { color: #4224b8; background: #fff; box-shadow: 0 3px 10px #26334d14; }
    .message { min-height: 22px; margin: 13px 2px 0; color: #657086; font-size: 13px; }
    .warning { margin-top: 16px; color: #7a6840; background: #fff8df; border: 1px solid #f1df9e; border-radius: 14px; padding: 12px 14px; font-size: 13px; line-height: 1.45; }
    @media (max-width: 520px) {
      body { align-items: start; padding: max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom)); }
      header { align-items: flex-start; }
      .status { max-width: 52%; font-size: 12px; }
      .card { padding: 17px; border-radius: 20px; }
      .actions button { flex: 1 1 auto; }
      .pairing { gap: 7px; padding: 11px; }
      .device-badge { width: 31px; height: 31px; border-radius: 10px; }
      .pair-route { font-size: 0; }
      .pair-route::before, .pair-route::after { width: 8px; }
      .pair-route span { width: 7px; height: 7px; border-radius: 50%; background: #20b26b; }
    }
    @media (prefers-color-scheme: dark) {
      :root { color: #eef1f7; background: #11141a; }
      .card { background: #1b2029; border-color: #303744; box-shadow: none; }
      textarea { color: inherit; background: #151920; border-color: #303744; }
      textarea[readonly] { color: #d8ddea; }
      .secondary, .tabs { background: #303744; color: #eef1f7; }
      .tab { color: #aeb7c8; }
      .tab[aria-selected="true"] { color: #fff; background: #5f35f2; box-shadow: none; }
      .pairing { border-color: #3b4050; background: linear-gradient(135deg, #23202f, #1d2731); }
      .warning { color: #e7d99f; background: #302a18; border-color: #554a27; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand"><img class="brand-icon" src="/brand-icon-96.png" srcset="/brand-icon-96.png 96w, /brand-icon-192.png 192w" sizes="36px" width="36" height="36" alt=""><h1>ClipBridge</h1></div>
      <span class="status"><i class="dot"></i>${connectionLabel}</span>
    </header>
    ${panel}
    <div class="warning">仅在可信私人网络中使用。请勿传输密码、验证码、私钥或敏感工作内容。</div>
  </main>
  <script>
    const token = ${safeToken};
    const headers = { Authorization: 'Bearer ' + token };
    const message = document.querySelector('#message');
    const show = (text, error = false) => {
      message.textContent = text;
      message.style.color = error ? '#d14343' : '';
    };

    async function readComputerClipboard() {
      const response = await fetch('/api/v1/clip', { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '获取失败');
      return data.text;
    }

    async function writeComputerClipboard(text) {
      const response = await fetch('/api/v1/clip', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'text', text })
      });
      if (!response.ok) throw new Error((await response.json()).error || '保存失败');
    }

    async function copyToThisDevice(text, field) {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {}
      }
      field.focus();
      field.select();
      try { return document.execCommand('copy'); } catch { return false; }
    }

    ${modeScript}
  </script>
</body>
</html>`;
}

function renderLocalPanel() {
  return `<section class="card" aria-labelledby="local-title">
      <div class="section-heading">
        <div class="eyebrow">Windows 剪贴板</div>
        <h2 id="local-title">本机剪贴板</h2>
        <p class="helper">查看当前内容，修改后可以重新保存到 Windows 剪贴板。</p>
      </div>
      <textarea id="local-clip" aria-label="Windows 剪贴板内容" placeholder="正在读取 Windows 剪贴板…"></textarea>
      <div class="actions">
        <button class="secondary" id="refresh-local"><span class="button-icon" aria-hidden="true">↻</span>重新读取</button>
        <button class="primary" id="save-local"><span class="button-icon" aria-hidden="true">✓</span>保存到剪贴板</button>
      </div>
      <div class="message" id="message" role="status" aria-live="polite"></div>
    </section>`;
}

function renderRemotePanel(deviceName, clientDevice) {
  return `<section class="card" aria-label="设备间剪贴板">
      <div class="pairing" aria-label="当前连接：${clientDevice} 与 ${deviceName}">
        <div class="pair-device">
          <span class="device-badge" aria-hidden="true">ME</span>
          <span class="device-copy"><small>当前设备</small><strong>${clientDevice}</strong></span>
        </div>
        <div class="pair-route" aria-hidden="true"><span>已连接</span></div>
        <div class="pair-device">
          <span class="device-copy"><small>Windows 电脑</small><strong>${deviceName}</strong></span>
          <span class="device-badge" aria-hidden="true">PC</span>
        </div>
      </div>
      <div class="tabs" role="tablist" aria-label="传输方向">
        <button class="tab" id="send-tab" role="tab" aria-selected="true" aria-controls="send-panel" data-tab="send">发送</button>
        <button class="tab" id="receive-tab" role="tab" aria-selected="false" aria-controls="receive-panel" data-tab="receive">接收</button>
      </div>
      <section id="send-panel" role="tabpanel" aria-labelledby="send-tab">
        <div class="section-heading">
          <div class="eyebrow">此设备 → 电脑</div>
          <h2>发送到电脑</h2>
          <p class="helper">粘贴或输入内容，它会进入 ${deviceName} 的剪贴板。</p>
        </div>
        <textarea id="send-text" aria-label="要发送到电脑的内容" placeholder="在这里粘贴或输入…"></textarea>
        <div class="actions">
          <button class="primary" id="send-to-computer"><span class="button-icon" aria-hidden="true">↑</span>发送到电脑</button>
        </div>
      </section>
      <section id="receive-panel" role="tabpanel" aria-labelledby="receive-tab" hidden>
        <div class="section-heading">
          <div class="eyebrow">电脑 → 此设备</div>
          <h2>从电脑接收</h2>
          <p class="helper">先获取 ${deviceName} 的最新剪贴板内容，再复制到当前设备。</p>
        </div>
        <textarea id="received-text" aria-label="从电脑接收的内容" placeholder="点击“获取最新内容”后显示在这里" readonly></textarea>
        <div class="actions">
          <button class="secondary" id="receive-from-computer"><span class="button-icon" aria-hidden="true">↓</span>获取最新内容</button>
          <button class="primary" id="copy-to-device" disabled><span class="button-icon" aria-hidden="true">⧉</span>复制到此设备</button>
        </div>
      </section>
      <div class="message" id="message" role="status" aria-live="polite"></div>
    </section>`;
}

function localModeScript() {
  return `const localField = document.querySelector('#local-clip');
    const refreshButton = document.querySelector('#refresh-local');
    const saveButton = document.querySelector('#save-local');

    async function refreshLocalClipboard() {
      refreshButton.disabled = true;
      show('正在读取 Windows 剪贴板…');
      try {
        localField.value = await readComputerClipboard();
        show('已读取当前 Windows 剪贴板');
      } catch (error) { show(error.message, true); }
      finally { refreshButton.disabled = false; }
    }

    refreshButton.addEventListener('click', refreshLocalClipboard);
    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true;
      show('正在保存…');
      try {
        await writeComputerClipboard(localField.value);
        show('已保存到 Windows 剪贴板');
      } catch (error) { show(error.message, true); }
      finally { saveButton.disabled = false; }
    });

    refreshLocalClipboard();`;
}

function remoteModeScript() {
  return `const sendField = document.querySelector('#send-text');
    const receivedField = document.querySelector('#received-text');
    const sendButton = document.querySelector('#send-to-computer');
    const receiveButton = document.querySelector('#receive-from-computer');
    const copyButton = document.querySelector('#copy-to-device');
    const tabs = [...document.querySelectorAll('[data-tab]')];

    function activateTab(name) {
      for (const tab of tabs) {
        const active = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', String(active));
        document.querySelector('#' + tab.getAttribute('aria-controls')).hidden = !active;
      }
      show('');
    }

    for (const tab of tabs) tab.addEventListener('click', () => activateTab(tab.dataset.tab));

    sendButton.addEventListener('click', async () => {
      sendButton.disabled = true;
      show('正在发送到电脑…');
      try {
        await writeComputerClipboard(sendField.value);
        show('已发送到电脑剪贴板');
      } catch (error) { show(error.message, true); }
      finally { sendButton.disabled = false; }
    });

    receiveButton.addEventListener('click', async () => {
      receiveButton.disabled = true;
      copyButton.disabled = true;
      show('正在获取电脑剪贴板…');
      try {
        receivedField.value = await readComputerClipboard();
        copyButton.disabled = false;
        show('已获取电脑的最新内容');
      } catch (error) { show(error.message, true); }
      finally { receiveButton.disabled = false; }
    });

    copyButton.addEventListener('click', async () => {
      const copied = await copyToThisDevice(receivedField.value, receivedField);
      if (copied) show('已复制到此设备的剪贴板');
      else show('已选中文字，请长按所选内容并选择“复制”', true);
    });`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function clientDeviceLabelFromUserAgent(userAgent = "") {
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))) return "iPad";
  if (/Android/i.test(userAgent)) return /Mobile/i.test(userAgent) ? "Android 手机" : "Android 设备";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "Mac";
  if (/Windows/i.test(userAgent)) return "Windows 设备";
  return "此设备";
}
