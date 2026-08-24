/**
 * WebRTC media helper for ruletka.vip / freenet-roulette.
 * Local preview can run before match; signaling only after matched.
 * ICE servers load from bridge GET /config.json (STUN/TURN).
 *
 * Quality notes:
 * - Prefer higher capture on desktop (720p ideal) with graceful fallbacks.
 * - Prefer modern codecs when the browser allows (VP9 / H264 / AV1 / Opus).
 * - Cap outbound bitrate and adapt from getStats (loss / RTT).
 * - Prefer direct P2P; self-hosted TURN is fallback via /config.json.
 */

/** Pre-gather candidates before createOffer.
 * LOCK 2026-08-10: ALWAYS 0. Pool≥2 caused ALLOCATE storms + 437
 * mismatched-allocation + peer_usage≈0 (offer/answer OK, cams black forever).
 */
const ICE_CANDIDATE_POOL_SIZE = 0;
/** Pure relay (force_relay / Hide IP): never pre-pool TURN. */
const ICE_RELAY_POOL_SIZE = 0;

const DEFAULT_ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  // Gather candidates early so first match connects faster
  iceCandidatePoolSize: ICE_CANDIDATE_POOL_SIZE,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

/** @type {RTCConfiguration} */
let iceConfig = {
  ...DEFAULT_ICE,
  iceServers: [...DEFAULT_ICE.iceServers],
};

/**
 * Trim ice URL. Do not strip ?transport=udp — that is an RN workaround
 * (MediaSession.ts). Chrome on a bare turn:host:3478 ALLOCATEs UDP+TCP;
 * TCP relay cannot pair with Android's UDP-only gather under force_relay.
 * @param {string} u
 * @returns {string}
 */
function normalizeTurnUrl(u) {
  return String(u || "").trim();
}

/**
 * Normalize bridge /config.json ice_servers into RTCConfiguration.iceServers.
 * One URL per entry (RN + Chromium both happier; multi-url delayed ALLOCATE).
 * @param {unknown} servers
 * @returns {RTCIceServer[]}
 */
function normalizeIceServers(servers) {
  if (!Array.isArray(servers) || !servers.length) return DEFAULT_ICE.iceServers;
  /** @type {RTCIceServer[]} */
  const out = [];
  for (const s of servers) {
    const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
    for (const u of urls) {
      const nu = normalizeTurnUrl(String(u || ""));
      if (!nu) continue;
      /** @type {RTCIceServer} */
      const entry = { urls: nu };
      if (s.username) entry.username = s.username;
      if (s.credential) entry.credential = s.credential;
      out.push(entry);
    }
  }
  return out.length ? out : DEFAULT_ICE.iceServers;
}

/** @type {ReturnType<typeof setInterval> | 0} */
let iceRefreshTimer = 0;
/** @type {object | null} */
let lastIceMeta = null;

/**
 * Session-only force-relay (VPN / hard NAT recovery).
 * Not persisted — survives until reload or Prefer Direct is turned on.
 * Differs from hideIpRelayOnly (user privacy pref) but uses the same ICE path.
 */
let sessionForceRelay = false;

/** @returns {boolean} */
function sessionForceRelayEnabled() {
  return !!sessionForceRelay;
}

/**
 * Force TURN relay for the rest of this browser session (VPN-friendly recovery).
 * @param {boolean} on
 * @returns {RTCConfiguration}
 */
function setSessionForceRelay(on) {
  const next = !!on;
  const was = sessionForceRelay;
  sessionForceRelay = next;
  if (sessionForceRelay) {
    // Prefer Direct is incompatible with relay recovery
    try {
      const raw = JSON.parse(
        localStorage.getItem("freenet-roulette-media-prefs-v1") || "{}"
      );
      if (raw.preferDirectOnly) {
        raw.preferDirectOnly = false;
        localStorage.setItem(
          "freenet-roulette-media-prefs-v1",
          JSON.stringify(raw)
        );
      }
    } catch (_) {}
  }
  applyIceDirectPreference();
  // force_relay = pure iceTransportPolicy=relay (hide_ip / untrusted / same public IP).
  // pool=0 — never pre-ALLOCATE pool (437 storms).
  if (was !== next && typeof warmIcePool === "function") {
    try {
      const want = next ? "relay" : "all";
      if (typeof warmPcPolicy === "function" && warmPcPolicy() === want) {
        console.info(
          "[webrtc] force_relay keep warm policy=" + want + (next ? " pure" : "")
        );
      } else {
        clearIceWarm();
        // preferRelay only when arming pure; do not warm empty pool
        warmIcePool({ force: true, preferRelay: !!next });
      }
    } catch (_) {}
  }
  return iceConfig;
}

/** Raw servers from last config.json (before prefer-direct filter). */
let lastRawIceServers = DEFAULT_ICE.iceServers;

/**
 * Prefer direct P2P: drop TURN/TURNS URLs (STUN only). Harder NATs may fail.
 * @returns {boolean}
 */
function preferDirectOnlyEnabled() {
  try {
    const p = JSON.parse(
      localStorage.getItem("freenet-roulette-media-prefs-v1") || "{}"
    );
    return !!p.preferDirectOnly;
  } catch {
    return false;
  }
}

/**
 * Hide IP from partner: force TURN relay only (no host/srflx path to peer).
 * Mutually exclusive with Prefer Direct. Requires TURN on the hub.
 * @returns {boolean}
 */
function hideIpRelayOnlyEnabled() {
  try {
    const p = JSON.parse(
      localStorage.getItem("freenet-roulette-media-prefs-v1") || "{}"
    );
    return !!p.hideIpRelayOnly;
  } catch {
    return false;
  }
}

/**
 * Keep only STUN (or only TURN) URL entries from iceServers list.
 * @param {RTCIceServer[]} raw
 * @param {"stun"|"turn"} mode
 * @returns {RTCIceServer[]}
 */
function filterIceServersByMode(raw, mode) {
  return (raw || [])
    .map((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
      const kept = urls.filter((u) => {
        const x = String(u).toLowerCase();
        if (mode === "turn") {
          return x.startsWith("turn:") || x.startsWith("turns:");
        }
        return x.startsWith("stun:") || (!x.startsWith("turn:") && !x.startsWith("turns:"));
      });
      if (!kept.length) return null;
      const entry = { urls: kept.length === 1 ? kept[0] : kept };
      if (s.username) entry.username = s.username;
      if (s.credential) entry.credential = s.credential;
      return entry;
    })
    .filter(Boolean);
}

/**
 * True when candidate string is a TURN relay (typ relay).
 * Used to drop host/srflx under force-relay so coturn never gets CREATE_PERMISSION
 * for private/link-local peers (403 Forbidden IP → black video).
 * @param {RTCIceCandidateInit | RTCIceCandidate | string | null | undefined} c
 * @returns {boolean}
 */
function isRelayIceCandidate(c) {
  if (c == null) return false;
  if (typeof c === "string") {
    return /\btyp\s+relay\b/i.test(c) || / typ relay /i.test(c);
  }
  const typ = String(
    /** @type {{ type?: string, candidateType?: string }} */ (c).type ||
      /** @type {{ candidateType?: string }} */ (c).candidateType ||
      ""
  ).toLowerCase();
  if (typ === "relay") return true;
  const s = String(
    /** @type {{ candidate?: string }} */ (c).candidate ||
      /** @type {{ toJSON?: () => { candidate?: string } }} */ (c).toJSON?.()
        ?.candidate ||
      ""
  );
  if (!s) return false;
  // SDP a=candidate:… typ relay …
  return /\btyp\s+relay\b/i.test(s) || / typ relay /i.test(s);
}

/**
 * ICE candidate text (SDP line or RTCIceCandidate.candidate).
 * @param {RTCIceCandidateInit | RTCIceCandidate | string | null | undefined} c
 * @returns {string}
 */
function iceCandidateText(c) {
  if (c == null) return "";
  if (typeof c === "string") return c;
  return String(
    /** @type {{ candidate?: string }} */ (c).candidate ||
      /** @type {{ toJSON?: () => { candidate?: string } }} */ (c).toJSON?.()
        ?.candidate ||
      ""
  );
}

/**
 * TCP TURN relay (Chrome gathers these on bare `turn:host:3478`).
 * Phone is UDP-only under force_relay — TCP↔UDP relay pairs never connect.
 * @param {string} s
 * @returns {boolean}
 */
function candidateLooksTcp(s) {
  const t = String(s || "");
  if (!t) return false;
  if (/\btcptype\b/i.test(t)) return true;
  if (/\bcandidate:\S+\s+\d+\s+tcp\b/i.test(t)) return true;
  return false;
}

/**
 * UDP typ relay only. Under force_relay, first *any* relay used to be TCP
 * (`20260816T061315Z` laptop ALLOCATE tcp, phone ICE failed 0/0).
 * @param {RTCIceCandidateInit | RTCIceCandidate | string | null | undefined} c
 * @returns {boolean}
 */
function isUdpRelayIceCandidate(c) {
  if (!isRelayIceCandidate(c)) return false;
  return !candidateLooksTcp(iceCandidateText(c));
}

/** Hide IP / hub force_relay: pair only UDP TURN with Android. */
function shouldPreferUdpRelay() {
  return hideIpRelayOnlyEnabled() || sessionForceRelayEnabled();
}

/**
 * @param {string} sdp
 * @param {{ udpOnly?: boolean }} [opts]
 * @returns {number}
 */
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

/**
 * Drop TCP typ relay when ≥1 UDP relay remains. Never empty the path.
 * @param {string} sdp
 * @returns {string}
 */
function stripTcpRelayCandidatesFromSdp(sdp) {
  if (!sdp || typeof sdp !== "string") return sdp;
  if (countTypRelayInSdp(sdp, { udpOnly: true }) === 0) return sdp;
  const out = [];
  let dropped = 0;
  for (const line of sdp.split(/\r?\n/)) {
    if (
      /^a=candidate:/i.test(line) &&
      /\btyp\s+relay\b/i.test(line) &&
      candidateLooksTcp(line)
    ) {
      dropped += 1;
      continue;
    }
    out.push(line);
  }
  if (dropped) {
    console.info(`[webrtc] stripped ${dropped} tcp relay (keep udp)`);
  }
  return out.join("\r\n");
}

/**
 * force_relay: UDP turn: only — TCP dual-path stormed ALLOCATEs and never
 * finished relay↔relay media (peer_usage stayed ~0).
 * @param {RTCIceServer[]} servers
 * @returns {RTCIceServer[]}
 */
function udpTurnOnly(servers) {
  const keep = (servers || []).filter((s) => {
    const u = String(
      Array.isArray(s.urls) ? s.urls[0] : s.urls || ""
    ).toLowerCase();
    if (!(u.startsWith("turn:") || u.startsWith("turns:"))) return false;
    // TLS TURN (5349/443) is the automatic DPI fallback — keep it.
    if (u.startsWith("turns:")) return true;
    // Bare TCP 3478 dual-path stormed ALLOCATEs (CONNECTIVITY_LOCK).
    if (u.includes("transport=tcp")) return false;
    return true;
  });
  return keep.length ? keep : servers || [];
}

/**
 * force_relay/hide/warm: keep one UDP turn: plus one turns: (TLS).
 * slice(0,1) dropped TURNS (FRA) or dropped UDP when geo listed TURNS first (RU vs APK 457).
 */
function keepUdpPlusTurns(servers) {
  const list = servers || [];
  let udp = null;
  let turns = null;
  let firstKind = "";
  for (const s of list) {
    const u = String(
      Array.isArray(s.urls) ? s.urls[0] : s.urls || ""
    ).toLowerCase();
    if (u.startsWith("turns:") && !turns) {
      turns = s;
      if (!firstKind) firstKind = "turns";
    } else if (
      u.startsWith("turn:") &&
      !u.includes("transport=tcp") &&
      !udp
    ) {
      udp = s;
      if (!firstKind) firstKind = "udp";
    }
  }
  const out = [];
  // RU hub lists TURNS before UDP — keep that. CA lists UDP first.
  if (firstKind === "turns") {
    if (turns) out.push(turns);
    if (udp) out.push(udp);
  } else {
    if (udp) out.push(udp);
    if (turns) out.push(turns);
  }
  return out.length ? out : list.slice(0, 1);
}

/**
 * Pin turn: URLs to UDP so Chrome will not gather TCP relay.
 * Bare `turn:host:3478` dual-stacks; Android is UDP-only under force_relay.
 * @param {string} u
 * @returns {string}
 */
function pinTurnUrlToUdp(u) {
  const raw = String(u || "").trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  // turns: starts with "turn:" — must not pin TLS URLs to UDP.
  if (lower.startsWith("turns:")) return raw;
  if (!lower.startsWith("turn:")) return raw;
  if (lower.includes("transport=tcp")) return raw;
  if (lower.includes("transport=udp")) return raw;
  return raw.includes("?") ? raw + "&transport=udp" : raw + "?transport=udp";
}

/**
 * @param {RTCIceServer[]} servers
 * @returns {RTCIceServer[]}
 */
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

/**
 * Strip to typ relay only — pure modes only:
 * Hide IP privacy + hub force_relay (hide_ip / untrusted / same public IP).
 * Normal (force_relay=false): NEVER pure-filter — keep private hosts.
 * @returns {boolean}
 */
function shouldFilterToRelayCandidates() {
  return hideIpRelayOnlyEnabled() || sessionForceRelayEnabled();
}

/**
 * Drop typ host under pure-relay modes only. Normal path keeps private
 * host candidates (Android 192.168.x → Chrome prflx). mDNS still stripped.
 * @returns {boolean}
 */
function shouldStripHostCandidates() {
  // Pure modes already strip non-relay via shouldFilterToRelayCandidates.
  // Host-only strip is unused when pure; keep for belt if called alone.
  return hideIpRelayOnlyEnabled() || sessionForceRelayEnabled();
}

/**
 * Strip typ host candidates (mDNS + private). Keep srflx + relay.
 * @param {string} sdp
 * @returns {string}
 */
function stripHostCandidatesFromSdp(sdp) {
  if (!sdp || typeof sdp !== "string") return sdp;
  const out = [];
  let dropped = 0;
  for (const line of sdp.split(/\r?\n/)) {
    if (/^a=candidate:/i.test(line) && /\btyp\s+host\b/i.test(line)) {
      dropped += 1;
      continue;
    }
    out.push(line);
  }
  if (dropped) {
    console.info(`[webrtc] stripped ${dropped} host candidates (keep srflx/relay)`);
  }
  return out.join("\r\n");
}

/**
 * Wait for typ relay before first SDP emit when TURN is available.
 * Same-LAN web↔android (2026-08-10 20:19): offer relay_candidates=0, answer=1,
 * force_relay=false → host/srflx hairpin dead, media max_rb STUN-only.
 * Chrome has no private host (mDNS stripped); without relay in offer both black.
 * @returns {boolean}
 */
function shouldWaitForFirstRelay() {
  try {
    if (preferDirectOnlyEnabled()) return false;
  } catch (_) {}
  if (hideIpRelayOnlyEnabled() || sessionForceRelayEnabled()) return true;
  // Hybrid: still wait briefly so first SDP carries typ relay for NAT/hairpin fail
  try {
    const raw = lastRawIceServers || iceConfig?.iceServers || [];
    return (raw || []).some((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
      return urls.some((u) => /^turns?:/i.test(String(u || "")));
    });
  } catch (_) {
    return false;
  }
}

/** Max ms to wait for first typ relay before emit. */
function relayWaitBudgetMs() {
  // Pure same-IP: first relay often lands ~0.8–1.5s; cap so mto isn't stuck at 1.7s+.
  // waitForIceGatherRelayOrDone exits early on first typ relay (does not always burn full budget).
  // Hop3: 1100→850; hop7: 850→700; hop8: 700→600; hop9: 600→520; hop11: 520→480.
  // rebuild-if-n=0 belt still on pure offer. product.ok re-smoke required after deploy.
  if (hideIpRelayOnlyEnabled() || sessionForceRelayEnabled()) return 480;
  // Hop7 hybrid: first-pass 400. Hop8: 350. Hop9: 320. Hop11: 300 — still wait when TURN present.
  return 300;
}

/**
 * Drop mDNS host candidates (*.local) — Chrome gathers them; RN Android often
 * never completes ICE checks against them → black both sides on same Wi‑Fi.
 * @param {string} sdp
 * @returns {string}
 */
function stripMdnsHostCandidatesFromSdp(sdp) {
  if (!sdp || typeof sdp !== "string") return sdp;
  const out = [];
  let dropped = 0;
  for (const line of sdp.split(/\r?\n/)) {
    if (
      /^a=candidate:/i.test(line) &&
      /\.local\b/i.test(line) &&
      /\btyp\s+host\b/i.test(line)
    ) {
      dropped += 1;
      continue;
    }
    out.push(line);
  }
  if (dropped) {
    console.info(`[webrtc] stripped ${dropped} mDNS host candidates`);
  }
  return out.join("\r\n");
}

/**
 * @param {RTCIceCandidateInit | RTCIceCandidate | string | null | undefined} c
 * @returns {boolean}
 */
function isMdnsHostIceCandidate(c) {
  if (c == null) return false;
  const s =
    typeof c === "string"
      ? c
      : String(
          /** @type {{ candidate?: string }} */ (c).candidate ||
            /** @type {{ toJSON?: () => { candidate?: string } }} */ (c).toJSON?.()
              ?.candidate ||
            ""
        );
  if (!s) return false;
  return /\.local\b/i.test(s) && /\btyp\s+host\b/i.test(s);
}

/**
 * @param {RTCIceCandidateInit | RTCIceCandidate | string | null | undefined} c
 * @returns {boolean}
 */
function isHostIceCandidate(c) {
  if (c == null) return false;
  const typ = String(
    /** @type {{ type?: string, candidateType?: string }} */ (c).type ||
      /** @type {{ candidateType?: string }} */ (c).candidateType ||
      ""
  ).toLowerCase();
  if (typ === "host") return true;
  const s =
    typeof c === "string"
      ? c
      : String(
          /** @type {{ candidate?: string }} */ (c).candidate ||
            /** @type {{ toJSON?: () => { candidate?: string } }} */ (c).toJSON?.()
              ?.candidate ||
            ""
        );
  return !!s && /\btyp\s+host\b/i.test(s);
}

/**
 * Strip host/srflx from SDP only when ≥1 typ relay remains.
 * Never strip local outbound under iceTransportPolicy=relay mid-gather
 * (empty SDP + no trickle = black cams). Prefer gathering wait instead.
 * @param {string} sdp
 * @returns {string}
 */
function stripNonRelayCandidatesFromSdp(sdp) {
  if (!sdp || typeof sdp !== "string") return sdp;
  const lines = sdp.split(/\r?\n/);
  let relayN = 0;
  let candN = 0;
  for (const line of lines) {
    if (!/^a=candidate:/i.test(line)) continue;
    candN += 1;
    if (/\btyp\s+relay\b/i.test(line)) relayN += 1;
  }
  if (relayN === 0) return sdp; // keep everything — better than zero path
  if (relayN === candN) return sdp; // already pure relay
  const out = [];
  let dropped = 0;
  for (const line of lines) {
    if (/^a=candidate:/i.test(line) && !/\btyp\s+relay\b/i.test(line)) {
      dropped += 1;
      continue;
    }
    out.push(line);
  }
  if (dropped) {
    console.info(
      `[webrtc] stripped ${dropped} non-relay; kept ${relayN} relay`
    );
  }
  return out.join("\r\n");
}

/**
 * Wait until ICE gathering has at least one relay (or complete / timeout).
 * Used under force_relay so SDP is not empty before trickle.
 * @param {RTCPeerConnection} pc
 * @param {number} [maxMs]
 */
function waitForIceGatherRelayOrDone(pc, maxMs = 150) {
  return new Promise((resolve) => {
    if (!pc) {
      resolve(0);
      return;
    }
    let settled = false;
    const udpOnly = shouldPreferUdpRelay();
    const countRelay = () => {
      try {
        return countTypRelayInSdp(pc.localDescription?.sdp || "", { udpOnly });
      } catch {
        return 0;
      }
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        pc.removeEventListener("icecandidate", onCand);
        pc.removeEventListener("icegatheringstatechange", onG);
      } catch (_) {}
      resolve(countRelay());
    };
    // First relay is enough — don't wait full gather (was +2s per side)
    if (countRelay() > 0 || pc.iceGatheringState === "complete") {
      finish();
      return;
    }
    const onCand = (ev) => {
      if (
        ev?.candidate &&
        (udpOnly
          ? isUdpRelayIceCandidate(ev.candidate)
          : isRelayIceCandidate(ev.candidate))
      )
        finish();
      else if (!ev?.candidate && pc.iceGatheringState === "complete") finish();
    };
    const onG = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    try {
      pc.addEventListener("icecandidate", onCand);
      pc.addEventListener("icegatheringstatechange", onG);
    } catch (_) {
      finish();
      return;
    }
    setTimeout(finish, Math.max(250, maxMs));
  });
}

/**
 * Per-m-line direction from SDP (default sendrecv if omitted).
 * @param {string} sdp
 * @returns {string[]}
 */
function sdpMlineDirections(sdp) {
  const dirs = [];
  for (const line of String(sdp || "").split(/\r?\n/)) {
    if (/^m=/i.test(line)) {
      dirs.push("sendrecv");
      continue;
    }
    const m = line.match(/^a=(sendrecv|recvonly|sendonly|inactive)\b/i);
    if (m && dirs.length) dirs[dirs.length - 1] = m[1].toLowerCase();
  }
  return dirs;
}

/**
 * Offer recvonly + answer sendrecv → Chrome InvalidAccessError
 * "Incompatible send direction" (laptop no-cam vs Android forceVideoSendrecvSdp).
 * Compatible: recvonly↔sendonly, sendonly↔recvonly.
 * @param {string} offerSdp
 * @param {string} answerSdp
 * @returns {string}
 */
function alignAnswerDirectionsToLocalOffer(offerSdp, answerSdp) {
  if (!offerSdp || !answerSdp) return answerSdp;
  const offerDirs = sdpMlineDirections(offerSdp);
  if (!offerDirs.length) return answerSdp;
  const lines = String(answerSdp).split(/\r?\n/);
  let mi = -1;
  let changed = 0;
  const out = [];
  for (const line of lines) {
    if (/^m=/i.test(line)) {
      mi += 1;
      out.push(line);
      continue;
    }
    const m = line.match(/^a=(sendrecv|recvonly|sendonly|inactive)\b/i);
    if (m && mi >= 0 && offerDirs[mi]) {
      const od = offerDirs[mi];
      const ad = m[1].toLowerCase();
      let next = ad;
      if (od === "recvonly" && ad === "sendrecv") next = "sendonly";
      else if (od === "sendonly" && ad === "sendrecv") next = "recvonly";
      if (next !== ad) {
        out.push("a=" + next);
        changed += 1;
        continue;
      }
    }
    out.push(line);
  }
  if (changed) {
    console.info(
      "[webrtc] aligned " + changed + " answer dir(s) to local offer"
    );
  }
  return out.join("\r\n");
}

/**
 * @param {RTCSessionDescriptionInit | { type?: string, sdp?: string }} desc
 * @returns {RTCSessionDescriptionInit}
 */
function sanitizeRemoteDescription(desc) {
  if (!desc || !desc.sdp) return desc;
  let sdp = String(desc.sdp);
  // Always drop Chrome mDNS host — returning original `desc` here discarded the
  // strip and left .local candidates in setRemote (same-LAN black / no answer).
  sdp = stripMdnsHostCandidatesFromSdp(sdp);
  if (shouldFilterToRelayCandidates()) {
    sdp = stripNonRelayCandidatesFromSdp(sdp);
    if (shouldPreferUdpRelay()) sdp = stripTcpRelayCandidatesFromSdp(sdp);
    // Do NOT spread inbound SDP — 382/383 phone-side spread broke PC↔Android.
  } else if (shouldStripHostCandidates()) {
    sdp = stripHostCandidatesFromSdp(sdp);
  }
  return { type: desc.type, sdp };
}

/**
 * Apply ICE policy from prefs:
 * - hideIpRelayOnly → iceTransportPolicy "relay" + TURN only (privacy)
 * - sessionForceRelay (hub force_relay / same-IP hairpin) → pure relay
 *   (hybrid policy=all left host preferred + peer_usage≈0 both black 2026-08-10)
 * - preferDirectOnly → STUN only
 * - default → all servers, policy "all"
 */
function applyIceDirectPreference() {
  const raw = lastRawIceServers?.length
    ? lastRawIceServers
    : DEFAULT_ICE.iceServers;
  const hideOnly = hideIpRelayOnlyEnabled();
  const forceRelay = sessionForceRelayEnabled();
  const directOnly = !hideOnly && !forceRelay && preferDirectOnlyEnabled();
  let servers = raw;
  /** @type {RTCIceTransportPolicy} */
  let iceTransportPolicy = "all";

  let poolSize = ICE_CANDIDATE_POOL_SIZE;
  if (hideOnly) {
    // Hide IP: true pure relay (privacy — no host/srflx path to peer).
    const turnOnly = filterIceServersByMode(raw, "turn");
    if (turnOnly.length) {
      servers = udpTurnOnly(preferFastTurnFirst(turnOnly));
      if (!servers.length) servers = preferFastTurnFirst(turnOnly);
      servers = keepUdpPlusTurns(servers);
      servers = pinTurnUrlsToUdp(servers);
      iceTransportPolicy = "relay";
      poolSize = 0;
    } else {
      servers = preferFastTurnFirst(raw);
      iceTransportPolicy = "all";
      console.warn("[webrtc] hide_ip wanted TURN empty — fail-open all");
    }
  } else if (forceRelay) {
    // Hub force_relay (hide_ip / untrusted / same public IP):
    // policy=relay + UDP TURN + optional TURNS. Not TCP 3478 (437 storms).
    const turnOnly = filterIceServersByMode(raw, "turn");
    let turn = udpTurnOnly(preferFastTurnFirst(turnOnly));
    if (!turn.length) turn = preferFastTurnFirst(turnOnly);
    turn = keepUdpPlusTurns(turn);
    if (turn.length) {
      servers = pinTurnUrlsToUdp(turn);
      iceTransportPolicy = "relay";
    } else {
      // Fail-open: keep hosts/STUN if TURN missing (never black forever)
      servers = preferFastTurnFirst(raw);
      iceTransportPolicy = "all";
      console.warn("[webrtc] force_relay no TURN — fail-open all");
    }
    poolSize = 0;
  } else if (directOnly) {
    servers = filterIceServersByMode(raw, "stun");
    if (!servers.length) servers = DEFAULT_ICE.iceServers;
    iceTransportPolicy = "all";
  } else {
    // Normal (force_relay=false): policy=all, STUN+TURN, keep private hosts.
    // TURN is fail-open (trickle); do not strip hosts.
    servers = preferFastTurnFirst(raw);
    iceTransportPolicy = "all";
    poolSize = 0;
  }

  iceConfig = {
    iceServers: servers,
    iceCandidatePoolSize: poolSize,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceTransportPolicy,
  };
  return iceConfig;
}

/**
 * Order TURN URLs for fast first media. UDP first (typical Play↔browser),
 * then TCP, then TURNS — TCP-first was safer for some VPNs but delayed first
 * frame on normal paths by 0.5–2s.
 * @param {RTCIceServer[]} servers
 * @returns {RTCIceServer[]}
 */
function preferFastTurnFirst(servers) {
  return (servers || []).map((s) => {
    const urls = Array.isArray(s.urls) ? s.urls.slice() : s.urls ? [s.urls] : [];
    if (urls.length < 2) return s;
    const score = (u) => {
      const x = String(u).toLowerCase();
      if (x.startsWith("turns:")) return 1; // TLS fallback (RU / DPI) after UDP
      if (x.startsWith("turn:") && !x.includes("transport=tcp")) return 0; // UDP
      if (x.startsWith("turn:") && x.includes("transport=tcp")) return 2;
      return 3; // stun etc.
    };
    urls.sort((a, b) => score(a) - score(b));
    const entry = { urls: urls.length === 1 ? urls[0] : urls };
    if (s.username) entry.username = s.username;
    if (s.credential) entry.credential = s.credential;
    return entry;
  });
}
/** @deprecated alias */
const preferTcpTurnFirst = preferFastTurnFirst;

/** Memory cache so match path rarely blocks on /config.json. */
let iceConfigFetchedAt = 0;
let iceConfigInflight = null;

async function loadRtcConfig(base = "", opts = {}) {
  const force = !!opts.force;
  const now = Date.now();
  const maxAge = 5 * 60 * 1000;
  const softAge = 90 * 1000;
  if (
    !force &&
    iceConfigFetchedAt &&
    lastRawIceServers?.length &&
    now - iceConfigFetchedAt < maxAge
  ) {
    if (now - iceConfigFetchedAt > softAge && !iceConfigInflight) {
      void loadRtcConfigFresh(base).catch(() => {});
    }
    return { config: iceConfig, meta: lastIceMeta, cached: true };
  }
  return loadRtcConfigFresh(base);
}

async function loadRtcConfigFresh(base = "") {
  if (iceConfigInflight) return iceConfigInflight;
  iceConfigInflight = (async () => {
    try {
      const url = `${base.replace(/\/$/, "")}/config.json`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.ice_servers) {
        lastRawIceServers = normalizeIceServers(j.ice_servers);
        applyIceDirectPreference();
      }
      lastIceMeta = j;
      iceConfigFetchedAt = Date.now();
      if (iceRefreshTimer) clearInterval(iceRefreshTimer);
      if (j.turn_ephemeral && j.turn_ttl_secs) {
        const refreshMs = Math.max(60_000, (Number(j.turn_ttl_secs) * 1000) / 2);
        iceRefreshTimer = setInterval(() => {
          loadRtcConfigFresh(base).catch(() => {});
        }, refreshMs);
      }
      return { config: iceConfig, meta: j };
    } catch (e) {
      console.warn("[webrtc] config.json failed, using default STUN", e);
      if (!lastRawIceServers?.length) {
        lastRawIceServers = [...DEFAULT_ICE.iceServers];
        applyIceDirectPreference();
      }
      return { config: iceConfig, meta: lastIceMeta, error: String(e.message || e) };
    } finally {
      iceConfigInflight = null;
    }
  })();
  return iceConfigInflight;
}

function getIceConfig() {
  return iceConfig;
}

/**
 * Pre-gather ICE + TURN allocate while user is in the queue.
 * PreferRelay: build relay-policy PC when pure is active (hide / session force).
 * Pure: one createOffer+setLocal on warm PC (pool=0), mark primed on first typ
 * relay, then rollback. takeWarmPc never promotes pure (clean rebuild) — avoids
 * dirty datachannel SDP / setLocal race; pendingWarmRelayPrimed trims offer wait.
 * Hybrid: promote empty PC object only (no pre-ALLOCATE; pool=0 forever).
 * @param {{ force?: boolean, preferRelay?: boolean }} [opts]
 * @returns {void}
 */
let iceWarmPc = null;
/** @type {"all"|"relay"|""} */
let iceWarmPolicy = "";
/** True once warm PC has completed at least one TURN ALLOCATE / relay candidate. */
let iceWarmPrimed = false;
/**
 * When takeWarmPc closes a dirty pure-warm offer, preserve primed for the fresh
 * real PC so offer/answer can use a slightly tighter first-relay wait.
 */
let pendingWarmRelayPrimed = false;
function warmIcePool(opts = {}) {
  try {
    applyIceDirectPreference();
    let cfg = { ...getIceConfig() };
    if (!cfg?.iceServers?.length) return;
    const raw = lastRawIceServers?.length
      ? lastRawIceServers
      : cfg.iceServers;
    const hasTurn = (raw || []).some((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
      return urls.some((u) => /^turns?:/i.test(String(u || "")));
    });
    // Pure-relay warm only when pure mode is actually active (hide / hub force).
    // preferRelay at match (after setSessionForceRelay) arms pure; never sticky
    // pure on Spin/Next when preferRelay alone without hide/force.
    const pureNow =
      hideIpRelayOnlyEnabled() ||
      sessionForceRelayEnabled() ||
      (!!opts.preferRelay &&
        (hideIpRelayOnlyEnabled() || sessionForceRelayEnabled()));
    if (pureNow && hasTurn) {
      const turnOnly = filterIceServersByMode(raw, "turn");
      if (turnOnly.length) {
        let udp = udpTurnOnly(preferFastTurnFirst(turnOnly));
        if (!udp.length) udp = preferFastTurnFirst(turnOnly);
        udp = keepUdpPlusTurns(udp);
        cfg = {
          ...cfg,
          iceServers: pinTurnUrlsToUdp(udp),
          iceTransportPolicy: "relay",
          iceCandidatePoolSize: 0,
        };
      }
    } else if (hasTurn) {
      // Normal / same-LAN: TURN + STUN, policy all — keep host path
      const turnOnly = filterIceServersByMode(raw, "turn");
      const stun = filterIceServersByMode(raw, "stun");
      let turn = udpTurnOnly(preferFastTurnFirst(turnOnly));
      if (!turn.length) turn = preferFastTurnFirst(turnOnly);
      turn = keepUdpPlusTurns(turn);
      cfg = {
        ...cfg,
        iceServers: preferFastTurnFirst([...turn, ...stun, ...raw]),
        iceTransportPolicy: "all",
        iceCandidatePoolSize: ICE_CANDIDATE_POOL_SIZE,
      };
    }
    const policy =
      cfg.iceTransportPolicy === "relay" ? "relay" : "all";
    // Keep same-policy warm whether primed or still allocating (no multi-ALLOCATE).
    if (iceWarmPc && iceWarmPolicy === policy && !opts.force) {
      return;
    }
    clearIceWarm();
    iceWarmPc = new RTCPeerConnection(cfg);
    iceWarmPolicy = policy;
    iceWarmPrimed = false;
    try {
      iceWarmPc.createDataChannel("ruletka-warm");
    } catch (_) {}
    if (policy === "relay") {
      // Real pure ALLOCATE once (pool=0). Mark primed on first typ relay, then
      // rollback (clean). takeWarmPc still clean-rebuilds pure — prime is for
      // path-hot + __ruletWarmPrimed budget trim, not dirty SDP promote.
      try {
        iceWarmPc.onicecandidate = (ev) => {
          if (iceWarmPrimed) return;
          const cand = String(ev?.candidate?.candidate || "");
          if (cand && /\btyp\s+relay\b/i.test(cand)) {
            iceWarmPrimed = true;
            console.info("[webrtc] warmIcePool prime on first relay cand");
          }
        };
      } catch (_) {}
      void (async () => {
        const pc = iceWarmPc;
        if (!pc) return;
        /** Abort if takeWarmPc/clearIceWarm stole or closed this warm PC. */
        const stillWarm = () =>
          iceWarmPc === pc && !pc.__ruletWarmTaken;
        try {
          const offer = await pc.createOffer();
          if (!stillWarm()) return;
          await pc.setLocalDescription(offer);
          if (!stillWarm()) return;
          const n = await waitForIceGatherRelayOrDone(pc, 2000);
          if (!stillWarm()) return;
          if (n > 0) {
            iceWarmPrimed = true;
            console.info(
              "[webrtc] warmIcePool pure prime ok relays=" + n
            );
          } else {
            console.info("[webrtc] warmIcePool pure prime no-relay");
          }
          // Clean for promote: stable signaling, no dirty local offer
          try {
            if (stillWarm() && pc.signalingState === "have-local-offer") {
              await pc.setLocalDescription({ type: "rollback" });
            }
          } catch (rbErr) {
            if (stillWarm()) {
              console.warn("[webrtc] warmIcePool pure rollback", rbErr);
            }
          }
        } catch (e) {
          if (stillWarm()) {
            console.warn("[webrtc] warmIcePool pure prime", e);
          }
        }
      })();
      console.info(
        "[webrtc] warmIcePool start policy=relay prime=allocate"
      );
    } else {
      // Hybrid: PC object only (no pre-ALLOCATE; pool=0 forever)
      iceWarmPrimed = true;
      console.info(
        "[webrtc] warmIcePool start policy=" + policy + " prime=skip"
      );
    }
  } catch (e) {
    console.warn("[webrtc] warmIcePool", e);
    iceWarmPc = null;
    iceWarmPolicy = "";
    iceWarmPrimed = false;
  }
}

function clearIceWarm() {
  try {
    if (iceWarmPc) iceWarmPc.__ruletWarmTaken = true;
  } catch (_) {}
  try {
    iceWarmPc?.close();
  } catch (_) {}
  iceWarmPc = null;
  iceWarmPolicy = "";
  iceWarmPrimed = false;
}

/**
 * Steal the queue warm PC for the real call.
 * Hybrid (policy=all): promote empty PC (no setLocal — safe).
 * Pure (policy=relay): always clean-rebuild — warm ALLOCATE may leave
 * have-local-offer or race setLocal onto a promoted media PC. Close warm,
 * hand primed via pendingWarmRelayPrimed (VIDEO_PATH_LOCK clean rebuild).
 * @returns {RTCPeerConnection | null}
 */
function takeWarmPc() {
  if (!iceWarmPc) return null;
  const pc = iceWarmPc;
  const wasPrimed = iceWarmPrimed;
  const policy = iceWarmPolicy;
  // Stop pure-warm async (setLocal must not land on a media PC)
  try {
    pc.__ruletWarmTaken = true;
  } catch (_) {}
  iceWarmPc = null;
  iceWarmPolicy = "";
  iceWarmPrimed = false;
  try {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.ondatachannel = null;
  } catch (_) {}
  // Pure 1v1: never promote (dirty SDP / in-flight setLocal race).
  // Extra 3rd-join: promote a *stable* rolled-back warm PC so the 2nd TURN
  // ALLOCATE is not a cold 5s setLocal (22:17 PC extra +6.4s, relay=0).
  if (policy === "relay") {
    let extraPromote = false;
    try {
      extraPromote =
        typeof window !== "undefined" &&
        !!window.__ruletMultiPeerFast &&
        (pc.signalingState || "") === "stable";
    } catch (_) {
      extraPromote = false;
    }
    if (extraPromote) {
      try {
        pc.__ruletWarmPrimed = wasPrimed;
      } catch (_) {}
      console.info("[webrtc] takeWarmPc extra promote relay primed=" + (wasPrimed ? 1 : 0));
      return pc;
    }
    try {
      pc.close();
    } catch (_) {}
    pendingWarmRelayPrimed = wasPrimed;
    return null;
  }
  // Hybrid or unexpected non-stable — close rather than ship dirty
  try {
    const st = pc.signalingState || "";
    if (st && st !== "stable") {
      try {
        pc.close();
      } catch (_) {}
      pendingWarmRelayPrimed = wasPrimed;
      return null;
    }
  } catch (_) {
    try {
      pc.close();
    } catch (_) {}
    pendingWarmRelayPrimed = wasPrimed;
    return null;
  }
  try {
    pc.__ruletWarmPrimed = wasPrimed;
  } catch (_) {}
  return pc;
}

/**
 * Apply pending warm-prime flag onto a fresh PC after dirty warm was closed.
 * @param {RTCPeerConnection | null | undefined} pc
 */
function applyPendingWarmPrimed(pc) {
  if (!pc || !pendingWarmRelayPrimed) return;
  try {
    pc.__ruletWarmPrimed = true;
  } catch (_) {}
  pendingWarmRelayPrimed = false;
}

function warmPcPolicy() {
  return iceWarmPolicy;
}

/** True when search warm PC already completed TURN ALLOCATE / first relay. */
function isIceWarmPrimed() {
  return !!iceWarmPrimed;
}

/**
 * Wait until warm pool reports primed (or timeout).
 * @param {number} [maxMs]
 * @returns {Promise<boolean>}
 */
function waitIceWarmPrimed(maxMs = 1200) {
  return new Promise((resolve) => {
    if (iceWarmPrimed) {
      resolve(true);
      return;
    }
    const t0 = Date.now();
    const tick = () => {
      if (iceWarmPrimed) {
        resolve(true);
        return;
      }
      if (Date.now() - t0 >= maxMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

function getIceMeta() {
  return lastIceMeta;
}

/**
 * Inspect selected ICE candidate pair: "direct" | "relay" | "unknown"
 * @param {RTCPeerConnection} pc
 * @returns {Promise<"direct"|"relay"|"unknown">}
 */
async function getIcePathKind(pc) {
  if (!pc) return "unknown";
  try {
    const report = await pc.getStats();
    /** @type {RTCStats | null} */
    let selected = null;
    report.forEach((r) => {
      if (r.type === "candidate-pair" && (r.selected || r.state === "succeeded")) {
        if (r.nominated || r.selected || !selected) selected = r;
      }
    });
    if (!selected || !selected.localCandidateId) return "unknown";
    const local = report.get(selected.localCandidateId);
    if (!local) return "unknown";
    const t = String(local.candidateType || local.type || "").toLowerCase();
    if (t === "relay") return "relay";
    if (t === "host" || t === "srflx" || t === "prflx") return "direct";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Prefer better codecs when the browser exposes setCodecPreferences. */
function preferCodecs(pc) {
  if (!pc || typeof RTCRtpSender === "undefined" || !RTCRtpSender.getCapabilities) {
    return;
  }
  try {
    const videoCaps = RTCRtpSender.getCapabilities("video");
    const audioCaps = RTCRtpSender.getCapabilities("audio");
    const transceivers = pc.getTransceivers?.() || [];
    for (const t of transceivers) {
      if (!t?.setCodecPreferences) continue;
      if (t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video") {
        if (!videoCaps?.codecs?.length) continue;
        // Phone↔browser: H264 (Android HW) then VP8 — AV1/VP9 first caused
        // negotiate/decode black partner on PC while phone still saw web cam.
        const pref = preferOrder(videoCaps.codecs, [
          "video/H264",
          "video/VP8",
          "video/VP9",
          "video/AV1",
        ]);
        if (pref.length) t.setCodecPreferences(pref);
      } else if (
        t.receiver?.track?.kind === "audio" ||
        t.sender?.track?.kind === "audio"
      ) {
        if (!audioCaps?.codecs?.length) continue;
        const pref = preferOrder(audioCaps.codecs, ["audio/opus", "audio/red", "audio/PCMU"]);
        if (pref.length) t.setCodecPreferences(pref);
      }
    }
  } catch (e) {
    console.warn("[webrtc] codec preference skipped", e);
  }
}

/**
 * @param {RTCRtpCodecCapability[]} codecs
 * @param {string[]} mimeOrder
 */
function preferOrder(codecs, mimeOrder) {
  const scored = codecs.map((c, i) => {
    const mime = String(c.mimeType || "").toUpperCase();
    let rank = 100 + i;
    mimeOrder.forEach((want, wi) => {
      if (mime === want.toUpperCase()) rank = wi;
    });
    // Prefer packetization-mode=1 for H264 when present
    if (mime === "VIDEO/H264" && /packetization-mode=1/i.test(c.sdpFmtpLine || "")) {
      rank -= 0.1;
    }
    return { c, rank };
  });
  scored.sort((a, b) => a.rank - b.rank);
  return scored.map((s) => s.c);
}

/**
 * Apply outbound encoding limits (bps / scale). Safe no-op if unsupported.
 * @param {RTCRtpSender} sender
 * @param {{ maxBitrate?: number, maxFramerate?: number, scaleResolutionDownBy?: number, degradationPreference?: string }} opts
 */
async function applySenderEncoding(sender, opts = {}) {
  if (!sender || typeof sender.getParameters !== "function") return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || !params.encodings.length) {
      params.encodings = [{}];
    }
    const enc = params.encodings[0];
    if (opts.maxBitrate != null) enc.maxBitrate = opts.maxBitrate;
    if (opts.maxFramerate != null) enc.maxFramerate = opts.maxFramerate;
    // Multi-party: send lower resolution on secondary links (saves encode + bandwidth)
    if (opts.scaleResolutionDownBy != null) {
      const scale = Math.max(1, Number(opts.scaleResolutionDownBy) || 1);
      enc.scaleResolutionDownBy = scale;
    }
    if (opts.degradationPreference && "degradationPreference" in params) {
      // @ts-ignore older TS libs
      params.degradationPreference = opts.degradationPreference;
    } else if (opts.degradationPreference) {
      // Chrome historically used this on encodings
      // @ts-ignore
      enc.degradationPreference = opts.degradationPreference;
    }
    await sender.setParameters(params);
  } catch (e) {
    console.warn("[webrtc] setParameters", e);
  }
}

/** Default quality ladder (outbound). scale >1 = lower res for multi-party extras. */
const QUALITY_TIERS = {
  high: {
    maxBitrate: 1_800_000,
    maxFramerate: 30,
    scaleResolutionDownBy: 1,
    label: "high",
  },
  mid: {
    maxBitrate: 900_000,
    maxFramerate: 28,
    scaleResolutionDownBy: 1,
    label: "mid",
  },
  low: {
    maxBitrate: 400_000,
    maxFramerate: 20,
    scaleResolutionDownBy: 2,
    label: "low",
  },
  min: {
    maxBitrate: 200_000,
    maxFramerate: 15,
    scaleResolutionDownBy: 2,
    label: "min",
  },
};

const TIER_RANK = { high: 3, mid: 2, low: 1, min: 0 };

/** Clamp tier name to the lower of `tier` and `ceiling`. */
function clampQualityTier(tier, ceiling) {
  const t = QUALITY_TIERS[tier] ? tier : "mid";
  const c = QUALITY_TIERS[ceiling] ? ceiling : "high";
  return (TIER_RANK[t] ?? 2) <= (TIER_RANK[c] ?? 3) ? t : c;
}

/** Android UA (browser / WebView) — multi min-tier freezes some HW encoders. */
function isAndroidUa() {
  try {
    return /Android/i.test(
      (typeof navigator !== "undefined" && navigator.userAgent) || ""
    );
  } catch {
    return false;
  }
}

/**
 * iPhone / iPad / iPod WebKit, including iPadOS desktop-mode Safari.
 * Same UA rules as live.js: iPhone|iPad|iPod or MacIntel + maxTouchPoints > 1.
 * WebKit AudioContext is often 44100 — do not force GUM 48k (resample crackle).
 */
function isIosWebKit() {
  try {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    // iPadOS 13+ reports as Macintosh / MacIntel.
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Multi-peer sibling path (3/4-way): live.js sets _multiPeerLink /
 * window.__ruletMultiPeerFast for shorter first-relay wait + quality floor.
 * @param {{ _multiPeerLink?: boolean } | null} [pcLike]
 */
function isMultiPeerFastMode(pcLike) {
  try {
    if (pcLike && pcLike._multiPeerLink) return true;
    return !!(
      typeof window !== "undefined" && window.__ruletMultiPeerFast
    );
  } catch {
    return false;
  }
}

/**
 * First-pass typ-relay wait. 1v1 hop11 stays cold=budget (480) / warm 320.
 * Sibling 2nd+ PC (window.__ruletMultiPeerFast / _multiPeerLink) trims cold
 * only — never lengthens 1v1, never cuts relayWaitBudgetMs itself.
 * @param {number} budget
 * @param {boolean} warmOk
 * @param {{ _multiPeerLink?: boolean } | null} [pcLike]
 */
function siblingAlreadyHasRelay() {
  try {
    if (typeof peerPcs === "undefined" || !peerPcs || peerPcs.size < 1) {
      return false;
    }
    for (const pc of peerPcs.values()) {
      const sdp = String(pc?.pc?.localDescription?.sdp || "");
      if (sdp && /typ relay/i.test(sdp)) return true;
    }
  } catch (_) {}
  return false;
}

function firstRelayWait1Ms(budget, warmOk, pcLike) {
  let wait1 = warmOk ? Math.min(budget, 320) : budget;
  if (isMultiPeerFastMode(pcLike) && !warmOk) {
    // Extra 3rd-join: trickle ICE. Sibling TURN → 80ms; first extra (laptop
    // solo, no sibling SDP yet) → 160ms. Never lengthens 1v1 hop11 480.
    wait1 = Math.min(wait1, siblingAlreadyHasRelay() ? 80 : 160);
  }
  return wait1;
}

/** Shared local preview stream from live.js (never stop its tracks on multi close). */
function getRuletPreviewStream() {
  try {
    return typeof window !== "undefined"
      ? window.__ruletPreviewStream || null
      : null;
  } catch {
    return null;
  }
}

/**
 * Shared preview still has a live camera. 3-way: live.js clones that
 * track onto the 2nd PC after connect — do not treat a brief missing
 * localStream video as no-cam (recvonly black).
 */
function previewHasLiveVideo() {
  try {
    const preview = getRuletPreviewStream();
    if (
      (preview?.getVideoTracks?.() || []).some(
        (t) => t && t.readyState !== "ended"
      )
    ) {
      return true;
    }
  } catch (_) {}
  // 3rd-join / kickSolo: preview map can lag #local by one tick.
  // recvonly offer here = Android / other browsers get no camera.
  try {
    const el =
      typeof document !== "undefined" ? document.getElementById("local") : null;
    const s = el && el.srcObject;
    if (
      (s?.getVideoTracks?.() || []).some((t) => t && t.readyState !== "ended")
    ) {
      return true;
    }
    if (el && el.videoWidth > 2 && el.videoHeight > 2) return true;
  } catch (_) {}
  return false;
}

/** Live camera on preview / #local — not dummy, not ended. */
function firstLivePreviewVideo() {
  const streams = [];
  try {
    const p = getRuletPreviewStream();
    if (p) streams.push(p);
  } catch (_) {}
  try {
    const el =
      typeof document !== "undefined" ? document.getElementById("local") : null;
    if (el?.srcObject) streams.push(el.srcObject);
  } catch (_) {}
  for (const s of streams) {
    const track = (s.getVideoTracks?.() || []).find(
      (t) => t && t.readyState !== "ended"
    );
    if (track) return { track, stream: s };
  }
  return null;
}

/**
 * True if track is the live preview source (or same id on preview).
 * Multi clones must not stop these when replacing / closing.
 * @param {MediaStreamTrack | null | undefined} track
 */
function trackBelongsToPreview(track) {
  if (!track) return false;
  try {
    const preview = getRuletPreviewStream();
    if (!preview || typeof preview.getTracks !== "function") return false;
    const pts = preview.getTracks() || [];
    if (pts.includes(track)) return true;
    const id = track.id;
    if (id) return pts.some((t) => t && t.id === id);
  } catch (_) {}
  return false;
}

/**
 * Stop a track only if it is not the shared preview source.
 * @param {MediaStreamTrack | null | undefined} track
 */
function stopTrackUnlessPreview(track) {
  if (!track) return;
  if (trackBelongsToPreview(track)) return;
  try {
    track.stop();
  } catch (_) {}
}

/**
 * Android multi: "min" (scale×2 + 200kbps) freezes HW encoders — floor at low.
 * Desktop and 1v1 keep full ladder.
 * @param {string} tier
 * @param {{ _multiPeerLink?: boolean } | null} [pcLike]
 */
function mobileSafeMultiTier(tier, pcLike) {
  const t = QUALITY_TIERS[tier] ? tier : "mid";
  if (t === "min" && isAndroidUa() && isMultiPeerFastMode(pcLike)) {
    return "low";
  }
  return t;
}

/**
 * @typedef {object} MediaDeviceChoices
 * @property {string} [videoDeviceId]
 * @property {string} [audioDeviceId]
 * @property {boolean} [video]
 * @property {boolean} [audio]
 */

/**
 * @typedef {object} WebRtcHooks
 * @property {(kind: 'offer'|'answer'|'ice'|'bye'|'av_path', payload: string, toPeerId?: string) => void} onSignal
 * @property {(stream: MediaStream) => void} [onRemoteStream]
 * @property {(state: string) => void} [onConnectionState]
 * @property {(ice: string) => void} [onIceConnectionState]
 * @property {(tier: string, stats: object) => void} [onQualityTier]
 * @property {(msg: object) => void} [onDataMessage]  P2P chat / control (JSON)
 * @property {(open: boolean) => void} [onDataChannel]  chat data channel open/close
 */

/** Reliable ordered chat channel label (must match both peers). */
const CHAT_DC_LABEL = "ruletka-chat";

/**
 * Keep A/V lipsync tight. RTT "good" only measures network — browsers still
 * buffer audio more than video by default, so speech can lag the picture.
 * Apply the same low jitter target to audio + video receivers.
 * @param {RTCPeerConnection | null | undefined} pc
 * @param {number} [targetMs]
 */
function applyLowLatencyPlayout(pc, targetMs = 70) {
  if (!pc || typeof pc.getReceivers !== "function") return;
  // Never go below ~55ms — ultra-low targets underrun and sound crackly.
  const ms = Math.max(55, Math.min(220, Number(targetMs) || 70));
  for (const receiver of pc.getReceivers()) {
    try {
      // Spec: DOMHighResTimeStamp in milliseconds
      if ("jitterBufferTarget" in receiver) {
        receiver.jitterBufferTarget = ms;
      }
    } catch (_) {}
    try {
      // Older Chromium experimental (seconds)
      if ("playoutDelayHint" in receiver) {
        receiver.playoutDelayHint = ms / 1000;
      }
    } catch (_) {}
    try {
      const t = receiver.track;
      if (t && t.kind === "audio") {
        try {
          if (t.enabled === false) t.enabled = true;
        } catch (_) {}
        try {
          if ("contentHint" in t) t.contentHint = "speech";
        } catch (_) {}
      }
      if (t && t.kind === "video") {
        try {
          if (t.enabled === false) t.enabled = true;
        } catch (_) {}
        try {
          if ("contentHint" in t) t.contentHint = "motion";
        } catch (_) {}
      }
    } catch (_) {}
  }
}

/**
 * Force inbound audio tracks on (3-way tiles start silent if enabled=false).
 * @param {RTCPeerConnection | null | undefined} pc
 */
function enableInboundAudioTracks(pc) {
  if (!pc || typeof pc.getReceivers !== "function") return;
  for (const receiver of pc.getReceivers()) {
    try {
      const t = receiver.track;
      if (t && t.kind === "audio" && t.enabled === false) t.enabled = true;
    } catch (_) {}
  }
}

/**
 * Ask encoder for a fresh keyframe so partner paints sooner after ICE
 * (TURN paths often delay first frame 2–8s without this).
 * @param {RTCPeerConnection | null | undefined} pc
 */
function requestOutboundKeyframes(pc) {
  if (!pc || typeof pc.getSenders !== "function") return;
  for (const sender of pc.getSenders()) {
    try {
      const t = sender.track;
      if (!t || t.kind !== "video" || t.readyState === "ended") continue;
      try {
        if (t.enabled === false) t.enabled = true;
      } catch (_) {}
      // Chrome / modern: generateKeyFrame()
      if (typeof sender.generateKeyFrame === "function") {
        void Promise.resolve(sender.generateKeyFrame()).catch(() => {});
      }
      // Some builds expose requestKeyFrame on sender
      if (typeof sender.requestKeyFrame === "function") {
        try {
          sender.requestKeyFrame();
        } catch (_) {}
      }
    } catch (_) {}
  }
}

/**
 * After ICE is up: tighten buffers, enable inbound video, keyframe outbound.
 * Call from connected/completed (and optionally ontrack video).
 * @param {RTCPeerConnection | null | undefined} pc
 */
function kickMediaAfterIce(pc) {
  if (!pc) return;
  try {
    enableInboundAudioTracks(pc);
  } catch (_) {}
  try {
    applyLowLatencyPlayout(pc, 60);
  } catch (_) {}
  try {
    requestOutboundKeyframes(pc);
  } catch (_) {}
  // Burst for TURN first-frame (0 + 80 + 200 + 500ms)
  setTimeout(() => {
    try {
      requestOutboundKeyframes(pc);
    } catch (_) {}
  }, 80);
  setTimeout(() => {
    try {
      requestOutboundKeyframes(pc);
    } catch (_) {}
  }, 200);
  setTimeout(() => {
    try {
      requestOutboundKeyframes(pc);
    } catch (_) {}
  }, 500);
}

/**
 * Prefer slightly lower-latency capture constraints when supported.
 * AEC/NS/AGC improve calls but can add 20–80ms of algorithmic audio delay
 * that is not always reflected in video timestamps → sound lags picture.
 * @returns {MediaTrackConstraints}
 */
/**
 * Whether the user opted into low-latency mic processing (less A/V lag).
 * Reads localStorage directly so webrtc.js works without live.js prefs helpers.
 */
/**
 * When true (1v2 / 2v2 / trio), force full mic processing even if user
 * enabled low-latency in Settings — multi-remote audio gets messy without NS/AGC.
 */
let forceFullAudioProcessing = false;

function setForceFullAudioProcessing(on) {
  forceFullAudioProcessing = !!on;
}

function isForceFullAudioProcessing() {
  return forceFullAudioProcessing;
}

function isLowLatencyAudioEnabled() {
  // Multi-peer always uses full processing (NS + AGC)
  if (forceFullAudioProcessing) return false;
  try {
    const p = JSON.parse(
      localStorage.getItem("freenet-roulette-media-prefs-v1") || "{}"
    );
    // Default OFF — noise suppression + AGC on (better multi-party / noisy rooms).
    // User can opt into low-latency (less processing, tighter lipsync) in Settings.
    if (p.lowLatencyAudio === true || p.lowLatencyAudio === 1) return true;
    return false;
  } catch {
    return false;
  }
}

/** Full AEC + noise suppression + AGC (multi-peer / noisy rooms). */
function fullProcessingAudioConstraints(extra = {}) {
  const c = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    latency: { ideal: 0.02, max: 0.08 },
  };
  // Desktop prefers 48k Opus. iOS/WebKit AC is often 44.1k — omit forced 48k.
  if (!isIosWebKit()) {
    c.sampleRate = { ideal: 48000 };
  }
  const out = { ...c, ...extra };
  if (isIosWebKit()) delete out.sampleRate;
  return out;
}

/**
 * Prefer slightly lower-latency capture constraints when supported.
 * AEC/NS/AGC improve calls but can add 20–80ms of algorithmic audio delay
 * that is not always reflected in video timestamps → sound lags picture.
 * Multi-peer forces full processing via forceFullAudioProcessing.
 * @returns {MediaTrackConstraints}
 */
function lowLatencyAudioConstraints(extra = {}) {
  if (forceFullAudioProcessing) {
    return fullProcessingAudioConstraints(extra);
  }
  const low = isLowLatencyAudioEnabled();
  const c = {
    echoCancellation: true, // keep echo control always
    // NS/AGC add delay; off in low-latency mode
    noiseSuppression: !low,
    autoGainControl: !low,
    channelCount: 1,
    latency: low
      ? { ideal: 0.005, max: 0.025 }
      : { ideal: 0.02, max: 0.08 },
  };
  // Desktop prefers 48k Opus. iOS/WebKit AC is often 44.1k — omit forced 48k.
  if (!isIosWebKit()) {
    c.sampleRate = { ideal: 48000 };
  }
  const out = { ...c, ...extra };
  if (isIosWebKit()) delete out.sampleRate;
  return out;
}

/**
 * Pure iceTransportPolicy=relay — Hide IP privacy OR hub force_relay
 * (hide_ip / untrusted / same public IP). pool=0 + single UDP TURN.
 */
function isRelayMediaMode() {
  try {
    if (typeof sessionForceRelayEnabled === "function" && sessionForceRelayEnabled()) {
      return true;
    }
    if (typeof hideIpRelayOnlyEnabled === "function" && hideIpRelayOnlyEnabled()) {
      return true;
    }
    const p = JSON.parse(
      localStorage.getItem("freenet-roulette-media-prefs-v1") || "{}"
    );
    if (p.hideIpRelayOnly) return true;
  } catch (_) {}
  return false;
}

/** True when path may use TURN (jitter floors / soft recover timing). */
function isTurnPreferredPath() {
  return isRelayMediaMode() || sessionForceRelayEnabled();
}

/**
 * Playout target ms — same value applied to audio *and* video for lipsync.
 * On TURN/relay (Hide IP), use a slightly higher matched target so browsers
 * don't underrun and grow A/V buffers unevenly.
 * @param {string} [tier]
 * @param {{ relay?: boolean }} [opts]
 */
function playoutTargetForTier(tier, opts = {}) {
  const low = isLowLatencyAudioEnabled();
  const relay = opts.relay === true || isTurnPreferredPath();
  // Floors kept conservative — too-low jitter targets underrun on Wi‑Fi/mobile
  // and sound like crackle / dropouts ("crapping out").
  if (relay) {
    // Matched higher floor: hide-IP / TURN path — sync > absolute min delay
    if (low) {
      if (tier === "min" || tier === "low") return 130;
      if (tier === "mid") return 105;
      return 90;
    }
    if (tier === "min" || tier === "low") return 150;
    if (tier === "mid") return 120;
    return 100;
  }
  if (low) {
    // Low-latency mode: still keep a safe floor (was 48 — crackled on some links)
    if (tier === "min" || tier === "low") return 90;
    if (tier === "mid") return 70;
    return 60;
  }
  if (tier === "min" || tier === "low") return 110;
  if (tier === "mid") return 85;
  return 70;
}

class RouletteWebRtc {
  /**
   * @param {WebRtcHooks} hooks
   * @param {boolean} isOfferer
   * @param {string} [remotePeerId]
   */
  constructor(hooks, isOfferer, remotePeerId = "") {
    this.hooks = hooks;
    this.isOfferer = isOfferer;
    this.remotePeerId = remotePeerId || "";
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.sigSeq = 0;
    /** @type {HTMLVideoElement | null} */
    this._videoEl = null;
    /** Remote audio/video ontrack order (audio-first black recovery). */
    this._gotRemoteAudio = false;
    this._gotRemoteVideo = false;
    this._qualityTier = "high";
    /** Max tier allowed (multi-party secondary links use "mid"/"low"). */
    this._qualityCeiling = "high";
    this._adaptTimer = 0;
    this._lastBytes = 0;
    this._lastTs = 0;
    this._lossEma = 0;
    this._rttEma = 0;
    /** ICE/PC reached connected|completed at least once on this PC. */
    this._iceEverOk = false;
    /** @type {RTCDataChannel | null} */
    this._chatDc = null;
    this._chatDcOpen = false;
  }

  /**
   * Cap adaptive quality (e.g. secondary multi-party link never goes above "low").
   * @param {keyof typeof QUALITY_TIERS | string} ceiling
   */
  setQualityCeiling(ceiling) {
    let c = QUALITY_TIERS[ceiling] ? ceiling : "high";
    // Android multi: never hold ceiling at "min" (encoder freeze)
    c = mobileSafeMultiTier(c, this);
    this._qualityCeiling = c;
    const cur = this._qualityTier || "high";
    const next = mobileSafeMultiTier(clampQualityTier(cur, c), this);
    if (next !== cur) {
      this.applyQualityTier(next).catch(() => {});
    }
  }

  _emitSignal(kind, payload) {
    // Last line of defense: never put a second non-restart offer on the wire
    // for this match (hub debounce drop @~800ms → 18–20s black video).
    // Only block if a prior offer actually emitted (_offerEmitOk / real stamp).
    if (kind === "offer") {
      try {
        const now = Date.now();
        const hard = window.__ruletMatchOfferAt || 0;
        const iceRestart = !!this._emittingIceRestart;
        // 12s is enough to block thrash; 20s left no recovery until ~25s MTO
        if (!iceRestart && hard && now - hard < 12000 && this._offerEmitOk) {
          console.info("[webrtc] blocked second offer emit", now - hard);
          return;
        }
        // Stale stamp without emit (setLocal without wire) — clear fast
        if (
          !iceRestart &&
          hard &&
          !this._offerEmitOk &&
          now - hard > 800
        ) {
          window.__ruletMatchOfferAt = 0;
          window.__ruletMatchOfferLock = 0;
        }
      } catch (_) {}
    }
    this.hooks.onSignal(kind, payload, this.remotePeerId || undefined);
  }

  /**
   * Open camera/mic for preview (works before match).
   * @param {MediaDeviceChoices} [opts]
   */
  async startLocalMedia(opts = {}) {
    const {
      videoDeviceId = null,
      audioDeviceId = null,
      video = true,
      audio = true,
    } = opts;

    if (this.localStream) {
      // Never stop shared preview tracks (multi/rematch keeps cam live)
      this.localStream.getTracks().forEach((t) => stopTrackUnlessPreview(t));
      this.localStream = null;
    }

    /** @type {MediaStreamConstraints} */
    const constraints = {};
    if (video) {
      // USB webcams (Razer Kiyo, Logitech, …) reject facingMode:"user" and
      // may never power on (no LED). Only use facingMode when no deviceId.
      if (videoDeviceId) {
        constraints.video = {
          deviceId: { exact: videoDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        };
      } else {
        constraints.video = {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        };
      }
    } else {
      constraints.video = false;
    }
    if (audio) {
      const baseAudio = lowLatencyAudioConstraints(
        audioDeviceId ? { deviceId: { ideal: audioDeviceId } } : {}
      );
      constraints.audio = baseAudio;
    } else {
      constraints.audio = false;
    }

    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    this._tagTracks();

    if (this.pc) {
      await this.syncLocalTracksToPc();
    } else {
      try {
        this._ensureNoCamVideoRecvonly();
      } catch (_) {}
    }
    return this.localStream;
  }

  /** contentHint + default encodings for better encoder choices. */
  _tagTracks() {
    if (!this.localStream) return;
    for (const t of this.localStream.getVideoTracks()) {
      try {
        // "motion" → better for talking-head / continuous movement
        if ("contentHint" in t) t.contentHint = "motion";
      } catch (_) {}
    }
    for (const t of this.localStream.getAudioTracks()) {
      try {
        if ("contentHint" in t) t.contentHint = "speech";
      } catch (_) {}
    }
  }

  /**
   * Audio-only GUM: video m-line must be recvonly so we can still see the
   * partner camera. sendrecv with no track makes Android attach a muted
   * dummy remote video and stay on Linking cameras.
   */
  _ensureNoCamVideoRecvonly() {
    const hasLocalVideo = (this.localStream?.getVideoTracks?.() || []).some(
      (t) => t && t.readyState !== "ended"
    );
    // Preview cam / 3-way clone pending: keep sendrecv (not recvonly black).
    if (hasLocalVideo || previewHasLiveVideo() || !this.pc) return;
    // #local already has a stream (Start preview) — do not flip sendrecv→recvonly.
    try {
      const el =
        typeof document !== "undefined"
          ? document.getElementById("local")
          : null;
      if (el?.srcObject) return;
    } catch (_) {}
    try {
      const tr = this.pc.getTransceivers?.() || [];
      for (const x of tr) {
        const kind = x?.receiver?.track?.kind || x?.sender?.track?.kind;
        if (kind !== "video") continue;
        const dir = String(x.direction || "");
        if (
          (dir === "sendrecv" || dir === "sendonly") &&
          typeof x.setDirection === "function"
        ) {
          x.setDirection("recvonly");
        }
      }
    } catch (_) {}
  }

  /**
   * PC-with-cam offered recvonly (preview map lagged) → Safari fin=0 / our fout=0.
   * Attach #local/preview track and flip video m-line to sendrecv before offer.
   */
  _attachPreviewVideoIfSending() {
    const got = firstLivePreviewVideo();
    if (!got || !this.pc) return false;
    const { track, stream } = got;
    let attached = false;
    try {
      for (const tr of this.pc.getTransceivers?.() || []) {
        const kind = tr?.receiver?.track?.kind || tr?.sender?.track?.kind;
        if (kind !== "video") continue;
        const dir = String(tr.direction || "");
        if (
          (dir === "recvonly" || dir === "inactive") &&
          typeof tr.setDirection === "function"
        ) {
          try {
            tr.setDirection("sendrecv");
            attached = true;
          } catch (_) {}
        }
        if (tr.sender && !tr.sender.track) {
          try {
            tr.sender.replaceTrack(track);
            attached = true;
          } catch (_) {}
        }
      }
      const hasSender = (this.pc.getSenders?.() || []).some(
        (s) => s.track && s.track.kind === "video"
      );
      if (!hasSender) {
        try {
          this.pc.addTrack(track, stream);
          attached = true;
        } catch (_) {}
      }
    } catch (_) {}
    return attached;
  }

  /**
   * Late 3-way clone / replaceTrack on a recvonly slot must send.
   * @param {RTCRtpSender | null | undefined} sender
   */
  _promoteVideoSend(sender) {
    if (!sender || !this.pc) return;
    // 005410Z 1v1: setDirection after createOffer (have-local-offer) rewrites
    // m-lines → Android answer InvalidModificationError → ICE failed 0/0.
    if (this._offerSentOnce && !this._gotRemoteAnswerAt) {
      this._pendingPromoteSend = sender;
      return;
    }
    let flipped = false;
    try {
      const tr = (this.pc.getTransceivers?.() || []).find(
        (x) => x && x.sender === sender
      );
      const dir = String(tr?.direction || "");
      if (
        tr &&
        (dir === "recvonly" || dir === "inactive") &&
        typeof tr.setDirection === "function"
      ) {
        tr.setDirection("sendrecv");
        flipped = true;
      }
    } catch (_) {}
    // 234751Z: 3rd-join offer went recvonly then replaceTrack — remote SDP
    // still recvonly until we renegotiate. Once per PC, only if we flipped.
    // 004600Z: never re-offer before the first answer — second offer + first
    // answer → InvalidModificationError m-line order (ICE failed 0/0).
    if (
      flipped &&
      this.isOfferer &&
      !this._promotedSendRenego &&
      this._gotRemoteAnswerAt &&
      this._offerSentOnce &&
      this.pc.signalingState === "stable"
    ) {
      this._promotedSendRenego = true;
      try {
        void this._createAndSendOffer({ iceRestart: false });
      } catch (_) {}
    }
  }

  /**
   * Remote audio track is live (receivers or remoteStream).
   * Laptop no-cam / hide never gets videoWidth — this is the link signal.
   */
  _remoteAudioIsLive() {
    try {
      const recvs = this.pc?.getReceivers?.() || [];
      for (const r of recvs) {
        const t = r?.track;
        if (t && t.kind === "audio" && t.readyState === "live") return true;
      }
    } catch (_) {}
    try {
      const ats = this.remoteStream?.getAudioTracks?.() || [];
      if (ats.some((t) => t && t.readyState === "live")) return true;
    } catch (_) {}
    return false;
  }

  /**
   * Bound remote <video> for this PC. 3-way: keep assigned tile
   * (remote2 / remote-third). Never steal #remote from a sibling.
   * @returns {HTMLVideoElement | null}
   */
  _resolveRemoteVideoEl() {
    try {
      if (this.remoteStream && typeof document !== "undefined") {
        for (const id of ["remote", "remote2", "remote-third"]) {
          const el = document.getElementById(id);
          if (el && el.srcObject === this.remoteStream) {
            this._videoEl = el;
            return el;
          }
        }
      }
    } catch (_) {}
    try {
      const assigned = this._videoEl;
      if (assigned && assigned.isConnected !== false) return assigned;
    } catch (_) {}
    if (!this._videoEl && typeof document !== "undefined") {
      try {
        if (!this._multiPeerLink) {
          this._videoEl = document.getElementById("remote");
        }
      } catch (_) {}
    }
    return this._videoEl || null;
  }

  /** Remote inbound audio must stay enabled — do not start muted/disabled. */
  _enableRemoteAudioTracks() {
    try {
      enableInboundAudioTracks(this.pc);
    } catch (_) {}
    try {
      const ats = this.remoteStream?.getAudioTracks?.() || [];
      for (const t of ats) {
        if (!t) continue;
        try {
          if (t.enabled === false) t.enabled = true;
        } catch (_) {}
      }
    } catch (_) {}
  }

  /**
   * Unmuted play() after remote tracks. Catch autoplay reject — never
   * start muted (3-way tiles carry audio on the same <video>).
   * @param {HTMLVideoElement | null | undefined} el
   */
  _playRemoteVideo(el) {
    if (!el) return;
    try {
      el.playsInline = true;
      el.setAttribute?.("playsinline", "");
      el.setAttribute?.("webkit-playsinline", "");
      el.muted = false;
      el.defaultMuted = false;
      el.removeAttribute?.("muted");
    } catch (_) {}
    try {
      const p = el.play?.();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          try {
            el.muted = false;
            el.play?.().catch(() => {});
          } catch (_) {}
        });
      }
    } catch (_) {}
  }

  /** Attach an existing stream (from external preview manager). */
  setLocalStream(stream) {
    // Never stop previous tracks — preview + multi clones stay owned by
    // live.js (__ruletPreviewStream / __ruletReleasePeerOutbound).
    this.localStream = stream;
    this._tagTracks();
    // If PC already exists, push tracks so offer/answer includes cam
    if (this.pc && stream) {
      void this.syncLocalTracksToPc().catch(() => {});
    } else {
      try {
        this._ensureNoCamVideoRecvonly();
      } catch (_) {}
    }
  }

  /** Push current localStream tracks into an active peer connection. */
  async syncLocalTracksToPc() {
    if (!this.pc || !this.localStream) return;
    this._tagTracks();
    const senders = this.pc.getSenders() || [];
    for (const track of this.localStream.getTracks()) {
      // Prefer existing sender of same kind (incl. null-track transceiver).
      // Avoid addTrack spam — multi re-push must use replaceTrack only.
      let sender =
        senders.find((s) => s.track && s.track.id === track.id) ||
        senders.find((s) => s.track && s.track.kind === track.kind) ||
        null;
      if (!sender) {
        try {
          const tr = this.pc.getTransceivers?.() || [];
          for (const x of tr) {
            const st = x?.sender;
            if (!st) continue;
            if (st.track && st.track.id === track.id) {
              sender = st;
              break;
            }
            if (st.track && st.track.kind === track.kind) {
              sender = st;
              break;
            }
            // Empty video/audio slot from addTransceiver
            if (!st.track && x.receiver?.track?.kind === track.kind) {
              sender = st;
              break;
            }
          }
        } catch (_) {}
      }
      if (sender) {
        // Already bound — no replaceTrack churn
        if (sender.track === track) {
          if (track.kind === "video") this._promoteVideoSend(sender);
          continue;
        }
        if (typeof sender.replaceTrack === "function") {
          try {
            // prev may be preview real track or multi clone — never stop here
            await sender.replaceTrack(track);
            if (track.kind === "video") this._promoteVideoSend(sender);
            continue;
          } catch (_) {}
        }
      }
      // Mid-offer addTrack adds a new m-line → first answer fails (005410Z).
      if (this._offerSentOnce && !this._gotRemoteAnswerAt) {
        continue;
      }
      try {
        this.pc.addTrack(track, this.localStream);
      } catch (_) {}
    }
    try {
      this.localStream.getVideoTracks().forEach((t) => {
        if (t.enabled === false) t.enabled = true;
      });
    } catch (_) {}
    try {
      this._ensureNoCamVideoRecvonly();
    } catch (_) {}
    await this.applyQualityTier(this._qualityTier || "high");
  }

  setMicEnabled(enabled) {
    // Only toggle tracks on this.localStream (clones ok). Never touch preview
    // tracks by id when they are not attached to this.localStream.
    const stream = this.localStream;
    if (!stream) return;
    for (const t of stream.getAudioTracks()) {
      try {
        t.enabled = enabled;
      } catch (_) {}
    }
  }

  setCamEnabled(enabled) {
    // Only this.localStream video — multi clones yes; bare preview no-op if
    // not on this PC's stream.
    const stream = this.localStream;
    if (!stream) return;
    for (const t of stream.getVideoTracks()) {
      try {
        t.enabled = enabled;
      } catch (_) {}
    }
  }

  /**
   * @param {keyof typeof QUALITY_TIERS | string} tier
   */
  async applyQualityTier(tier) {
    let capped = clampQualityTier(tier, this._qualityCeiling || "high");
    // Android multi: map min→low so scale+bitrate does not freeze encoders
    capped = mobileSafeMultiTier(capped, this);
    const t = QUALITY_TIERS[capped] || QUALITY_TIERS.mid;
    this._qualityTier = t.label;
    if (!this.pc) return;
    for (const sender of this.pc.getSenders()) {
      if (!sender.track) continue;
      if (sender.track.kind === "video") {
        await applySenderEncoding(sender, {
          maxBitrate: t.maxBitrate,
          maxFramerate: t.maxFramerate,
          scaleResolutionDownBy: t.scaleResolutionDownBy || 1,
          degradationPreference: "balanced",
        });
      } else if (sender.track.kind === "audio") {
        // ~32 kbps speech Opus — lower encode buffering than music-rate bitrates
        await applySenderEncoding(sender, { maxBitrate: 32_000 });
      }
    }
    this.hooks.onQualityTier?.(this._qualityTier, t);
  }

  _startAdaptiveQuality() {
    this._stopAdaptiveQuality();
    this._lastBytes = 0;
    this._lastTs = 0;
    this._lossEma = 0;
    this._rttEma = 0;
    this._relayPath = isRelayMediaMode();
    // Relay (Hide IP) needs tighter adapt loop — jitter drifts faster
    const period = this._relayPath ? 1800 : 2500;
    this._adaptTimer = setInterval(() => this._adaptOnce(), period);
  }

  _stopAdaptiveQuality() {
    if (this._adaptTimer) {
      clearInterval(this._adaptTimer);
      this._adaptTimer = 0;
    }
  }

  async _adaptOnce() {
    if (!this.pc) return;
    // Hold low until first paint OR live remote audio (no-cam laptop
    // never gets videoWidth — audio is enough to leave the low hold).
    try {
      const el = this._videoEl;
      const videoOk = !!(el && el.videoWidth > 8 && el.readyState >= 2);
      if (!videoOk && !this._remoteAudioIsLive()) return;
    } catch (_) {
      return;
    }
    try {
      const report = await this.pc.getStats();
      let rtt = 0;
      let loss = 0;
      let bytes = 0;
      let rttN = 0;
      let lossN = 0;
      let audioJitter = 0;
      let videoJitter = 0;
      let audioJitterN = 0;
      let videoJitterN = 0;
      /** @type {Map<string, any>} */
      const byId = new Map();
      report.forEach((r) => byId.set(r.id, r));

      report.forEach((r) => {
        if (r.type === "candidate-pair" && (r.state === "succeeded" || r.nominated)) {
          if (typeof r.currentRoundTripTime === "number") {
            rtt += r.currentRoundTripTime * 1000;
            rttN++;
          }
          // Detect TURN relay path for playout / quality policy
          try {
            const local = byId.get(r.localCandidateId);
            const remote = byId.get(r.remoteCandidateId);
            const lt = String(local?.candidateType || local?.type || "").toLowerCase();
            const rt = String(remote?.candidateType || remote?.type || "").toLowerCase();
            if (lt === "relay" || rt === "relay") this._relayPath = true;
          } catch (_) {}
        }
        if (r.type === "outbound-rtp" && !r.isRemote && r.kind === "video") {
          if (typeof r.packetsSent === "number" && typeof r.packetsLost === "number") {
            // packetsLost may be on inbound from remote; some browsers expose NACK count
          }
          if (typeof r.bytesSent === "number") bytes += r.bytesSent;
          if (typeof r.qualityLimitationReason === "string" && r.qualityLimitationReason === "bandwidth") {
            loss += 0.05;
            lossN++;
          }
        }
        if (r.type === "inbound-rtp" && !r.isRemote && (r.kind === "video" || r.mediaType === "video")) {
          if (typeof r.packetsLost === "number" && typeof r.packetsReceived === "number") {
            const tot = r.packetsLost + r.packetsReceived;
            if (tot > 20) {
              loss += r.packetsLost / tot;
              lossN++;
            }
          }
          if (typeof r.jitter === "number") {
            videoJitter += r.jitter;
            videoJitterN++;
            // jitter in seconds — relay paths often sit higher
            const jLim = this._relayPath || isRelayMediaMode() ? 0.055 : 0.04;
            if (r.jitter > jLim) {
              loss += 0.02;
              lossN++;
            }
          }
        }
        if (r.type === "inbound-rtp" && !r.isRemote && (r.kind === "audio" || r.mediaType === "audio")) {
          if (typeof r.jitter === "number") {
            audioJitter += r.jitter;
            audioJitterN++;
            const jLim = this._relayPath || isRelayMediaMode() ? 0.065 : 0.05;
            if (r.jitter > jLim) {
              loss += 0.015;
              lossN++;
            }
          }
        }
      });

      if (rttN) this._rttEma = this._rttEma ? this._rttEma * 0.7 + (rtt / rttN) * 0.3 : rtt / rttN;
      if (lossN) this._lossEma = this._lossEma ? this._lossEma * 0.6 + (loss / lossN) * 0.4 : loss / lossN;

      let next = this._qualityTier || "high";
      const rttMs = this._rttEma;
      const lossP = this._lossEma;
      const relay = !!(this._relayPath || isRelayMediaMode());

      // Relay (Hide IP): slightly earlier quality step-down — freerzes hurt lipsync more than mild res drop
      if (relay) {
        if (lossP > 0.1 || rttMs > 380) next = "min";
        else if (lossP > 0.05 || rttMs > 240) next = "low";
        else if (lossP > 0.025 || rttMs > 160) next = "mid";
        else if (lossP < 0.012 && rttMs < 110) next = "high";
      } else {
        if (lossP > 0.12 || rttMs > 450) next = "min";
        else if (lossP > 0.06 || rttMs > 280) next = "low";
        else if (lossP > 0.03 || rttMs > 180) next = "mid";
        else if (lossP < 0.015 && rttMs < 120) next = "high";
      }
      // Multi-party ceiling (secondary streams stay cheaper to encode)
      next = clampQualityTier(next, this._qualityCeiling || "high");
      // Android multi: adaptive path must not land on "min" either
      next = mobileSafeMultiTier(next, this);

      if (next !== this._qualityTier) {
        await this.applyQualityTier(next);
      }

      // Matched A/V playout target (same ms for both) — critical for relay lipsync
      let target = playoutTargetForTier(next, { relay });

      // If measured audio lags video (or reverse), raise *both* targets together
      // — but don't thrash (smooth toward last target; cap so we don't balloon).
      try {
        const lag = await this.estimateAvPlayoutLag();
        if (lag && lag.lagMs != null && Math.abs(lag.lagMs) > 70) {
          const bump = Math.min(35, Math.abs(lag.lagMs) * 0.28);
          target = Math.min(160, target + bump);
        }
      } catch (_) {}
      // Smooth playout changes — abrupt jitterBufferTarget jumps cause glitches
      const prev = Number(this._lastPlayoutTarget) || target;
      if (Math.abs(target - prev) > 8) {
        target = prev + Math.sign(target - prev) * Math.min(12, Math.abs(target - prev));
      }

      applyLowLatencyPlayout(this.pc, target);
      this._lastPlayoutTarget = target;
    } catch (_) {}
  }

  /**
   * Soft ICE restart (offerer creates a new offer). Safe no-op if not connected.
   * Used by find-3rd / 1v1 soft-recover when a path fails without hanging up.
   * @param {{ force?: boolean }} [opts]
   * @returns {Promise<boolean>}
   */
  async softIceRestart(opts = {}) {
    if (!this.pc) return false;
    try {
      // force: live soft-recover may race the auto-restart on ice=failed
      return !!(await this._tryIceRestart({ force: opts.force !== false }));
    } catch (e) {
      console.warn("[webrtc] softIceRestart", e);
    }
    return false;
  }

  /**
   * Current ICE / PC health for live soft-recover and tab-resume checks.
   * @returns {{ ice: string, cs: string, ok: boolean, bad: boolean }}
   */
  iceHealth() {
    const ice = this.pc?.iceConnectionState || "";
    const cs = this.pc?.connectionState || "";
    const ok =
      ice === "connected" ||
      ice === "completed" ||
      cs === "connected";
    const bad =
      ice === "failed" ||
      ice === "disconnected" ||
      ice === "closed" ||
      cs === "failed" ||
      cs === "disconnected" ||
      cs === "closed";
    return { ice, cs, ok, bad };
  }

  /**
   * Estimate receive jitter-buffer delay (ms) for audio and video from getStats.
   * @returns {Promise<{ audioMs: number|null, videoMs: number|null, lagMs: number|null }>}
   */
  async estimateAvPlayoutLag() {
    const out = { audioMs: null, videoMs: null, lagMs: null };
    if (!this.pc) return out;
    try {
      const report = await this.pc.getStats();
      report.forEach((r) => {
        if (r.type !== "inbound-rtp" || r.isRemote) return;
        const emitted = Number(r.jitterBufferEmittedCount) || 0;
        const delay = Number(r.jitterBufferDelay);
        if (!(emitted > 0) || !Number.isFinite(delay)) return;
        // delay is in seconds cumulative
        const ms = (delay / emitted) * 1000;
        if (r.kind === "audio" || r.mediaType === "audio") out.audioMs = ms;
        if (r.kind === "video" || r.mediaType === "video") out.videoMs = ms;
      });
      if (out.audioMs != null && out.videoMs != null) {
        out.lagMs = out.audioMs - out.videoMs; // + = audio behind video
      } else if (out.audioMs != null) {
        out.lagMs = out.audioMs > 80 ? out.audioMs - 40 : 0;
      }
    } catch (_) {}
    return out;
  }

  /**
   * Wire a chat data channel (offerer creates; answerer receives via ondatachannel).
   * @param {RTCDataChannel} dc
   */
  _attachChatDc(dc) {
    if (!dc) return;
    // Prefer the first open/ready channel; replace closed one
    if (this._chatDc && this._chatDc !== dc && this._chatDc.readyState === "open") {
      try {
        dc.close();
      } catch (_) {}
      return;
    }
    this._chatDc = dc;
    dc.binaryType = "arraybuffer";
    dc.onopen = () => {
      this._chatDcOpen = true;
      try {
        this.hooks.onDataChannel?.(true);
      } catch (_) {}
    };
    dc.onclose = () => {
      if (this._chatDc === dc) {
        this._chatDcOpen = false;
        this._chatDc = null;
        try {
          this.hooks.onDataChannel?.(false);
        } catch (_) {}
      }
    };
    dc.onerror = () => {
      /* browser fires close after error in most cases */
    };
    dc.onmessage = (ev) => {
      try {
        let raw = "";
        const d = ev?.data;
        if (typeof d === "string") raw = d;
        else if (d instanceof ArrayBuffer) {
          raw = new TextDecoder("utf-8").decode(new Uint8Array(d));
        } else if (ArrayBuffer.isView?.(d)) {
          raw = new TextDecoder("utf-8").decode(
            new Uint8Array(d.buffer, d.byteOffset, d.byteLength)
          );
        }
        if (!raw) return;
        const msg = JSON.parse(raw);
        if (!msg || typeof msg !== "object") return;
        this.hooks.onDataMessage?.(msg);
      } catch (e) {
        console.warn("[webrtc] bad datachannel message", e);
      }
    };
    if (dc.readyState === "open") {
      this._chatDcOpen = true;
      try {
        this.hooks.onDataChannel?.(true);
      } catch (_) {}
    }
  }

  /** @returns {boolean} */
  isChatDcOpen() {
    return !!(this._chatDc && this._chatDc.readyState === "open" && this._chatDcOpen);
  }

  /**
   * Send a JSON-serializable object over the P2P chat channel.
   * @param {object} obj
   * @returns {boolean} true if queued on an open channel
   */
  sendChatMessage(obj) {
    if (!this.isChatDcOpen() || !this._chatDc) return false;
    try {
      const s = JSON.stringify(obj);
      if (s.length > 8000) return false;
      this._chatDc.send(s);
      return true;
    } catch (e) {
      console.warn("[webrtc] datachannel send failed", e);
      return false;
    }
  }

  async connect() {
    // CRITICAL: never tear down a PC that is already negotiating / live.
    // Double connect() was closing PC1 mid-offer and sending a second offer
    // (hub logs: offer → answer → offer ~0.3s later) → black video thrash.
    // Pure-relay (hide_ip / force_relay): rebuild if PC is not policy=relay.
    try {
      applyIceDirectPreference();
    } catch (_) {}
    const needRelayRebuild =
      isRelayMediaMode() &&
      this.pc &&
      !this._relayPc &&
      this.pc.iceConnectionState !== "connected" &&
      this.pc.iceConnectionState !== "completed" &&
      !(
        this.remoteStream &&
        (this.remoteStream.getVideoTracks?.() || []).some(
          (t) => t.readyState === "live"
        )
      );
    if (needRelayRebuild) {
      console.info("[webrtc] connect() rebuild — pure-relay PC (hide/force)");
      try {
        this.pc.close();
      } catch (_) {}
      this.pc = null;
      this._offerInFlight = false;
      this._offerSentOnce = false;
    } else if (
      this.pc &&
      this.pc.signalingState !== "closed" &&
      this.pc.connectionState !== "closed" &&
      // Pure relay only thrash-rebuild via needRelayRebuild above
      !(isRelayMediaMode() && !this._relayPc) &&
      (this.pc.localDescription ||
        this.pc.remoteDescription ||
        this._offerInFlight ||
        this.pc.signalingState === "have-local-offer" ||
        this.pc.signalingState === "have-remote-offer" ||
        this.pc.iceConnectionState === "connected" ||
        this.pc.iceConnectionState === "completed" ||
        this.pc.connectionState === "connected")
    ) {
      // Do NOT keep on ice=checking alone — that was black forever after
      // failed TURN/hairpin rematches (zero new offers on hub).
      console.info(
        "[webrtc] connect() skip — PC already active",
        this.pc.signalingState,
        this.pc.iceConnectionState
      );
      // CRITICAL: still ensure SDP. Skip used to leave answerer with no watchdog
      // while phone-offerer stayed silent 15–25s → "still slow".
      if (this.isOfferer && !this._offerSentOnce && !this._offerInFlight) {
        void this._createAndSendOffer({ iceRestart: false });
      }
      // Answerer: wait for their offer. Do not arm promote-watchdog.
      return;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this._chatDc = null;
    this._chatDcOpen = false;
    this._pendingRemoteIce = [];
    // Always refresh policy before PC (match may have armed force_relay mid-flight)
    try {
      applyIceDirectPreference();
    } catch (_) {}
    // Promote queue warm PC when policy matches — TURN already allocated
    // (biggest Play↔browser first-frame win). Else free warm and create cold.
    // Pure hide_ip / force_relay → warm "relay". Normal → warm "all".
    const wantPure = isRelayMediaMode();
    // Extra 3rd-join (laptop answer + PC extra offer): Chrome setLocal on
    // iceTransportPolicy=relay waits TURN ALLOCATE ~6s (22:31 +5901 / +6823,
    // relay=0). Use policy=all + existing relay filter/trickle. 1v1 stays relay.
    const extraFast = isMultiPeerFastMode(this);
    let promoted = false;
    try {
      if (extraFast) {
        // Do not promote a relay-policy warm PC (same 6s setLocal).
      } else if (
        typeof takeWarmPc === "function" &&
        warmPcPolicy() === (wantPure ? "relay" : "all")
      ) {
        const warm = takeWarmPc();
        if (warm && warm.signalingState !== "closed") {
          this.pc = warm;
          promoted = true;
          console.info(
            "[webrtc] connect() promoted warm PC pure=" + (wantPure ? 1 : 0)
          );
        }
      } else if (typeof clearIceWarm === "function") {
        clearIceWarm();
      }
    } catch (_) {
      try {
        if (typeof clearIceWarm === "function") clearIceWarm();
      } catch (_) {}
    }
    if (!this.pc) {
      const cfg =
        extraFast && iceConfig.iceTransportPolicy === "relay"
          ? {
              ...iceConfig,
              iceTransportPolicy: "all",
              iceCandidatePoolSize: 0,
            }
          : iceConfig;
      this.pc = new RTCPeerConnection(cfg);
    }
    // Dirty pure-warm was closed in takeWarmPc — still mark path primed
    try {
      applyPendingWarmPrimed(this.pc);
    } catch (_) {}
    this._pcBornAt = Date.now();
    this._relayPc =
      iceConfig.iceTransportPolicy === "relay" || wantPure || extraFast;
    this._offerInFlight = false;
    this._offerSentOnce = false;
    this._offerEmitOk = false;
    this._answeredAt = 0;
    this._gotRemoteAnswerAt = 0;
    this._lastOfferAt = 0;
    this._pendingRemoteOfferSince = 0;
    this._iceEverOk = false;
    this.pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      // Hide IP pure: only trickle typ relay.
      if (
        shouldFilterToRelayCandidates() &&
        !isRelayIceCandidate(ev.candidate)
      ) {
        return;
      }
      // Same-IP force_relay: do not trickle TCP relay — Android is UDP-only.
      if (
        shouldPreferUdpRelay() &&
        isRelayIceCandidate(ev.candidate) &&
        !isUdpRelayIceCandidate(ev.candidate)
      ) {
        return;
      }
      // force_relay / hide: never trickle typ host (mDNS or private).
      if (shouldStripHostCandidates() && isHostIceCandidate(ev.candidate)) {
        return;
      }
      // Belt: drop mDNS host even on normal path.
      if (isMdnsHostIceCandidate(ev.candidate)) return;
      this._emitSignal("ice", JSON.stringify(ev.candidate));
      // First-frame forensics
      try {
        if (
          typeof window !== "undefined" &&
          window.__ruletConnectT0 &&
          window.__ruletConnect &&
          window.__ruletConnect.firstIceMs == null
        ) {
          window.__ruletConnect.firstIceMs =
            Date.now() - window.__ruletConnectT0;
          console.info(
            "[webrtc] first ice out +" + window.__ruletConnect.firstIceMs + "ms"
          );
        }
      } catch (_) {}
    };
    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const cs = this.pc.connectionState;
      if (cs === "connected" || cs === "completed") this._iceEverOk = true;
      this.hooks.onConnectionState?.(cs);
      if (cs === "connected") {
        this._startAdaptiveQuality();
        kickMediaAfterIce(this.pc);
        try {
          if (
            typeof window !== "undefined" &&
            window.__ruletConnectT0 &&
            window.__ruletConnect &&
            window.__ruletConnect.iceMs == null
          ) {
            window.__ruletConnect.iceMs =
              Date.now() - window.__ruletConnectT0;
          }
        } catch (_) {}
        // Re-push cam so partner gets a keyframe ASAP (TURN black lag)
        try {
          if (
            typeof window !== "undefined" &&
            typeof window.pushOutboundVideoTracks === "function"
          ) {
            void window.pushOutboundVideoTracks();
          }
        } catch (_) {}
        try {
          if (this.remoteStream) this.hooks.onRemoteStream?.(this.remoteStream);
        } catch (_) {}
        void this.reportAvPath("connected");
        this._armAvPathBeacons();
      }
      if (cs === "failed" || cs === "closed" || cs === "disconnected") {
        // keep adapting a bit on disconnected; stop on failed/closed
        if (cs === "failed" || cs === "closed") {
          this._stopAdaptiveQuality();
        }
      }
    };
    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      const ice = this.pc.iceConnectionState;
      if (ice === "connected" || ice === "completed") this._iceEverOk = true;
      this.hooks.onIceConnectionState?.(ice);
      if (ice === "failed") {
        // ICE restart can recover after NAT/path change (rate-limited)
        this._tryIceRestart();
        this.hooks.onConnectionState?.("failed");
      } else if (ice === "disconnected") {
        // Brief disconnect is common on mobile handoff; restart only if stuck
        this._scheduleDisconnectedIceProbe();
        this.hooks.onConnectionState?.(this.pc.connectionState);
      } else if (ice === "checking" || ice === "connected" || ice === "completed") {
        // Keyframe as soon as ICE starts checking — don't wait for "connected"
        // (TURN path often sits in checking 1–3s before first frame).
        if (ice === "checking") {
          try {
            kickMediaAfterIce(this.pc);
          } catch (_) {}
        }
      }
      if (ice === "connected" || ice === "completed") {
        this._clearDisconnectedIceProbe();
        this._iceRestartCount = 0;
        this._startAdaptiveQuality();
        kickMediaAfterIce(this.pc);
        void this.reportAvPath("ice_" + ice);
        this._armAvPathBeacons();
        try {
          if (
            typeof window !== "undefined" &&
            typeof window.pushOutboundVideoTracks === "function"
          ) {
            void window.pushOutboundVideoTracks();
          }
        } catch (_) {}
        // Soft paint if track already present (hard rebind on ICE thrash = flicker)
        try {
          this._enableRemoteAudioTracks();
          if (this.remoteStream) {
            const el = this._resolveRemoteVideoEl();
            if (el) {
              let painting = false;
              try {
                painting =
                  el.srcObject === this.remoteStream &&
                  el.videoWidth > 0 &&
                  el.readyState >= 2;
              } catch (_) {}
              if (!painting && el.srcObject !== this.remoteStream) {
                el.srcObject = this.remoteStream;
              }
              this._playRemoteVideo(el);
            }
          }
          if (this.remoteStream) this.hooks.onRemoteStream?.(this.remoteStream);
        } catch (_) {}
      }
    };
    this.pc.ontrack = (ev) => {
      // Prefer browser-provided stream (RN often puts video on streams[0])
      try {
        if (ev.streams && ev.streams[0]) {
          this.remoteStream = ev.streams[0];
        } else if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
      } catch (_) {
        if (!this.remoteStream) this.remoteStream = new MediaStream();
      }
      // Detect audio-first → video-later (PC often blacks if #remote bound audio-only)
      let audioFirstVideoLater = false;
      try {
        if (ev.track?.kind === "video") {
          const priorV = (this.remoteStream.getVideoTracks?.() || []).length;
          const priorA = (this.remoteStream.getAudioTracks?.() || []).length;
          audioFirstVideoLater =
            !!this._gotRemoteAudio && !this._gotRemoteVideo && priorA > 0;
          // also when stream already had audio and this is first video track add
          if (!audioFirstVideoLater && priorA > 0 && priorV === 0) {
            audioFirstVideoLater = true;
          }
          this._gotRemoteVideo = true;
        } else if (ev.track?.kind === "audio") {
          this._gotRemoteAudio = true;
        }
      } catch (_) {}
      try {
        const exists = this.remoteStream
          .getTracks()
          .some((t) => t.id === ev.track.id);
        if (!exists) this.remoteStream.addTrack(ev.track);
      } catch (_) {}
      // Partner may send disabled/muted A/V — force enable; audio never starts muted
      try {
        if (ev.track && ev.track.enabled === false) ev.track.enabled = true;
      } catch (_) {}
      this._enableRemoteAudioTracks();
      applyLowLatencyPlayout(this.pc);
      if (ev.track?.kind === "video") {
        try {
          requestOutboundKeyframes(this.pc);
        } catch (_) {}
        if (audioFirstVideoLater) {
          try {
            console.info(
              "[webrtc] late video after audio — hard re-paint #remote + force play"
            );
          } catch (_) {}
        }
      }
      // Bound tile first (3-way: remote2 / remote-third). Do not steal #remote.
      if (!this._videoEl) this._resolveRemoteVideoEl();
      // First video after audio needs one hard rebind; later paint waves must NOT
      // null→srcObject thrash (PC browser flicker while linking).
      let needHardVideoBind =
        ev.track?.kind === "video" && audioFirstVideoLater;
      const paint = (opts) => {
        if (!this.remoteStream) return;
        const hard = !!(opts && opts.hard) || needHardVideoBind;
        const el = this._resolveRemoteVideoEl();
        if (!el) return;
        this._videoEl = el;
        try {
          // Hard-show (empty overlay / hidden attr left black with HOT RTP)
          try {
            el.hidden = false;
            el.removeAttribute?.("hidden");
            el.style.setProperty("display", "block", "important");
            el.style.setProperty("opacity", "1", "important");
            el.style.setProperty("visibility", "visible", "important");
            el.style.setProperty("z-index", "5", "important");
          } catch (_) {}
          const same = el.srcObject === this.remoteStream;
          let painting = false;
          try {
            painting = same && el.videoWidth > 0 && el.readyState >= 2;
          } catch (_) {}
          if (painting) {
            // Already showing frames — never null-rebind (was PC flicker while linking)
          } else if (same && !hard) {
            // Same stream soft-attach: assign only if missing; never null thrash
            try {
              if (!el.srcObject) el.srcObject = this.remoteStream;
            } catch (_) {
              try {
                el.srcObject = this.remoteStream;
              } catch (_) {}
            }
          } else {
            // Stream changed, or one-shot hard rebind after audio-first video
            try {
              if (hard && same) el.srcObject = null;
            } catch (_) {}
            try {
              el.srcObject = this.remoteStream;
            } catch (_) {
              try {
                el.srcObject = this.remoteStream;
              } catch (_) {}
            }
            if (hard) needHardVideoBind = false; // only once per late-video track
          }
          this._enableRemoteAudioTracks();
          this._playRemoteVideo(el);
          try {
            document.getElementById("tile-remote")?.classList.add("has-remote-feed");
            document.getElementById("remote-empty")?.classList.add("hidden");
          } catch (_) {}
        } catch (_) {}
      };
      // Hard only for audio→video upgrade; first pure video bind is soft assign
      paint({
        hard: needHardVideoBind,
      });
      if (ev.track?.kind === "video") {
        // Subsequent waves soft only
        needHardVideoBind = false;
        try {
          if (
            typeof window !== "undefined" &&
            window.__ruletConnectT0 &&
            window.__ruletConnect &&
            window.__ruletConnect.trackMs == null
          ) {
            window.__ruletConnect.trackMs =
              Date.now() - window.__ruletConnectT0;
            const c = window.__ruletConnect;
            console.info(
              "[webrtc] CONNECT offer=" +
                (c.offerMs ?? "?") +
                " answer=" +
                (c.answerMs ?? "?") +
                " track=" +
                c.trackMs +
                "ms kind=video" +
                (audioFirstVideoLater ? " late_after_audio" : "")
            );
            try {
              localStorage.setItem(
                "ruletka-last-connect-v1",
                JSON.stringify({
                  offerMs: c.offerMs ?? null,
                  answerMs: c.answerMs ?? null,
                  iceMs: c.iceMs ?? null,
                  trackMs: c.trackMs ?? null,
                  at: Date.now(),
                })
              );
            } catch (_) {}
          }
        } catch (_) {}
        // Fewer soft waves — old dense null→rebind waves flickered PC while linking
        const waves = audioFirstVideoLater
          ? [80, 250, 800, 2000]
          : [120, 500, 1500];
        for (const ms of waves) setTimeout(() => paint({ hard: false }), ms);
        try {
          if (typeof ev.track.addEventListener === "function") {
            const onUnmute = () => paint({ hard: false });
            ev.track.addEventListener("unmute", onUnmute);
            ev.track.addEventListener("mute", () => {
              /* repaint on unmute */
            });
          }
        } catch (_) {}
      }
      this.hooks.onRemoteStream?.(this.remoteStream);
      // Late video: re-fire hook so live.js updates overlays (soft paint only)
      if (audioFirstVideoLater) {
        for (const ms of [200, 1000]) {
          setTimeout(() => {
            try {
              paint({ hard: false });
              this.hooks.onRemoteStream?.(this.remoteStream);
            } catch (_) {}
          }, ms);
        }
      }
    };
    // Answerer: remote offerer creates the chat channel
    this.pc.ondatachannel = (ev) => {
      if (ev?.channel && ev.channel.label === CHAT_DC_LABEL) {
        this._attachChatDc(ev.channel);
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }
    }
    // Offerer must advertise A+V even when GUM is audio-only (no-cam laptop).
    // Video slot is recvonly — sendrecv with no track makes Android attach a
    // muted dummy remote video and sit on "Linking cameras…" forever.
    // Laptop still receives the phone camera; phone sees no video track →
    // existing 384 2.2s no-cam portrait (and no_cam advertise) can fire.
    if (this.isOfferer) {
      const kinds = new Set(
        (this.localStream?.getTracks?.() || []).map((t) => t && t.kind)
      );
      try {
        if (!kinds.has("audio")) {
          this.pc.addTransceiver("audio", { direction: "sendrecv" });
        }
        if (!kinds.has("video")) {
          // True no-cam: recvonly (sendrecv empty → Android dummy / Linking).
          // Preview cam (3-way clone pending in live.js): sendrecv slot so
          // later replaceTrack actually sends.
          this.pc.addTransceiver("video", {
            direction: previewHasLiveVideo() ? "sendrecv" : "recvonly",
          });
        }
      } catch (e) {
        console.warn("[webrtc] addTransceiver fallback", e);
      }
    }
    try {
      this._ensureNoCamVideoRecvonly();
    } catch (_) {}

    // Offerer must create DC before createOffer so it appears in SDP
    if (this.isOfferer) {
      try {
        const dc = this.pc.createDataChannel(CHAT_DC_LABEL, {
          ordered: true,
        });
        this._attachChatDc(dc);
      } catch (e) {
        console.warn("[webrtc] createDataChannel failed", e);
      }
    }

    preferCodecs(this.pc);
    // First path: hold low until first paint — timed mid re-encode delayed TURN keyframe.
    this._qualityTier = "low";
    void this.applyQualityTier("low");
    this._armQualityRampAfterFrame();

    // Offerer: retry if first createOffer never emitted.
    // Answerer: wait for peer offer — never 4.5s self-promote (1v1 one-way).
    if (this.isOfferer) this._armOfferWatchdog(2500);
    if (this.isOfferer) {
      const t0 = Date.now();
      await this._createAndSendOffer({ iceRestart: false });
      console.info("[webrtc] offer path ms", Date.now() - t0);
      this._clearOfferWatchdog();
    }
    // After connect: re-push outbound cam (live.js wires this to real tracks
    // unless user Hide is active). Fixes phone seeing black while browser ok.
    // Must NOT trigger a second createOffer (replaceTrack only).
    try {
      this.hooks.onConnectionState?.("tracks_sync");
      if (typeof this.hooks.onNeedOutboundSync === "function") {
        void this.hooks.onNeedOutboundSync();
      } else if (
        typeof window !== "undefined" &&
        typeof window.pushOutboundVideoTracks === "function"
      ) {
        void window.pushOutboundVideoTracks();
      }
    } catch (_) {}
    // After 1v1 takes the search warm, refill so a later 3rd extra can
    // promote a primed relay PC instead of a cold 5s ALLOCATE.
    try {
      if (typeof warmIcePool === "function") {
        warmIcePool({ preferRelay: wantPure });
      }
    } catch (_) {}
  }

  _clearOfferWatchdog() {
    try {
      if (this._offerWatchTimer) clearTimeout(this._offerWatchTimer);
    } catch (_) {}
    this._offerWatchTimer = null;
  }

  /**
   * Offerer: retry if first createOffer never emitted.
   * Answerer: NEVER self-promote (1v1 one-way: Calgary offer@5s after hub
   * said answer — dual-offer, partner frames_out=0). Gotcha 52 + 1v1 belt.
   */
  _armOfferWatchdog(ms = 800) {
    this._clearOfferWatchdog();
    if (this.answerOnly || !this.isOfferer) return;
    this._offerWatchTimer = setTimeout(() => {
      this._offerWatchTimer = null;
      try {
        if (!this.pc) return;
        if (this.pc.remoteDescription || this.pc.currentRemoteDescription) return;
        if (this._offerSentOnce || this._offerInFlight) return;
        if (
          this._pendingRemoteOfferSince &&
          Date.now() - this._pendingRemoteOfferSince < 4000
        ) {
          console.info("[webrtc] offer watchdog — skip, remote offer pending");
          return;
        }
        if (this._answeredAt) return;
        if (!this.isOfferer) return;
        const live =
          this.remoteStream &&
          (this.remoteStream.getVideoTracks?.() || []).some(
            (t) => t.readyState === "live"
          );
        if (live) return;
        console.info("[webrtc] offer watchdog — retry stuck offerer");
        void this._createAndSendOffer({ iceRestart: false });
      } catch (e) {
        console.warn("[webrtc] offer watchdog", e);
      }
    }, ms);
  }

  /**
   * Debounced createOffer. Blocks double-offer thrash (glare with phone promote).
   * @param {{ iceRestart?: boolean, earlyBlack?: boolean }} [opts]
   * @returns {Promise<boolean>}
   */
  async _createAndSendOffer(opts = {}) {
    if (this.answerOnly) {
      this.isOfferer = false;
      console.info("[webrtc] skip offer — answerOnly (solo 3rd)");
      return false;
    }
    if (!this.pc || !this.isOfferer) return false;
    const iceRestart = !!opts.iceRestart;
    const earlyBlack = !!opts.earlyBlack;
    const now = Date.now();
    // Already building an offer
    if (this._offerInFlight) return false;
    // Match-level gate: ONE offer per match for 1v1 only.
    // 3-way: laptop must offer this-PC AND Android. Global lock + 12s
    // "already offered" skipped the 2nd createOffer (659: laptop sees PC,
    // Android extra ice=new 0/0, no laptop offerer beacon).
    const multiMesh = isMultiPeerFastMode(this);
    try {
      if (typeof window !== "undefined" && !multiMesh) {
        const hard = window.__ruletMatchOfferAt || 0;
        // Only block if a prior offer actually left the wire.
        if (!iceRestart && hard && now - hard < 12000 && this._offerEmitOk) {
          console.info("[webrtc] skip offer — match already offered", now - hard);
          return false;
        }
        // Stale stamp without emit — free so recovery can proceed (hop10: 500ms)
        if (
          !iceRestart &&
          hard &&
          !this._offerEmitOk &&
          now - hard > 500
        ) {
          try {
            window.__ruletMatchOfferAt = 0;
            window.__ruletMatchOfferLock = 0;
          } catch (_) {}
        }
        // Stale lock without emit (attempt >500ms, no _offerEmitOk) — free
        if (!iceRestart && window.__ruletMatchOfferLock && !this._offerEmitOk) {
          const att = window.__ruletMatchOfferAttemptAt || 0;
          if (!att || now - att > 500) {
            try {
              window.__ruletMatchOfferLock = 0;
              window.__ruletMatchOfferAttemptAt = 0;
              if (!this._offerEmitOk) window.__ruletMatchOfferAt = 0;
            } catch (_) {}
          }
        }
        // iceRestart blocked 45s after first offer once answer exists.
        // Re-offer@20s on pure force_relay killed settling media (2026-08-10).
        if (
          iceRestart &&
          hard &&
          now - hard < 45000 &&
          (this._gotRemoteAnswerAt || this.pc?.currentRemoteDescription)
        ) {
          console.info(
            "[webrtc] skip iceRestart — first path still in grace",
            now - hard,
            earlyBlack ? "earlyBlack" : ""
          );
          return false;
        }
      }
    } catch (_) {}
    // After we answered a remote offer, never re-offer unless iceRestart
    // (was: second offer ~0.7s later → hub debounce drop → 18–24s silence).
    if (
      !iceRestart &&
      this._answeredAt &&
      now - this._answeredAt < 15000
    ) {
      console.info(
        "[webrtc] skip offer — already answered",
        now - this._answeredAt
      );
      return false;
    }
    // Offerer path: we received their answer — renegotiation only via iceRestart.
    if (
      !iceRestart &&
      this._gotRemoteAnswerAt &&
      now - this._gotRemoteAnswerAt < 15000
    ) {
      console.info(
        "[webrtc] skip offer — already got remote answer",
        now - this._gotRemoteAnswerAt
      );
      return false;
    }
    // One non-restart offer per PC lifetime (phone double-offer thrash)
    if (!iceRestart && this._offerSentOnce && this._offerEmitOk) {
      console.info("[webrtc] skip offer — already sent this PC");
      return false;
    }
    // Latch without wire — allow recovery createOffer
    if (!iceRestart && this._offerSentOnce && !this._offerEmitOk) {
      this._offerSentOnce = false;
    }
    // iceRestart grace. earlyBlack was 3.5s → offer thrash@4s (hub 20:27) and
    // peer_usage one-way STUN only. First path needs ≥15s before renego.
    const pcAge = this._pcBornAt ? now - this._pcBornAt : 99999;
    const matchAge =
      typeof matchMediaGraceAt !== "undefined" && matchMediaGraceAt
        ? now - matchMediaGraceAt
        : pcAge;
    const hasRemote = !!(
      this._gotRemoteAnswerAt ||
      this.pc?.currentRemoteDescription
    );
    // Frames painted (videoWidth) — not mere track presence (black is still black)
    const hasPaintedRemote = (() => {
      try {
        const el = this._videoEl;
        if (el && el.videoWidth > 8 && el.readyState >= 2) return true;
      } catch (_) {}
      try {
        if (
          typeof window !== "undefined" &&
          window.__ruletConnect &&
          window.__ruletConnect.frameMs != null
        ) {
          return true;
        }
      } catch (_) {}
      return false;
    })();
    // Absolute: never iceRestart-offer if we already got an answer and ICE is
    // still checking/connecting (renego mid-check = black forever).
    if (
      iceRestart &&
      hasRemote &&
      (this.pc.iceConnectionState === "checking" ||
        this.pc.iceConnectionState === "new" ||
        this.pc.connectionState === "connecting")
    ) {
      console.info(
        "[webrtc] skip iceRestart — first ICE still in progress",
        this.pc.iceConnectionState
      );
      return false;
    }
    const iceGrace = earlyBlack
      ? 45000
      : hasRemote
        ? hasPaintedRemote
          ? 45000
          : 45000
        : 20000;
    if (iceRestart && Math.min(pcAge, matchAge) < iceGrace) {
      console.info(
        "[webrtc] skip iceRestart (PC/match grace)",
        pcAge,
        matchAge,
        iceGrace,
        earlyBlack ? "earlyBlack" : ""
      );
      return false;
    }
    // Debounce only after a real wire emit (setLocal-without-emit used to
    // stamp _lastOfferAt and block recovery for 8s → cascaded to 25s MTO).
    if (
      !iceRestart &&
      this._offerEmitOk &&
      this._lastOfferAt &&
      now - this._lastOfferAt < 8000
    ) {
      console.info("[webrtc] skip duplicate offer (debounce)");
      return false;
    }
    // After a successful answer, never re-offer unless iceRestart (renego thrash)
    if (
      !iceRestart &&
      this.pc.signalingState === "stable" &&
      this.pc.currentRemoteDescription
    ) {
      console.info("[webrtc] skip renego offer (stable, use iceRestart)");
      return false;
    }
    // Absolute: if we already have remote SDP and ICE is working/checking,
    // never spam a second offer (was offer→answer→offer in <1s).
    if (
      !iceRestart &&
      this.pc.currentRemoteDescription &&
      (this.pc.iceConnectionState === "checking" ||
        this.pc.iceConnectionState === "connected" ||
        this.pc.iceConnectionState === "completed" ||
        this.pc.connectionState === "connecting" ||
        this.pc.connectionState === "connected")
    ) {
      console.info("[webrtc] skip offer — already have remote + ICE active");
      return false;
    }
    // Take match lock ONLY after all early returns (atomic for single-thread JS).
    try {
      if (typeof window !== "undefined" && !iceRestart) {
        if (!multiMesh && window.__ruletMatchOfferLock && this._offerEmitOk) {
          console.info("[webrtc] skip offer — match offer lock held (emit ok)");
          return false;
        }
        // Concurrent first-offer race: if another call holds lock <500ms, skip
        // (hop10: free faster so offerKick can re-emit; still blocks dual thrash)
        if (!multiMesh && window.__ruletMatchOfferLock) {
          const att = window.__ruletMatchOfferAttemptAt || 0;
          if (att && now - att < 500) {
            console.info("[webrtc] skip offer — match offer lock held (racing)");
            return false;
          }
          window.__ruletMatchOfferLock = 0;
        }
        if (!multiMesh) {
          window.__ruletMatchOfferLock = 1;
          window.__ruletMatchOfferAttemptAt = now;
        }
      }
    } catch (_) {}
    this._offerInFlight = true;
    try {
      this._attachPreviewVideoIfSending();
    } catch (_) {}
    try {
      await this.syncLocalTracksToPc();
    } catch (_) {}
    // Do NOT set _offerSentOnce until emit succeeds — early set blocked
    // re-emit when localDescription existed but never hit the hub (MTO ~25s).
    // Fail-open: hung createOffer must not hold match lock forever.
    // Hop10: hang free @1000ms (was 1500) so denser offerKick can recover.
    const offerGen = (this._offerGen = (this._offerGen || 0) + 1);
    const hangTimer = setTimeout(() => {
      try {
        if (this._offerGen !== offerGen) return;
        if (this._offerEmitOk) return;
        console.warn("[webrtc] createOffer hang — free locks for offerKick");
        this._offerInFlight = false;
        if (!iceRestart) {
          this._offerSentOnce = false;
          // Allow retry: do not keep debounce stamp without wire
          this._lastOfferAt = 0;
        }
        if (typeof window !== "undefined" && !iceRestart) {
          window.__ruletMatchOfferAttemptAt = 0;
          window.__ruletMatchOfferLock = 0;
          if (!this._offerEmitOk) window.__ruletMatchOfferAt = 0;
        }
      } catch (_) {}
    }, 1000);
    try {
      const offer = await this.pc.createOffer(
        iceRestart
          ? {
              iceRestart: true,
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            }
          : { offerToReceiveAudio: true, offerToReceiveVideo: true }
      );
      if (this._offerGen !== offerGen) return false;
      // Must setLocal BEFORE emit — answer can return faster than setLocal
      // on low RTT; early answer would be dropped (state not have-local-offer).
      // Answer path still emits before setLocal (safe: offerer already ready).
      await this.pc.setLocalDescription(offer);
      if (this._offerGen !== offerGen) return false;
      try {
        const vSend = (this.pc.getSenders?.() || []).some(
          (s) => s.track && s.track.kind === "video" && s.track.readyState !== "ended"
        );
        if (!vSend) {
          this._attachPreviewVideoIfSending();
          await this.syncLocalTracksToPc();
        }
      } catch (_) {}
      // Include typ relay when possible (same-WiFi host/mDNS often fails).
      // Always wait for real typ relay on THIS pc (never ship 0-relay pure).
      // Early-exit on first relay; warmOk trims first-pass hard (search ALLOCATE hot).
      if (shouldWaitForFirstRelay()) {
        const warmOk = !!(this.pc && this.pc.__ruletWarmPrimed);
        // 3-way: extra peers often spin pure TURN while "linking cameras".
        // Sibling already allocated TURN this match → shorter first-relay budget.
        // Cap ≤450ms cold multiFast only — never lengthens 1v1 hop11 480.
        const multiFast = isMultiPeerFastMode(this);
        const budget = relayWaitBudgetMs();
        // Hop11 1v1: warm 320 / cold = budget (480). Sibling: firstRelayWait1Ms.
        const wait1 = firstRelayWait1Ms(budget, warmOk, this);
        let n = 0;
        try {
          n = countTypRelayInSdp(this.pc?.localDescription?.sdp || "", {
            udpOnly: shouldPreferUdpRelay(),
          });
        } catch (_) {}
        if (n === 0) {
          n = await waitForIceGatherRelayOrDone(this.pc, wait1);
        }
        // Extra 3rd-join: trickle ICE. Skip 2nd gather wait (was ~280ms +
        // 5s rebuild when sibling SDP had no typ relay). 1v1 still waits.
        if (n === 0 && !multiFast) {
          n = await waitForIceGatherRelayOrDone(
            this.pc,
            isRelayMediaMode()
              ? warmOk
                ? 280
                : 320
              : 280
          );
        }
        console.info(
          "[webrtc] offer first-relay count=" +
            n +
            " warm=" +
            (warmOk ? 1 : 0) +
            " multi=" +
            (multiFast ? 1 : 0) +
            " budget=" +
            wait1
        );
        // Pure relay only: rebuild once if still no relay.
        // Extra 3rd-join: trickle, never 5s rebuild (22:10 laptop answer
        // +6.7s / PC extra +7.3s — sibling SDP often lacks typ relay).
        // 1v1 hop11 still rebuilds. Does not cut relayWaitBudgetMs 480.
        if (
          n === 0 &&
          !opts._relayRetry &&
          isRelayMediaMode() &&
          !multiFast
        ) {
          console.warn(
            "[webrtc] offer no relay — rebuild pure-relay PC and retry once"
          );
          try {
            this.pc.close();
          } catch (_) {}
          this.pc = null;
          this._relayPc = false;
          this._offerInFlight = false;
          this._offerSentOnce = false;
          this._offerEmitOk = false;
          try {
            if (typeof window !== "undefined") {
              window.__ruletMatchOfferLock = 0;
              window.__ruletMatchOfferAt = 0;
            }
          } catch (_) {}
          try {
            applyIceDirectPreference();
            if (typeof clearIceWarm === "function") clearIceWarm();
          } catch (_) {}
          await this.connect();
          return this._createAndSendOffer({
            iceRestart: !!opts.iceRestart,
            earlyBlack: !!opts.earlyBlack,
            _relayRetry: true,
          });
        }
        if (n === 0) {
          console.warn(
            "[webrtc] offer no relay after wait — emit host path (fail-open)"
          );
        }
      }
      if (this._offerGen !== offerGen) return false;
      // Prefer localDescription (may include first relay after wait)
      let desc = this.pc.localDescription || offer;
      if (desc && desc.sdp) {
        let sdp = String(desc.sdp);
        sdp = stripMdnsHostCandidatesFromSdp(sdp);
        if (shouldFilterToRelayCandidates()) {
          sdp = stripNonRelayCandidatesFromSdp(sdp);
          if (shouldPreferUdpRelay()) sdp = stripTcpRelayCandidatesFromSdp(sdp);
          // Do not copy relay onto empty m-lines. Laptop 321 sendrecv+3-relay
          // offers got zero Android answers (same class as 382 PC break).
        } else if (shouldStripHostCandidates()) {
          sdp = stripHostCandidatesFromSdp(sdp);
        }
        desc = { type: desc.type, sdp };
      }
      // Prefer relay under force_relay, but never block emit forever (black cams).
      if (shouldWaitForFirstRelay()) {
        const rn = countTypRelayInSdp(desc?.sdp || "", {
          udpOnly: shouldPreferUdpRelay(),
        });
        if (rn === 0) {
          console.warn(
            "[webrtc] offer emit without relay (fail-open host path)"
          );
        }
      }
      this._emitSignal("offer", JSON.stringify(desc));
      // Stamp only AFTER emit left the wire (was before → 8s debounce with no SDP)
      this._lastOfferAt = Date.now();
      this._offerEmitOk = true;
      if (!iceRestart) this._offerSentOnce = true;
      this._armStuckIceWatch();
      this._clearOfferWatchdog();
      try {
        if (typeof window !== "undefined" && !iceRestart) {
          window.__ruletMatchOfferAt = Date.now();
          window.__ruletMatchOfferAttemptAt = window.__ruletMatchOfferAt;
          // Keep lock held for the match grace (cleared only on new Matched)
          window.__ruletMatchOfferLock = 1;
          if (window.__ruletConnectT0 && window.__ruletConnect) {
            window.__ruletConnect.offerMs =
              Date.now() - window.__ruletConnectT0;
          }
        }
      } catch (_) {}
      return true;
    } catch (e) {
      console.warn("[webrtc] createOffer failed", e);
      // Allow one retry if first createOffer threw
      if (!iceRestart) this._offerSentOnce = false;
      this._offerEmitOk = false;
      try {
        if (typeof window !== "undefined" && !iceRestart) {
          // Free locks so offerKick can retry a real first offer
          window.__ruletMatchOfferAttemptAt = 0;
          window.__ruletMatchOfferLock = 0;
        }
      } catch (_) {}
      return false;
    } finally {
      clearTimeout(hangTimer);
      this._offerInFlight = false;
      // offerGen abort / mid-return without emit must not leave lock stuck
      try {
        if (
          typeof window !== "undefined" &&
          !iceRestart &&
          !this._offerEmitOk
        ) {
          window.__ruletMatchOfferLock = 0;
          window.__ruletMatchOfferAttemptAt = 0;
          if (!this._offerEmitOk) window.__ruletMatchOfferAt = 0;
        }
      } catch (_) {}
    }
  }

  /**
   * Brief pause so localDescription can pick up early candidates.
   * Do not rebind onicecandidate — trickle must keep firing uninterrupted.
   * @param {number} maxMs
   */
  _waitForInitialIce(maxMs = 60) {
    return new Promise((resolve) => setTimeout(resolve, maxMs));
  }

  /**
   * Hold low bitrate until partner first frame paints OR remote audio is live,
   * then ramp mid. Timed 2.5s mid re-encode was fighting TURN first keyframe.
   * No-cam laptop never gets videoWidth — live audio is enough to leave low.
   */
  _armQualityRampAfterFrame() {
    if (this._qualityRampTimer) {
      clearTimeout(this._qualityRampTimer);
      this._qualityRampTimer = 0;
    }
    let n = 0;
    const tick = () => {
      this._qualityRampTimer = 0;
      if (!this.pc || this.pc.connectionState === "closed") return;
      let painted = false;
      let videoPainted = false;
      try {
        const el = this._videoEl;
        if (el && el.videoWidth > 8 && el.readyState >= 2) {
          painted = true;
          videoPainted = true;
        }
      } catch (_) {}
      // Live remote audio counts as linked (laptop hide/no-cam). First path
      // still starts low; this only ramps mid — no ICE/relayWait/pool change.
      if (!painted && this._remoteAudioIsLive()) painted = true;
      if (painted) {
        try {
          void this.applyQualityTier("mid");
        } catch (_) {}
        try {
          if (
            videoPainted &&
            typeof window !== "undefined" &&
            window.__ruletConnectT0
          ) {
            window.__ruletConnect = window.__ruletConnect || {};
            if (window.__ruletConnect.frameMs == null) {
              window.__ruletConnect.frameMs =
                Date.now() - window.__ruletConnectT0;
            }
          }
        } catch (_) {}
        return;
      }
      n += 1;
      // Poll up to ~12s; fall back to mid if still black (don't stay low forever)
      if (n < 50) {
        this._qualityRampTimer = setTimeout(tick, 150);
      } else {
        try {
          void this.applyQualityTier("mid");
        } catch (_) {}
      }
    };
    this._qualityRampTimer = setTimeout(tick, 80);
  }

  /**
   * Rate-limited ICE restart. Offerer renego; answerer uses restartIce() so the
   * remote can renegotiate. Caps spam when ICE flaps failed/disconnected.
   * @param {{ force?: boolean, earlyBlack?: boolean }} [opts]
   *   force=true for soft-recover; earlyBlack=true for zero-frame after SDP
   *   (was blocked by 18s grace → 20–30s black product lag).
   * @returns {Promise<boolean>}
   */
  async _tryIceRestart(opts = {}) {
    if (!this.pc) return false;
    const force = !!opts.force;
    const earlyBlack = !!opts.earlyBlack;
    const now = Date.now();
    const last = this._iceRestartAt || 0;
    const count = this._iceRestartCount || 0;
    // Protect negotiated first path; allow earlier restart if never got remote SDP.
    const pcAge = this._pcBornAt ? now - this._pcBornAt : 99999;
    let matchAge = 99999;
    try {
      if (typeof matchMediaGraceAt !== "undefined" && matchMediaGraceAt) {
        matchAge = now - matchMediaGraceAt;
      }
    } catch (_) {}
    const hasRemote = !!(
      this._gotRemoteAnswerAt ||
      this.pc?.currentRemoteDescription
    );
    // HARD CAP: at most ONE iceRestart offer per match. Hub 20:52 showed
    // re-offer every ~18s forever → black both sides, peer_usage STUN-only.
    // 233311Z: first restart burned, then find-3rd ice_failed with no recover.
    // Allow a second restart only if this PC already had ICE ok and is now
    // failed/disconnected (3rd-join tear), never a third.
    if (count >= 1 && hasRemote) {
      let iceNow = "";
      try {
        iceNow = String(this.pc.iceConnectionState || "");
      } catch (_) {}
      const recover =
        count < 2 &&
        this._iceEverOk &&
        (iceNow === "failed" || iceNow === "disconnected");
      if (!recover) {
        console.info("[webrtc] skip iceRestart — already used once this match");
        return false;
      }
      console.info("[webrtc] iceRestart recover after fail (3rd-join)");
    }
    // Still checking — do not renego
    try {
      const ice = String(this.pc.iceConnectionState || "");
      const cs = String(this.pc.connectionState || "");
      if (
        hasRemote &&
        (ice === "checking" || ice === "new" || cs === "connecting")
      ) {
        console.info("[webrtc] skip iceRestart — ICE still checking", ice);
        return false;
      }
    } catch (_) {}
    // First path needs ≥18s before any renego (was earlyBlack@2.2s thrash)
    const iceGrace = earlyBlack ? 18000 : hasRemote ? (force ? 18000 : 25000) : 12000;
    if (Math.min(pcAge, matchAge) < iceGrace) {
      console.info(
        "[webrtc] skip early iceRestart (grace)",
        pcAge,
        matchAge,
        iceGrace,
        earlyBlack ? "earlyBlack" : ""
      );
      return false;
    }
    // Restart already in flight
    if (last && now - last < 5000 && count > 0) return true;
    if (now - last < 8000) return false;
    this._iceRestartAt = now;
    this._iceRestartCount = count + 1;
    try {
      if (this.isOfferer) {
        this._emittingIceRestart = true;
        let ok = false;
        try {
          ok = await this._createAndSendOffer({
            iceRestart: true,
            earlyBlack,
          });
        } finally {
          this._emittingIceRestart = false;
        }
        if (ok) {
          console.info("[webrtc] ICE restart offer sent", this._iceRestartCount);
        }
        return ok;
      }
      // Answerer: restartIce so the remote offerer renegotiates
      if (typeof this.pc.restartIce === "function") {
        this.pc.restartIce();
        console.info("[webrtc] restartIce() (answerer)", this._iceRestartCount);
        return true;
      }
    } catch (e) {
      console.warn("[webrtc] ICE restart failed", e);
    }
    return false;
  }

  _scheduleDisconnectedIceProbe() {
    // One probe wave at a time (2s / 6s / 12s) — recover radio handoffs before hard rebuild
    if (this._discIceProbing) return;
    this._discIceProbing = true;
    const clearSlot = (key) => {
      this[key] = 0;
    };
    const probeAt = (delay, force, slotKey, isLast) => {
      this[slotKey] = setTimeout(() => {
        clearSlot(slotKey);
        if (isLast) this._discIceProbing = false;
        if (!this.pc) return;
        const ice = this.pc.iceConnectionState;
        const cs = this.pc.connectionState;
        if (
          ice === "disconnected" ||
          cs === "disconnected" ||
          ice === "failed" ||
          cs === "failed"
        ) {
          this._tryIceRestart({ force: !!force });
        }
      }, delay);
    };
    probeAt(2000, false, "_discIceTimer", false);
    probeAt(6000, true, "_discIceTimer2", false);
    probeAt(12000, true, "_discIceTimer3", true);
  }

  /**
   * After SDP: recover black / stuck TURN without waiting 18s call grace.
   * 0.1.202 timers called _tryIceRestart but grace blocked until 18s.
   */

  /** Rebind remote <video> + play() when stream exists but element is black. */
  forceRemoteVideoPaint(why) {
    try {
      if (!this.remoteStream) return;
      const el = this._resolveRemoteVideoEl();
      if (!el) return;
      this._videoEl = el;
      // Soft if already painting — null rebind causes visible flicker mid-link
      let painting = false;
      try {
        painting =
          el.srcObject === this.remoteStream &&
          el.videoWidth > 0 &&
          el.readyState >= 2;
      } catch (_) {}
      if (!painting) {
        const same = el.srcObject === this.remoteStream;
        try {
          // Only hard-null when stuck black (not every black_watch tick)
          if (same && !(el.videoWidth > 0)) el.srcObject = null;
        } catch (_) {}
        try {
          el.srcObject = this.remoteStream;
        } catch (_) {
          try {
            el.srcObject = this.remoteStream;
          } catch (_) {}
        }
      }
      this._enableRemoteAudioTracks();
      this._playRemoteVideo(el);
      try {
        (this.remoteStream.getTracks?.() || []).forEach((tr) => {
          if (tr && tr.enabled === false) tr.enabled = true;
        });
      } catch (_) {}
    } catch (_) {}
  }

  _armStuckIceWatch() {
    this._clearStuckIceWatch();
    const pushCam = () => {
      try {
        if (
          typeof window !== "undefined" &&
          typeof window.pushOutboundVideoTracks === "function"
        ) {
          void window.pushOutboundVideoTracks();
        }
      } catch (_) {}
    };
    const noFramesYet = () => {
      try {
        if (
          typeof window !== "undefined" &&
          window.__ruletConnect &&
          window.__ruletConnect.frameMs != null
        ) {
          return false;
        }
      } catch (_) {}
      // Fallback: video element has painted
      try {
        const el = this._videoEl;
        if (el && el.videoWidth > 0 && el.readyState >= 2) return false;
      } catch (_) {}
      return true;
    };
    // First 18s: keyframes + paint only. NEVER iceRestart (that was the thrash).
    // One optional restart after 20s if still black and ICE failed/disconnected.
    this._stuckIceTimer = setTimeout(() => {
      this._stuckIceTimer = 0;
      if (!this.pc || !noFramesYet()) return;
      if (
        !this.pc.currentRemoteDescription &&
        !this.pc.remoteDescription
      ) {
        return;
      }
      const ice = String(this.pc.iceConnectionState || "");
      const cs = String(this.pc.connectionState || "");
      console.warn("[webrtc] black_watch 2s keyframe", ice, cs);
      kickMediaAfterIce(this.pc);
      pushCam();
      this.forceRemoteVideoPaint("black_2s");
    }, 2000);
    this._stuckIceTimer2 = setTimeout(() => {
      this._stuckIceTimer2 = 0;
      if (!this.pc || !noFramesYet()) return;
      if (
        !this.pc.currentRemoteDescription &&
        !this.pc.remoteDescription
      ) {
        return;
      }
      console.warn("[webrtc] black_watch 6s keyframe (no renego)");
      kickMediaAfterIce(this.pc);
      pushCam();
      this.forceRemoteVideoPaint("black_6s");
    }, 6000);
    this._stuckIceTimer3 = setTimeout(() => {
      this._stuckIceTimer3 = 0;
      if (!this.pc || !noFramesYet()) return;
      if (
        !this.pc.currentRemoteDescription &&
        !this.pc.remoteDescription
      ) {
        return;
      }
      const ice = String(this.pc.iceConnectionState || "");
      console.warn("[webrtc] black_watch 20s one restart ice=" + ice);
      // Only if ICE fully failed — not while checking
      if (ice === "failed" || ice === "disconnected" || ice === "closed") {
        try {
          this._tryIceRestart({ force: true, earlyBlack: true });
        } catch (_) {}
      }
      kickMediaAfterIce(this.pc);
      pushCam();
      this.forceRemoteVideoPaint("black_20s");
    }, 20000);
  }

  _clearStuckIceWatch() {
    if (this._stuckIceTimer) {
      clearTimeout(this._stuckIceTimer);
      this._stuckIceTimer = 0;
    }
    if (this._stuckIceTimer2) {
      clearTimeout(this._stuckIceTimer2);
      this._stuckIceTimer2 = 0;
    }
    if (this._stuckIceTimer3) {
      clearTimeout(this._stuckIceTimer3);
      this._stuckIceTimer3 = 0;
    }
  }

  _clearDisconnectedIceProbe() {
    this._discIceProbing = false;
    // Do NOT clear stuck/black watch on ICE connected — path can be up with
    // black video; black_watch must keep running until first frame.
    if (this._discIceTimer) {
      clearTimeout(this._discIceTimer);
      this._discIceTimer = 0;
    }
    if (this._discIceTimer2) {
      clearTimeout(this._discIceTimer2);
      this._discIceTimer2 = 0;
    }
    if (this._discIceTimer3) {
      clearTimeout(this._discIceTimer3);
      this._discIceTimer3 = 0;
    }
  }

  async handleRemoteSignal(kind, payload) {
    // Peer echo of hub forensics beacon — never apply / never create a PC for it.
    if (kind === "av_path") return;
    if (kind === "offer") this._pendingRemoteOfferSince = Date.now();
    if (!this.pc) await this.connect();
    if (kind === "offer") {
      const raw = JSON.parse(payload);
      // Rebuild only when policy is wrong (warm PC already relay → keep it).
      // Always-rebuild here made every answer cold-TURN (~0.5–1s).
      applyIceDirectPreference();
      // Pure-relay (hide_ip / force_relay): rebuild if dirty warm or wrong policy.
      const pureDirty =
        isRelayMediaMode() &&
        this.pc &&
        !this._answeredAt &&
        (String(this.pc.signalingState || "") === "have-local-offer" ||
          !!this.pc.localDescription);
      if (
        (shouldFilterToRelayCandidates() &&
          iceConfig.iceTransportPolicy === "relay" &&
          this.pc &&
          !this._relayPc) ||
        pureDirty
      ) {
        console.info(
          "[webrtc] rebuild PC for pure-relay before answer dirty=" +
            (pureDirty ? 1 : 0)
        );
        try {
          this.pc.close();
        } catch (_) {}
        this.pc = null;
        this._pendingRemoteIce = [];
        this.isOfferer = false;
        this._relayPc = false;
        await this.connect();
      }
      const desc = sanitizeRemoteDescription(raw);
      // Glare / phone hard-retry as offerer: we may still have a local offer.
      // Without rollback, setRemoteDescription fails → phone↔browser never connects.
      const state = String(this.pc.signalingState || "");
      if (state === "have-local-offer") {
        try {
          await this.pc.setLocalDescription({ type: "rollback" });
          console.info("[webrtc] glare rollback for remote offer");
        } catch (e) {
          console.warn("[webrtc] rollback failed, recreate PC", e);
          try {
            this.pc.close();
          } catch (_) {}
          this.pc = null;
          this._pendingRemoteIce = [];
          this.isOfferer = false;
          await this.connect();
        }
      }
      // Skip exact duplicate offer while mid-answer (phone re-send thrash)
      if (
        this.pc.remoteDescription &&
        state === "have-remote-offer" &&
        this._lastRemoteOfferSdp &&
        raw?.sdp &&
        String(raw.sdp).slice(0, 200) === this._lastRemoteOfferSdp
      ) {
        console.info("[webrtc] skip duplicate remote offer");
        return;
      }
      // Already answered — ignore re-offer thrash for 12s even if ICE still "new".
      // Phone double-offer ~0.7s after first answer was killing video both ways.
      if (
        this.pc.currentRemoteDescription &&
        this.pc.currentLocalDescription &&
        this._answeredAt &&
        Date.now() - this._answeredAt < 12000
      ) {
        console.info(
          "[webrtc] skip remote offer — answered recently",
          Date.now() - this._answeredAt
        );
        return;
      }
      if (
        this.pc.currentRemoteDescription &&
        this.pc.currentLocalDescription &&
        (this.pc.iceConnectionState === "checking" ||
          this.pc.iceConnectionState === "connected" ||
          this.pc.iceConnectionState === "completed" ||
          this.pc.connectionState === "connecting" ||
          this.pc.connectionState === "connected")
      ) {
        // Don't let "checking" alone count as live (lock rule #7) — a peer
        // that's been stuck in checking/connecting with zero painted frames
        // for a while is a zombie, not an active negotiation. Without this
        // escape hatch a legitimate one-shot black_watch rebuild offer from
        // the other side gets swallowed here forever and both sides stay
        // dark (see tasks/admin-queue/done/100-pair-smoke-headless-RESULT.md).
        let painted = false;
        try {
          const el = this._videoEl;
          if (el && el.videoWidth > 8 && el.readyState >= 2) painted = true;
        } catch (_) {}
        const stuckNoFrames =
          !painted &&
          this._answeredAt &&
          Date.now() - this._answeredAt > 18000;
        if (!stuckNoFrames) {
          console.info(
            "[webrtc] skip remote offer — already negotiated, ICE",
            this.pc.iceConnectionState
          );
          return;
        }
        console.warn(
          "[webrtc] accept renego offer — stuck no frames",
          Date.now() - this._answeredAt,
          "ICE",
          this.pc.iceConnectionState
        );
      }
      if (raw?.sdp) this._lastRemoteOfferSdp = String(raw.sdp).slice(0, 200);
      await this.pc.setRemoteDescription(desc);
      this._pendingRemoteOfferSince = 0;
      this.isOfferer = false;
      // Push tracks before answer so sendrecv m-lines have real media.
      try {
        this._attachPreviewVideoIfSending();
      } catch (_) {}
      try {
        this.syncLocalTracksToPc();
      } catch (_) {}
      // No-cam laptop answering a sendrecv video offer: do not keep a send
      // slot (dummy track on the phone → Linking forever).
      // Cam-present PC: attach preview first so we never answer recvonly/inactive.
      try {
        this._ensureNoCamVideoRecvonly();
      } catch (_) {}
      const iceFlush = this._flushPendingIce();
      try {
        preferCodecs(this.pc);
      } catch (_) {}
      const answer = await this.pc.createAnswer();
      try {
        await this.pc.setLocalDescription(answer);
      } catch (e) {
        console.warn("[webrtc] setLocal answer failed", e);
      }
      // Pure-relay / hybrid-with-TURN: wait for typ relay in answer SDP.
      // Hop11: same schedule as offer (cold pure 480 / warm first 320 / hybrid 300).
      // Early-exit on first typ relay; fail-open strip belts unchanged.
      if (shouldWaitForFirstRelay()) {
        const warmOk = !!(this.pc && this.pc.__ruletWarmPrimed);
        // Cap ≤450ms cold multiFast only — never lengthens 1v1 hop11 480.
        const multiFast = isMultiPeerFastMode(this);
        const budget = relayWaitBudgetMs();
        const wait1 = firstRelayWait1Ms(budget, warmOk, this);
        let n = 0;
        try {
          n = countTypRelayInSdp(this.pc?.localDescription?.sdp || "", {
            udpOnly: shouldPreferUdpRelay(),
          });
        } catch (_) {}
        if (n === 0) {
          n = await waitForIceGatherRelayOrDone(this.pc, wait1);
        }
        // Extra 3rd-join: trickle; skip 2nd gather wait. 1v1 unchanged.
        if (n === 0 && !multiFast) {
          n = await waitForIceGatherRelayOrDone(
            this.pc,
            isRelayMediaMode()
              ? warmOk
                ? 280
                : 320
              : 280
          );
        }
        console.info(
          "[webrtc] answer first-relay count=" +
            n +
            " warm=" +
            (warmOk ? 1 : 0) +
            " multi=" +
            (multiFast ? 1 : 0) +
            " budget=" +
            wait1
        );
      }
      let ansDesc = this.pc.localDescription || answer;
      if (ansDesc && ansDesc.sdp) {
        let sdp = String(ansDesc.sdp);
        // Always drop Chrome mDNS host; keep private hosts on normal path.
        sdp = stripMdnsHostCandidatesFromSdp(sdp);
        if (shouldFilterToRelayCandidates()) {
          sdp = stripNonRelayCandidatesFromSdp(sdp);
          if (shouldPreferUdpRelay()) sdp = stripTcpRelayCandidatesFromSdp(sdp);
        } else if (shouldStripHostCandidates()) {
          sdp = stripHostCandidatesFromSdp(sdp);
        }
        ansDesc = { type: ansDesc.type, sdp };
      }
      this._emitSignal("answer", JSON.stringify(ansDesc));
      this._answeredAt = Date.now();
      this._clearOfferWatchdog();
      this._offerSentOnce = true;
      this._armStuckIceWatch();
      // av-verify: beacon even if ICE never leaves checking (black path)
      void this.reportAvPath("answer_sent");
      this._armAvPathBeacons();
      try {
        if (typeof window !== "undefined" && window.__ruletConnectT0) {
          window.__ruletConnect = window.__ruletConnect || {};
          window.__ruletConnect.answerMs =
            Date.now() - window.__ruletConnectT0;
        }
      } catch (_) {}
      try {
        preferCodecs(this.pc);
      } catch (_) {}
      this._qualityTier = "low";
      void this.applyQualityTier("low");
      this._armQualityRampAfterFrame();
      void iceFlush;
      // After answer: re-bind outbound + keyframes so partner paints ASAP
      try {
        this.syncLocalTracksToPc();
      } catch (_) {}
      try {
        kickMediaAfterIce(this.pc);
      } catch (_) {}
      try {
        if (
          typeof window !== "undefined" &&
          typeof window.pushOutboundVideoTracks === "function"
        ) {
          void window.pushOutboundVideoTracks();
        }
      } catch (_) {}
      [120, 400, 1200].forEach((ms) => {
        setTimeout(() => {
          try {
            kickMediaAfterIce(this.pc);
            if (
              typeof window !== "undefined" &&
              typeof window.pushOutboundVideoTracks === "function"
            ) {
              void window.pushOutboundVideoTracks();
            }
          } catch (_) {}
        }, ms);
      });
    } else if (kind === "answer") {
      const raw = JSON.parse(payload);
      let desc = sanitizeRemoteDescription(raw);
      try {
        if (!this.pc) return;
        const localSdp = String(this.pc.localDescription?.sdp || "");
        if (desc && desc.sdp && localSdp) {
          const aligned = alignAnswerDirectionsToLocalOffer(localSdp, desc.sdp);
          if (aligned !== desc.sdp) desc = { type: desc.type, sdp: aligned };
        }
        const st = String(this.pc.signalingState || "");
        // Only apply answers when we are waiting for one. Stale/late answers
        // after a rebuild (or after already stable) throw and thrash the path.
        if (
          st !== "have-local-offer" &&
          !(st === "stable" && !this.pc.currentRemoteDescription)
        ) {
          console.info(
            "[webrtc] skip answer (state=" + st + ") — not awaiting"
          );
          return;
        }
        await this.pc.setRemoteDescription(desc);
        // Latch: we are offerer and negotiation completed once — blocks the
        // offer→answer→offer@~800ms thrash (hub debounce drop → 18–24s stall).
        this._gotRemoteAnswerAt = Date.now();
        this._offerSentOnce = true;
        this._clearOfferWatchdog();
        try {
          this._attachPreviewVideoIfSending();
          const pending = this._pendingPromoteSend;
          this._pendingPromoteSend = null;
          if (pending) this._promoteVideoSend(pending);
          else {
            const sender = (this.pc.getSenders?.() || []).find(
              (s) => s.track && s.track.kind === "video"
            );
            if (sender) this._promoteVideoSend(sender);
          }
        } catch (_) {}
        // av-verify: beacon while linking (ice=checking frames=0 still useful)
        void this.reportAvPath("answer_applied");
        this._armAvPathBeacons();
        try {
          if (typeof window !== "undefined") {
            window.__ruletMatchOfferAt =
              window.__ruletMatchOfferAt || Date.now();
            window.__ruletMatchOfferAttemptAt = window.__ruletMatchOfferAt;
            if (window.__ruletConnectT0) {
              window.__ruletConnect = window.__ruletConnect || {};
              window.__ruletConnect.answerMs =
                Date.now() - window.__ruletConnectT0;
            }
          }
        } catch (_) {}
        // Parallel: ICE flush + keyframes + cam push (don't serialize)
        void this._flushPendingIce();
        try {
          kickMediaAfterIce(this.pc);
        } catch (_) {}
        try {
          if (
            typeof window !== "undefined" &&
            typeof window.pushOutboundVideoTracks === "function"
          ) {
            void window.pushOutboundVideoTracks();
          }
        } catch (_) {}
        // Phone answer may deliver tracks slightly after setRemote — paint hard
        // (PC black partner with HOT TURN was often track live + empty overlay).
        try {
          const receivers = this.pc.getReceivers?.() || [];
          for (const r of receivers) {
            const tr = r?.track;
            if (!tr) continue;
            if (!this.remoteStream) this.remoteStream = new MediaStream();
            const has = (this.remoteStream.getTracks?.() || []).some(
              (t) => t.id === tr.id
            );
            if (!has) this.remoteStream.addTrack(tr);
            try {
              if (tr.enabled === false) tr.enabled = true;
            } catch (_) {}
          }
          if (this.remoteStream) {
            this.hooks.onRemoteStream?.(this.remoteStream);
            this._enableRemoteAudioTracks();
            const el = this._resolveRemoteVideoEl();
            if (el) {
              this._videoEl = el;
              try {
                el.srcObject = this.remoteStream;
                this._playRemoteVideo(el);
              } catch (_) {}
            }
          }
        } catch (_) {}
        [80, 300, 900, 2000].forEach((ms) => {
          setTimeout(() => {
            try {
              if (this.remoteStream) this.hooks.onRemoteStream?.(this.remoteStream);
              kickMediaAfterIce(this.pc);
            } catch (_) {}
          }, ms);
        });
      } catch (e) {
        const msg = String(e && (e.message || e) || "");
        console.warn("[webrtc] answer apply failed", e, "state=", this.pc?.signalingState);
        // Stale answer vs a later local offer (promote / iceRestart).
        // Do not leave the PC half-applied — wait for the matching answer.
        if (/InvalidModification|m-lin|order of m-lines/i.test(msg)) {
          console.info("[webrtc] skip stale answer (m-line order)");
        }
      }
    } else if (kind === "ice") {
      try {
        const c = JSON.parse(payload);
        // Drop non-relay under pure-relay (hide / hub force only).
        if (
          shouldFilterToRelayCandidates() &&
          c &&
          c.candidate &&
          !isRelayIceCandidate(c)
        ) {
          return;
        }
        if (
          shouldPreferUdpRelay() &&
          c &&
          c.candidate &&
          isRelayIceCandidate(c) &&
          !isUdpRelayIceCandidate(c)
        ) {
          return;
        }
        // Drop Chrome mDNS host — Android cannot resolve *.local.
        // Keep private host / srflx / relay for same-LAN prflx.
        if (c && c.candidate && isMdnsHostIceCandidate(c)) {
          return;
        }
        // Pure modes only: drop typ host if strip-host is armed (belt).
        if (
          shouldStripHostCandidates() &&
          shouldFilterToRelayCandidates() &&
          c &&
          c.candidate &&
          isHostIceCandidate(c)
        ) {
          return;
        }
        if (!this.pc?.remoteDescription) {
          if (!this._pendingRemoteIce) this._pendingRemoteIce = [];
          this._pendingRemoteIce.push(c);
          return;
        }
        await this.pc.addIceCandidate(c);
      } catch (e) {
        console.warn("[webrtc] ice error", e);
      }
    } else if (kind === "bye") {
      this.closeCall({ keepLocal: true });
    }
  }

  async _flushPendingIce() {
    let batch = (this._pendingRemoteIce || []).splice(0);
    if (!batch.length || !this.pc) return;
    if (shouldFilterToRelayCandidates()) {
      batch = batch.filter(
        (c) =>
          !c?.candidate ||
          (isRelayIceCandidate(c) &&
            (!shouldPreferUdpRelay() || isUdpRelayIceCandidate(c)))
      );
    } else {
      // Normal / same-LAN: drop mDNS only — keep private host for prflx
      batch = batch.filter(
        (c) => !c?.candidate || !isMdnsHostIceCandidate(c)
      );
    }
    if (!batch.length) return;
    await Promise.all(
      batch.map(async (c) => {
        try {
          await this.pc.addIceCandidate(c);
        } catch (_) {
          /* stale mid */
        }
      })
    );
  }

  /**
   * End the peer connection. Optionally keep local camera/mic for preview.
   * @param {{ keepLocal?: boolean, sendBye?: boolean }} [opts]
   */
  closeCall(opts = {}) {
    const { keepLocal = false, sendBye = true } = opts;
    this._stopAdaptiveQuality();
    this._clearDisconnectedIceProbe();
    this._clearStuckIceWatch();
    if (this._qualityRampTimer) {
      clearTimeout(this._qualityRampTimer);
      this._qualityRampTimer = 0;
    }
    if (sendBye) {
      try {
        this._emitSignal("bye", "{}");
      } catch (_) {}
    }
    try {
      this._chatDc?.close();
    } catch (_) {}
    this._chatDc = null;
    this._chatDcOpen = false;
    try {
      if (this._avPathTimer) clearInterval(this._avPathTimer);
    } catch (_) {}
    this._avPathTimer = 0;
    this._avPathArmed = false;
    this.pc?.close();
    this.pc = null;
    this.remoteStream = null;
    this._gotRemoteAudio = false;
    this._gotRemoteVideo = false;
    // Multi-peer clones live on the wrapper — always release (not preview tracks)
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.__ruletReleasePeerOutbound === "function"
      ) {
        window.__ruletReleasePeerOutbound(this);
      }
    } catch (_) {}
    if (!keepLocal) {
      // Only stop tracks that are not the shared preview (clones ok to stop)
      try {
        this.localStream?.getTracks().forEach((t) => stopTrackUnlessPreview(t));
      } catch (_) {
        try {
          this.localStream?.getTracks().forEach((t) => {
            if (!trackBelongsToPreview(t)) {
              try {
                t.stop();
              } catch (__) {}
            }
          });
        } catch (__) {}
      }
      this.localStream = null;
    }
    // keepLocal:true — never stop tracks; preview stays live for rematch / multi
  }

  /** @deprecated use closeCall */
  close() {
    this.closeCall({ keepLocal: false, sendBye: true });
  }

  /**
   * Emit av_path signal for scripts/av-verify.sh (ICE pair + frames).
   * @param {string} [why]
   */
  async reportAvPath(why = "tick") {
    try {
      if (!this.pc) return;
      const snap = await collectAvPathSnapshot(this.pc, {
        why: String(why || "tick").slice(0, 32),
        platform: "web",
        offerer: this.isOfferer ? 1 : 0,
      });
      this._emitSignal("av_path", JSON.stringify(snap));
      try {
        console.info(
          "[av_path]",
          snap.ice,
          snap.local_type + "→" + snap.remote_type,
          "fin=" + snap.frames_in,
          "fout=" + snap.frames_out,
          "ok=" + (snap.ok ? 1 : 0),
          why
        );
      } catch (_) {}
    } catch (_) {}
  }

  /**
   * Periodic beacons while call alive (2s, 5s, 8s, 12s once + 8s interval).
   * Armed after answer so black/checking paths still report ice+frames.
   */
  _armAvPathBeacons() {
    if (this._avPathArmed) return;
    this._avPathArmed = true;
    // 8s wave: explicit "still linking" snapshot for av-verify black paths
    const waves = [2000, 5000, 8000, 12000];
    for (const ms of waves) {
      setTimeout(() => {
        if (!this.pc) return;
        const why =
          ms === 8000 &&
          this.pc.iceConnectionState !== "connected" &&
          this.pc.iceConnectionState !== "completed" &&
          this.pc.connectionState !== "connected"
            ? "linking_8s"
            : "wave_" + ms;
        void this.reportAvPath(why);
      }, ms);
    }
    this._avPathTimer = setInterval(() => {
      if (!this.pc) {
        try {
          clearInterval(this._avPathTimer);
        } catch (_) {}
        this._avPathTimer = 0;
        this._avPathArmed = false;
        return;
      }
      void this.reportAvPath("interval");
    }, 8000);
  }
}

/** List cameras and mics (labels need permission first). */
async function listMediaDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { cameras: [], mics: [], speakers: [] };
  }
  let devices = await navigator.mediaDevices.enumerateDevices();
  const hasLabels = devices.some((d) => d.label);
  if (!hasLabels) {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      tmp.getTracks().forEach((t) => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (_) {}
  }
  const dedupe = (arr) => {
    const seen = new Set();
    return arr.filter((d) => {
      if (!d.deviceId || seen.has(d.deviceId)) return false;
      seen.add(d.deviceId);
      return true;
    });
  };
  return {
    cameras: dedupe(devices.filter((d) => d.kind === "videoinput")),
    mics: dedupe(devices.filter((d) => d.kind === "audioinput")),
    speakers: dedupe(devices.filter((d) => d.kind === "audiooutput")),
  };
}

/**
 * Compact getStats dump for av-verify (hub logs kind=av_path).
 * @param {RTCPeerConnection | null | undefined} pc
 * @param {Record<string, unknown>} [extra]
 * @returns {Promise<Record<string, unknown>>}
 */
async function collectAvPathSnapshot(pc, extra = {}) {
  /** @type {Record<string, unknown>} */
  const out = {
    v: 1,
    t: Date.now(),
    force_relay: !!(typeof sessionForceRelayEnabled === "function" && sessionForceRelayEnabled()),
    hide_ip: !!(typeof hideIpRelayOnlyEnabled === "function" && hideIpRelayOnlyEnabled()),
    policy: iceConfig?.iceTransportPolicy || "?",
    ice: pc ? String(pc.iceConnectionState || "") : "no_pc",
    cs: pc ? String(pc.connectionState || "") : "no_pc",
    sig: pc ? String(pc.signalingState || "") : "no_pc",
    ...extra,
  };
  if (!pc || typeof pc.getStats !== "function") return out;
  try {
    const report = await pc.getStats();
    let framesIn = 0;
    let framesOut = 0;
    let bytesIn = 0;
    let bytesOut = 0;
    let audioIn = 0;
    let audioOut = 0;
    /** @type {string} */
    let localType = "";
    /** @type {string} */
    let remoteType = "";
    /** @type {string} */
    let pairState = "";
    /** @type {Record<string, { candidateType?: string, protocol?: string, address?: string }>} */
    const cands = {};
    report.forEach((r) => {
      if (r.type === "local-candidate" || r.type === "remote-candidate") {
        cands[r.id] = {
          candidateType: r.candidateType,
          protocol: r.protocol,
          address: r.address || r.ip,
        };
      }
    });
    report.forEach((r) => {
      if (r.type === "inbound-rtp" && (r.kind === "video" || r.mediaType === "video")) {
        if (typeof r.framesReceived === "number") framesIn += r.framesReceived;
        if (typeof r.bytesReceived === "number") bytesIn += r.bytesReceived;
      }
      if (r.type === "outbound-rtp" && (r.kind === "video" || r.mediaType === "video")) {
        if (typeof r.framesEncoded === "number") framesOut += r.framesEncoded;
        if (typeof r.bytesSent === "number") bytesOut += r.bytesSent;
      }
      if (r.type === "inbound-rtp" && (r.kind === "audio" || r.mediaType === "audio")) {
        if (typeof r.bytesReceived === "number") audioIn += r.bytesReceived;
      }
      if (r.type === "outbound-rtp" && (r.kind === "audio" || r.mediaType === "audio")) {
        if (typeof r.bytesSent === "number") audioOut += r.bytesSent;
      }
      if (r.type === "candidate-pair" && (r.nominated || r.selected)) {
        pairState = String(r.state || "");
        const loc = cands[r.localCandidateId];
        const rem = cands[r.remoteCandidateId];
        if (loc?.candidateType) localType = String(loc.candidateType);
        if (rem?.candidateType) remoteType = String(rem.candidateType);
        out.pair_proto = loc?.protocol || rem?.protocol || "";
      }
    });
    // Fallback: best succeeded pair
    if (!localType) {
      report.forEach((r) => {
        if (r.type === "candidate-pair" && r.state === "succeeded") {
          const loc = cands[r.localCandidateId];
          const rem = cands[r.remoteCandidateId];
          if (loc?.candidateType) localType = String(loc.candidateType);
          if (rem?.candidateType) remoteType = String(rem.candidateType);
          pairState = pairState || "succeeded";
        }
      });
    }
    out.frames_in = framesIn;
    out.frames_out = framesOut;
    out.bytes_in = bytesIn;
    out.bytes_out = bytesOut;
    out.audio_in = audioIn;
    out.audio_out = audioOut;
    out.local_type = localType || "?";
    out.remote_type = remoteType || "?";
    out.pair = pairState || "?";
    out.ok =
      (framesIn > 2 || bytesIn > 8000) &&
      (framesOut > 2 || bytesOut > 8000) &&
      (out.ice === "connected" || out.ice === "completed");
  } catch (e) {
    out.stats_err = e instanceof Error ? e.message : String(e);
  }
  return out;
}

if (typeof window !== "undefined") {
  window.getIcePathKind = getIcePathKind;
  window.getIceMeta = getIceMeta;
  window.collectAvPathSnapshot = collectAvPathSnapshot;
  window.RouletteWebRtc = RouletteWebRtc;
  window.listMediaDevices = listMediaDevices;
  window.loadRtcConfig = loadRtcConfig;
  window.getIceConfig = getIceConfig;
  window.warmIcePool = warmIcePool;
  window.clearIceWarm = clearIceWarm;
  window.takeWarmPc = takeWarmPc;
  window.warmPcPolicy = warmPcPolicy;
  window.isIceWarmPrimed = isIceWarmPrimed;
  window.waitIceWarmPrimed = waitIceWarmPrimed;
  window.applyIceDirectPreference = applyIceDirectPreference;
  window.preferDirectOnlyEnabled = preferDirectOnlyEnabled;
  window.hideIpRelayOnlyEnabled = hideIpRelayOnlyEnabled;
  window.sessionForceRelayEnabled = sessionForceRelayEnabled;
  window.setSessionForceRelay = setSessionForceRelay;
  window.isRelayMediaMode = isRelayMediaMode;
  window.isTurnPreferredPath = isTurnPreferredPath;
  window.alignAnswerDirectionsToLocalOffer = alignAnswerDirectionsToLocalOffer;
  window.sdpMlineDirections = sdpMlineDirections;
  window.isRelayIceCandidate = isRelayIceCandidate;
  window.isUdpRelayIceCandidate = isUdpRelayIceCandidate;
  window.countTypRelayInSdp = countTypRelayInSdp;
  window.stripTcpRelayCandidatesFromSdp = stripTcpRelayCandidatesFromSdp;
  window.pinTurnUrlsToUdp = pinTurnUrlsToUdp;
  window.udpTurnOnly = udpTurnOnly;
  window.waitForIceGatherRelayOrDone = waitForIceGatherRelayOrDone;
  window.requestOutboundKeyframes = requestOutboundKeyframes;
  window.kickMediaAfterIce = kickMediaAfterIce;
  window.QUALITY_TIERS = QUALITY_TIERS;
  window.applyLowLatencyPlayout = applyLowLatencyPlayout;
  window.lowLatencyAudioConstraints = lowLatencyAudioConstraints;
  window.fullProcessingAudioConstraints = fullProcessingAudioConstraints;
  window.isLowLatencyAudioEnabled = isLowLatencyAudioEnabled;
  window.setForceFullAudioProcessing = setForceFullAudioProcessing;
  window.isForceFullAudioProcessing = isForceFullAudioProcessing;
  window.playoutTargetForTier = playoutTargetForTier;
}
