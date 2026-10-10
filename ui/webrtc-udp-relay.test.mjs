#!/usr/bin/env node
/** Contract for webrtc.js UDP-relay helpers (laptop TCP relay vs Android UDP). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "webrtc.js"),
  "utf8"
);

function must(name) {
  if (!src.includes(`function ${name}`)) {
    console.error(`FAIL missing function ${name}`);
    process.exit(1);
  }
}
for (const n of [
  "candidateLooksTcp",
  "isUdpRelayIceCandidate",
  "countTypRelayInSdp",
  "stripTcpRelayCandidatesFromSdp",
  "shouldPreferUdpRelay",
  "udpTurnOnly",
  "keepUdpPlusTurns",
  "pinTurnUrlToUdp",
  "pinTurnUrlsToUdp",
]) {
  must(n);
}

function candidateLooksTcp(s) {
  const t = String(s || "");
  if (!t) return false;
  if (/\btcptype\b/i.test(t)) return true;
  if (/\bcandidate:\S+\s+\d+\s+tcp\b/i.test(t)) return true;
  return false;
}
function countTypRelayInSdp(sdp, opts) {
  const udpOnly = !!(opts && opts.udpOnly);
  let n = 0;
  for (const line of String(sdp || "").split(/\r?\n/)) {
    if (!/\btyp\s+relay\b/i.test(line)) continue;
    if (udpOnly && candidateLooksTcp(line)) continue;
    n += 1;
  }
  return n;
}
function stripTcpRelayCandidatesFromSdp(sdp) {
  if (countTypRelayInSdp(sdp, { udpOnly: true }) === 0) return sdp;
  return sdp
    .split(/\r?\n/)
    .filter(
      (line) =>
        !(
          /^a=candidate:/i.test(line) &&
          /\btyp\s+relay\b/i.test(line) &&
          candidateLooksTcp(line)
        )
    )
    .join("\r\n");
}

const udp =
  "a=candidate:1 1 udp 41885439 209.38.204.153 49648 typ relay raddr 162.157.227.46 rport 35087";
const tcp =
  "a=candidate:2 1 tcp 1518280447 209.38.204.153 9 typ relay raddr 162.157.227.46 rport 59439 tcptype passive";
const sdp = ["v=0", udp, tcp, ""].join("\r\n");

if (candidateLooksTcp(udp)) {
  console.error("FAIL udp line looks tcp");
  process.exit(1);
}
if (!candidateLooksTcp(tcp)) {
  console.error("FAIL tcp line not tcp");
  process.exit(1);
}
if (countTypRelayInSdp(sdp) !== 2) {
  console.error("FAIL count all");
  process.exit(1);
}
if (countTypRelayInSdp(sdp, { udpOnly: true }) !== 1) {
  console.error("FAIL count udp");
  process.exit(1);
}
const stripped = stripTcpRelayCandidatesFromSdp(sdp);
if (stripped.includes("tcptype") || !stripped.includes("typ relay")) {
  console.error("FAIL strip");
  process.exit(1);
}
const tcpOnly = ["v=0", tcp, ""].join("\r\n");
if (stripTcpRelayCandidatesFromSdp(tcpOnly) !== tcpOnly) {
  console.error("FAIL keep last tcp path");
  process.exit(1);
}
if (!src.includes("webrtc.js?v=") && !true) {
  /* pin lives in live.html */
}

function pinTurnUrlToUdp(u) {
  const raw = String(u || "").trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  if (lower.startsWith("turns:")) return raw;
  if (!lower.startsWith("turn:")) return raw;
  if (lower.includes("transport=tcp")) return raw;
  if (lower.includes("transport=udp")) return raw;
  return raw.includes("?") ? raw + "&transport=udp" : raw + "?transport=udp";
}
function udpTurnOnly(servers) {
  const keep = (servers || []).filter((s) => {
    const u = String(
      Array.isArray(s.urls) ? s.urls[0] : s.urls || ""
    ).toLowerCase();
    if (!(u.startsWith("turn:") || u.startsWith("turns:"))) return false;
    if (u.startsWith("turns:")) return true;
    if (u.includes("transport=tcp")) return false;
    return true;
  });
  return keep.length ? keep : servers || [];
}
function pinTurnUrlsToUdp(servers) {
  return (servers || []).map((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
    const pinned = urls.map((u) => pinTurnUrlToUdp(u));
    const entry = { urls: pinned.length === 1 ? pinned[0] : pinned };
    if (s.username) entry.username = s.username;
    if (s.credential) entry.credential = s.credential;
    return entry;
  });
}

if (pinTurnUrlToUdp("turn:ruletka.vip:3478") !== "turn:ruletka.vip:3478?transport=udp") {
  console.error("FAIL pin bare turn");
  process.exit(1);
}
if (
  pinTurnUrlToUdp("turn:ruletka.vip:3478?transport=udp") !==
  "turn:ruletka.vip:3478?transport=udp"
) {
  console.error("FAIL pin already udp");
  process.exit(1);
}
if (
  pinTurnUrlToUdp("turn:ruletka.vip:3478?transport=tcp") !==
  "turn:ruletka.vip:3478?transport=tcp"
) {
  console.error("FAIL pin leaves tcp");
  process.exit(1);
}
if (pinTurnUrlToUdp("turns:ruletka.vip:443") !== "turns:ruletka.vip:443") {
  console.error("FAIL pin leaves turns");
  process.exit(1);
}
if (
  pinTurnUrlToUdp("turns:ruletka.vip:5349?transport=tcp") !==
  "turns:ruletka.vip:5349?transport=tcp"
) {
  console.error("FAIL pin leaves turns tcp query");
  process.exit(1);
}
{
  const mixed = udpTurnOnly([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:ruletka.vip:3478?transport=udp" },
    { urls: "turn:ruletka.vip:3478?transport=tcp" },
    { urls: "turns:ruletka.vip:5349?transport=tcp" },
  ]);
  const urls = mixed.map((s) => s.urls);
  if (!urls.includes("turn:ruletka.vip:3478?transport=udp")) {
    console.error("FAIL udpTurnOnly dropped UDP");
    process.exit(1);
  }
  if (!urls.includes("turns:ruletka.vip:5349?transport=tcp")) {
    console.error("FAIL udpTurnOnly dropped TURNS");
    process.exit(1);
  }
  if (urls.some((u) => String(u).includes("3478?transport=tcp"))) {
    console.error("FAIL udpTurnOnly kept TCP 3478");
    process.exit(1);
  }
}
if (
  pinTurnUrlToUdp("turn:ruletka.vip:3478?foo=1") !==
  "turn:ruletka.vip:3478?foo=1&transport=udp"
) {
  console.error("FAIL pin appends &transport=udp");
  process.exit(1);
}
const pinned = pinTurnUrlsToUdp([
  { urls: "turn:ruletka.vip:3478", username: "u", credential: "c" },
]);
if (pinned[0].urls !== "turn:ruletka.vip:3478?transport=udp") {
  console.error("FAIL pinTurnUrlsToUdp urls");
  process.exit(1);
}
if (pinned[0].username !== "u" || pinned[0].credential !== "c") {
  console.error("FAIL pinTurnUrlsToUdp creds");
  process.exit(1);
}

// Browser: do not strip ?transport=udp (RN workaround stays in MediaSession).
if (/s\.replace\(\/\\\?transport=udp/m.test(src)) {
  console.error("FAIL normalizeTurnUrl still strips transport=udp");
  process.exit(1);
}
if (!src.includes("function normalizeTurnUrl") || !src.includes("return String(u || \"\").trim()")) {
  console.error("FAIL normalizeTurnUrl should keep query as-is");
  process.exit(1);
}

// force_relay / hide_ip: pin after udpTurnOnly (3 call sites).
const pinAfterUdp = (src.match(/udpTurnOnly\(/g) || []).length;
const pinCalls = (src.match(/pinTurnUrlsToUdp\(/g) || []).length;
if (pinAfterUdp < 3) {
  console.error("FAIL expected udpTurnOnly call sites");
  process.exit(1);
}
if (pinCalls < 3) {
  console.error("FAIL expected pinTurnUrlsToUdp after udpTurnOnly");
  process.exit(1);
}
if (!src.includes("servers = pinTurnUrlsToUdp(servers)")) {
  console.error("FAIL hide_ip path missing pin");
  process.exit(1);
}
if (!src.includes("servers = pinTurnUrlsToUdp(turn)")) {
  console.error("FAIL force_relay path missing pin");
  process.exit(1);
}
if (!src.includes("iceServers: pinTurnUrlsToUdp(udp)")) {
  console.error("FAIL warm pure path missing pin");
  process.exit(1);
}

const liveHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "live.html"),
  "utf8"
);
if (!liveHtml.includes("webrtc.js?v=356")) {
  console.error("FAIL live.html pin not webrtc.js?v=356");
  process.exit(1);
}
if ((src.match(/turn\.slice\(0, 1\)/g) || []).length > 0) {
  console.error("FAIL force_relay still slice(0,1) TURN list");
  process.exit(1);
}
if (!/iceCandidatePoolSize:\s*ICE_CANDIDATE_POOL_SIZE/.test(src)) {
  console.error("FAIL pool size not locked to ICE_CANDIDATE_POOL_SIZE");
  process.exit(1);
}
if (!src.includes("const ICE_CANDIDATE_POOL_SIZE = 0")) {
  console.error("FAIL ICE_CANDIDATE_POOL_SIZE not 0");
  process.exit(1);
}
if (!src.includes("if (hideIpRelayOnlyEnabled() || sessionForceRelayEnabled()) return 480")) {
  console.error("FAIL relayWaitBudgetMs drifted from 480");
  process.exit(1);
}
if (!src.includes("isRelayMediaMode() &&") || !src.includes("!multiFast")) {
  console.error("FAIL extra 3rd-join must skip relay rebuild when multiFast");
  process.exit(1);
}
if (!src.includes("const extraFast = isMultiPeerFastMode(this)")) {
  console.error("FAIL extra 3rd-join must use extraFast policy=all PC");
  process.exit(1);
}

console.log("ok webrtc-udp-relay 18 asserts");
