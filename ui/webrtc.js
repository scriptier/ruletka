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

const DEFAULT_ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  // Gather a few candidates early so first match connects faster
  iceCandidatePoolSize: 2,
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
 * Apply optional “no TURN” filter to iceConfig from lastRawIceServers.
 */
function applyIceDirectPreference() {
  const raw = lastRawIceServers?.length
    ? lastRawIceServers
    : DEFAULT_ICE.iceServers;
  const directOnly = preferDirectOnlyEnabled();
  let servers = raw;
  if (directOnly) {
    servers = raw
      .map((s) => {
        const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
        const kept = urls.filter((u) => {
          const x = String(u).toLowerCase();
          return !x.startsWith("turn:") && !x.startsWith("turns:");
        });
        if (!kept.length) return null;
        const entry = { urls: kept.length === 1 ? kept[0] : kept };
        if (s.username) entry.username = s.username;
        if (s.credential) entry.credential = s.credential;
        return entry;
      })
      .filter(Boolean);
    if (!servers.length) servers = DEFAULT_ICE.iceServers;
  }
  iceConfig = {
    iceServers: servers,
    iceCandidatePoolSize: 2,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
  return iceConfig;
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
 * Apply outbound encoding limits (bps). Safe no-op if unsupported.
 * @param {RTCRtpSender} sender
 * @param {{ maxBitrate?: number, maxFramerate?: number, degradationPreference?: string }} opts
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

/** Default quality ladder (outbound). */
const QUALITY_TIERS = {
  high: { maxBitrate: 1_800_000, maxFramerate: 30, label: "high" },
  mid: { maxBitrate: 900_000, maxFramerate: 28, label: "mid" },
  low: { maxBitrate: 400_000, maxFramerate: 20, label: "low" },
  min: { maxBitrate: 200_000, maxFramerate: 15, label: "min" },
};

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
    this._adaptTimer = 0;
    this._lastBytes = 0;
    this._lastTs = 0;
    this._lossEma = 0;
    this._rttEma = 0;
    /** @type {RTCDataChannel | null} */
    this._chatDc = null;
    this._chatDcOpen = false;
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
      const baseAudio = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      };
      constraints.audio = audioDeviceId
        ? { ...baseAudio, deviceId: { ideal: audioDeviceId } }
        : baseAudio;
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
    const t = QUALITY_TIERS[tier] || QUALITY_TIERS.mid;
    this._qualityTier = t.label;
    if (!this.pc) return;
    for (const sender of this.pc.getSenders()) {
      if (!sender.track) continue;
      if (sender.track.kind === "video") {
        await applySenderEncoding(sender, {
          maxBitrate: t.maxBitrate,
          maxFramerate: t.maxFramerate,
          degradationPreference: "balanced",
        });
      } else if (sender.track.kind === "audio") {
        // ~40 kbps is plenty for speech with Opus
        await applySenderEncoding(sender, { maxBitrate: 48_000 });
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
    this._adaptTimer = setInterval(() => this._adaptOnce(), 2500);
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

      report.forEach((r) => {
        if (r.type === "candidate-pair" && (r.state === "succeeded" || r.nominated)) {
          if (typeof r.currentRoundTripTime === "number") {
            rtt += r.currentRoundTripTime * 1000;
            rttN++;
          }
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
            // jitter in seconds
            if (r.jitter > 0.04) {
              loss += 0.02;
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

      if (lossP > 0.12 || rttMs > 450) next = "min";
      else if (lossP > 0.06 || rttMs > 280) next = "low";
      else if (lossP > 0.03 || rttMs > 180) next = "mid";
      else if (lossP < 0.015 && rttMs < 120) next = "high";

      if (next !== this._qualityTier) {
        await this.applyQualityTier(next);
      }
    } catch (_) {}
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
        // ICE restart can recover after NAT/path change
        this._tryIceRestart();
        this.hooks.onConnectionState?.("failed");
      } else if (ice === "disconnected") {
        this.hooks.onConnectionState?.(this.pc.connectionState);
      } else if (ice === "connected" || ice === "completed") {
        this._startAdaptiveQuality();
      }
    };
    this.pc.ontrack = (ev) => {
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      // Avoid duplicate track ids when renegotiating
      const exists = this.remoteStream.getTracks().some((t) => t.id === ev.track.id);
      if (!exists) this.remoteStream.addTrack(ev.track);
      if (this._videoEl) {
        try {
          this._videoEl.srcObject = this.remoteStream;
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

  async _tryIceRestart() {
    if (!this.pc || !this.isOfferer) return;
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      this._emitSignal("offer", JSON.stringify(this.pc.localDescription));
      console.info("[webrtc] ICE restart offer sent");
    } catch (e) {
      console.warn("[webrtc] ICE restart failed", e);
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
  window.QUALITY_TIERS = QUALITY_TIERS;
}
