export function renderDashboard({
  deviceName,
  isLocal = false,
  clientDevice = { label: "此设备", type: "other" },
  legacyToken = "",
  pairingCode = ""
}) {
  const normalizedClient = typeof clientDevice === "string"
    ? { label: clientDevice, type: deviceTypeFromLabel(clientDevice) }
    : clientDevice;
  const safeDeviceName = escapeHtml(deviceName);
  const panel = isLocal ? renderLocalPanel() : renderRemotePanel(safeDeviceName, normalizedClient);
  const modeScript = isLocal
    ? localModeScript()
    : remoteModeScript({ deviceName, clientDevice: normalizedClient, legacyToken, pairingCode });

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
  <link rel="manifest" href="/manifest.webmanifest">
  <title>ClipBridge · ${safeDeviceName}</title>
  <style>
    :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f3f5f8; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(720px, 100%); }
    header { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 18px; }
    .brand { display: inline-flex; align-items: center; gap: 9px; }
    .brand-icon { width: 40px; height: 40px; object-fit: contain; image-rendering: auto; filter: drop-shadow(0 4px 8px #5f35f233); }
    h1 { font-size: 20px; margin: 0; }
    h2 { margin: 3px 0 0; font-size: 19px; line-height: 1.3; }
    h3 { margin: 0; font-size: 15px; }
    .status { display: inline-flex; align-items: center; gap: 7px; color: #657086; font-size: 14px; text-align: right; }
    .dot { flex: 0 0 auto; width: 9px; height: 9px; border-radius: 50%; background: #20b26b; box-shadow: 0 0 0 4px #20b26b22; }
    .stack { display: grid; gap: 16px; }
    .card { background: #fff; border: 1px solid #e5e8ef; border-radius: 22px; padding: 20px; box-shadow: 0 14px 45px #26334d12; }
    .section-heading { margin-bottom: 18px; }
    .row-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
    .eyebrow { color: #7b8497; font-size: 13px; }
    .helper { margin: 7px 0 0; color: #7b8497; font-size: 13px; line-height: 1.45; }
    textarea, input, select { width: 100%; border: 1px solid #e5e8ef; border-radius: 14px; outline: 0; padding: 12px 14px; color: inherit; background: #fafbfc; font: 15px/1.5 inherit; transition: border-color .16s, box-shadow .16s; }
    textarea { min-height: 158px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 16px; }
    textarea:focus, input:focus, select:focus { border-color: #8c70f7; box-shadow: 0 0 0 4px #6b45f21a; }
    textarea[readonly] { color: #39445a; }
    label { display: grid; gap: 7px; color: #59647a; font-size: 13px; font-weight: 650; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-grid .full { grid-column: 1 / -1; }
    .code-input { text-align: center; font: 750 24px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .22em; }
    .actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    button { appearance: none; border: 0; border-radius: 13px; padding: 12px 16px; font: inherit; font-weight: 650; cursor: pointer; transition: transform .12s, opacity .12s, background .12s; }
    button:active:not(:disabled) { transform: scale(.98); }
    button:focus-visible { outline: 3px solid #7655f455; outline-offset: 2px; }
    button:disabled { cursor: not-allowed; opacity: .48; }
    .primary { background: #5f35f2; color: #fff; box-shadow: 0 8px 18px #5f35f229; }
    .secondary { background: #eef0f5; color: #273147; }
    .quiet { padding: 8px 11px; color: #69748a; background: transparent; font-size: 13px; }
    .danger { color: #b83737; background: #fff0f0; }
    .button-icon { display: inline-block; min-width: 1.1em; margin-right: 5px; font-weight: 800; }
    .pairing { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px; margin-bottom: 18px; padding: 13px 14px; border: 1px solid #e8e4fb; border-radius: 17px; background: linear-gradient(135deg, #faf8ff, #f4f9ff); }
    .pair-device { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .pair-device:last-child { justify-content: flex-end; text-align: right; }
    .device-badge { flex: 0 0 auto; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; color: #fff; background: linear-gradient(145deg, #9b4df5, #366cff); font-size: 16px; box-shadow: 0 6px 14px #5f35f229; }
    .device-copy { min-width: 0; }
    .device-copy small { display: block; margin-bottom: 2px; color: #8a93a6; font-size: 11px; }
    .device-copy strong { display: block; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .pair-route { display: flex; align-items: center; gap: 5px; color: #20a767; font-size: 11px; white-space: nowrap; }
    .pair-route::before, .pair-route::after { content: ""; width: 12px; height: 1px; background: #8bd5af; }
    .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-bottom: 22px; padding: 4px; border-radius: 15px; background: #eef0f5; }
    .tab { padding: 10px 14px; color: #657086; background: transparent; box-shadow: none; }
    .tab[aria-selected="true"] { color: #4224b8; background: #fff; box-shadow: 0 3px 10px #26334d14; }
    .message { min-height: 22px; margin: 13px 2px 0; color: #657086; font-size: 13px; }
    .pair-box { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 18px; align-items: center; padding: 16px; border: 1px solid #e8e4fb; border-radius: 18px; background: #faf8ff; }
    .qr { display: grid; place-items: center; width: 180px; height: 180px; padding: 10px; overflow: hidden; border-radius: 16px; background: #fff; }
    .qr svg { display: block; width: 100%; height: 100%; }
    .pair-code { margin: 7px 0; color: #4e2ad5; font: 800 32px/1.15 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .18em; }
    .pair-url { overflow: hidden; color: #7b8497; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .device-list { display: grid; gap: 8px; }
    .device-item { display: flex; align-items: center; gap: 11px; padding: 11px; border: 1px solid #eceef3; border-radius: 14px; }
    .device-item .copy { flex: 1; min-width: 0; }
    .device-item strong, .device-item small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .device-item small { margin-top: 2px; color: #8a93a6; }
    .history-list { display: grid; gap: 9px; }
    .history-item { padding: 13px; border: 1px solid #eceef3; border-radius: 15px; background: #fafbfc; }
    .history-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .history-route { overflow: hidden; color: #5e687d; font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .history-meta { flex: 0 0 auto; color: #929aac; font-size: 11px; }
    .history-text { display: -webkit-box; overflow: hidden; margin: 9px 0 0; color: #273147; font: 14px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
    .history-actions { display: flex; justify-content: flex-end; gap: 5px; margin-top: 8px; }
    .empty { padding: 18px 8px; color: #8a93a6; text-align: center; font-size: 13px; }
    .notice { margin-bottom: 16px; padding: 11px 13px; color: #664f18; background: #fff7d8; border: 1px solid #f0df9c; border-radius: 13px; font-size: 12px; line-height: 1.5; }
    .warning { margin-top: 16px; color: #7a6840; background: #fff8df; border: 1px solid #f1df9e; border-radius: 14px; padding: 12px 14px; font-size: 13px; line-height: 1.45; }
    @media (max-width: 560px) {
      body { align-items: start; padding: max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom)); }
      header { align-items: flex-start; }
      .status { max-width: 52%; font-size: 12px; }
      .card { padding: 17px; border-radius: 20px; }
      .actions button { flex: 1 1 auto; }
      .pairing { gap: 7px; padding: 11px; }
      .device-badge { width: 32px; height: 32px; border-radius: 10px; font-size: 14px; }
      .pair-route { font-size: 0; }
      .pair-route::before, .pair-route::after { width: 8px; }
      .pair-route span { width: 7px; height: 7px; border-radius: 50%; background: #20b26b; }
      .form-grid { grid-template-columns: 1fr; }
      .form-grid .full { grid-column: auto; }
      .pair-box { grid-template-columns: 1fr; text-align: center; }
      .qr { margin: auto; }
      .history-top { align-items: flex-start; flex-direction: column; gap: 3px; }
      .history-actions button { flex: 0 1 auto; }
    }
    @media (prefers-color-scheme: dark) {
      :root { color: #eef1f7; background: #11141a; }
      .card { background: #1b2029; border-color: #303744; box-shadow: none; }
      textarea, input, select { color: inherit; background: #151920; border-color: #303744; }
      textarea[readonly] { color: #d8ddea; }
      .secondary, .tabs { background: #303744; color: #eef1f7; }
      .tab { color: #aeb7c8; }
      .tab[aria-selected="true"] { color: #fff; background: #5f35f2; box-shadow: none; }
      .pairing, .pair-box { border-color: #3b4050; background: linear-gradient(135deg, #23202f, #1d2731); }
      .device-item { border-color: #303744; }
      .history-item { border-color: #303744; background: #151920; }
      .history-text { color: #e6eaf2; }
      .danger { color: #ffb2b2; background: #442626; }
      .notice, .warning { color: #e7d99f; background: #302a18; border-color: #554a27; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand"><img class="brand-icon" src="/brand-icon-96.png" srcset="/brand-icon-96.png 96w, /brand-icon-192.png 192w" sizes="40px" width="40" height="40" alt=""><h1>ClipBridge</h1></div>
      <span class="status"><i class="dot"></i><span id="connection-status">${isLocal ? "Windows 本机" : "等待配对"}</span></span>
    </header>
    ${panel}
    <div class="warning">仅在可信私人网络中使用。当前局域网传输尚未加密，请勿传输密码、验证码或私钥。</div>
  </main>
  <script>
    const message = document.querySelector('#message');
    const show = (text, error = false) => {
      if (!message) return;
      message.textContent = text;
      message.style.color = error ? '#d14343' : '';
    };

    async function apiJson(path, options = {}) {
      const response = await fetch(path, options);
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error || '请求失败'), { status: response.status, data });
      return data;
    }

    async function copyText(text, field) {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(text); return true; } catch {}
      }
      if (field) { field.focus(); field.select(); }
      else {
        field = document.createElement('textarea');
        field.value = text;
        field.style.position = 'fixed'; field.style.opacity = '0';
        document.body.append(field); field.select();
      }
      try { return document.execCommand('copy'); }
      catch { return false; }
      finally { if (field && !field.id) field.remove(); }
    }

    function renderHistoryList(container, entries, { actionLabel, onUse, onDelete }) {
      container.replaceChildren();
      if (!entries.length) {
        const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '还没有传输记录'; container.append(empty); return;
      }
      for (const entry of entries) {
        const item = document.createElement('article'); item.className = 'history-item';
        const top = document.createElement('div'); top.className = 'history-top';
        const route = document.createElement('div'); route.className = 'history-route'; route.textContent = entry.source.name + ' → ' + entry.target.name;
        const meta = document.createElement('time'); meta.className = 'history-meta'; meta.dateTime = entry.createdAt; meta.textContent = new Date(entry.createdAt).toLocaleString();
        const content = document.createElement('p'); content.className = 'history-text'; content.textContent = entry.text || '（空文本）';
        const actions = document.createElement('div'); actions.className = 'history-actions';
        const use = document.createElement('button'); use.className = 'quiet'; use.textContent = actionLabel;
        const remove = document.createElement('button'); remove.className = 'quiet danger'; remove.textContent = '删除';
        use.addEventListener('click', () => onUse(entry));
        remove.addEventListener('click', () => onDelete(entry));
        top.append(route, meta); actions.append(use, remove); item.append(top, content, actions); container.append(item);
      }
    }

    ${modeScript}
  </script>
</body>
</html>`;
}

function renderLocalPanel() {
  return `<div class="stack">
    <section class="card" aria-labelledby="local-title">
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
    </section>
    <section class="card" aria-labelledby="history-title">
      <div class="row-heading">
        <div><div class="eyebrow">最近传输</div><h2 id="history-title">剪贴板历史</h2></div>
        <button class="quiet danger" id="clear-history">清空</button>
      </div>
      <p class="helper">仅记录通过 ClipBridge 主动传输的文本，最多保留 50 条，并且只保存在这台 Windows 电脑上。</p>
      <div class="history-list" id="history-list"><div class="empty">正在读取历史…</div></div>
      <div class="message" id="history-message" role="status" aria-live="polite"></div>
    </section>
    <section class="card" aria-labelledby="devices-title">
      <div class="row-heading">
        <div><div class="eyebrow">安全连接</div><h2 id="devices-title">已配对设备</h2></div>
        <button class="primary" id="new-pairing">＋ 配对新设备</button>
      </div>
      <div class="pair-box" id="pair-box" hidden>
        <div class="qr" id="pair-qr" aria-label="配对二维码"></div>
        <div>
          <div class="eyebrow">用手机扫码，或输入这组一次性配对码</div>
          <div class="pair-code" id="pair-code">------</div>
          <select id="pair-url-select" aria-label="配对网络地址" hidden></select>
          <div class="pair-url" id="pair-url"></div>
          <p class="helper" id="pair-expiry">配对码将在 5 分钟后失效，使用一次后立即作废。</p>
          <div class="actions"><button class="secondary" id="copy-pair-link">复制配对链接</button></div>
        </div>
      </div>
      <div class="device-list" id="device-list"><div class="empty">正在读取设备…</div></div>
    </section>
  </div>`;
}

function renderRemotePanel(deviceName, clientDevice) {
  const safeClientName = escapeHtml(clientDevice.label);
  return `<div class="stack">
    <section class="card" id="pair-panel" aria-labelledby="pair-title">
      <div class="section-heading">
        <div class="eyebrow">首次连接</div>
        <h2 id="pair-title">与 ${deviceName} 配对</h2>
        <p class="helper">在 Windows 的 ClipBridge 中点击“配对新设备”，然后扫描二维码或输入 6 位配对码。</p>
      </div>
      <form id="pair-form" class="form-grid">
        <label class="full">配对码<input class="code-input" id="pair-code-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required placeholder="000000"></label>
        <label>设备名称<input id="pair-name" name="name" maxlength="48" required value="${safeClientName}"></label>
        <label>设备类型<select id="pair-type" name="type">${deviceTypeOptions(clientDevice.type)}</select></label>
        <div class="actions full"><button class="primary" id="pair-submit" type="submit">安全配对</button></div>
      </form>
      <div class="message" id="message" role="status" aria-live="polite"></div>
    </section>
    <section class="card" id="remote-panel" aria-label="设备间剪贴板" hidden>
      <div class="notice" id="legacy-notice" hidden>当前仍在使用 v0.1 的共享链接。建议在 Windows 端生成一次性配对码，升级为可单独撤销的设备身份。</div>
      <div class="pairing" aria-label="当前已配对连接">
        <div class="pair-device">
          <span class="device-badge" id="client-device-icon" aria-hidden="true">📱</span>
          <span class="device-copy"><small>当前设备</small><strong id="client-device-name">${safeClientName}</strong></span>
        </div>
        <div class="pair-route" aria-hidden="true"><span>已配对</span></div>
        <div class="pair-device">
          <span class="device-copy"><small>Windows 电脑</small><strong id="computer-name">${deviceName}</strong></span>
          <span class="device-badge" aria-hidden="true">💻</span>
        </div>
      </div>
      <div class="tabs" role="tablist" aria-label="传输方向">
        <button class="tab" id="send-tab" role="tab" aria-selected="true" aria-controls="send-panel" data-tab="send">发送</button>
        <button class="tab" id="receive-tab" role="tab" aria-selected="false" aria-controls="receive-panel" data-tab="receive">接收</button>
        <button class="tab" id="history-tab" role="tab" aria-selected="false" aria-controls="history-panel" data-tab="history">历史</button>
      </div>
      <section id="send-panel" role="tabpanel" aria-labelledby="send-tab">
        <div class="section-heading"><div class="eyebrow">此设备 → 电脑</div><h2>发送到电脑</h2><p class="helper">粘贴或输入内容，它会进入 Windows 剪贴板。</p></div>
        <textarea id="send-text" aria-label="要发送到电脑的内容" placeholder="在这里粘贴或输入…"></textarea>
        <div class="actions"><button class="primary" id="send-to-computer"><span class="button-icon" aria-hidden="true">↑</span>发送到电脑</button></div>
      </section>
      <section id="receive-panel" role="tabpanel" aria-labelledby="receive-tab" hidden>
        <div class="section-heading"><div class="eyebrow">电脑 → 此设备</div><h2>从电脑接收</h2><p class="helper">获取电脑的最新剪贴板内容，再复制到当前设备。</p></div>
        <textarea id="received-text" aria-label="从电脑接收的内容" placeholder="点击“获取最新内容”后显示在这里" readonly></textarea>
        <div class="actions">
          <button class="secondary" id="receive-from-computer"><span class="button-icon" aria-hidden="true">↓</span>获取最新内容</button>
          <button class="primary" id="copy-to-device" disabled><span class="button-icon" aria-hidden="true">⧉</span>复制到此设备</button>
        </div>
      </section>
      <section id="history-panel" role="tabpanel" aria-labelledby="history-tab" hidden>
        <div class="row-heading">
          <div><div class="eyebrow">这台设备的最近传输</div><h2>剪贴板历史</h2></div>
          <button class="quiet danger" id="clear-history">清空</button>
        </div>
        <p class="helper">最多保留 50 条，仅显示与当前设备有关的记录；内容保存在 Windows 电脑上。</p>
        <div class="history-list" id="history-list"><div class="empty">正在读取历史…</div></div>
      </section>
      <div class="message" id="remote-message" role="status" aria-live="polite"></div>
      <div class="actions"><button class="quiet danger" id="forget-device">取消此设备的配对</button></div>
    </section>
  </div>`;
}

function localModeScript() {
  return `const localField = document.querySelector('#local-clip');
    const refreshButton = document.querySelector('#refresh-local');
    const saveButton = document.querySelector('#save-local');
    const pairButton = document.querySelector('#new-pairing');
    const pairBox = document.querySelector('#pair-box');
    const pairCode = document.querySelector('#pair-code');
    const pairQr = document.querySelector('#pair-qr');
    const pairUrl = document.querySelector('#pair-url');
    const pairUrlSelect = document.querySelector('#pair-url-select');
    const pairExpiry = document.querySelector('#pair-expiry');
    const deviceList = document.querySelector('#device-list');
    const historyList = document.querySelector('#history-list');
    const historyMessage = document.querySelector('#history-message');
    const historyShow = (text, error = false) => { historyMessage.textContent = text; historyMessage.style.color = error ? '#d14343' : ''; };
    let currentPairUrl = '';
    let pairingPoll = null;

    async function refreshLocalClipboard() {
      refreshButton.disabled = true; show('正在读取 Windows 剪贴板…');
      try { localField.value = (await apiJson('/api/v1/clip')).text; show('已读取当前 Windows 剪贴板'); }
      catch (error) { show(error.message, true); }
      finally { refreshButton.disabled = false; }
    }

    async function refreshDevices() {
      try {
        const data = await apiJson('/api/v1/devices');
        deviceList.replaceChildren();
        if (!data.devices.length) {
          const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '还没有配对设备'; deviceList.append(empty); return;
        }
        for (const device of data.devices) {
          const item = document.createElement('div'); item.className = 'device-item';
          const badge = document.createElement('span'); badge.className = 'device-badge'; badge.textContent = deviceIcon(device.type);
          const copy = document.createElement('span'); copy.className = 'copy';
          const name = document.createElement('strong'); name.textContent = device.name;
          const meta = document.createElement('small'); meta.textContent = '最近连接：' + new Date(device.lastSeenAt).toLocaleString();
          const revoke = document.createElement('button'); revoke.className = 'quiet danger'; revoke.textContent = '撤销';
          revoke.addEventListener('click', async () => {
            if (!confirm('撤销“' + device.name + '”的访问权限？')) return;
            try { await apiJson('/api/v1/devices/' + encodeURIComponent(device.id), { method: 'DELETE' }); await refreshDevices(); }
            catch (error) { show(error.message, true); }
          });
          copy.append(name, meta); item.append(badge, copy, revoke); deviceList.append(item);
        }
      } catch (error) { deviceList.textContent = error.message; }
    }

    async function refreshHistory() {
      try {
        const data = await apiJson('/api/v1/history');
        renderHistoryList(historyList, data.entries, {
          actionLabel: '放回剪贴板',
          onUse: async (entry) => {
            try {
              await apiJson('/api/v1/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: entry.text }) });
              localField.value = entry.text; historyShow('已放回 Windows 剪贴板');
            } catch (error) { historyShow(error.message, true); }
          },
          onDelete: async (entry) => {
            try { await apiJson('/api/v1/history/' + encodeURIComponent(entry.id), { method: 'DELETE' }); historyShow('已删除这条记录'); await refreshHistory(); }
            catch (error) { historyShow(error.message, true); }
          }
        });
      } catch (error) { historyList.textContent = error.message; }
    }

    function deviceIcon(type) {
      return ({ iphone: '📱', ipad: '▣', android: '🤖', mac: '⌘', windows: '💻' })[type] || '◆';
    }

    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true; show('正在保存…');
      try { await apiJson('/api/v1/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: localField.value }) }); show('已保存到 Windows 剪贴板'); }
      catch (error) { show(error.message, true); }
      finally { saveButton.disabled = false; }
    });
    refreshButton.addEventListener('click', refreshLocalClipboard);
    document.querySelector('#clear-history').addEventListener('click', async () => {
      if (!confirm('清空这台 Windows 电脑上的全部剪贴板历史？')) return;
      try { const data = await apiJson('/api/v1/history', { method: 'DELETE' }); historyShow('已清空 ' + data.removed + ' 条记录'); await refreshHistory(); }
      catch (error) { historyShow(error.message, true); }
    });
    pairButton.addEventListener('click', async () => {
      pairButton.disabled = true;
      try {
        const data = await apiJson('/api/v1/pairing/sessions', { method: 'POST' });
        pairBox.hidden = false; pairCode.textContent = data.code;
        const options = data.options || data.urls.map((url, index) => ({ url, qrSvg: index === 0 ? data.qrSvg : null }));
        pairUrlSelect.replaceChildren();
        for (const [index, option] of options.entries()) {
          const item = document.createElement('option'); item.value = String(index); item.textContent = new URL(option.url).hostname; pairUrlSelect.append(item);
        }
        pairUrlSelect.hidden = options.length < 2;
        const selectPairUrl = (index) => {
          const option = options[index]; currentPairUrl = option?.url || '';
          pairUrl.textContent = currentPairUrl || '未找到可用的局域网地址，请检查网络连接。';
          pairQr.innerHTML = option?.qrSvg || '<span class="helper">运行 npm install 后可显示二维码；当前仍可输入配对码。</span>';
        };
        pairUrlSelect.onchange = () => selectPairUrl(Number(pairUrlSelect.value));
        selectPairUrl(0);
        const expires = new Date(data.expiresAt); pairExpiry.textContent = '有效至 ' + expires.toLocaleTimeString() + '，使用一次后立即作废。';
        clearInterval(pairingPoll); pairingPoll = setInterval(refreshDevices, 3000);
      } catch (error) { show(error.message, true); }
      finally { pairButton.disabled = false; }
    });
    document.querySelector('#copy-pair-link').addEventListener('click', async () => {
      if (!currentPairUrl) return;
      show(await copyText(currentPairUrl) ? '配对链接已复制' : '请手动复制配对链接', false);
    });
    refreshLocalClipboard(); refreshHistory(); refreshDevices();`;
}

function remoteModeScript({ deviceName, clientDevice, legacyToken, pairingCode }) {
  return `const TOKEN_KEY = 'clipbridge.deviceToken.v2';
    const initialLegacyToken = ${safeScriptJson(legacyToken)};
    const initialPairingCode = ${safeScriptJson(pairingCode)};
    const guessedDevice = ${safeScriptJson(clientDevice)};
    const computerDisplayName = ${safeScriptJson(deviceName)};
    const pairPanel = document.querySelector('#pair-panel');
    const remotePanel = document.querySelector('#remote-panel');
    const pairForm = document.querySelector('#pair-form');
    const remoteMessage = document.querySelector('#remote-message');
    const historyList = document.querySelector('#history-list');
    let deviceToken = localStorage.getItem(TOKEN_KEY) || '';

    if (initialLegacyToken) {
      deviceToken = initialLegacyToken; localStorage.setItem(TOKEN_KEY, deviceToken);
    }
    if (initialPairingCode) document.querySelector('#pair-code-input').value = initialPairingCode.replace(/\\D/g, '').slice(0, 6);
    if (initialLegacyToken || initialPairingCode) history.replaceState(null, '', '/ui');

    function authHeaders(extra = {}) { return deviceToken ? { ...extra, Authorization: 'Bearer ' + deviceToken } : extra; }
    function remoteShow(text, error = false) { remoteMessage.textContent = text; remoteMessage.style.color = error ? '#d14343' : ''; }
    function deviceIcon(type) { return ({ iphone: '📱', ipad: '▣', android: '🤖', mac: '⌘', windows: '💻' })[type] || '◆'; }

    async function authenticated(path, options = {}) {
      return apiJson(path, { ...options, headers: authHeaders(options.headers || {}) });
    }

    function showPairing() {
      pairPanel.hidden = false; remotePanel.hidden = true; document.querySelector('#connection-status').textContent = '等待配对';
    }

    function showConnected(session) {
      pairPanel.hidden = true; remotePanel.hidden = false;
      document.querySelector('#connection-status').textContent = session.legacy ? '旧版连接' : '已安全配对';
      document.querySelector('#client-device-name').textContent = session.device.name;
      document.querySelector('#client-device-icon').textContent = deviceIcon(session.device.type);
      document.querySelector('#computer-name').textContent = session.computer.name;
      document.querySelector('#legacy-notice').hidden = !session.legacy;
      refreshHistory();
    }

    async function refreshHistory() {
      if (!deviceToken) return;
      try {
        const data = await authenticated('/api/v1/history');
        renderHistoryList(historyList, data.entries, {
          actionLabel: '复制文字',
          onUse: async (entry) => {
            remoteShow(await copyText(entry.text) ? '已复制到此设备的剪贴板' : '请长按文字并选择“复制”');
          },
          onDelete: async (entry) => {
            try { await authenticated('/api/v1/history/' + encodeURIComponent(entry.id), { method: 'DELETE' }); remoteShow('已删除这条记录'); await refreshHistory(); }
            catch (error) { remoteShow(error.message, true); }
          }
        });
      } catch (error) { historyList.textContent = error.message; }
    }

    async function bootstrap() {
      if (!deviceToken) { showPairing(); return; }
      try { showConnected(await authenticated('/api/v1/session')); }
      catch { localStorage.removeItem(TOKEN_KEY); deviceToken = ''; showPairing(); }
    }

    pairForm.addEventListener('submit', async (event) => {
      event.preventDefault(); const button = document.querySelector('#pair-submit'); button.disabled = true; show('正在安全配对…');
      try {
        const data = await apiJson('/api/v1/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          code: document.querySelector('#pair-code-input').value,
          name: document.querySelector('#pair-name').value,
          type: document.querySelector('#pair-type').value
        }) });
        deviceToken = data.token; localStorage.setItem(TOKEN_KEY, deviceToken); show(''); await bootstrap();
      } catch (error) { show(error.message, true); }
      finally { button.disabled = false; }
    });

    const tabs = [...document.querySelectorAll('[data-tab]')];
    function activateTab(name) {
      for (const tab of tabs) { const active = tab.dataset.tab === name; tab.setAttribute('aria-selected', String(active)); document.querySelector('#' + tab.getAttribute('aria-controls')).hidden = !active; }
      remoteShow('');
      if (name === 'history') refreshHistory();
    }
    for (const tab of tabs) tab.addEventListener('click', () => activateTab(tab.dataset.tab));

    document.querySelector('#send-to-computer').addEventListener('click', async () => {
      const button = document.querySelector('#send-to-computer'); button.disabled = true; remoteShow('正在发送到电脑…');
      try { await authenticated('/api/v1/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: document.querySelector('#send-text').value }) }); remoteShow('已发送到电脑剪贴板'); await refreshHistory(); }
      catch (error) { remoteShow(error.message, true); }
      finally { button.disabled = false; }
    });
    document.querySelector('#receive-from-computer').addEventListener('click', async () => {
      const button = document.querySelector('#receive-from-computer'); const copy = document.querySelector('#copy-to-device'); button.disabled = true; copy.disabled = true; remoteShow('正在获取电脑剪贴板…');
      try { document.querySelector('#received-text').value = (await authenticated('/api/v1/clip')).text; copy.disabled = false; remoteShow('已获取电脑的最新内容'); await refreshHistory(); }
      catch (error) { remoteShow(error.message, true); }
      finally { button.disabled = false; }
    });
    document.querySelector('#copy-to-device').addEventListener('click', async () => {
      const field = document.querySelector('#received-text'); remoteShow(await copyText(field.value, field) ? '已复制到此设备的剪贴板' : '已选中文字，请长按并选择“复制”', false);
    });
    document.querySelector('#clear-history').addEventListener('click', async () => {
      if (!confirm('清空与这台设备有关的剪贴板历史？')) return;
      try { const data = await authenticated('/api/v1/history', { method: 'DELETE' }); remoteShow('已清空 ' + data.removed + ' 条记录'); await refreshHistory(); }
      catch (error) { remoteShow(error.message, true); }
    });
    document.querySelector('#forget-device').addEventListener('click', async () => {
      if (!confirm('取消这台设备与 ' + computerDisplayName + ' 的配对？')) return;
      try { await authenticated('/api/v1/session', { method: 'DELETE' }); } catch {}
      localStorage.removeItem(TOKEN_KEY); deviceToken = ''; showPairing();
    });
    bootstrap();`;
}

function deviceTypeOptions(selected) {
  return [
    ["iphone", "iPhone"], ["ipad", "iPad"], ["android", "Android"],
    ["mac", "Mac"], ["windows", "Windows"], ["other", "其他设备"]
  ].map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join("");
}

function deviceTypeFromLabel(label) {
  const text = String(label).toLowerCase();
  if (text.includes("iphone")) return "iphone";
  if (text.includes("ipad")) return "ipad";
  if (text.includes("android")) return "android";
  if (text.includes("mac")) return "mac";
  if (text.includes("windows")) return "windows";
  return "other";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeScriptJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

export function clientDeviceFromUserAgent(userAgent = "") {
  if (/iPhone/i.test(userAgent)) return { label: "iPhone", type: "iphone" };
  if (/iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))) return { label: "iPad", type: "ipad" };
  if (/Android/i.test(userAgent)) return { label: /Mobile/i.test(userAgent) ? "Android 手机" : "Android 设备", type: "android" };
  if (/Macintosh|Mac OS X/i.test(userAgent)) return { label: "Mac", type: "mac" };
  if (/Windows/i.test(userAgent)) return { label: "Windows 设备", type: "windows" };
  return { label: "此设备", type: "other" };
}

export function clientDeviceLabelFromUserAgent(userAgent = "") {
  return clientDeviceFromUserAgent(userAgent).label;
}
