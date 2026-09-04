import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { DeviceRegistry, normalizeDeviceName, normalizeDeviceType } from "./devices.mjs";
import { FileTransferStore, MAX_FILE_TARGETS, filePresentation } from "./files.mjs";
import { HistoryStore } from "./history.mjs";
import { applyHandoff, createHandoff, inspectHandoff, listHandoffs } from "./handoff.mjs";
import { isRelayTargetId, managementSession, relayNodeIdentity } from "./identity.mjs";
import { InboxStore } from "./inbox.mjs";
import { isLoopbackAddress, isPrivateAddress } from "./network.mjs";
import { PairingManager } from "./pairing.mjs";
import { createQrSvg } from "./qr.mjs";
import { clientDeviceFromUserAgent, renderDashboard } from "./ui.mjs";

const APP_VERSION = "0.7.2";
const JSON_TYPE = "application/json; charset=utf-8";
const STATIC_ASSETS = new Map([
  ["/favicon.ico", { source: new URL("../assets/favicon.ico", import.meta.url), type: "image/x-icon" }],
  ["/favicon-16.png", { source: new URL("../assets/favicon-16.png", import.meta.url), type: "image/png" }],
  ["/favicon-32.png", { source: new URL("../assets/favicon-32.png", import.meta.url), type: "image/png" }],
  ["/brand-icon-96.png", { source: new URL("../assets/brand-icon-96.png", import.meta.url), type: "image/png" }],
  ["/brand-icon-192.png", { source: new URL("../assets/brand-icon-192.png", import.meta.url), type: "image/png" }],
  ["/apple-touch-icon.png", { source: new URL("../assets/apple-touch-icon.png", import.meta.url), type: "image/png" }],
  ["/icons/icon-192.png", { source: new URL("../assets/icon-192.png", import.meta.url), type: "image/png" }],
  ["/icons/icon-512.png", { source: new URL("../assets/icon-512.png", import.meta.url), type: "image/png" }]
]);

function json(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": JSON_TYPE,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

function safeTokenEqual(actual, expected) {
  const left = Buffer.from(actual ?? "");
  const right = Buffer.from(expected ?? "");
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearerToken(request, url) {
  const authorization = request.headers.authorization ?? "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  return url.searchParams.get("token") ?? "";
}

async function readJson(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

function pairingUrls(addresses, port, code) {
  if (!Number.isInteger(port)) return [];
  return addresses.map((address) => `http://${address}:${port}/ui?pair=${encodeURIComponent(code)}`);
}

function localIdentity(config) {
  return relayNodeIdentity(config);
}

function legacyIdentity(clientDevice) {
  return { id: "legacy-token", name: clientDevice.label, type: clientDevice.type, kind: "legacy" };
}

function transferEndpoint(identity) {
  return { id: identity.id, name: identity.name, type: identity.type };
}

function normalizeTargetIds(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  if (values.length < 1 || values.length > MAX_FILE_TARGETS || values.some((id) => typeof id !== "string" || !id || id.length > 128)) {
    return null;
  }
  return [...new Set(values)];
}

function resolveTargets(targetIds, { config, devices, identity }) {
  const targets = targetIds.map((targetId) => isRelayTargetId(targetId, config)
    ? transferEndpoint(localIdentity(config))
    : devices.get(targetId));
  if (targets.some((target) => !target || target.id === identity.id)) return null;
  return [...new Map(targets.map((target) => [target.id, transferEndpoint(target)])).values()];
}

function contentDisposition(name, disposition = "attachment") {
  const fallback = name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/["\\]/g, "_").slice(0, 120) || "download";
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function createClipBridgeServer({
  config,
  clipboard,
  now = () => Date.now(),
  instanceId = null,
  devices = new DeviceRegistry({ now }),
  history = new HistoryStore({ now }),
  inbox = new InboxStore({ now }),
  files = new FileTransferStore({
    stateDir: config.stateDir ?? path.join(process.cwd(), ".clipbridge"),
    maxFileBytes: config.maxFileBytes ?? 256 * 1024 * 1024,
    maxTotalBytes: config.maxFileTotalBytes ?? 1024 * 1024 * 1024,
    ttlMs: config.fileTtlMs ?? 24 * 60 * 60 * 1000,
    now
  }),
  pairing = new PairingManager({ now }),
  pairingAddresses = [],
  isLocalRequest = (address) => isLoopbackAddress(address)
}) {
  const downloadTickets = new Map();
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");
    const remoteAddress = request.socket.remoteAddress ?? "";
    const isLocal = isLocalRequest(remoteAddress, request);
    const clientDevice = clientDeviceFromUserAgent(request.headers["user-agent"]);

    if (!isPrivateAddress(remoteAddress)) {
      json(response, 403, { error: "ClipBridge only accepts local-network connections." });
      return;
    }

    if (requestUrl.pathname === "/health" && request.method === "GET") {
      const relayNode = localIdentity(config);
      json(response, 200, {
        ok: true,
        device: relayNode.name,
        version: APP_VERSION,
        relayNode,
        urls: pairingAddresses.map((address) => `http://${address}:${config.port}/ui`),
        ...(instanceId ? { instanceId } : {})
      });
      return;
    }

    const staticAsset = STATIC_ASSETS.get(requestUrl.pathname);
    if (staticAsset && request.method === "GET") {
      try {
        const content = await readFile(staticAsset.source);
        response.writeHead(200, {
          "Content-Type": staticAsset.type,
          "Content-Length": content.length,
          "Cache-Control": "public, max-age=86400",
          "X-Content-Type-Options": "nosniff"
        });
        response.end(content);
      } catch {
        json(response, 404, { error: "Icon asset not found." });
      }
      return;
    }

    if (requestUrl.pathname === "/" && request.method === "GET") {
      response.writeHead(302, { Location: "/ui", "Cache-Control": "no-store" });
      response.end();
      return;
    }

    if (requestUrl.pathname === "/manifest.webmanifest" && request.method === "GET") {
      const manifest = {
        name: "ClipBridge",
        short_name: "ClipBridge",
        description: "A lightweight local text and file bridge for your devices.",
        start_url: "/ui",
        scope: "/",
        display: "standalone",
        background_color: "#f3f0ff",
        theme_color: "#6636f4",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      };
      response.writeHead(200, {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(JSON.stringify(manifest));
      return;
    }

    if (requestUrl.pathname === "/ui" && request.method === "GET") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
      });
      response.end(renderDashboard({
        deviceName: config.deviceName,
        relayNode: localIdentity(config),
        isLocal,
        clientDevice,
        maxFileBytes: config.maxFileBytes,
        legacyToken: requestUrl.searchParams.get("token") ?? "",
        pairingCode: requestUrl.searchParams.get("pair") ?? ""
      }));
      return;
    }

    const downloadRoute = requestUrl.pathname.match(/^\/api\/v1\/file-downloads\/([^/]+)$/);
    if (downloadRoute && request.method === "GET") {
      const ticketId = decodeURIComponent(downloadRoute[1]);
      const ticket = downloadTickets.get(ticketId);
      downloadTickets.delete(ticketId);
      if (!ticket || ticket.expiresAt <= now()) {
        json(response, 404, { error: "下载链接已失效，请重新点击下载。" });
        return;
      }
      let entry = files.get(ticket.entryId, ticket.targetId);
      if (!entry) {
        json(response, 404, { error: "文件不存在或已经过期。" });
        return;
      }
      try {
        entry = await files.markDownloaded(entry.id, ticket.targetId);
      } catch {
        json(response, 500, { error: "无法更新文件投递状态，请重试。" });
        return;
      }
      if (!entry) {
        json(response, 404, { error: "文件不存在或已经过期。" });
        return;
      }
      const presentation = filePresentation(entry.name);
      const inline = ticket.inline && presentation.previewKind;
      response.writeHead(200, {
        "Content-Type": inline ? presentation.contentType : "application/octet-stream",
        "Content-Length": entry.bytes,
        "Content-Disposition": contentDisposition(entry.name, inline ? "inline" : "attachment"),
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
      });
      const stream = files.createReadStream(entry.blobId);
      stream.on("error", () => response.destroy());
      stream.pipe(response);
      return;
    }

    try {
      if (requestUrl.pathname === "/api/v1/pair" && request.method === "POST") {
        const body = await readJson(request, 4096);
        const name = normalizeDeviceName(body?.name);
        const type = normalizeDeviceType(body?.type);
        pairing.consume(body?.code, remoteAddress);
        const registered = await devices.register({ name, type });
        json(response, 201, {
          token: registered.token,
          device: registered.device,
          computer: localIdentity(config),
          relayNode: localIdentity(config)
        });
        return;
      }

      const presentedToken = bearerToken(request, requestUrl);
      let identity = null;
      if (isLocal) identity = localIdentity(config);
      else if (safeTokenEqual(presentedToken, config.token)) identity = legacyIdentity(clientDevice);
      else {
        const pairedDevice = await devices.authenticate(presentedToken);
        if (pairedDevice) identity = { ...pairedDevice, kind: "paired" };
      }

      if (!identity) {
        json(response, 401, { error: "此设备尚未与 ClipBridge 配对。", code: "PAIRING_REQUIRED" });
        return;
      }

      if (requestUrl.pathname === "/api/v1/session" && request.method === "GET") {
        const relayNode = localIdentity(config);
        json(response, 200, {
          device: identity,
          computer: relayNode,
          relayNode,
          session: managementSession(identity, { isLocal, legacy: identity.kind === "legacy" }),
          legacy: identity.kind === "legacy"
        });
        return;
      }

      if (requestUrl.pathname === "/api/v1/node" && request.method === "GET") {
        json(response, 200, {
          relayNode: localIdentity(config),
          session: managementSession(identity, { isLocal, legacy: identity.kind === "legacy" }),
          urls: pairingAddresses.map((address) => `http://${address}:${config.port}/ui`)
        });
        return;
      }

      if (requestUrl.pathname === "/api/v1/session" && request.method === "DELETE") {
        if (identity.kind !== "paired") {
          json(response, 400, { error: "旧版共享链接不能在此处单独撤销。" });
          return;
        }
        await devices.revoke(identity.id);
        await inbox.clear(identity.id);
        await files.removeForDevice(identity.id);
        json(response, 200, { ok: true });
        return;
      }

      if (requestUrl.pathname === "/api/v1/handoffs" && request.method === "GET") {
        if (!isLocal) {
          json(response, 403, { error: "Agent Handoff 只能在安装了 Git 和 Node.js 的中转电脑上使用。" });
          return;
        }
        const repository = requestUrl.searchParams.get("repository") || process.cwd();
        const fetchRemote = requestUrl.searchParams.get("fetch") === "1";
        const handoffs = await listHandoffs({ cwd: repository, fetch: fetchRemote });
        json(response, 200, { repository, handoffs });
        return;
      }

      if (requestUrl.pathname === "/api/v1/handoffs" && request.method === "POST") {
        if (!isLocal) {
          json(response, 403, { error: "Agent Handoff 只能在安装了 Git 和 Node.js 的中转电脑上使用。" });
          return;
        }
        const body = await readJson(request, 256 * 1024);
        const result = await createHandoff({
          cwd: body.repository || process.cwd(),
          goal: body.goal,
          summary: body.summary,
          next: body.next,
          push: body.push !== false
        });
        json(response, 201, result);
        return;
      }

      const handoffRoute = requestUrl.pathname.match(/^\/api\/v1\/handoffs\/([^/]+)$/);
      if (handoffRoute && request.method === "GET") {
        if (!isLocal) {
          json(response, 403, { error: "Agent Handoff 只能在中转电脑上查看和接手。" });
          return;
        }
        const repository = requestUrl.searchParams.get("repository") || process.cwd();
        const result = await inspectHandoff(decodeURIComponent(handoffRoute[1]), { cwd: repository });
        json(response, 200, result);
        return;
      }

      const handoffApplyRoute = requestUrl.pathname.match(/^\/api\/v1\/handoffs\/([^/]+)\/apply$/);
      if (handoffApplyRoute && request.method === "POST") {
        if (!isLocal) {
          json(response, 403, { error: "Agent Handoff 只能在中转电脑上应用。" });
          return;
        }
        const body = await readJson(request, 64 * 1024);
        const result = await applyHandoff(decodeURIComponent(handoffApplyRoute[1]), { cwd: body.repository || process.cwd() });
        json(response, 200, result);
        return;
      }

      if (requestUrl.pathname === "/api/v1/pairing/sessions" && request.method === "POST") {
        if (!isLocal) {
          json(response, 403, { error: "只能在中转节点本机创建配对。" });
          return;
        }
        const session = pairing.create();
        const urls = pairingUrls(pairingAddresses, config.port, session.code);
        const options = urls.map((url) => ({ url, qrSvg: createQrSvg(url) }));
        json(response, 201, {
          ...session,
          urls,
          qrSvg: options[0]?.qrSvg ?? null,
          options
        });
        return;
      }

      if (requestUrl.pathname === "/api/v1/devices" && request.method === "GET") {
        if (!isLocal) {
          json(response, 403, { error: "只能在中转节点本机管理设备。" });
          return;
        }
        json(response, 200, { devices: devices.list() });
        return;
      }

      const deviceRoute = requestUrl.pathname.match(/^\/api\/v1\/devices\/([^/]+)$/);
      if (deviceRoute && request.method === "DELETE") {
        if (!isLocal) {
          json(response, 403, { error: "只能在中转节点本机管理设备。" });
          return;
        }
        const removed = await devices.revoke(decodeURIComponent(deviceRoute[1]));
        if (!removed) {
          json(response, 404, { error: "没有找到这台设备。" });
          return;
        }
        await inbox.clear(decodeURIComponent(deviceRoute[1]));
        await files.removeForDevice(decodeURIComponent(deviceRoute[1]));
        json(response, 200, { ok: true });
        return;
      }

      if (requestUrl.pathname === "/api/v1/history" && request.method === "GET") {
        const requestedLimit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
        json(response, 200, {
          entries: history.list({
            deviceId: isLocal ? null : identity.id,
            limit: Number.isFinite(requestedLimit) ? requestedLimit : 50
          }),
          scope: isLocal ? "all" : "device"
        });
        return;
      }

      if (requestUrl.pathname === "/api/v1/history" && request.method === "DELETE") {
        const removed = await history.clear({ deviceId: isLocal ? null : identity.id });
        json(response, 200, { ok: true, removed });
        return;
      }

      const historyRoute = requestUrl.pathname.match(/^\/api\/v1\/history\/([^/]+)$/);
      if (historyRoute && request.method === "DELETE") {
        const removed = await history.remove(decodeURIComponent(historyRoute[1]), {
          deviceId: isLocal ? null : identity.id
        });
        if (!removed) {
          json(response, 404, { error: "没有找到这条历史记录。" });
          return;
        }
        json(response, 200, { ok: true });
        return;
      }

      if (requestUrl.pathname === "/api/v1/peers" && request.method === "GET") {
        if (!isLocal && identity.kind !== "paired") {
          json(response, 403, { error: "多设备传输需要使用 v0.2 设备配对。", code: "SECURE_PAIRING_REQUIRED" });
          return;
        }
        const peers = [transferEndpoint(localIdentity(config)), ...devices.list().map(transferEndpoint)];
        json(response, 200, {
          self: transferEndpoint(identity),
          targets: peers.filter((peer) => peer.id !== identity.id)
        });
        return;
      }

      if (requestUrl.pathname === "/api/v1/transfers" && request.method === "POST") {
        if (!isLocal && identity.kind !== "paired") {
          json(response, 403, { error: "多设备传输需要使用 v0.2 设备配对。", code: "SECURE_PAIRING_REQUIRED" });
          return;
        }
        const body = await readJson(request, config.maxTextBytes + 16_384);
        const targetIds = normalizeTargetIds(Array.isArray(body?.targetIds) ? body.targetIds : body?.targetId);
        if (body?.kind !== "text" || typeof body.text !== "string" || !targetIds) {
          json(response, 400, { error: "Expected { kind: 'text', text: string, targetIds: string[] }." });
          return;
        }
        if (Buffer.byteLength(body.text, "utf8") > config.maxTextBytes) {
          json(response, 413, { error: `Text exceeds ${config.maxTextBytes} bytes.` });
          return;
        }
        const targets = resolveTargets(targetIds, { config, devices, identity });
        if (!targets) {
          json(response, 404, { error: "没有找到可接收的目标设备。" });
          return;
        }
        const source = transferEndpoint(identity);
        const deliveries = [];
        for (const target of targets) {
          if (target.id === localIdentity(config).id) {
            await clipboard.writeText(body.text);
            const transfer = await history.add({ text: body.text, source, target });
            deliveries.push({ target, status: "delivered", delivery: "clipboard", transfer });
          } else {
            const transfer = await inbox.deliver({ text: body.text, source, target });
            await history.add({ text: body.text, source, target });
            deliveries.push({ target, status: "queued", delivery: "inbox", transfer });
          }
        }
        json(response, 201, {
          batchId: randomUUID(),
          deliveries,
          transfer: deliveries[0].transfer,
          delivery: deliveries[0].delivery
        });
        return;
      }

      if (requestUrl.pathname === "/api/v1/file-transfers" && request.method === "POST") {
        if (!isLocal && identity.kind !== "paired") {
          json(response, 403, { error: "文件传输需要使用安全设备配对。", code: "SECURE_PAIRING_REQUIRED" });
          return;
        }
        const requestedTargetIds = requestUrl.searchParams.getAll("targetId");
        if (!requestedTargetIds.length && requestUrl.searchParams.has("targetIds")) {
          requestedTargetIds.push(...requestUrl.searchParams.get("targetIds").split(","));
        }
        const targetIds = normalizeTargetIds(requestedTargetIds);
        const name = requestUrl.searchParams.get("name") ?? "";
        if (!targetIds) {
          json(response, 400, { error: "请至少选择一台接收设备。" });
          return;
        }
        const targets = resolveTargets(targetIds, { config, devices, identity });
        if (!targets) {
          json(response, 404, { error: "没有找到可接收的目标设备。" });
          return;
        }
        const contentLengthHeader = request.headers["content-length"];
        const declaredBytes = contentLengthHeader === undefined ? null : Number(contentLengthHeader);
        const batch = await files.receive({
          stream: request,
          name,
          mimeType: request.headers["content-type"] ?? "",
          declaredBytes,
          source: transferEndpoint(identity),
          targets
        });
        const deliveries = batch.deliveries.map((transfer) => ({
          target: transfer.target,
          status: transfer.status,
          delivery: "file-inbox",
          transfer
        }));
        json(response, 201, {
          blobId: batch.blobId,
          deliveries,
          transfer: deliveries[0].transfer,
          delivery: deliveries[0].delivery
        });
        return;
      }

      if (requestUrl.pathname === "/api/v1/file-outbox" && request.method === "GET") {
        if (!isLocal && identity.kind !== "paired") {
          json(response, 403, { error: "只有已安全配对的设备才可以查看文件投递状态。" });
          return;
        }
        await files.cleanupExpired();
        json(response, 200, { transfers: files.listBySource(identity.id) });
        return;
      }

      if (requestUrl.pathname === "/api/v1/file-inbox" && request.method === "GET") {
        if (!isLocal && identity.kind !== "paired") {
          json(response, 403, { error: "只有已安全配对的设备才有文件收件箱。" });
          return;
        }
        await files.cleanupExpired();
        json(response, 200, { transfers: files.list(identity.id) });
        return;
      }

      if (requestUrl.pathname === "/api/v1/file-inbox" && request.method === "DELETE") {
        if (!isLocal && identity.kind !== "paired") {
          json(response, 403, { error: "只有已安全配对的设备才有文件收件箱。" });
          return;
        }
        const removed = await files.clear(identity.id);
        json(response, 200, { ok: true, removed });
        return;
      }

      const fileRoute = requestUrl.pathname.match(/^\/api\/v1\/file-transfers\/([^/]+)$/);
      if (fileRoute && request.method === "DELETE") {
        if (!isLocal && identity.kind !== "paired") {
          json(response, 403, { error: "只有已安全配对的设备才可以删除文件。" });
          return;
        }
        const removed = await files.remove(decodeURIComponent(fileRoute[1]), identity.id);
        if (!removed) {
          json(response, 404, { error: "没有找到这个文件。" });
          return;
        }
        json(response, 200, { ok: true });
        return;
      }

      const fileDownloadRoute = requestUrl.pathname.match(/^\/api\/v1\/file-transfers\/([^/]+)\/download$/);
      if (fileDownloadRoute && request.method === "POST") {
        if (!isLocal && identity.kind !== "paired") {
          json(response, 403, { error: "只有已安全配对的设备才可以下载文件。" });
          return;
        }
        const entry = files.get(decodeURIComponent(fileDownloadRoute[1]), identity.id);
        if (!entry) {
          json(response, 404, { error: "文件不存在或已经过期。" });
          return;
        }
        const ticket = randomUUID();
        for (const [id, issued] of downloadTickets) {
          if (issued.expiresAt <= now()) downloadTickets.delete(id);
        }
        while (downloadTickets.size >= 1000) downloadTickets.delete(downloadTickets.keys().next().value);
        downloadTickets.set(ticket, {
          entryId: entry.id,
          targetId: identity.id,
          inline: requestUrl.searchParams.get("inline") === "1",
          expiresAt: now() + 60_000
        });
        json(response, 201, { url: `/api/v1/file-downloads/${ticket}`, expiresIn: 60 });
        return;
      }

      if (requestUrl.pathname === "/api/v1/inbox" && request.method === "GET") {
        if (identity.kind !== "paired") {
          json(response, 403, { error: "只有已安全配对的设备才有收件箱。" });
          return;
        }
        json(response, 200, { transfers: inbox.list(identity.id) });
        return;
      }

      if (requestUrl.pathname === "/api/v1/inbox" && request.method === "DELETE") {
        if (identity.kind !== "paired") {
          json(response, 403, { error: "只有已安全配对的设备才有收件箱。" });
          return;
        }
        const removed = await inbox.clear(identity.id);
        json(response, 200, { ok: true, removed });
        return;
      }

      const inboxRoute = requestUrl.pathname.match(/^\/api\/v1\/inbox\/([^/]+)$/);
      if (inboxRoute && request.method === "DELETE") {
        if (identity.kind !== "paired") {
          json(response, 403, { error: "只有已安全配对的设备才有收件箱。" });
          return;
        }
        const transfer = await inbox.consume(decodeURIComponent(inboxRoute[1]), identity.id);
        if (!transfer) {
          json(response, 404, { error: "没有找到这条待接收内容。" });
          return;
        }
        json(response, 200, { ok: true, transfer });
        return;
      }

      if (requestUrl.pathname === "/api/v1/clip" && request.method === "GET") {
        const text = await clipboard.readText();
        if (!isLocal) {
          await history.add({
            text,
            source: transferEndpoint(localIdentity(config)),
            target: transferEndpoint(identity)
          });
        }
        json(response, 200, {
          id: randomUUID(),
          kind: "text",
          text,
          origin: localIdentity(config).name,
          createdAt: new Date(now()).toISOString()
        });
        return;
      }

      if (requestUrl.pathname === "/api/v1/clip" && request.method === "POST") {
        const body = await readJson(request, config.maxTextBytes + 4096);
        if (body?.kind !== "text" || typeof body.text !== "string") {
          json(response, 400, { error: "Expected { kind: 'text', text: string }." });
          return;
        }
        if (Buffer.byteLength(body.text, "utf8") > config.maxTextBytes) {
          json(response, 413, { error: `Text exceeds ${config.maxTextBytes} bytes.` });
          return;
        }
        await clipboard.writeText(body.text);
        if (!isLocal) {
          await history.add({
            text: body.text,
            source: transferEndpoint(identity),
            target: transferEndpoint(localIdentity(config))
          });
        }
        json(response, 200, {
          ok: true,
          source: { id: identity.id, name: identity.name, type: identity.type },
          receivedAt: new Date(now()).toISOString()
        });
        return;
      }

      json(response, 404, { error: "Not found." });
    } catch (error) {
      if (!error.status) {
        console.error(`Request failed for ${request.method} ${requestUrl.pathname}:`, error);
      }
      json(response, error.status ?? 500, {
        error: error.status ? error.message : isLocal && requestUrl.pathname.startsWith("/api/v1/handoffs")
          ? error.message
          : "Clipboard operation failed."
      });
    }
  });
}
