import { DurableObject } from "cloudflare:workers";

const ALLOWED_ORIGINS = new Set([
  "https://junfei-z.github.io",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);
const ROOM_LIFETIME_MS = 5 * 60 * 1000;
const MAX_SIGNAL_BYTES = 64 * 1024;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://junfei-z.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function randomDigits() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0] % 1_000_000).padStart(6, "0");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return Response.json({ error: "Origin not allowed" }, { status: 403 });

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "clipbridge-signal" });
    }
    if (request.method === "POST" && url.pathname === "/rooms") {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const code = randomDigits();
        const token = crypto.randomUUID();
        const room = env.ROOMS.getByName(code);
        const result = await room.fetch(new Request("https://room/init", { method: "POST", body: token }));
        if (result.ok) return Response.json({ code, token, expiresIn: ROOM_LIFETIME_MS / 1000 }, { headers: cors(origin) });
        if (result.status !== 409) break;
      }
      return Response.json({ error: "Unable to allocate room" }, { status: 503, headers: cors(origin) });
    }

    const match = url.pathname.match(/^\/rooms\/(\d{6})\/connect$/);
    if (match && request.method === "GET") {
      return env.ROOMS.getByName(match[1]).fetch(request);
    }
    return Response.json({ error: "Not found" }, { status: 404, headers: cors(origin) });
  },
};

export class SignalRoom extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const existing = await this.ctx.storage.get("expiresAt");
      if (existing && existing > Date.now()) return new Response(null, { status: 409 });
      const token = await request.text();
      const expiresAt = Date.now() + ROOM_LIFETIME_MS;
      await this.ctx.storage.put({ token, expiresAt });
      await this.ctx.storage.setAlarm(expiresAt);
      return new Response(null, { status: 201 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const expiresAt = await this.ctx.storage.get("expiresAt");
    if (!expiresAt || expiresAt <= Date.now()) return this.reject(4004, "Room expired");

    const role = url.searchParams.get("role");
    if (role !== "creator" && role !== "joiner") return this.reject(4000, "Invalid role");
    if (role === "creator") {
      const storedToken = await this.ctx.storage.get("token");
      if (url.searchParams.get("token") !== storedToken) return this.reject(4003, "Invalid token");
    }
    const active = this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
    if (active.length >= 2 || active.some((ws) => ws.deserializeAttachment()?.role === role)) return this.reject(4009, "Room full");

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, joinedAt: Date.now() });
    const peers = [...active, server];
    if (peers.length === 2) for (const ws of peers) ws.send(JSON.stringify({ type: "peer-ready" }));
    return new Response(null, { status: 101, webSocket: client });
  }

  reject(code, reason) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.close(code, reason);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(sender, message) {
    if (typeof message !== "string" || new TextEncoder().encode(message).byteLength > MAX_SIGNAL_BYTES) {
      sender.close(1009, "Signal too large");
      return;
    }
    try {
      const data = JSON.parse(message);
      if (data.type !== "description" || !["offer", "answer"].includes(data.description?.type) || typeof data.description?.sdp !== "string") throw new Error("Invalid signal");
      for (const peer of this.ctx.getWebSockets()) if (peer !== sender && peer.readyState === WebSocket.OPEN) peer.send(message);
    } catch {
      sender.send(JSON.stringify({ type: "error", message: "无效的连接协商消息" }));
    }
  }

  webSocketClose(ws, code, reason) {
    for (const peer of this.ctx.getWebSockets()) if (peer !== ws && peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ type: "peer-left" }));
    ws.close(code, reason);
  }

  webSocketError(ws) {
    ws.close(1011, "WebSocket error");
  }

  async alarm() {
    for (const ws of this.ctx.getWebSockets()) ws.close(4004, "Room expired");
    await this.ctx.storage.deleteAll();
  }
}
