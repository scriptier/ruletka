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

/** Pre-gather candidates before createOffer (faster first match). */
// Pool=8 caused ALLOCATE storms + peer_usage=0 on force_relay pairs.
const ICE_CANDIDATE_POOL_SIZE = 4;
/** Pure relay (force_relay / Hide IP): tiny pool, UDP TURN only. */
const ICE_RELAY_POOL_SIZE = 2;

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
 * Strip ?transport=udp (default for turn:) — some stacks mishandle the query.
 * @param {string} u
 * @returns {string}
 */
function normalizeTurnUrl(u) {
  let s = String(u || "").trim();
  if (!s) return s;
  s = s.replace(/\?transport=udp$/i, "");
  s = s.replace(/([?&])transport=udp(&)?/gi, (_m, p1, p2) => (p2 ? p1 : ""));
  s = s.replace(/[?&]$/, "");
  return s;
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
  // force_relay = pure iceTransportPolicy=relay (same-IP hairpin). Hybrid
  // policy=all left host preferred → peer_usage≈0 / both cams black (2026-08-10).
  if (was !== next && typeof warmIcePool === "function") {
    try {
      const want = next ? "relay" : "all";
      if (typeof warmPcPolicy === "function" && warmPcPolicy() === want) {
        console.info(
          "[webrtc] force_relay keep warm policy=" + want + (next ? " pure" : "")
        );
      } else {
        clearIceWarm();
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
 * force_relay: UDP turn: only — TCP dual-path stormed ALLOCATEs and never
 * finished relay↔relay media (peer_usage stayed ~0).
 * @param {RTCIceServer[]} servers
 * @returns {RTCIceServer[]}
 */
function udpTurnOnly(servers) {
  const udp = (servers || []).filter((s) => {
    const u = String(
      Array.isArray(s.urls) ? s.urls[0] : s.urls || ""
    ).toLowerCase();
    if (!(u.startsWith("turn:") || u.startsWith("turns:"))) return false;
    if (u.includes("transport=tcp")) return false;
    if (u.startsWith("turns:")) return false;
    return true;
  });
  return udp.length ? udp : servers || [];
}

/**
 * Strip host/srflx for pure-relay modes (Hide IP + hub force_relay).
 * Same-IP hairpin must not trickle private peers (coturn CREATE_PERM + no media).
 * @returns {boolean}
 */
function shouldFilterToRelayCandidates() {
  return hideIpRelayOnlyEnabled() || sessionForceRelayEnabled();
}

/**
 * Wait for ≥1 typ relay whenever TURN is in config (Play↔browser black when
 * web emitted host-only offer relay_candidates=0 while phone had relay).
 * Pure strip/filter stays hide/force only — this only delays emit for TURN.
 * @returns {boolean}
 */
function shouldWaitForFirstRelay() {
  try {
    if (preferDirectOnlyEnabled()) return false;
  } catch (_) {}
  try {
    const raw = lastRawIceServers || iceConfig?.iceServers || [];
    return (raw || []).some((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
      return urls.some((u) => /^turns?:/i.test(String(u || "")));
    });
  } catch (_) {
    return hideIpRelayOnlyEnabled() || sessionForceRelayEnabled();
  }
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
    const countRelay = () => {
      try {
        const s = pc.localDescription?.sdp || "";
        return (s.match(/\btyp\s+relay\b/gi) || []).length;
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
      if (ev?.candidate && isRelayIceCandidate(ev.candidate)) finish();
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
 * @param {RTCSessionDescriptionInit | { type?: string, sdp?: string }} desc
 * @returns {RTCSessionDescriptionInit}
 */
function sanitizeRemoteDescription(desc) {
  if (!desc || !shouldFilterToRelayCandidates()) return desc;
  const sdp = desc.sdp;
  if (!sdp) return desc;
  return { type: desc.type, sdp: stripNonRelayCandidatesFromSdp(sdp) };
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
  if (hideOnly || forceRelay) {
    // Pure relay for Hide IP privacy AND hub same-IP force_relay (hairpin).
    // UDP TURN only, pool=0 — avoids ALLOCATE storms that left peer_usage=0.
    const turnOnly = filterIceServersByMode(raw, "turn");
    if (turnOnly.length) {
      servers = udpTurnOnly(preferFastTurnFirst(turnOnly));
      if (!servers.length) servers = preferFastTurnFirst(turnOnly);
      if (servers.length > 1) servers = servers.slice(0, 1);
      iceTransportPolicy = "relay";
      poolSize = 0;
    } else {
      servers = preferFastTurnFirst(raw);
      iceTransportPolicy = "all";
      console.warn(
        "[webrtc] pure-relay wanted TURN empty — fail-open all (" +
          (hideOnly ? "hide_ip" : "force_relay") +
          ")"
      );
    }
  } else if (directOnly) {
    servers = filterIceServersByMode(raw, "stun");
    if (!servers.length) servers = DEFAULT_ICE.iceServers;
    iceTransportPolicy = "all";
  } else {
    servers = preferFastTurnFirst(raw);
    iceTransportPolicy = "all";
    poolSize = 2;
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
      if (x.startsWith("turn:") && !x.includes("transport=tcp")) return 0; // UDP
      if (x.startsWith("turn:") && x.includes("transport=tcp")) return 1;
      if (x.startsWith("turns:")) return 2;
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
 * PreferRelay: build relay-policy PC even before match force_relay so Play↔browser
 * promote-to-call reuses a warm ALLOCATE (biggest first-frame win).
 * @param {{ force?: boolean, preferRelay?: boolean }} [opts]
 * @returns {void}
 */
let iceWarmPc = null;
/** @type {"all"|"relay"|""} */
let iceWarmPolicy = "";
/** True once warm PC has completed at least one TURN ALLOCATE / relay candidate. */
let iceWarmPrimed = false;
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
    // Pure-relay warm: Hide IP, hub force_relay (same-IP), or explicit preferRelay.
    // Hybrid host-first on force_relay left peer_usage≈0 / black both cams.
    const wantPureRelay =
      hideIpRelayOnlyEnabled() ||
      sessionForceRelayEnabled() ||
      !!opts.preferRelay;
    if (wantPureRelay && hasTurn) {
      const turnOnly = filterIceServersByMode(raw, "turn");
      if (turnOnly.length) {
        let udp = udpTurnOnly(preferFastTurnFirst(turnOnly));
        if (!udp.length) udp = preferFastTurnFirst(turnOnly);
        if (udp.length > 1) udp = udp.slice(0, 1);
        cfg = {
          ...cfg,
          iceServers: udp,
          iceTransportPolicy: "relay",
          iceCandidatePoolSize: 0,
        };
      }
    } else if (hasTurn) {
      // Normal match: TURN first + STUN, policy all
      const turnOnly = filterIceServersByMode(raw, "turn");
      const stun = filterIceServersByMode(raw, "stun");
      let turn = udpTurnOnly(preferFastTurnFirst(turnOnly));
      if (!turn.length) turn = preferFastTurnFirst(turnOnly);
      if (turn.length > 1) turn = turn.slice(0, 1);
      cfg = {
        ...cfg,
        iceServers: preferFastTurnFirst([...turn, ...stun, ...raw]),
        iceTransportPolicy: "all",
        iceCandidatePoolSize: ICE_CANDIDATE_POOL_SIZE,
      };
    }
    const policy =
      cfg.iceTransportPolicy === "relay" ? "relay" : "all";
    if (iceWarmPc && iceWarmPolicy === policy && iceWarmPrimed && !opts.force) {
      return;
    }
    clearIceWarm();
    iceWarmPc = new RTCPeerConnection(cfg);
    iceWarmPolicy = policy;
    iceWarmPrimed = false;
    try {
      iceWarmPc.createDataChannel("ruletka-warm");
    } catch (_) {}
    // Pure-relay warm: do NOT createOffer (ALLOCATE storm + dirty SDP).
    // Match path gathers one fresh relay on the real PC (pool=0).
    iceWarmPrimed = policy !== "relay";
    console.info(
      "[webrtc] warmIcePool start policy=" + policy + " prime=skip"
    );
  } catch (e) {
    console.warn("[webrtc] warmIcePool", e);
    iceWarmPc = null;
    iceWarmPolicy = "";
    iceWarmPrimed = false;
  }
}

function clearIceWarm() {
  try {
    iceWarmPc?.close();
  } catch (_) {}
  iceWarmPc = null;
  iceWarmPolicy = "";
  iceWarmPrimed = false;
}

/**
 * Steal the queue warm PC for the real call (TURN already allocated).
 * @returns {RTCPeerConnection | null}
 */
function takeWarmPc() {
  if (!iceWarmPc) return null;
  const pc = iceWarmPc;
  const wasPrimed = iceWarmPrimed;
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
  // Mark for connect() — skip long first-relay wait when TURN already allocated
  try {
    pc.__ruletWarmPrimed = wasPrimed;
  } catch (_) {}
  return pc;
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

/**
 * @typedef {object} MediaDeviceChoices
 * @property {string} [videoDeviceId]
 * @property {string} [audioDeviceId]
 * @property {boolean} [video]
 * @property {boolean} [audio]
 */

/**
 * @typedef {object} WebRtcHooks
 * @property {(kind: 'offer'|'answer'|'ice'|'bye', payload: string, toPeerId?: string) => void} onSignal
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
      if (t && t.kind === "audio" && "contentHint" in t) {
        t.contentHint = "speech";
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
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    latency: { ideal: 0.02, max: 0.08 },
    sampleRate: { ideal: 48000 },
    ...extra,
  };
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
  return {
    echoCancellation: true, // keep echo control always
    // NS/AGC add delay; off in low-latency mode
    noiseSuppression: !low,
    autoGainControl: !low,
    channelCount: 1,
    latency: low
      ? { ideal: 0.005, max: 0.025 }
      : { ideal: 0.02, max: 0.08 },
    sampleRate: { ideal: 48000 },
    ...extra,
  };
}

/**
 * Pure iceTransportPolicy=relay PC — Hide IP privacy OR hub force_relay
 * (same public IP hairpin). Hybrid force_relay left host preferred and
 * peer_usage≈0 / both cams black on same-LAN (2026-08-10).
 */
function isRelayMediaMode() {
  try {
    if (typeof sessionForceRelayEnabled === "function" && sessionForceRelayEnabled()) {
      return true;
    }
  } catch (_) {}
  try {
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
    this._qualityTier = "high";
    /** Max tier allowed (multi-party secondary links use "mid"/"low"). */
    this._qualityCeiling = "high";
    this._adaptTimer = 0;
    this._lastBytes = 0;
    this._lastTs = 0;
    this._lossEma = 0;
    this._rttEma = 0;
    /** @type {RTCDataChannel | null} */
    this._chatDc = null;
    this._chatDcOpen = false;
  }

  /**
   * Cap adaptive quality (e.g. secondary multi-party link never goes above "low").
   * @param {keyof typeof QUALITY_TIERS | string} ceiling
   */
  setQualityCeiling(ceiling) {
    const c = QUALITY_TIERS[ceiling] ? ceiling : "high";
    this._qualityCeiling = c;
    const cur = this._qualityTier || "high";
    const next = clampQualityTier(cur, c);
    if (next !== cur) {
      this.applyQualityTier(next).catch(() => {});
    }
  }

  _emitSignal(kind, payload) {
    // Last line of defense: never put a second non-restart offer on the wire
    // for this match (hub debounce drop @~800ms → 18–20s black video).
    if (kind === "offer") {
      try {
        const now = Date.now();
        const hard = window.__ruletMatchOfferAt || 0;
        // Prefer explicit flag set by iceRestart path
        const iceRestart = !!this._emittingIceRestart;
        if (!iceRestart && hard && now - hard < 20000) {
          console.info("[webrtc] blocked second offer emit", now - hard);
          return;
        }
        if (!iceRestart) {
          window.__ruletMatchOfferAt = now;
          window.__ruletMatchOfferLock = 1;
          window.__ruletMatchOfferAttemptAt = now;
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
      this.localStream.getTracks().forEach((t) => t.stop());
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

  /** Attach an existing stream (from external preview manager). */
  setLocalStream(stream) {
    this.localStream = stream;
    this._tagTracks();
    // If PC already exists (rare), push tracks so offer/answer includes cam
    if (this.pc && stream) {
      void this.syncLocalTracksToPc().catch(() => {});
    }
  }

  /** Push current localStream tracks into an active peer connection. */
  async syncLocalTracksToPc() {
    if (!this.pc || !this.localStream) return;
    this._tagTracks();
    const senders = this.pc.getSenders() || [];
    for (const track of this.localStream.getTracks()) {
      // Prefer existing sender of same kind (incl. null-track transceiver)
      let sender = senders.find((s) => s.track && s.track.kind === track.kind);
      if (!sender) {
        try {
          const tr = this.pc.getTransceivers?.() || [];
          for (const x of tr) {
            const st = x?.sender;
            if (!st) continue;
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
      if (sender && typeof sender.replaceTrack === "function") {
        try {
          await sender.replaceTrack(track);
          continue;
        } catch (_) {}
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
    await this.applyQualityTier(this._qualityTier || "high");
  }

  setMicEnabled(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  setCamEnabled(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  /**
   * @param {keyof typeof QUALITY_TIERS | string} tier
   */
  async applyQualityTier(tier) {
    const capped = clampQualityTier(tier, this._qualityCeiling || "high");
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
    // Hold low until first paint — adaptive mid/high delayed TURN keyframe
    try {
      const el = this._videoEl;
      if (!(el && el.videoWidth > 8 && el.readyState >= 2)) return;
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
      } else if (!this.isOfferer && !this._offerSentOnce && !this._answeredAt) {
        this._armOfferWatchdog(1600);
      }
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
    let promoted = false;
    try {
      if (
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
      this.pc = new RTCPeerConnection(iceConfig);
    }
    this._pcBornAt = Date.now();
    this._relayPc =
      iceConfig.iceTransportPolicy === "relay" || wantPure;
    this._offerInFlight = false;
    this._offerSentOnce = false;
    this._offerEmitOk = false;
    this._answeredAt = 0;
    this._gotRemoteAnswerAt = 0;
    this._lastOfferAt = 0;
    this._pendingRemoteOfferSince = 0;
    this.pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      // Force-relay: never trickle host/srflx — peer TURN would CREATE_PERMISSION
      // private/link-local addresses → coturn 403 and wasted ICE time.
      if (
        shouldFilterToRelayCandidates() &&
        !isRelayIceCandidate(ev.candidate)
      ) {
        return;
      }
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
      this.hooks.onConnectionState?.(this.pc.connectionState);
      if (this.pc.connectionState === "connected") {
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
      }
      if (
        this.pc.connectionState === "failed" ||
        this.pc.connectionState === "closed" ||
        this.pc.connectionState === "disconnected"
      ) {
        // keep adapting a bit on disconnected; stop on failed/closed
        if (this.pc.connectionState === "failed" || this.pc.connectionState === "closed") {
          this._stopAdaptiveQuality();
        }
      }
    };
    this.pc.oniceconnectionstatechange = () => {
      const ice = this.pc.iceConnectionState;
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
        try {
          if (
            typeof window !== "undefined" &&
            typeof window.pushOutboundVideoTracks === "function"
          ) {
            void window.pushOutboundVideoTracks();
          }
        } catch (_) {}
        // Force paint if track already present but element black
        try {
          if (this._videoEl && this.remoteStream) {
            this._videoEl.srcObject = this.remoteStream;
            const p = this._videoEl.play?.();
            if (p && typeof p.catch === "function") p.catch(() => {});
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
      try {
        const exists = this.remoteStream
          .getTracks()
          .some((t) => t.id === ev.track.id);
        if (!exists) this.remoteStream.addTrack(ev.track);
      } catch (_) {}
      // Partner may send disabled/muted video — force enable for display
      try {
        if (ev.track && ev.track.enabled === false) ev.track.enabled = true;
      } catch (_) {}
      applyLowLatencyPlayout(this.pc);
      if (ev.track?.kind === "video") {
        try {
          requestOutboundKeyframes(this.pc);
        } catch (_) {}
      }
      // Ensure main remote element is bound (kickSolo may race)
      if (!this._videoEl && typeof document !== "undefined") {
        try {
          this._videoEl = document.getElementById("remote");
        } catch (_) {}
      }
      const paint = () => {
        if (!this.remoteStream) return;
        // Prefer live #remote (may have been remounted by blank-watch)
        if (typeof document !== "undefined") {
          try {
            const live = document.getElementById("remote");
            if (live && live !== this._videoEl) this._videoEl = live;
            if (!this._videoEl) this._videoEl = live;
          } catch (_) {}
        }
        if (!this._videoEl) return;
        try {
          const el = this._videoEl;
          // Hard-show (empty overlay / hidden attr left black with HOT RTP)
          try {
            el.hidden = false;
            el.removeAttribute?.("hidden");
            el.style.setProperty("display", "block", "important");
            el.style.setProperty("opacity", "1", "important");
            el.style.setProperty("visibility", "visible", "important");
            el.style.setProperty("z-index", "5", "important");
          } catch (_) {}
          // Always rebind on video track so audio-first doesn't leave black
          if (
            el.srcObject !== this.remoteStream ||
            ev.track?.kind === "video"
          ) {
            try {
              if (el.srcObject && el.srcObject !== this.remoteStream) {
                el.srcObject = null;
              }
            } catch (_) {}
            el.srcObject = this.remoteStream;
          }
          el.playsInline = true;
          // Autoplay: try unmuted; if blocked, mute then play (frames still show)
          el.muted = false;
          const p = el.play?.();
          if (p && typeof p.catch === "function") {
            p.catch(() => {
              try {
                el.muted = true;
                el.play?.().then(() => {
                  try {
                    el.muted = false;
                  } catch (_) {}
                }).catch(() => {});
              } catch (_) {}
            });
          }
          try {
            document.getElementById("tile-remote")?.classList.add("has-remote-feed");
            document.getElementById("remote-empty")?.classList.add("hidden");
          } catch (_) {}
        } catch (_) {}
      };
      paint();
      if (ev.track?.kind === "video") {
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
                "ms kind=video"
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
        setTimeout(paint, 40);
        setTimeout(paint, 120);
        setTimeout(paint, 350);
        setTimeout(paint, 900);
        setTimeout(paint, 2000);
        try {
          if (typeof ev.track.addEventListener === "function") {
            ev.track.addEventListener("unmute", paint);
            ev.track.addEventListener("mute", () => {
              /* repaint on unmute */
            });
          }
        } catch (_) {}
      }
      this.hooks.onRemoteStream?.(this.remoteStream);
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
    // No tracks yet (cam still opening): still negotiate A/V so first SDP leaves
    // immediately. Tracks attach later via replaceTrack — no second createOffer.
    if (
      this.isOfferer &&
      (!this.localStream || !(this.localStream.getTracks?.() || []).length)
    ) {
      try {
        this.pc.addTransceiver("audio", { direction: "sendrecv" });
        this.pc.addTransceiver("video", { direction: "sendrecv" });
      } catch (e) {
        console.warn("[webrtc] addTransceiver fallback", e);
      }
    }

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
    // Answerer: wait for peer offer (web is preferred offerer vs mobile).
    // Early promote = dual-offer thrash → black cams.
    this._armOfferWatchdog(this.isOfferer ? 2500 : 4500);
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
  }

  _clearOfferWatchdog() {
    try {
      if (this._offerWatchTimer) clearTimeout(this._offerWatchTimer);
    } catch (_) {}
    this._offerWatchTimer = null;
  }

  /**
   * If we never receive an offer (peer stuck / wrong role), become offerer once.
   */
  _armOfferWatchdog(ms = 800) {
    this._clearOfferWatchdog();
    this._offerWatchTimer = setTimeout(() => {
      this._offerWatchTimer = null;
      try {
        if (!this.pc) return;
        if (this.pc.remoteDescription || this.pc.currentRemoteDescription) return;
        if (this._offerSentOnce || this._offerInFlight) return;
        // Real offer already arrived and still applying — don't race promote (003)
        if (
          this._pendingRemoteOfferSince &&
          Date.now() - this._pendingRemoteOfferSince < 4000
        ) {
          console.info("[webrtc] offer watchdog — skip, remote offer pending");
          return;
        }
        // Already answered this PC — never re-offer from watchdog
        if (this._answeredAt) return;
        const live =
          this.remoteStream &&
          (this.remoteStream.getVideoTracks?.() || []).some(
            (t) => t.readyState === "live"
          );
        if (live) return;
        if (!this.isOfferer) {
          console.info("[webrtc] offer watchdog — promote answerer → offerer");
          this.isOfferer = true;
        } else {
          console.info("[webrtc] offer watchdog — retry stuck offerer");
        }
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
    if (!this.pc || !this.isOfferer) return false;
    const iceRestart = !!opts.iceRestart;
    const earlyBlack = !!opts.earlyBlack;
    const now = Date.now();
    // Already building an offer
    if (this._offerInFlight) return false;
    // Match-level gate: ONE offer per match for all PCs.
    // Use a synchronous lock bit (not check-then-set) so two concurrent
    // createOffer calls cannot both pass → hub drop ~800ms → 18s black video.
    try {
      if (typeof window !== "undefined") {
        const hard = window.__ruletMatchOfferAt || 0;
        if (!iceRestart && hard && now - hard < 20000) {
          console.info("[webrtc] skip offer — match already offered", now - hard);
          return false;
        }
        // iceRestart blocked 20s after first offer — including earlyBlack.
        // earlyBlack@3.5s caused offer thrash@4s (black both cams, one-way TURN).
        if (
          iceRestart &&
          hard &&
          now - hard < 20000 &&
          (this._gotRemoteAnswerAt || this.pc?.currentRemoteDescription)
        ) {
          console.info(
            "[webrtc] skip iceRestart — first path still in grace",
            now - hard,
            earlyBlack ? "earlyBlack" : ""
          );
          return false;
        }
        if (!iceRestart) {
          if (window.__ruletMatchOfferLock) {
            console.info("[webrtc] skip offer — match offer lock held");
            return false;
          }
          // Set lock BEFORE any await (atomic for single-threaded JS)
          window.__ruletMatchOfferLock = 1;
          window.__ruletMatchOfferAttemptAt = now;
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
    if (!iceRestart && this._offerSentOnce) {
      console.info("[webrtc] skip offer — already sent this PC");
      return false;
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
      ? 15000
      : hasRemote
        ? hasPaintedRemote
          ? 18000
          : 15000
        : 12000;
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
    // Block duplicate offers hard — phone promote + startCall glare thrash
    // was 4 offer/answer pairs per match and killed media.
    if (
      !iceRestart &&
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
    this._offerInFlight = true;
    if (!iceRestart) this._offerSentOnce = true;
    // Fail-open: hung createOffer must not hold match lock forever (24s MTO).
    const offerGen = (this._offerGen = (this._offerGen || 0) + 1);
    const hangTimer = setTimeout(() => {
      try {
        if (this._offerGen !== offerGen) return;
        if (this._offerEmitOk) return;
        console.warn("[webrtc] createOffer hang — free locks for offerKick");
        this._offerInFlight = false;
        if (!iceRestart) this._offerSentOnce = false;
        if (typeof window !== "undefined" && !iceRestart) {
          window.__ruletMatchOfferAttemptAt = 0;
          window.__ruletMatchOfferLock = 0;
          // Do not stamp __ruletMatchOfferAt — nothing left the wire
        }
      } catch (_) {}
    }, 2500);
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
      // force_relay: MUST have typ relay in SDP (hub logged relay_candidates=0).
      // Warm flag alone is not enough — new offer re-gathers.
      if (shouldWaitForFirstRelay()) {
        const warmOk = !!(this.pc && this.pc.__ruletWarmPrimed);
        let n = 0;
        try {
          n = (
            String(this.pc?.localDescription?.sdp || "").match(
              /\btyp\s+relay\b/gi
            ) || []
          ).length;
        } catch (_) {}
        if (n === 0) {
          n = await waitForIceGatherRelayOrDone(this.pc, warmOk ? 600 : 900);
        }
        if (n === 0) {
          n = await waitForIceGatherRelayOrDone(this.pc, 1800);
        }
        console.info(
          "[webrtc] offer first-relay count=" +
            n +
            " warm=" +
            (warmOk ? 1 : 0)
        );
        // Pure relay (hide_ip / force_relay): rebuild once if still no relay.
        if (n === 0 && !opts._relayRetry && isRelayMediaMode()) {
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
          // No TURN path — emit host/srflx anyway (same-LAN / no-TURN smoke).
          // Blocking forever left match offer lock held + black both sides.
          console.warn(
            "[webrtc] offer no relay after rebuild — emit host path (fail-open)"
          );
        }
      }
      if (this._offerGen !== offerGen) return false;
      this._lastOfferAt = Date.now();
      // Prefer localDescription (may include first relay after wait)
      let desc = this.pc.localDescription || offer;
      if (desc && shouldFilterToRelayCandidates() && desc.sdp) {
        desc = {
          type: desc.type,
          sdp: stripNonRelayCandidatesFromSdp(String(desc.sdp)),
        };
      }
      // Prefer relay under force_relay, but never block emit forever (black cams).
      if (shouldWaitForFirstRelay()) {
        const rn = (String(desc?.sdp || "").match(/\btyp\s+relay\b/gi) || [])
          .length;
        if (rn === 0) {
          console.warn(
            "[webrtc] offer emit without relay (fail-open host path)"
          );
        }
      }
      this._emitSignal("offer", JSON.stringify(desc));
      this._offerEmitOk = true;
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
   * Hold low bitrate until partner first frame paints, then ramp mid.
   * Timed 2.5s mid re-encode was fighting TURN first keyframe.
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
      try {
        const el = this._videoEl;
        if (el && el.videoWidth > 8 && el.readyState >= 2) painted = true;
      } catch (_) {}
      if (painted) {
        try {
          void this.applyQualityTier("mid");
        } catch (_) {}
        try {
          if (typeof window !== "undefined" && window.__ruletConnectT0) {
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
      if (n < 40) {
        this._qualityRampTimer = setTimeout(tick, 300);
      } else {
        try {
          void this.applyQualityTier("mid");
        } catch (_) {}
      }
    };
    this._qualityRampTimer = setTimeout(tick, 400);
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
    if (count >= 1 && hasRemote) {
      console.info("[webrtc] skip iceRestart — already used once this match");
      return false;
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
      if (!this._videoEl || !this.remoteStream) return;
      const el = this._videoEl;
      try {
        el.srcObject = null;
      } catch (_) {}
      try {
        el.srcObject = this.remoteStream;
      } catch (_) {
        el.srcObject = this.remoteStream;
      }
      const play = el.play?.();
      if (play && typeof play.catch === "function") play.catch(() => {});
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
        console.info(
          "[webrtc] skip remote offer — already negotiated, ICE",
          this.pc.iceConnectionState
        );
        return;
      }
      if (raw?.sdp) this._lastRemoteOfferSdp = String(raw.sdp).slice(0, 200);
      await this.pc.setRemoteDescription(desc);
      this._pendingRemoteOfferSince = 0;
      this.isOfferer = false;
      // Push tracks before answer so sendrecv m-lines have real media.
      try {
        this.syncLocalTracksToPc();
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
      // Pure-relay / TURN path: wait briefly for typ relay in answer SDP.
      if (shouldWaitForFirstRelay()) {
        const warmOk = !!(this.pc && this.pc.__ruletWarmPrimed);
        let n = 0;
        try {
          n = (
            String(this.pc?.localDescription?.sdp || "").match(
              /\btyp\s+relay\b/gi
            ) || []
          ).length;
        } catch (_) {}
        if (n === 0) {
          n = await waitForIceGatherRelayOrDone(this.pc, warmOk ? 500 : 800);
        }
        if (n === 0) {
          n = await waitForIceGatherRelayOrDone(this.pc, 1500);
        }
        console.info(
          "[webrtc] answer first-relay count=" +
            n +
            " warm=" +
            (warmOk ? 1 : 0)
        );
      }
      let ansDesc = this.pc.localDescription || answer;
      if (ansDesc && shouldFilterToRelayCandidates() && ansDesc.sdp) {
        ansDesc = {
          type: ansDesc.type,
          sdp: stripNonRelayCandidatesFromSdp(String(ansDesc.sdp)),
        };
      }
      this._emitSignal("answer", JSON.stringify(ansDesc));
      this._answeredAt = Date.now();
      this._clearOfferWatchdog();
      this._offerSentOnce = true;
      this._armStuckIceWatch();
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
      try {
        kickMediaAfterIce(this.pc);
      } catch (_) {}
    } else if (kind === "answer") {
      const raw = JSON.parse(payload);
      const desc = sanitizeRemoteDescription(raw);
      try {
        if (!this.pc) return;
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
            const el =
              this._videoEl ||
              (typeof document !== "undefined"
                ? document.getElementById("remote")
                : null);
            if (el) {
              this._videoEl = el;
              try {
                el.srcObject = this.remoteStream;
                el.muted = false;
                const p = el.play?.();
                if (p && typeof p.catch === "function") {
                  p.catch(() => {
                    try {
                      el.muted = true;
                      el.play?.().catch(() => {});
                    } catch (_) {}
                  });
                }
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
        console.warn("[webrtc] answer apply failed", e, "state=", this.pc?.signalingState);
      }
    } else if (kind === "ice") {
      try {
        const c = JSON.parse(payload);
        // Drop non-relay under force-relay — avoids coturn CREATE_PERMISSION 403
        // on private host candidates from the peer.
        if (
          shouldFilterToRelayCandidates() &&
          c &&
          c.candidate &&
          !isRelayIceCandidate(c)
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
        (c) => !c?.candidate || isRelayIceCandidate(c)
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
    this.pc?.close();
    this.pc = null;
    this.remoteStream = null;
    if (!keepLocal) {
      this.localStream?.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }

  /** @deprecated use closeCall */
  close() {
    this.closeCall({ keepLocal: false, sendBye: true });
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

if (typeof window !== "undefined") {
  window.getIcePathKind = getIcePathKind;
  window.getIceMeta = getIceMeta;
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
  window.isRelayIceCandidate = isRelayIceCandidate;
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
