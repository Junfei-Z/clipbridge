import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { isLoopbackAddress, isPrivateAddress } from "./network.mjs";
import { clientDeviceLabelFromUserAgent, renderDashboard } from "./ui.mjs";

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
  const right = Buffer.from(expected);
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

export function createClipBridgeServer({ config, clipboard, now = () => Date.now(), instanceId = null }) {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");
    const remoteAddress = request.socket.remoteAddress ?? "";

    if (!isPrivateAddress(remoteAddress)) {
      json(response, 403, { error: "ClipBridge only accepts local-network connections." });
      return;
    }

    if (requestUrl.pathname === "/health" && request.method === "GET") {
      json(response, 200, {
        ok: true,
        device: config.deviceName,
        version: "0.1.5",
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

    if (!safeTokenEqual(bearerToken(request, requestUrl), config.token)) {
      json(response, 401, { error: "Invalid pairing token." });
      return;
    }

    try {
      if (requestUrl.pathname === "/manifest.webmanifest" && request.method === "GET") {
        const manifest = {
          name: "ClipBridge",
          short_name: "ClipBridge",
          description: "A lightweight clipboard bridge between iPhone and Windows.",
          start_url: `/ui?token=${encodeURIComponent(config.token)}`,
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
          "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY"
        });
        response.end(renderDashboard({
          deviceName: config.deviceName,
          token: config.token,
          isLocal: isLoopbackAddress(remoteAddress),
          clientDevice: clientDeviceLabelFromUserAgent(request.headers["user-agent"])
        }));
        return;
      }

      if (requestUrl.pathname === "/api/v1/clip" && request.method === "GET") {
        const text = await clipboard.readText();
        json(response, 200, {
          id: randomUUID(),
          kind: "text",
          text,
          origin: config.deviceName,
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
        json(response, 200, { ok: true, receivedAt: new Date(now()).toISOString() });
        return;
      }

      json(response, 404, { error: "Not found." });
    } catch (error) {
      json(response, error.status ?? 500, {
        error: error.status ? error.message : "Clipboard operation failed."
      });
    }
  });
}
