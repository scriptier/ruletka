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

/** Pre-gather host/srflx candidates before createOffer (faster first match). */
const ICE_CANDIDATE_POOL_SIZE = 8;

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
 * Normalize bridge /config.json ice_servers into RTCConfiguration.iceServers.
 * @param {unknown} servers
 * @returns {RTCIceServer[]}
 */
function normalizeIceServers(servers) {
  if (!Array.isArray(servers) || !servers.length) return DEFAULT_ICE.iceServers;
  return servers.map((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
    /** @type {RTCIceServer} */
    const entry = { urls: urls.length === 1 ? urls[0] : urls };
    if (s.username) entry.username = s.username;
    if (s.credential) entry.credential = s.credential;
    return entry;
  });
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
  sessionForceRelay = !!on;
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
 * Apply ICE policy from prefs:
 * - hideIpRelayOnly or sessionForceRelay → iceTransportPolicy "relay" + TURN only
 * - preferDirectOnly → STUN only (no TURN)
 * - default → all servers, policy "all" (VPN OK — browser picks TURN when needed)
 */
function applyIceDirectPreference() {
  const raw = lastRawIceServers?.length
    ? lastRawIceServers
    : DEFAULT_ICE.iceServers;
  const hideIp = hideIpRelayOnlyEnabled() || sessionForceRelayEnabled();
  const directOnly = !hideIp && preferDirectOnlyEnabled();
  let servers = raw;
  /** @type {RTCIceTransportPolicy} */
  let iceTransportPolicy = "all";

  if (hideIp) {
    // Force relay: partner never sees host/srflx; also best path for many VPNs
    const turnOnly = filterIceServersByMode(raw, "turn");
    if (turnOnly.length) {
      // Prefer TCP TURN first when forcing relay — some VPNs block UDP entirely
      servers = preferTcpTurnFirst(turnOnly);
      iceTransportPolicy = "relay";
    } else {
      // No TURN configured — cannot hide IP; fall back to all (UI should warn)
      servers = raw;
      iceTransportPolicy = "all";
      console.warn(
        "[webrtc] Hide IP / VPN relay needs TURN, but no turn: servers in config — using default ICE"
      );
    }
  } else if (directOnly) {
    servers = filterIceServersByMode(raw, "stun");
    if (!servers.length) servers = DEFAULT_ICE.iceServers;
    iceTransportPolicy = "all";
  } else {
    // Default: STUN + TURN. Keep TCP TURN available for VPN users who block UDP.
    servers = preferTcpTurnFirst(raw);
    iceTransportPolicy = "all";
  }

  iceConfig = {
    iceServers: servers,
    iceCandidatePoolSize: ICE_CANDIDATE_POOL_SIZE,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceTransportPolicy,
  };
  return iceConfig;
}

/**
 * Within each iceServer entry, list TCP/TLS TURN URLs before UDP so browsers
 * that try in order recover faster on UDP-blocked VPN paths.
 * @param {RTCIceServer[]} servers
 * @returns {RTCIceServer[]}
 */
function preferTcpTurnFirst(servers) {
  return (servers || []).map((s) => {
    const urls = Array.isArray(s.urls) ? s.urls.slice() : s.urls ? [s.urls] : [];
    if (urls.length < 2) return s;
    const score = (u) => {
      const x = String(u).toLowerCase();
      if (x.startsWith("turns:")) return 0;
      if (x.includes("transport=tcp")) return 1;
      if (x.startsWith("turn:")) return 2;
      return 3; // stun etc.
    };
    urls.sort((a, b) => score(a) - score(b));
    const entry = { urls: urls.length === 1 ? urls[0] : urls };
    if (s.username) entry.username = s.username;
    if (s.credential) entry.credential = s.credential;
    return entry;
  });
}

async function loadRtcConfig(base = "") {
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
    if (iceRefreshTimer) clearInterval(iceRefreshTimer);
    if (j.turn_ephemeral && j.turn_ttl_secs) {
      const refreshMs = Math.max(60_000, (Number(j.turn_ttl_secs) * 1000) / 2);
      iceRefreshTimer = setInterval(() => {
        loadRtcConfig(base).catch(() => {});
      }, refreshMs);
    }
    return { config: iceConfig, meta: j };
  } catch (e) {
    console.warn("[webrtc] config.json failed, using default STUN", e);
    lastRawIceServers = [...DEFAULT_ICE.iceServers];
    applyIceDirectPreference();
    return { config: iceConfig, meta: null, error: String(e.message || e) };
  }
}

function getIceConfig() {
  return iceConfig;
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
        const pref = preferOrder(videoCaps.codecs, [
          "video/AV1",
          "video/VP9",
          "video/H264",
          "video/VP8",
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
    } catch (_) {}
  }
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
 * True when media should prefer matched (slightly higher) jitter targets:
 * Hide-IP relay-only pref, or last known path is TURN.
 */
function isRelayMediaMode() {
  try {
    if (sessionForceRelayEnabled()) return true;
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

/**
 * Playout target ms — same value applied to audio *and* video for lipsync.
 * On TURN/relay (Hide IP), use a slightly higher matched target so browsers
 * don't underrun and grow A/V buffers unevenly.
 * @param {string} [tier]
 * @param {{ relay?: boolean }} [opts]
 */
function playoutTargetForTier(tier, opts = {}) {
  const low = isLowLatencyAudioEnabled();
  const relay = opts.relay === true || isRelayMediaMode();
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
      const baseVideo = {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: "user",
      };
      constraints.video = videoDeviceId
        ? { ...baseVideo, deviceId: { ideal: videoDeviceId } }
        : baseVideo;
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
  }

  /** Push current localStream tracks into an active peer connection. */
  async syncLocalTracksToPc() {
    if (!this.pc || !this.localStream) return;
    this._tagTracks();
    const senders = this.pc.getSenders();
    for (const track of this.localStream.getTracks()) {
      const sender = senders.find((s) => s.track && s.track.kind === track.kind);
      if (sender) {
        await sender.replaceTrack(track);
      } else {
        this.pc.addTrack(track, this.localStream);
      }
    }
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
        const raw = typeof ev.data === "string" ? ev.data : "";
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
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this._chatDc = null;
    this._chatDcOpen = false;
    this.pc = new RTCPeerConnection(iceConfig);
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this._emitSignal("ice", JSON.stringify(ev.candidate));
      }
    };
    this.pc.onconnectionstatechange = () => {
      this.hooks.onConnectionState?.(this.pc.connectionState);
      if (this.pc.connectionState === "connected") {
        this._startAdaptiveQuality();
        applyLowLatencyPlayout(this.pc);
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
      } else if (ice === "connected" || ice === "completed") {
        this._clearDisconnectedIceProbe();
        this._iceRestartCount = 0;
        this._startAdaptiveQuality();
        applyLowLatencyPlayout(this.pc);
      }
    };
    this.pc.ontrack = (ev) => {
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      // Avoid duplicate track ids when renegotiating
      const exists = this.remoteStream.getTracks().some((t) => t.id === ev.track.id);
      if (!exists) this.remoteStream.addTrack(ev.track);
      // Keep audio+video on one MediaStream so the <video> element lipsyncs them
      applyLowLatencyPlayout(this.pc);
      if (this._videoEl) {
        try {
          // Only reassign if needed — thrashing srcObject can desync A/V briefly
          if (this._videoEl.srcObject !== this.remoteStream) {
            this._videoEl.srcObject = this.remoteStream;
          }
          const p = this._videoEl.play?.();
          if (p && typeof p.catch === "function") p.catch(() => {});
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
    await this.applyQualityTier(this._qualityTier || "high");

    if (this.isOfferer) {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.pc.setLocalDescription(offer);
      this._emitSignal("offer", JSON.stringify(this.pc.localDescription));
    }
  }

  /**
   * Rate-limited ICE restart. Offerer renego; answerer uses restartIce() so the
   * remote can renegotiate. Caps spam when ICE flaps failed/disconnected.
   * @param {{ force?: boolean }} [opts] force=true for explicit soft-recover from live.js
   * @returns {Promise<boolean>}
   */
  async _tryIceRestart(opts = {}) {
    if (!this.pc) return false;
    const force = !!opts.force;
    const now = Date.now();
    const last = this._iceRestartAt || 0;
    const count = this._iceRestartCount || 0;
    // Restart already in flight — report success so callers don't hard-fail immediately
    if (last && now - last < 1800 && count > 0) return true;
    // Auto: every 4s, up to 5 restarts (mobile Wi‑Fi / radio sleep flaps)
    // Force (live soft-recover): up to 6 attempts, 2.5s cooldown
    if (!force) {
      if (now - last < 4000) return false;
      if (count >= 5) return false;
    } else {
      if (now - last < 2500) return count > 0;
      if (count >= 6) return false;
    }
    this._iceRestartAt = now;
    this._iceRestartCount = count + 1;
    try {
      if (this.isOfferer) {
        const offer = await this.pc.createOffer({ iceRestart: true });
        await this.pc.setLocalDescription(offer);
        this._emitSignal("offer", JSON.stringify(this.pc.localDescription));
        console.info("[webrtc] ICE restart offer sent", this._iceRestartCount);
        return true;
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

  _clearDisconnectedIceProbe() {
    this._discIceProbing = false;
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
    if (!this.pc) await this.connect();
    if (kind === "offer") {
      const desc = JSON.parse(payload);
      await this.pc.setRemoteDescription(desc);
      preferCodecs(this.pc);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this.applyQualityTier(this._qualityTier || "high");
      this._emitSignal("answer", JSON.stringify(this.pc.localDescription));
    } else if (kind === "answer") {
      const desc = JSON.parse(payload);
      if (!this.pc.currentRemoteDescription) {
        await this.pc.setRemoteDescription(desc);
      }
    } else if (kind === "ice") {
      try {
        await this.pc.addIceCandidate(JSON.parse(payload));
      } catch (e) {
        console.warn("[webrtc] ice error", e);
      }
    } else if (kind === "bye") {
      this.closeCall({ keepLocal: true });
    }
  }

  /**
   * End the peer connection. Optionally keep local camera/mic for preview.
   * @param {{ keepLocal?: boolean, sendBye?: boolean }} [opts]
   */
  closeCall(opts = {}) {
    const { keepLocal = false, sendBye = true } = opts;
    this._stopAdaptiveQuality();
    this._clearDisconnectedIceProbe();
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
  window.applyIceDirectPreference = applyIceDirectPreference;
  window.preferDirectOnlyEnabled = preferDirectOnlyEnabled;
  window.hideIpRelayOnlyEnabled = hideIpRelayOnlyEnabled;
  window.sessionForceRelayEnabled = sessionForceRelayEnabled;
  window.setSessionForceRelay = setSessionForceRelay;
  window.isRelayMediaMode = isRelayMediaMode;
  window.QUALITY_TIERS = QUALITY_TIERS;
  window.applyLowLatencyPlayout = applyLowLatencyPlayout;
  window.lowLatencyAudioConstraints = lowLatencyAudioConstraints;
  window.fullProcessingAudioConstraints = fullProcessingAudioConstraints;
  window.isLowLatencyAudioEnabled = isLowLatencyAudioEnabled;
  window.setForceFullAudioProcessing = setForceFullAudioProcessing;
  window.isForceFullAudioProcessing = isForceFullAudioProcessing;
  window.playoutTargetForTier = playoutTargetForTier;
}
