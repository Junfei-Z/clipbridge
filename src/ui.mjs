export function renderDashboard({
  deviceName,
  relayNode,
  isLocal = false,
  clientDevice = { label: "此设备", type: "other" },
  legacyToken = "",
  pairingCode = "",
  maxFileBytes = 256 * 1024 * 1024
}) {
  const normalizedClient = typeof clientDevice === "string"
    ? { label: clientDevice, type: deviceTypeFromLabel(clientDevice) }
    : clientDevice;
  const normalizedRelay = relayNode ?? {
    id: "windows-host",
    name: deviceName,
    type: "windows",
    platform: "win32",
    role: "relay-node"
  };
  const safeDeviceName = escapeHtml(deviceName);
  const fileLimitLabel = formatFileLimit(maxFileBytes);
  const panel = isLocal
    ? renderLocalPanel(fileLimitLabel, normalizedRelay)
    : renderRemotePanel(safeDeviceName, normalizedClient, fileLimitLabel, normalizedRelay);
  const modeScript = isLocal
    ? localModeScript({ fileLimitLabel, relayNode: normalizedRelay })
    : remoteModeScript({ deviceName, relayNode: normalizedRelay, clientDevice: normalizedClient, legacyToken, pairingCode, fileLimitLabel });

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
    .destination { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 14px; }
    .destination button { min-height: 49px; }
    .target-block { display: grid; gap: 7px; min-width: 0; }
    .target-label { color: #59647a; font-size: 13px; font-weight: 650; }
    .target-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px; margin-bottom: 14px; }
    .target-option { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 10px 11px; border: 1px solid #e5e8ef; border-radius: 13px; color: #59647a; background: #fafbfc; cursor: pointer; font-size: 13px; font-weight: 650; }
    .target-option:has(input:checked) { color: #4e2ad5; border-color: #8c70f7; background: #f4f0ff; box-shadow: 0 0 0 3px #6b45f212; }
    .target-option input { flex: 0 0 auto; width: 17px; height: 17px; margin: 0; padding: 0; accent-color: #5f35f2; }
    .target-option span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
    .mode-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 18px; padding: 4px; border-radius: 16px; background: #f1eff8; }
    .mode-tab { color: #657086; background: #f4f2fb; border: 1px solid #e8e4fb; }
    .mode-tab[aria-selected="true"] { color: #fff; background: linear-gradient(135deg, #7546f5, #4d35e8); box-shadow: 0 7px 16px #5f35f229; }
    .mode-tab:disabled { color: #8c93a3; background: transparent; opacity: 1; }
    .desktop-note { display: flex; align-items: flex-start; gap: 10px; margin: -6px 0 18px; padding: 11px 13px; border: 1px solid #e8e4fb; border-radius: 13px; color: #657086; background: #faf8ff; font-size: 12px; line-height: 1.5; }
    .desktop-note strong { color: #4e2ad5; white-space: nowrap; }
    .agent-grid { display: grid; gap: 12px; }
    .environment-bar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
    .environment-item { min-width: 0; padding: 9px 10px; border: 1px solid #e5e8ef; border-radius: 12px; color: #7b8497; background: #fafbfc; font-size: 11px; }
    .environment-item strong { display: block; margin-bottom: 2px; color: #59647a; font-size: 12px; }
    .environment-item[data-ok="true"] { border-color: #bce8d0; background: #f1fbf5; }
    .environment-item[data-ok="true"] strong { color: #168652; }
    .environment-item[data-ok="false"] { border-color: #f1d3a7; background: #fff9ef; }
    .environment-item[data-ok="false"] strong { color: #a66316; }
    .environment-detail { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .prompt-box { min-height: 190px; color: #39445a; background: #f7f5ff; }
    .handoff-connection { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; padding: 11px 13px; border: 1px solid #e5e8ef; border-radius: 13px; color: #657086; background: #fafbfc; font-size: 12px; }
    .handoff-connection .dot { background: #b9bec9; box-shadow: 0 0 0 4px #8a93a622; }
    .handoff-connection[data-online="true"] { border-color: #bce8d0; background: #f1fbf5; }
    .handoff-connection[data-online="true"] .dot { background: #20b26b; box-shadow: 0 0 0 4px #20b26b22; }
    .handoff-connection strong { display: block; color: #273147; }
    .handoff-connection span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .compact-area { min-height: 88px; font-family: inherit; font-size: 14px; }
    .handoff-list { display: grid; gap: 9px; margin-top: 16px; }
    .handoff-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 12px; border: 1px solid #eceef3; border-radius: 14px; background: #fafbfc; }
    .handoff-item strong, .handoff-item small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .handoff-item small { margin-top: 3px; color: #8a93a6; }
    .handoff-preview { max-height: 320px; margin-top: 14px; padding: 14px; overflow: auto; border: 1px solid #e5e8ef; border-radius: 14px; background: #fafbfc; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
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
    .inbox-heading { margin-top: 4px; }
    .inbox-list { display: grid; gap: 9px; }
    .file-picker { display: grid; gap: 9px; margin-top: 14px; padding: 18px; border: 1px dashed #b8aaf1; border-radius: 16px; background: #faf8ff; text-align: center; }
    .file-picker input { padding: 9px; background: #fff; }
    .file-summary { min-height: 20px; color: #7b8497; font-size: 13px; }
    progress { width: 100%; height: 9px; margin-top: 12px; accent-color: #5f35f2; }
    .file-name { margin: 8px 0 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 720; }
    .file-detail { margin-top: 5px; color: #7b8497; font-size: 12px; }
    .delivery-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
    .delivery-chip { padding: 5px 8px; border-radius: 999px; color: #735b20; background: #fff4ca; font-size: 11px; font-weight: 700; }
    .delivery-chip[data-status="downloaded"], .delivery-chip[data-status="delivered"] { color: #167148; background: #dff7ea; }
    .inbox-divider { height: 1px; margin: 22px 0; border: 0; background: #eceef3; }
    .empty { padding: 18px 8px; color: #8a93a6; text-align: center; font-size: 13px; }
    .notice { margin-bottom: 16px; padding: 11px 13px; color: #664f18; background: #fff7d8; border: 1px solid #f0df9c; border-radius: 13px; font-size: 12px; line-height: 1.5; }
    .warning { margin-top: 16px; color: #7a6840; background: #fff8df; border: 1px solid #f1df9e; border-radius: 14px; padding: 12px 14px; font-size: 13px; line-height: 1.45; }
    .role-strip { display: flex; align-items: center; justify-content: center; gap: 9px; padding: 10px 14px; border: 1px solid #e8e4fb; border-radius: 15px; color: #657086; background: #faf8ff; font-size: 12px; }
    .role-pill { padding: 5px 8px; border-radius: 999px; color: #4e2ad5; background: #eee8ff; font-weight: 750; }
    .role-node { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
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
      .environment-bar { grid-template-columns: 1fr 1fr; }
      .destination { grid-template-columns: 1fr; }
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
      .mode-tabs { background: #20242d; }
      .mode-tab, .file-picker, .target-option { color: #d8ddea; background: #222631; border-color: #3b4050; }
      .target-option:has(input:checked) { color: #fff; background: #33265a; border-color: #8c70f7; }
      .tab { color: #aeb7c8; }
      .tab[aria-selected="true"] { color: #fff; background: #5f35f2; box-shadow: none; }
      .pairing, .pair-box { border-color: #3b4050; background: linear-gradient(135deg, #23202f, #1d2731); }
      .device-item { border-color: #303744; }
      .history-item { border-color: #303744; background: #151920; }
      .history-text { color: #e6eaf2; }
      .inbox-divider { background: #303744; }
      .danger { color: #ffb2b2; background: #442626; }
      .notice, .warning { color: #e7d99f; background: #302a18; border-color: #554a27; }
      .role-strip { color: #c7cfdd; background: #23202f; border-color: #3b4050; }
      .role-pill { color: #e1d8ff; background: #3b2d67; }
      .desktop-note, .handoff-item, .handoff-preview { color: #c7cfdd; background: #222631; border-color: #3b4050; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand"><img class="brand-icon" src="/brand-icon-96.png" srcset="/brand-icon-96.png 96w, /brand-icon-192.png 192w" sizes="40px" width="40" height="40" alt=""><h1>ClipBridge</h1></div>
      <span class="status"><i class="dot"></i><span id="connection-status">${isLocal ? `管理端 · ${normalizedRelay.type === "mac" ? "Mac" : "Windows"} 中转` : "等待配对"}</span></span>
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

    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
      return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }

    function selectedTargetIds(container) {
      return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    }

    function renderTargetPicker(container, targets, selectedIds = []) {
      const selected = new Set(selectedIds);
      container.replaceChildren();
      if (!targets.length) {
        const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '没有可用的接收设备'; container.append(empty); return;
      }
      for (const target of targets) {
        const option = document.createElement('label'); option.className = 'target-option';
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = target.id; input.checked = selected.has(target.id);
        const text = document.createElement('span'); text.textContent = deviceIcon(target.type) + ' ' + target.name;
        input.addEventListener('change', () => container.dispatchEvent(new Event('targetschange')));
        option.append(input, text); container.append(option);
      }
    }

    function deliverySummary(deliveries) {
      return deliveries.map(({ target, status }) => target.name + '：' + (status === 'delivered' ? '已送达' : status === 'downloaded' ? '已下载' : '待接收')).join('；');
    }

    function renderFileOutbox(container, batches) {
      container.replaceChildren();
      if (!batches.length) {
        const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '还没有发送中的文件'; container.append(empty); return;
      }
      for (const batch of batches) {
        const item = document.createElement('article'); item.className = 'history-item';
        const name = document.createElement('p'); name.className = 'file-name'; name.textContent = batch.name;
        const detail = document.createElement('div'); detail.className = 'file-detail'; detail.textContent = formatBytes(batch.bytes) + ' · 上传一次，共享给 ' + batch.deliveries.length + ' 台设备';
        const chips = document.createElement('div'); chips.className = 'delivery-chips';
        for (const delivery of batch.deliveries) {
          const chip = document.createElement('span'); chip.className = 'delivery-chip'; chip.dataset.status = delivery.status;
          chip.textContent = delivery.target.name + ' · ' + (delivery.status === 'downloaded' ? '已下载' : '待接收'); chips.append(chip);
        }
        item.append(name, detail, chips); container.append(item);
      }
    }

    function renderFileList(container, entries, { onOpen, onDownload, onDelete }) {
      container.replaceChildren();
      if (!entries.length) {
        const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '暂时没有待接收文件'; container.append(empty); return;
      }
      for (const entry of entries) {
        const item = document.createElement('article'); item.className = 'history-item';
        const top = document.createElement('div'); top.className = 'history-top';
        const route = document.createElement('div'); route.className = 'history-route'; route.textContent = entry.source.name + ' → ' + entry.target.name;
        const time = document.createElement('time'); time.className = 'history-meta'; time.textContent = new Date(entry.createdAt).toLocaleString();
        const name = document.createElement('p'); name.className = 'file-name'; name.textContent = entry.name;
        const detail = document.createElement('div'); detail.className = 'file-detail'; detail.textContent = formatBytes(entry.bytes) + ' · ' + new Date(entry.expiresAt).toLocaleString() + ' 前有效';
        const actions = document.createElement('div'); actions.className = 'history-actions';
        if (entry.previewKind) {
          const open = document.createElement('button'); open.className = 'quiet'; open.textContent = entry.previewKind === 'text' ? '安全预览' : '打开'; open.addEventListener('click', () => onOpen(entry)); actions.append(open);
        }
        const download = document.createElement('button'); download.className = 'quiet'; download.textContent = '下载'; download.addEventListener('click', () => onDownload(entry));
        const remove = document.createElement('button'); remove.className = 'quiet danger'; remove.textContent = '删除'; remove.addEventListener('click', () => onDelete(entry));
        top.append(route, time); actions.append(download, remove); item.append(top, name, detail, actions); container.append(item);
      }
    }

    function uploadFile(file, targetIds, token, onProgress, onStart = () => {}) {
      return new Promise((resolve, reject) => {
        const query = new URLSearchParams({ name: file.name });
        for (const targetId of targetIds) query.append('targetId', targetId);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/file-transfers?' + query);
        if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
        onStart(xhr);
        xhr.onload = () => {
          let data = {}; try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || '文件上传失败'));
        };
        xhr.onerror = () => reject(new Error('网络中断，文件没有上传完成'));
        xhr.onabort = () => reject(new Error('上传已取消'));
        xhr.send(file);
      });
    }

    ${modeScript}
  </script>
</body>
</html>`;
}

function renderLocalPanel(fileLimitLabel, relayNode) {
  const relayLabel = relayNode.type === "mac" ? "Mac" : relayNode.type === "windows" ? "Windows" : "设备";
  const relayName = escapeHtml(relayNode.name);
  return `<div class="stack">
    <section class="role-strip" aria-label="ClipBridge 角色"><span class="role-pill">管理设备</span><span aria-hidden="true">→</span><span class="role-node">${relayLabel} 中转节点 · ${relayName}</span></section>
    <nav class="mode-tabs" role="tablist" aria-label="ClipBridge 功能">
      <button class="mode-tab" id="local-text-mode" role="tab" aria-controls="local-text-workspace" aria-selected="true">文字</button>
      <button class="mode-tab" id="local-file-mode" role="tab" aria-controls="local-file-workspace" aria-selected="false">文件</button>
      <button class="mode-tab" id="local-agent-mode" role="tab" aria-controls="local-agent-workspace" aria-selected="false">Agent</button>
    </nav>
    <div id="local-text-workspace" class="stack">
    <section class="card" aria-labelledby="local-title">
      <div class="section-heading">
        <div class="eyebrow">${relayLabel} 中转节点剪贴板</div>
        <h2 id="local-title">节点剪贴板</h2>
        <p class="helper">查看当前内容，修改后可以重新保存到 ${relayLabel} 剪贴板。</p>
      </div>
      <textarea id="local-clip" aria-label="中转节点剪贴板内容" placeholder="正在读取中转节点剪贴板…"></textarea>
      <div class="destination">
        <div class="target-block"><div class="target-label">接收设备（可多选）</div><div class="target-picker" id="local-target" role="group" aria-label="文字接收设备"><div class="empty">正在读取设备…</div></div></div>
        <button class="primary" id="send-local-target" disabled><span class="button-icon" aria-hidden="true">→</span>发送给所选设备</button>
      </div>
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
      <p class="helper">仅记录通过 ClipBridge 主动传输的文本，最多保留 50 条，并且只保存在当前中转节点上。</p>
      <div class="history-list" id="history-list"><div class="empty">正在读取历史…</div></div>
      <div class="message" id="history-message" role="status" aria-live="polite"></div>
    </section>
    </div>
    <div id="local-file-workspace" hidden>
    <section class="card" aria-labelledby="local-files-title">
      <div class="row-heading">
        <div><div class="eyebrow">局域网文件中转</div><h2 id="local-files-title">文件</h2></div>
        <button class="quiet" id="refresh-local-files">刷新收件箱</button>
      </div>
      <p class="helper">一次上传可以共享给多台已配对设备；每台设备的接收和下载状态互不影响。文件默认在本机保留 24 小时。</p>
      <div class="target-block"><div class="target-label">接收设备（可多选）</div><div class="target-picker" id="local-file-target" role="group" aria-label="文件接收设备"><div class="empty">正在读取设备…</div></div></div>
      <label class="file-picker">选择一个或多个文件<input id="local-file-input" type="file" multiple><span class="file-summary" id="local-file-summary">单文件上限 ${fileLimitLabel}</span></label>
      <progress id="local-file-progress" max="1" value="0" hidden></progress>
      <div class="actions"><button class="primary" id="send-local-files" disabled>发送文件</button><button class="secondary" id="cancel-local-files" hidden>取消上传</button></div>
      <div class="message" id="local-file-message" role="status" aria-live="polite"></div>
      <hr class="inbox-divider">
      <div class="row-heading inbox-heading"><div><div class="eyebrow">共享 Blob · 独立投递</div><h3>最近发送状态</h3></div></div>
      <div class="inbox-list" id="local-file-outbox"><div class="empty">正在读取发送状态…</div></div>
      <hr class="inbox-divider">
      <div class="row-heading inbox-heading"><div><div class="eyebrow">其他设备 → 中转节点</div><h3>文件收件箱</h3></div><button class="quiet danger" id="clear-local-files">清空</button></div>
      <div class="inbox-list" id="local-file-list"><div class="empty">正在检查文件…</div></div>
    </section>
    </div>
    <div id="local-agent-workspace" hidden>
      <section class="card" aria-labelledby="agent-title">
        <div class="row-heading"><div><div class="eyebrow">桌面端 Beta · GitHub 项目交接</div><h2 id="agent-title">Agent Handoff</h2></div><span class="role-pill">电脑专用</span></div>
        <div class="desktop-note"><strong>使用限制</strong><span>仅支持安装了 Git、Node.js，并能访问同一 GitHub 仓库的 Mac、Windows 或 Linux 电脑。手机和平板不能创建或应用代码补丁。</span></div>
        <div class="environment-bar" id="handoff-environment" aria-label="Agent Handoff 环境状态">
          <div class="environment-item" data-key="git"><strong>○ Git</strong><span class="environment-detail">检测中…</span></div>
          <div class="environment-item" data-key="node"><strong>○ Node.js</strong><span class="environment-detail">检测中…</span></div>
          <div class="environment-item" data-key="repository"><strong>○ Git 项目</strong><span class="environment-detail">等待目录</span></div>
          <div class="environment-item" data-key="github"><strong>○ GitHub</strong><span class="environment-detail">等待远端</span></div>
        </div>
        <div class="handoff-connection" id="handoff-connection" data-online="false"><span class="dot" aria-hidden="true"></span><span><strong id="handoff-connection-title">尚未连接交接仓库</strong><span id="handoff-connection-detail">选择有效的 GitHub 项目后，所有有仓库权限的电脑都可以获取这份交接。</span></span></div>
        <div class="agent-grid">
          <label>1. Git 项目目录<input id="handoff-repository" value="." placeholder="/Users/name/project 或 C:\\Users\\name\\project"></label>
          <label>2. 复制这段官方 Prompt<textarea class="prompt-box" id="handoff-prompt" readonly>请为当前项目生成一份 ClipBridge Agent Handoff 交接说明。请检查当前对话、已经完成的工作、关键决定、尚未解决的问题，以及下一台电脑上的 Agent 应该采取的动作。不要包含密码、令牌、私钥或其他敏感信息。请只返回以下格式，内容要具体、可执行：

CLIPBRIDGE_HANDOFF_V1
## 当前目标
（项目现在最终想完成什么）
## 已完成、关键决定与当前状态
（已完成内容、重要文件、验证结果、约束、风险和未跟踪文件）
## 下一步
（接手 Agent 按顺序应该做什么）
END_CLIPBRIDGE_HANDOFF</textarea></label>
          <div class="actions"><button class="secondary" id="copy-handoff-prompt">复制官方 Prompt</button></div>
          <label>3. 粘贴 Agent 的完整回复<textarea id="handoff-response" placeholder="把 Agent 按照上面格式生成的完整回复粘贴到这里…"></textarea></label>
        </div>
        <div class="actions"><button class="primary" id="create-handoff">4. 发布交接到此仓库</button><button class="secondary" id="refresh-handoffs">获取待接手任务</button><button class="quiet" id="check-handoff-environment">重新检测环境</button></div>
        <div class="message" id="handoff-message" role="status" aria-live="polite"></div>
        <div class="handoff-list" id="handoff-list"><div class="empty">输入 Git 项目目录，然后获取待接手任务。</div></div>
        <pre class="handoff-preview" id="handoff-preview" hidden></pre>
      </section>
    </div>
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

function renderRemotePanel(deviceName, clientDevice, fileLimitLabel, relayNode) {
  const relayLabel = relayNode.type === "mac" ? "Mac" : relayNode.type === "windows" ? "Windows" : "设备";
  const safeClientName = escapeHtml(clientDevice.label);
  return `<div class="stack">
    <section class="card" id="pair-panel" aria-labelledby="pair-title">
      <div class="section-heading">
        <div class="eyebrow">首次连接</div>
        <h2 id="pair-title">与 ${deviceName} 配对</h2>
        <p class="helper">在 ${relayLabel} 中转节点的 ClipBridge 中点击“配对新设备”，然后扫描二维码或输入 6 位配对码。</p>
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
      <div class="notice" id="legacy-notice" hidden>当前仍在使用 v0.1 的共享链接。建议在中转节点生成一次性配对码，升级为可单独撤销的设备身份。</div>
      <div class="pairing" aria-label="当前已配对连接">
        <div class="pair-device">
          <span class="device-badge" id="client-device-icon" aria-hidden="true">📱</span>
          <span class="device-copy"><small>管理设备</small><strong id="client-device-name">${safeClientName}</strong></span>
        </div>
        <div class="pair-route" aria-hidden="true"><span>已配对</span></div>
        <div class="pair-device">
          <span class="device-copy"><small>${relayLabel} 中转节点</small><strong id="computer-name">${deviceName}</strong></span>
          <span class="device-badge" id="relay-device-icon" aria-hidden="true">${relayNode.type === "mac" ? "⌘" : "💻"}</span>
        </div>
      </div>
      <div class="mode-tabs" role="tablist" aria-label="内容类型">
        <button class="mode-tab" id="text-mode" role="tab" aria-controls="clipboard-workspace" aria-selected="true">文字</button>
        <button class="mode-tab" id="file-mode" role="tab" aria-controls="file-workspace" aria-selected="false">文件</button>
        <button class="mode-tab" type="button" disabled title="Agent Handoff 需要桌面端 Git 和 Node.js">Agent · 电脑端</button>
      </div>
      <div class="desktop-note"><strong>Agent Handoff</strong><span>代码项目交接仅能在中转电脑的管理页面使用；手机和平板仍可使用文字与文件传输。</span></div>
      <div id="clipboard-workspace">
      <div class="tabs" role="tablist" aria-label="传输方向">
        <button class="tab" id="send-tab" role="tab" aria-selected="true" aria-controls="send-panel" data-tab="send">发送</button>
        <button class="tab" id="receive-tab" role="tab" aria-selected="false" aria-controls="receive-panel" data-tab="receive">接收</button>
        <button class="tab" id="history-tab" role="tab" aria-selected="false" aria-controls="history-panel" data-tab="history">历史</button>
      </div>
      <section id="send-panel" role="tabpanel" aria-labelledby="send-tab">
        <div class="section-heading"><div class="eyebrow">一次选择一个或多个目标</div><h2>发送到所选设备</h2><p class="helper">发给中转节点会立即写入节点剪贴板；其他设备会各自在自己的收件箱中收到。</p></div>
        <div class="target-block"><div class="target-label">接收设备（可多选）</div><div class="target-picker" id="send-target" role="group" aria-label="文字发送目标"><div class="empty">正在读取设备…</div></div></div>
        <textarea id="send-text" aria-label="要发送到电脑的内容" placeholder="在这里粘贴或输入…"></textarea>
        <div class="actions"><button class="primary" id="send-to-computer" disabled><span class="button-icon" aria-hidden="true">↑</span>发送</button></div>
      </section>
      <section id="receive-panel" role="tabpanel" aria-labelledby="receive-tab" hidden>
        <div class="row-heading inbox-heading">
          <div><div class="eyebrow">其他设备 → 此设备</div><h2>设备收件箱</h2></div>
          <button class="quiet danger" id="clear-inbox">清空</button>
        </div>
        <div class="inbox-list" id="inbox-list"><div class="empty">正在检查新内容…</div></div>
        <hr class="inbox-divider">
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
        <p class="helper">最多保留 50 条，仅显示与当前设备有关的记录；内容保存在中转节点上。</p>
        <div class="history-list" id="history-list"><div class="empty">正在读取历史…</div></div>
      </section>
      </div>
      <section id="file-workspace" hidden>
        <div class="section-heading"><div class="eyebrow">上传一次，共享给多台设备</div><h2>发送文件</h2><p class="helper">中转节点只保存一份文件 Blob，各接收设备拥有独立状态；默认 24 小时后自动清理。</p></div>
        <div class="target-block"><div class="target-label">接收设备（可多选）</div><div class="target-picker" id="file-target" role="group" aria-label="文件发送目标"><div class="empty">正在读取设备…</div></div></div>
        <label class="file-picker">选择照片、视频、PDF、代码或其他文件<input id="file-input" type="file" multiple><span class="file-summary" id="file-summary">单文件上限 ${fileLimitLabel}</span></label>
        <progress id="file-progress" max="1" value="0" hidden></progress>
        <div class="actions"><button class="primary" id="send-files" disabled>发送文件</button><button class="secondary" id="cancel-files" hidden>取消上传</button><button class="secondary" id="refresh-files">刷新收件箱</button></div>
        <div class="message" id="file-message" role="status" aria-live="polite"></div>
        <hr class="inbox-divider">
        <div class="row-heading inbox-heading"><div><div class="eyebrow">共享 Blob · 独立投递</div><h2>最近发送状态</h2></div></div>
        <div class="inbox-list" id="file-outbox"><div class="empty">正在读取发送状态…</div></div>
        <hr class="inbox-divider">
        <div class="row-heading inbox-heading"><div><div class="eyebrow">其他设备 → 此设备</div><h2>文件收件箱</h2></div><button class="quiet danger" id="clear-files">清空</button></div>
        <div class="inbox-list" id="file-list"><div class="empty">正在检查文件…</div></div>
      </section>
      <div class="message" id="remote-message" role="status" aria-live="polite"></div>
      <div class="actions"><button class="quiet danger" id="forget-device">取消此设备的配对</button></div>
    </section>
  </div>`;
}

function localModeScript({ fileLimitLabel, relayNode }) {
  const relayLabel = relayNode.type === "mac" ? "Mac" : relayNode.type === "windows" ? "Windows" : "中转节点";
  return `const fileLimitLabel = ${safeScriptJson(fileLimitLabel)};
    const relayLabel = ${safeScriptJson(relayLabel)};
    const localField = document.querySelector('#local-clip');
    const refreshButton = document.querySelector('#refresh-local');
    const saveButton = document.querySelector('#save-local');
    const localTarget = document.querySelector('#local-target');
    const sendLocalTarget = document.querySelector('#send-local-target');
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
    const localFileTarget = document.querySelector('#local-file-target');
    const localFileInput = document.querySelector('#local-file-input');
    const localFileSummary = document.querySelector('#local-file-summary');
    const localFileProgress = document.querySelector('#local-file-progress');
    const localFileList = document.querySelector('#local-file-list');
    const localFileOutbox = document.querySelector('#local-file-outbox');
    const localFileMessage = document.querySelector('#local-file-message');
    const sendLocalFiles = document.querySelector('#send-local-files');
    const cancelLocalFiles = document.querySelector('#cancel-local-files');
    const localModes = [...document.querySelectorAll('[id^="local-"][id$="-mode"]')];
    const localTextWorkspace = document.querySelector('#local-text-workspace');
    const localFileWorkspace = document.querySelector('#local-file-workspace');
    const localAgentWorkspace = document.querySelector('#local-agent-workspace');
    const handoffRepository = document.querySelector('#handoff-repository');
    const handoffEnvironmentBar = document.querySelector('#handoff-environment');
    const handoffConnection = document.querySelector('#handoff-connection');
    const handoffPrompt = document.querySelector('#handoff-prompt');
    const handoffResponse = document.querySelector('#handoff-response');
    const handoffList = document.querySelector('#handoff-list');
    const handoffPreview = document.querySelector('#handoff-preview');
    const handoffMessage = document.querySelector('#handoff-message');
    const createHandoffButton = document.querySelector('#create-handoff');
    const refreshHandoffsButton = document.querySelector('#refresh-handoffs');
    const historyShow = (text, error = false) => { historyMessage.textContent = text; historyMessage.style.color = error ? '#d14343' : ''; };
    const localFileShow = (text, error = false) => { localFileMessage.textContent = text; localFileMessage.style.color = error ? '#d14343' : ''; };
    let currentPairUrl = '';
    let pairingPoll = null;
    let localUpload = null;
    let environmentTimer = null;

    const handoffShow = (text, error = false) => { handoffMessage.textContent = text; handoffMessage.style.color = error ? '#d14343' : ''; };
    const repositoryQuery = () => '?repository=' + encodeURIComponent(handoffRepository.value.trim() || '.');

    async function checkHandoffEnvironment() {
      try {
        const data = await apiJson('/api/v1/handoff-environment' + repositoryQuery());
        for (const [key, status] of Object.entries(data)) {
          const item = handoffEnvironmentBar.querySelector('[data-key="' + key + '"]');
          if (!item) continue;
          item.dataset.ok = String(status.ok);
          item.querySelector('strong').textContent = (status.ok ? '● ' : '● ') + ({ git: 'Git', node: 'Node.js', repository: 'Git 项目', github: 'GitHub' })[key];
          item.querySelector('.environment-detail').textContent = status.detail;
          item.title = status.detail;
        }
        const connected = data.repository.ok && data.github.ok;
        handoffConnection.dataset.online = String(connected);
        document.querySelector('#handoff-connection-title').textContent = connected ? '已连接 GitHub 交接仓库' : '尚未连接交接仓库';
        document.querySelector('#handoff-connection-detail').textContent = connected
          ? data.github.detail + ' · 所有有权限的电脑均可获取，当前不是定向发送。'
          : '请选择带有 GitHub origin 的 Git 项目；这不是与某台电脑的直接在线连接。';
      } catch (error) { handoffShow(error.message, true); }
    }

    function activateLocalMode(name) {
      const workspaces = { text: localTextWorkspace, file: localFileWorkspace, agent: localAgentWorkspace };
      for (const [mode, workspace] of Object.entries(workspaces)) {
        const active = mode === name; workspace.hidden = !active;
        document.querySelector('#local-' + mode + '-mode').setAttribute('aria-selected', String(active));
      }
      if (name === 'file') refreshLocalFiles();
      if (name === 'agent') checkHandoffEnvironment();
    }

    async function inspectHandoffFromUi(id) {
      handoffShow('正在读取交接包…');
      try {
        const data = await apiJson('/api/v1/handoffs/' + encodeURIComponent(id) + repositoryQuery());
        handoffPreview.textContent = data.markdown; handoffPreview.hidden = false; handoffShow('已校验并读取交接说明');
      } catch (error) { handoffShow(error.message, true); }
    }

    async function applyHandoffFromUi(id) {
      if (!confirm('把交接包“' + id + '”的修改应用到这个 Git 项目？接收项目必须是干净工作区。')) return;
      handoffShow('正在校验并应用 Git patch…');
      try {
        const data = await apiJson('/api/v1/handoffs/' + encodeURIComponent(id) + '/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repository: handoffRepository.value.trim() || '.' }) });
        handoffShow(data.applied ? '交接修改已应用，请在项目中检查并运行测试。' : '交接包没有需要应用的 tracked 修改。');
      } catch (error) { handoffShow(error.message, true); }
    }

    async function refreshHandoffs(fetchRemote = true) {
      refreshHandoffsButton.disabled = true; handoffShow(fetchRemote ? '正在从 GitHub 获取交接任务…' : '正在读取交接任务…');
      try {
        const suffix = repositoryQuery() + (fetchRemote ? '&fetch=1' : '');
        const data = await apiJson('/api/v1/handoffs' + suffix);
        handoffList.replaceChildren();
        if (!data.handoffs.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '没有待接手任务'; handoffList.append(empty); }
        for (const handoff of data.handoffs) {
          const item = document.createElement('article'); item.className = 'handoff-item';
          const copy = document.createElement('div'), title = document.createElement('strong'), meta = document.createElement('small');
          title.textContent = handoff.id; meta.textContent = handoff.date ? new Date(handoff.date).toLocaleString() : handoff.ref; copy.append(title, meta);
          const actions = document.createElement('div'); actions.className = 'actions'; actions.style.marginTop = '0';
          const inspect = document.createElement('button'); inspect.className = 'quiet'; inspect.textContent = '预览'; inspect.onclick = () => inspectHandoffFromUi(handoff.id);
          const apply = document.createElement('button'); apply.className = 'secondary'; apply.textContent = '接手'; apply.onclick = () => applyHandoffFromUi(handoff.id);
          actions.append(inspect, apply); item.append(copy, actions); handoffList.append(item);
        }
        handoffShow(fetchRemote ? '已获取最新交接任务' : '已读取本地交接任务');
      } catch (error) { handoffList.replaceChildren(); handoffShow(error.message, true); }
      finally { refreshHandoffsButton.disabled = false; }
    }

    for (const mode of localModes) mode.addEventListener('click', () => activateLocalMode(mode.id.replace('local-', '').replace('-mode', '')));
    document.querySelector('#copy-handoff-prompt').addEventListener('click', async () => {
      const copied = await copyText(handoffPrompt.value, handoffPrompt);
      handoffShow(copied ? '官方 Prompt 已复制，请发给当前 Agent。' : '已选中 Prompt，请手动复制。');
    });
    document.querySelector('#check-handoff-environment').addEventListener('click', checkHandoffEnvironment);
    handoffRepository.addEventListener('input', () => { clearTimeout(environmentTimer); environmentTimer = setTimeout(checkHandoffEnvironment, 450); });
    refreshHandoffsButton.addEventListener('click', () => refreshHandoffs(true));
    createHandoffButton.addEventListener('click', async () => {
      createHandoffButton.disabled = true; handoffShow('正在创建并推送安全交接包…');
      try {
        const data = await apiJson('/api/v1/handoffs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repository: handoffRepository.value.trim() || '.', agentResponse: handoffResponse.value, push: true }) });
        handoffShow('已推送交接：' + data.id); await refreshHandoffs(false);
      } catch (error) { handoffShow(error.message, true); }
      finally { createHandoffButton.disabled = false; }
    });

    async function refreshLocalClipboard() {
      refreshButton.disabled = true; show('正在读取' + relayLabel + '剪贴板…');
      try { localField.value = (await apiJson('/api/v1/clip')).text; show('已读取当前中转节点剪贴板'); }
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
            try { await apiJson('/api/v1/devices/' + encodeURIComponent(device.id), { method: 'DELETE' }); await Promise.all([refreshDevices(), refreshPeers()]); }
            catch (error) { show(error.message, true); }
          });
          copy.append(name, meta); item.append(badge, copy, revoke); deviceList.append(item);
        }
      } catch (error) { deviceList.textContent = error.message; }
    }

    async function refreshPeers() {
      try {
        const data = await apiJson('/api/v1/peers');
        const selected = selectedTargetIds(localTarget);
        const selectedFileTargets = selectedTargetIds(localFileTarget);
        renderTargetPicker(localTarget, data.targets, selected);
        renderTargetPicker(localFileTarget, data.targets, selectedFileTargets);
        sendLocalTarget.disabled = !selectedTargetIds(localTarget).length;
        sendLocalFiles.disabled = !selectedTargetIds(localFileTarget).length || !localFileInput.files.length;
      } catch (error) { sendLocalTarget.disabled = true; historyShow(error.message, true); }
    }

    async function requestLocalFile(entry, inline) {
      const tab = inline ? window.open('', '_blank') : null;
      try {
        const data = await apiJson('/api/v1/file-transfers/' + encodeURIComponent(entry.id) + '/download' + (inline ? '?inline=1' : ''), { method: 'POST' });
        if (tab) tab.location.href = data.url; else window.location.assign(data.url);
      } catch (error) { if (tab) tab.close(); localFileShow(error.message, true); }
    }

    async function refreshLocalFiles() {
      try {
        const [data, outbox] = await Promise.all([apiJson('/api/v1/file-inbox'), apiJson('/api/v1/file-outbox')]);
        renderFileList(localFileList, data.transfers, {
          onOpen: (entry) => requestLocalFile(entry, true),
          onDownload: (entry) => requestLocalFile(entry, false),
          onDelete: async (entry) => {
            try { await apiJson('/api/v1/file-transfers/' + encodeURIComponent(entry.id), { method: 'DELETE' }); await refreshLocalFiles(); }
            catch (error) { localFileShow(error.message, true); }
          }
        });
        renderFileOutbox(localFileOutbox, outbox.transfers);
      } catch (error) { localFileList.textContent = error.message; }
    }

    async function refreshHistory() {
      try {
        const data = await apiJson('/api/v1/history');
        renderHistoryList(historyList, data.entries, {
          actionLabel: '放回剪贴板',
          onUse: async (entry) => {
            try {
              await apiJson('/api/v1/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: entry.text }) });
              localField.value = entry.text; historyShow('已放回中转节点剪贴板');
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
      try { await apiJson('/api/v1/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: localField.value }) }); show('已保存到' + relayLabel + '剪贴板'); }
      catch (error) { show(error.message, true); }
      finally { saveButton.disabled = false; }
    });
    refreshButton.addEventListener('click', refreshLocalClipboard);
    document.querySelector('#clear-history').addEventListener('click', async () => {
      if (!confirm('清空当前中转节点上的全部剪贴板历史？')) return;
      try { const data = await apiJson('/api/v1/history', { method: 'DELETE' }); historyShow('已清空 ' + data.removed + ' 条记录'); await refreshHistory(); }
      catch (error) { historyShow(error.message, true); }
    });
    sendLocalTarget.addEventListener('click', async () => {
      const targetIds = selectedTargetIds(localTarget);
      if (!targetIds.length) return;
      sendLocalTarget.disabled = true;
      try {
        const data = await apiJson('/api/v1/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: localField.value, targetIds }) });
        historyShow(deliverySummary(data.deliveries)); await refreshHistory();
      } catch (error) { historyShow(error.message, true); }
      finally { sendLocalTarget.disabled = !selectedTargetIds(localTarget).length; }
    });
    localTarget.addEventListener('targetschange', () => { sendLocalTarget.disabled = !selectedTargetIds(localTarget).length; });
    localFileTarget.addEventListener('targetschange', () => { sendLocalFiles.disabled = !selectedTargetIds(localFileTarget).length || !localFileInput.files.length; });
    localFileInput.addEventListener('change', () => {
      const files = [...localFileInput.files];
      localFileSummary.textContent = files.length ? files.length + ' 个文件 · ' + formatBytes(files.reduce((sum, file) => sum + file.size, 0)) : '单文件上限 ' + fileLimitLabel;
      sendLocalFiles.disabled = !files.length || !selectedTargetIds(localFileTarget).length;
    });
    sendLocalFiles.addEventListener('click', async () => {
      const selectedFiles = [...localFileInput.files];
      const targetIds = selectedTargetIds(localFileTarget);
      if (!selectedFiles.length || !targetIds.length) return;
      sendLocalFiles.disabled = true; cancelLocalFiles.hidden = false; localFileProgress.hidden = false; localFileProgress.value = 0;
      try {
        let latestDeliveries = [];
        for (const [index, file] of selectedFiles.entries()) {
          localFileShow('正在发送 ' + file.name + '…');
          const data = await uploadFile(file, targetIds, '', (fraction) => { localFileProgress.value = (index + fraction) / selectedFiles.length; }, (xhr) => { localUpload = xhr; });
          latestDeliveries = data.deliveries;
        }
        localFileProgress.value = 1; localFileShow('已发送 ' + selectedFiles.length + ' 个文件 · ' + deliverySummary(latestDeliveries)); localFileInput.value = ''; localFileSummary.textContent = '单文件上限 ' + fileLimitLabel; await refreshLocalFiles();
      } catch (error) { localFileShow(error.message, true); }
      finally { localUpload = null; cancelLocalFiles.hidden = true; sendLocalFiles.disabled = !localFileInput.files.length || !selectedTargetIds(localFileTarget).length; }
    });
    cancelLocalFiles.addEventListener('click', () => localUpload?.abort());
    document.querySelector('#refresh-local-files').addEventListener('click', refreshLocalFiles);
    document.querySelector('#clear-local-files').addEventListener('click', async () => {
      if (!confirm('删除发给当前中转节点的全部待接收文件？')) return;
      try { const data = await apiJson('/api/v1/file-inbox', { method: 'DELETE' }); localFileShow('已清理 ' + data.removed + ' 个文件'); await refreshLocalFiles(); }
      catch (error) { localFileShow(error.message, true); }
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
        clearInterval(pairingPoll); pairingPoll = setInterval(() => { refreshDevices(); refreshPeers(); }, 3000);
      } catch (error) { show(error.message, true); }
      finally { pairButton.disabled = false; }
    });
    document.querySelector('#copy-pair-link').addEventListener('click', async () => {
      if (!currentPairUrl) return;
      show(await copyText(currentPairUrl) ? '配对链接已复制' : '请手动复制配对链接', false);
    });
    refreshLocalClipboard(); refreshHistory(); refreshDevices(); refreshPeers(); refreshLocalFiles();`;
}

function remoteModeScript({ deviceName, relayNode, clientDevice, legacyToken, pairingCode, fileLimitLabel }) {
  return `const TOKEN_KEY = 'clipbridge.deviceToken.v2';
    const initialLegacyToken = ${safeScriptJson(legacyToken)};
    const initialPairingCode = ${safeScriptJson(pairingCode)};
    const guessedDevice = ${safeScriptJson(clientDevice)};
    const fileLimitLabel = ${safeScriptJson(fileLimitLabel)};
    const computerDisplayName = ${safeScriptJson(deviceName)};
    const initialRelayNode = ${safeScriptJson({ id: relayNode.id, name: relayNode.name, type: relayNode.type })};
    const pairPanel = document.querySelector('#pair-panel');
    const remotePanel = document.querySelector('#remote-panel');
    const pairForm = document.querySelector('#pair-form');
    const remoteMessage = document.querySelector('#remote-message');
    const historyList = document.querySelector('#history-list');
    const sendTarget = document.querySelector('#send-target');
    const inboxList = document.querySelector('#inbox-list');
    const receiveTab = document.querySelector('#receive-tab');
    const clipboardWorkspace = document.querySelector('#clipboard-workspace');
    const fileWorkspace = document.querySelector('#file-workspace');
    const textMode = document.querySelector('#text-mode');
    const fileMode = document.querySelector('#file-mode');
    const fileTarget = document.querySelector('#file-target');
    const fileInput = document.querySelector('#file-input');
    const fileSummary = document.querySelector('#file-summary');
    const fileProgress = document.querySelector('#file-progress');
    const fileList = document.querySelector('#file-list');
    const fileOutbox = document.querySelector('#file-outbox');
    const fileMessage = document.querySelector('#file-message');
    const sendFiles = document.querySelector('#send-files');
    const cancelFiles = document.querySelector('#cancel-files');
    let deviceToken = localStorage.getItem(TOKEN_KEY) || '';
    let currentSession = null;
    let inboxPoll = null;
    let currentUpload = null;

    if (initialLegacyToken) {
      deviceToken = initialLegacyToken; localStorage.setItem(TOKEN_KEY, deviceToken);
    }
    if (initialPairingCode) document.querySelector('#pair-code-input').value = initialPairingCode.replace(/\\D/g, '').slice(0, 6);
    if (initialLegacyToken || initialPairingCode) history.replaceState(null, '', '/ui');

    function authHeaders(extra = {}) { return deviceToken ? { ...extra, Authorization: 'Bearer ' + deviceToken } : extra; }
    function remoteShow(text, error = false) { remoteMessage.textContent = text; remoteMessage.style.color = error ? '#d14343' : ''; }
    function fileShow(text, error = false) { fileMessage.textContent = text; fileMessage.style.color = error ? '#d14343' : ''; }
    function deviceIcon(type) { return ({ iphone: '📱', ipad: '▣', android: '🤖', mac: '⌘', windows: '💻' })[type] || '◆'; }

    async function authenticated(path, options = {}) {
      return apiJson(path, { ...options, headers: authHeaders(options.headers || {}) });
    }

    function showPairing() {
      clearInterval(inboxPoll); currentSession = null;
      pairPanel.hidden = false; remotePanel.hidden = true; document.querySelector('#connection-status').textContent = '等待配对';
    }

    function showConnected(session) {
      currentSession = session;
      pairPanel.hidden = true; remotePanel.hidden = false;
      document.querySelector('#connection-status').textContent = session.legacy ? '旧版连接' : '已安全配对';
      document.querySelector('#client-device-name').textContent = session.device.name;
      document.querySelector('#client-device-icon').textContent = deviceIcon(session.device.type);
      const connectedRelay = session.relayNode || session.computer || initialRelayNode;
      document.querySelector('#computer-name').textContent = connectedRelay.name;
      document.querySelector('#relay-device-icon').textContent = deviceIcon(connectedRelay.type);
      document.querySelector('#legacy-notice').hidden = !session.legacy;
      document.querySelector('#clear-inbox').disabled = session.legacy;
      fileMode.disabled = session.legacy;
      refreshHistory(); loadPeers(); refreshInbox(); refreshFileInbox(); refreshFileOutbox();
      clearInterval(inboxPoll);
      if (!session.legacy) inboxPoll = setInterval(() => { refreshInbox(); refreshFileInbox(); refreshFileOutbox(); }, 5000);
    }

    async function loadPeers() {
      const fallbackTargets = [initialRelayNode];
      renderTargetPicker(sendTarget, fallbackTargets, [initialRelayNode.id]);
      renderTargetPicker(fileTarget, fallbackTargets, []);
      if (currentSession?.legacy) { document.querySelector('#send-to-computer').disabled = false; return; }
      try {
        const data = await authenticated('/api/v1/peers');
        renderTargetPicker(sendTarget, data.targets, selectedTargetIds(sendTarget));
        renderTargetPicker(fileTarget, data.targets, selectedTargetIds(fileTarget));
        document.querySelector('#send-to-computer').disabled = !selectedTargetIds(sendTarget).length;
        sendFiles.disabled = !selectedTargetIds(fileTarget).length || !fileInput.files.length;
      } catch (error) { remoteShow(error.message, true); }
    }

    async function requestRemoteFile(entry, inline) {
      const tab = inline ? window.open('', '_blank') : null;
      try {
        const data = await authenticated('/api/v1/file-transfers/' + encodeURIComponent(entry.id) + '/download' + (inline ? '?inline=1' : ''), { method: 'POST' });
        if (tab) tab.location.href = data.url; else window.location.assign(data.url);
      } catch (error) { if (tab) tab.close(); fileShow(error.message, true); }
    }

    async function refreshFileInbox() {
      if (!deviceToken || currentSession?.legacy) {
        fileList.replaceChildren(); const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '安全配对后可使用文件中转'; fileList.append(empty); return;
      }
      try {
        const data = await authenticated('/api/v1/file-inbox');
        fileMode.textContent = data.transfers.length ? '文件 · ' + data.transfers.length : '文件';
        renderFileList(fileList, data.transfers, {
          onOpen: (entry) => requestRemoteFile(entry, true),
          onDownload: (entry) => requestRemoteFile(entry, false),
          onDelete: async (entry) => {
            try { await authenticated('/api/v1/file-transfers/' + encodeURIComponent(entry.id), { method: 'DELETE' }); fileShow('文件已删除'); await refreshFileInbox(); }
            catch (error) { fileShow(error.message, true); }
          }
        });
      } catch (error) { fileList.textContent = error.message; }
    }

    async function refreshFileOutbox() {
      if (!deviceToken || currentSession?.legacy) {
        fileOutbox.replaceChildren(); const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '安全配对后可查看逐设备投递状态'; fileOutbox.append(empty); return;
      }
      try { renderFileOutbox(fileOutbox, (await authenticated('/api/v1/file-outbox')).transfers); }
      catch (error) { fileOutbox.textContent = error.message; }
    }

    async function refreshInbox() {
      if (!deviceToken || currentSession?.legacy) {
        receiveTab.textContent = '接收'; inboxList.replaceChildren();
        const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '安全配对后可使用设备收件箱'; inboxList.append(empty); return;
      }
      try {
        const data = await authenticated('/api/v1/inbox');
        receiveTab.textContent = data.transfers.length ? '接收 · ' + data.transfers.length : '接收';
        inboxList.replaceChildren();
        if (!data.transfers.length) {
          const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '暂时没有其他设备发来的内容'; inboxList.append(empty); return;
        }
        for (const transfer of data.transfers) {
          const item = document.createElement('article'); item.className = 'history-item';
          const top = document.createElement('div'); top.className = 'history-top';
          const route = document.createElement('div'); route.className = 'history-route'; route.textContent = transfer.source.name + ' → 此设备';
          const meta = document.createElement('time'); meta.className = 'history-meta'; meta.textContent = new Date(transfer.createdAt).toLocaleString();
          const content = document.createElement('p'); content.className = 'history-text'; content.textContent = transfer.text || '（空文本）';
          const actions = document.createElement('div'); actions.className = 'history-actions';
          const accept = document.createElement('button'); accept.className = 'quiet'; accept.textContent = '复制并收下';
          const dismiss = document.createElement('button'); dismiss.className = 'quiet danger'; dismiss.textContent = '忽略';
          accept.addEventListener('click', async () => {
            try {
              if (!await copyText(transfer.text)) { remoteShow('请长按文字并选择“复制”'); return; }
              await authenticated('/api/v1/inbox/' + encodeURIComponent(transfer.id), { method: 'DELETE' }); remoteShow('已复制并移出收件箱'); await refreshInbox();
            } catch (error) { remoteShow(error.message, true); }
          });
          dismiss.addEventListener('click', async () => {
            try { await authenticated('/api/v1/inbox/' + encodeURIComponent(transfer.id), { method: 'DELETE' }); await refreshInbox(); }
            catch (error) { remoteShow(error.message, true); }
          });
          top.append(route, meta); actions.append(accept, dismiss); item.append(top, content, actions); inboxList.append(item);
        }
      } catch (error) { inboxList.textContent = error.message; }
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
      if (name === 'receive') refreshInbox();
    }
    for (const tab of tabs) tab.addEventListener('click', () => activateTab(tab.dataset.tab));

    function activateMode(mode) {
      const showFiles = mode === 'file';
      textMode.setAttribute('aria-selected', String(!showFiles)); fileMode.setAttribute('aria-selected', String(showFiles));
      clipboardWorkspace.hidden = showFiles; fileWorkspace.hidden = !showFiles;
      remoteShow(''); fileShow('');
      if (showFiles) refreshFileInbox();
    }
    textMode.addEventListener('click', () => activateMode('text'));
    fileMode.addEventListener('click', () => activateMode('file'));

    document.querySelector('#send-to-computer').addEventListener('click', async () => {
      const button = document.querySelector('#send-to-computer'); const targetIds = selectedTargetIds(sendTarget);
      if (!currentSession?.legacy && !targetIds.length) return;
      button.disabled = true; remoteShow('正在发送…');
      try {
        if (currentSession?.legacy) {
          await authenticated('/api/v1/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: document.querySelector('#send-text').value }) }); remoteShow('已发送到电脑剪贴板');
        } else {
          const data = await authenticated('/api/v1/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: document.querySelector('#send-text').value, targetIds }) });
          remoteShow(deliverySummary(data.deliveries));
        }
        await refreshHistory();
      }
      catch (error) { remoteShow(error.message, true); }
      finally { button.disabled = !currentSession?.legacy && !selectedTargetIds(sendTarget).length; }
    });
    sendTarget.addEventListener('targetschange', () => { document.querySelector('#send-to-computer').disabled = !currentSession?.legacy && !selectedTargetIds(sendTarget).length; });
    fileTarget.addEventListener('targetschange', () => { sendFiles.disabled = !selectedTargetIds(fileTarget).length || !fileInput.files.length || currentSession?.legacy; });
    document.querySelector('#receive-from-computer').addEventListener('click', async () => {
      const button = document.querySelector('#receive-from-computer'); const copy = document.querySelector('#copy-to-device'); button.disabled = true; copy.disabled = true; remoteShow('正在获取电脑剪贴板…');
      try { document.querySelector('#received-text').value = (await authenticated('/api/v1/clip')).text; copy.disabled = false; remoteShow('已获取电脑的最新内容'); await refreshHistory(); }
      catch (error) { remoteShow(error.message, true); }
      finally { button.disabled = false; }
    });
    document.querySelector('#copy-to-device').addEventListener('click', async () => {
      const field = document.querySelector('#received-text'); remoteShow(await copyText(field.value, field) ? '已复制到此设备的剪贴板' : '已选中文字，请长按并选择“复制”', false);
    });
    fileInput.addEventListener('change', () => {
      const selectedFiles = [...fileInput.files];
      fileSummary.textContent = selectedFiles.length ? selectedFiles.length + ' 个文件 · ' + formatBytes(selectedFiles.reduce((sum, file) => sum + file.size, 0)) : '单文件上限 ' + fileLimitLabel;
      sendFiles.disabled = !selectedFiles.length || !selectedTargetIds(fileTarget).length || currentSession?.legacy;
    });
    sendFiles.addEventListener('click', async () => {
      const selectedFiles = [...fileInput.files];
      const targetIds = selectedTargetIds(fileTarget);
      if (!selectedFiles.length || !targetIds.length || currentSession?.legacy) return;
      sendFiles.disabled = true; cancelFiles.hidden = false; fileProgress.hidden = false; fileProgress.value = 0;
      try {
        let latestDeliveries = [];
        for (const [index, file] of selectedFiles.entries()) {
          fileShow('正在发送 ' + file.name + '…');
          const data = await uploadFile(file, targetIds, deviceToken, (fraction) => { fileProgress.value = (index + fraction) / selectedFiles.length; }, (xhr) => { currentUpload = xhr; });
          latestDeliveries = data.deliveries;
        }
        fileProgress.value = 1; fileShow('已发送 ' + selectedFiles.length + ' 个文件 · ' + deliverySummary(latestDeliveries)); fileInput.value = ''; fileSummary.textContent = '单文件上限 ' + fileLimitLabel; await refreshFileOutbox();
      } catch (error) { fileShow(error.message, true); }
      finally { currentUpload = null; cancelFiles.hidden = true; sendFiles.disabled = !fileInput.files.length || !selectedTargetIds(fileTarget).length || currentSession?.legacy; }
    });
    cancelFiles.addEventListener('click', () => currentUpload?.abort());
    document.querySelector('#refresh-files').addEventListener('click', () => { refreshFileInbox(); refreshFileOutbox(); });
    document.querySelector('#clear-files').addEventListener('click', async () => {
      if (currentSession?.legacy || !confirm('删除发给此设备的全部待接收文件？')) return;
      try { const data = await authenticated('/api/v1/file-inbox', { method: 'DELETE' }); fileShow('已清理 ' + data.removed + ' 个文件'); await refreshFileInbox(); }
      catch (error) { fileShow(error.message, true); }
    });
    document.querySelector('#clear-history').addEventListener('click', async () => {
      if (!confirm('清空与这台设备有关的剪贴板历史？')) return;
      try { const data = await authenticated('/api/v1/history', { method: 'DELETE' }); remoteShow('已清空 ' + data.removed + ' 条记录'); await refreshHistory(); }
      catch (error) { remoteShow(error.message, true); }
    });
    document.querySelector('#clear-inbox').addEventListener('click', async () => {
      if (currentSession?.legacy || !confirm('清空这台设备尚未收下的全部内容？')) return;
      try { const data = await authenticated('/api/v1/inbox', { method: 'DELETE' }); remoteShow('已清空 ' + data.removed + ' 条待接收内容'); await refreshInbox(); }
      catch (error) { remoteShow(error.message, true); }
    });
    document.querySelector('#forget-device').addEventListener('click', async () => {
      if (!confirm('取消这台设备与 ' + computerDisplayName + ' 的配对？')) return;
      try { await authenticated('/api/v1/session', { method: 'DELETE' }); } catch {}
      clearInterval(inboxPoll); localStorage.removeItem(TOKEN_KEY); deviceToken = ''; showPairing();
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

function formatFileLimit(bytes) {
  const safeBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : 256 * 1024 * 1024;
  if (safeBytes % (1024 * 1024 * 1024) === 0) return `${safeBytes / (1024 * 1024 * 1024)} GB`;
  if (safeBytes % (1024 * 1024) === 0) return `${safeBytes / (1024 * 1024)} MB`;
  return `${Math.round(safeBytes / 1024)} KB`;
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
