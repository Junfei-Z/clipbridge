import { detectDevice, validatePairingUrl } from "./pairing.js";

const $ = (selector) => document.querySelector(selector);

const device = detectDevice(navigator.userAgent, navigator.maxTouchPoints);
const deviceName = $("#device-name");
const routeDeviceName = $("#route-device-name");
const deviceIcon = $("#device-icon");
const routeDeviceIcon = $("#route-device-icon");
const pairingInput = $("#pairing-url");
const pairingMessage = $("#pairing-message");
const connectForm = $("#connect-form");
const pasteButton = $("#paste-button");
const installButton = $("#install-button");
const installDialog = $("#install-dialog");
const installSteps = $("#install-steps");
const dialogInstallButton = $("#dialog-install-button");

deviceName.textContent = device.name;
routeDeviceName.textContent = device.name;
deviceIcon.textContent = device.icon;
routeDeviceIcon.textContent = device.icon;

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.textContent = "安装到此设备";
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.textContent = "已安装";
  installButton.disabled = true;
  installDialog.close();
});

connectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = validatePairingUrl(pairingInput.value, window.location.hostname);
  pairingInput.setAttribute("aria-invalid", String(!result.ok));
  pairingMessage.textContent = result.message;

  if (!result.ok) return;

  // Top-level navigation is deliberate: the public page never fetches the
  // pairing URL, so the one-time code is not sent to GitHub Pages or persisted.
  window.location.assign(result.url.href);
});

pairingInput.addEventListener("input", () => {
  pairingInput.removeAttribute("aria-invalid");
  pairingMessage.textContent = "";
});

pasteButton.addEventListener("click", async () => {
  if (!window.isSecureContext || !navigator.clipboard?.readText) {
    pairingInput.focus();
    pairingMessage.textContent = "请长按输入框并选择“粘贴”。";
    return;
  }

  try {
    pairingInput.value = await navigator.clipboard.readText();
    pairingInput.dispatchEvent(new Event("input"));
    pairingInput.focus();
  } catch {
    pairingInput.focus();
    pairingMessage.textContent = "浏览器没有允许读取剪贴板，请手动粘贴。";
  }
});

installButton.addEventListener("click", openInstallDialog);
$(".close-button").addEventListener("click", () => installDialog.close());
installDialog.addEventListener("click", (event) => {
  if (event.target === installDialog) installDialog.close();
});

dialogInstallButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installDialog.close();
});

const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
if ("serviceWorker" in navigator && !isLocalPreview) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}

function openInstallDialog() {
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  installSteps.replaceChildren();
  dialogInstallButton.hidden = true;

  const steps = isStandalone
    ? ["ClipBridge 已经以应用模式运行，无需再次安装。"]
    : isiOS
      ? ["点击 Safari 底部的“分享”按钮。", "向下滑动并选择“添加到主屏幕”。", "确认名称和图标后点击“添加”。"]
      : deferredInstallPrompt
        ? ["点击下面的“安装应用”。", "在浏览器确认窗口中选择安装。", "以后可直接从桌面或应用列表打开。"]
        : ["打开浏览器菜单。", "选择“安装 ClipBridge”或“添加到主屏幕”。", "确认后即可从桌面直接打开。"];

  for (const text of steps) {
    const item = document.createElement("li");
    item.textContent = text;
    installSteps.append(item);
  }
  dialogInstallButton.hidden = !deferredInstallPrompt || isStandalone;
  installDialog.showModal();
}
