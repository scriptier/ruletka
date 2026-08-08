#!/usr/bin/env node
/**
 * Minimal LiveKit access-token HTTP server (localhost).
 * GET /token?room=SESSION&identity=USER&name=NAME
 * GET /health
 *
 * Env: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL, PORT (default 17883)
 *
 * Uses Web Crypto HMAC — no npm deps (works on bare node 18+).
 */
import http from "node:http";
import { createHmac } from "node:crypto";
import { URL } from "node:url";

const KEY = process.env.LIVEKIT_API_KEY || "";
const SECRET = process.env.LIVEKIT_API_SECRET || "";
const LK_URL = process.env.LIVEKIT_URL || "wss://ruletka.vip:7880";
const PORT = Number(process.env.PORT || process.env.LIVEKIT_TOKEN_PORT || 17883);

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

/** LiveKit access token (JWT) — video grant for room join/publish/subscribe */
function mintToken({ identity, name, room }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const video = {
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  };
  const payload = {
    iss: KEY,
    sub: identity,
    name: name || identity,
    nbf: now - 10,
    exp: now + 60 * 60 * 6,
    video,
  };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const data = `${h}.${p}`;
  const sig = createHmac("sha256", SECRET).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(s),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(s);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }
  const u = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (u.pathname === "/health") {
    json(res, 200, {
      ok: true,
      service: "livekit-token",
      has_keys: !!(KEY && SECRET),
      livekit_url: LK_URL,
    });
    return;
  }
  if (u.pathname === "/token" || u.pathname === "/v1/livekit/token") {
    if (!KEY || !SECRET) {
      json(res, 503, { ok: false, error: "LIVEKIT keys not configured" });
      return;
    }
    const room = (u.searchParams.get("room") || "").trim();
    const identity = (u.searchParams.get("identity") || "").trim();
    const name = (u.searchParams.get("name") || identity).trim();
    if (!room || !identity) {
      json(res, 400, { ok: false, error: "room and identity required" });
      return;
    }
    // Sanitize room/identity (LiveKit limits)
    const roomSafe = room.replace(/[^a-zA-Z0-9_\-.:]/g, "").slice(0, 128);
    const idSafe = identity.replace(/[^a-zA-Z0-9_\-.:]/g, "").slice(0, 128);
    try {
      const token = mintToken({ identity: idSafe, name, room: roomSafe });
      json(res, 200, {
        ok: true,
        token,
        url: LK_URL,
        room: roomSafe,
        identity: idSafe,
      });
    } catch (e) {
      json(res, 500, { ok: false, error: String(e?.message || e) });
    }
    return;
  }
  json(res, 404, { ok: false, error: "not found" });
});

if (!KEY || !SECRET) {
  console.warn("[livekit-token] WARNING: LIVEKIT_API_KEY/SECRET empty");
}
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[livekit-token] http://127.0.0.1:${PORT}  url=${LK_URL}`);
});
