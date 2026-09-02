export function renderDashboard({ deviceName, token }) {
  const safeDeviceName = escapeHtml(deviceName);
  const safeToken = JSON.stringify(token);
  const manifestHref = escapeHtml(`/manifest.webmanifest?token=${encodeURIComponent(token)}`);
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
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(680px, 100%); }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .brand { display: inline-flex; align-items: center; gap: 9px; }
    .brand-icon { width: 36px; height: 36px; object-fit: contain; filter: drop-shadow(0 4px 8px #5f35f233); }
    h1 { font-size: 20px; margin: 0; }
    .status { display: inline-flex; align-items: center; gap: 7px; color: #657086; font-size: 14px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #20b26b; box-shadow: 0 0 0 4px #20b26b22; }
    .card { background: #fff; border: 1px solid #e5e8ef; border-radius: 22px; padding: 20px; box-shadow: 0 14px 45px #26334d12; }
    .eyebrow { color: #7b8497; font-size: 13px; margin-bottom: 10px; }
    textarea { width: 100%; min-height: 145px; resize: vertical; border: 0; outline: 0; padding: 0; color: inherit; background: transparent; font: 16px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
    button { appearance: none; border: 0; border-radius: 13px; padding: 12px 16px; font-weight: 650; cursor: pointer; }
    .primary { background: #5f35f2; color: #fff; }
    .secondary { background: #eef0f5; color: #273147; }
    .message { min-height: 22px; margin: 13px 2px 0; color: #657086; font-size: 13px; }
    .warning { margin-top: 16px; color: #7a6840; background: #fff8df; border: 1px solid #f1df9e; border-radius: 14px; padding: 12px 14px; font-size: 13px; line-height: 1.45; }
    @media (prefers-color-scheme: dark) {
      :root { color: #eef1f7; background: #11141a; }
      .card { background: #1b2029; border-color: #303744; box-shadow: none; }
      .secondary { background: #303744; color: #eef1f7; }
      .warning { color: #e7d99f; background: #302a18; border-color: #554a27; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand"><img class="brand-icon" src="/favicon-32.png" alt=""><h1>ClipBridge</h1></div>
      <span class="status"><i class="dot"></i>${safeDeviceName}</span>
    </header>
    <section class="card">
      <div class="eyebrow">随身剪贴板</div>
      <textarea id="clip" placeholder="输入文字发送到 Windows，或获取电脑当前剪贴板…" autofocus></textarea>
      <div class="actions">
        <button class="primary" id="send">发送到 Windows</button>
        <button class="secondary" id="receive">从 Windows 获取</button>
        <button class="secondary" id="copy">复制文本</button>
      </div>
      <div class="message" id="message" role="status"></div>
    </section>
    <div class="warning">原型版仅供可信私人网络使用。请勿发送密码、验证码、私钥或敏感工作内容。</div>
  </main>
  <script>
    const token = ${safeToken};
    const field = document.querySelector('#clip');
    const message = document.querySelector('#message');
    const headers = { Authorization: 'Bearer ' + token };
    const show = (text, error = false) => { message.textContent = text; message.style.color = error ? '#d14343' : ''; };

    document.querySelector('#send').addEventListener('click', async () => {
      show('正在发送…');
      try {
        const response = await fetch('/api/v1/clip', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'text', text: field.value })
        });
        if (!response.ok) throw new Error((await response.json()).error || '发送失败');
        show('已放入 Windows 剪贴板');
      } catch (error) { show(error.message, true); }
    });

    document.querySelector('#receive').addEventListener('click', async () => {
      show('正在获取…');
      try {
        const response = await fetch('/api/v1/clip', { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '获取失败');
        field.value = data.text;
        show('已获取 Windows 剪贴板');
      } catch (error) { show(error.message, true); }
    });

    document.querySelector('#copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(field.value);
        show('已复制到本机剪贴板');
      } catch {
        field.focus(); field.select();
        show('浏览器未授权自动复制，请长按所选文字复制', true);
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
