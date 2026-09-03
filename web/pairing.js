export function validatePairingUrl(value, currentHostname = "") {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: "请先粘贴 ClipBridge 给出的配对链接。" };

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: "这个链接无法识别，请重新从 Hub 复制。" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, message: "配对链接必须以 http:// 或 https:// 开头。" };
  }
  if (url.username || url.password) {
    return { ok: false, message: "为了安全，不支持包含用户名或密码的链接。" };
  }
  if (url.hostname === currentHostname) {
    return { ok: false, message: "这是公开网页地址，不是你设备上的 Hub 配对链接。" };
  }
  if (!isPrivateHubHost(url.hostname)) {
    return { ok: false, message: "当前版本只接受局域网 Hub 地址，请勿打开陌生公网链接。" };
  }

  const pairingCode = url.searchParams.get("pair");
  if (!pairingCode) {
    return { ok: false, message: "链接中缺少一次性配对码，请在 Hub 上重新生成。" };
  }
  if (!/^\d{6}$/.test(pairingCode)) {
    return { ok: false, message: "一次性配对码格式不正确，请在 Hub 上重新生成。" };
  }

  return {
    ok: true,
    url,
    message: url.protocol === "http:"
      ? "即将进入局域网 Hub。请确认当前 Wi-Fi 值得信任。"
      : "配对链接有效，正在打开 Hub。"
  };
}

export function isPrivateHubHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".local")) return true;
  if (normalized === "::1" || normalized.startsWith("fe80:") || /^f[cd][0-9a-f]:/.test(normalized)) return true;

  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

export function detectDevice(userAgent = "", maxTouchPoints = 0) {
  if (/iPhone/i.test(userAgent)) return { name: "这台 iPhone", icon: "●" };
  if (/iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return { name: "这台 iPad", icon: "▰" };
  if (/Android/i.test(userAgent)) return { name: "这台 Android", icon: "◆" };
  if (/Windows/i.test(userAgent)) return { name: "这台 Windows 电脑", icon: "▦" };
  if (/Macintosh|Mac OS X/i.test(userAgent)) return { name: "这台 Mac", icon: "▰" };
  return { name: "此设备", icon: "●" };
}
