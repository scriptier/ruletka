/**
 * WebRTC media helper for Freenet Chat Roulette.
 * Local preview can run before match; signaling only after matched.
 * ICE servers load from bridge GET /config.json (STUN/TURN).
 */

const DEFAULT_ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/** @type {RTCConfiguration} */
let iceConfig = { ...DEFAULT_ICE, iceServers: [...DEFAULT_ICE.iceServers] };

/**
 * Normalize bridge /config.json ice_servers into RTCConfiguration.iceServers.
 * Bridge sends { urls: string[], username?, credential? }.
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

/**
 * Fetch ICE config from the bridge (same origin by default).
 * @param {string} [base] origin or empty for relative
 * @returns {Promise<RTCConfiguration>}
 */
/** @type {ReturnType<typeof setInterval> | 0} */
let iceRefreshTimer = 0;
/** @type {object | null} */
let lastIceMeta = null;

async function loadRtcConfig(base = "") {
  try {
    const url = `${base.replace(/\/$/, "")}/config.json`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.ice_servers) {
      iceConfig = { iceServers: normalizeIceServers(j.ice_servers) };
    }
    lastIceMeta = j;
    // Re-fetch before ephemeral TURN credentials expire
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
    iceConfig = { ...DEFAULT_ICE, iceServers: [...DEFAULT_ICE.iceServers] };
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

// export helpers for non-module script tags
if (typeof window !== "undefined") {
  window.getIcePathKind = getIcePathKind;
  window.getIceMeta = getIceMeta;
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
 */

class RouletteWebRtc {
  /**
   * @param {WebRtcHooks} hooks
   * @param {boolean} isOfferer
   * @param {string} [remotePeerId] peer_id for multi-party signaling demux
   */
  constructor(hooks, isOfferer, remotePeerId = "") {
    this.hooks = hooks;
    this.isOfferer = isOfferer;
    this.remotePeerId = remotePeerId || "";
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.sigSeq = 0;
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

    // Stop previous tracks if re-opening with new devices
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    /** @type {MediaStreamConstraints} */
    const constraints = {};
    if (video) {
      // Prefer ideal over exact so missing/stale deviceIds don't block preview
      constraints.video = videoDeviceId
        ? { deviceId: { ideal: videoDeviceId } }
        : { facingMode: "user" };
    } else {
      constraints.video = false;
    }
    if (audio) {
      constraints.audio = audioDeviceId
        ? {
            deviceId: { ideal: audioDeviceId },
            echoCancellation: true,
            noiseSuppression: true,
          }
        : { echoCancellation: true, noiseSuppression: true };
    } else {
      constraints.audio = false;
    }

    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // If already in a call, swap tracks into the peer connection
    if (this.pc) {
      await this._syncLocalTracksToPc();
    }
    return this.localStream;
  }

  /** Attach an existing stream (from external preview manager). */
  setLocalStream(stream) {
    this.localStream = stream;
  }

  /** Push current localStream tracks into an active peer connection. */
  async syncLocalTracksToPc() {
    if (!this.pc || !this.localStream) return;
    const senders = this.pc.getSenders();
    for (const track of this.localStream.getTracks()) {
      const sender = senders.find((s) => s.track && s.track.kind === track.kind);
      if (sender) {
        await sender.replaceTrack(track);
      } else {
        this.pc.addTrack(track, this.localStream);
      }
    }
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

  async connect() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.pc = new RTCPeerConnection(iceConfig);
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this._emitSignal("ice", JSON.stringify(ev.candidate));
      }
    };
    this.pc.onconnectionstatechange = () => {
      this.hooks.onConnectionState?.(this.pc.connectionState);
    };
    this.pc.oniceconnectionstatechange = () => {
      const ice = this.pc.iceConnectionState;
      this.hooks.onIceConnectionState?.(ice);
      // Some browsers report ice "failed" before connectionState
      if (ice === "failed" || ice === "disconnected") {
        this.hooks.onConnectionState?.(ice === "failed" ? "failed" : this.pc.connectionState);
      }
    };
    this.pc.ontrack = (ev) => {
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      this.remoteStream.addTrack(ev.track);
      this.hooks.onRemoteStream?.(this.remoteStream);
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }
    }

    if (this.isOfferer) {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this._emitSignal("offer", JSON.stringify(this.pc.localDescription));
    }
  }

  async handleRemoteSignal(kind, payload) {
    if (!this.pc) await this.connect();
    if (kind === "offer") {
      const desc = JSON.parse(payload);
      await this.pc.setRemoteDescription(desc);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
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
    if (sendBye) {
      try {
        this._emitSignal("bye", "{}");
      } catch (_) {}
    }
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
  // Prompt once so labels are populated
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
    } catch (_) {
      // may still get deviceIds without labels
    }
  }
  // Dedupe by deviceId (Chrome lists default + hardware with same id sometimes)
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

window.RouletteWebRtc = RouletteWebRtc;
window.listMediaDevices = listMediaDevices;
window.loadRtcConfig = loadRtcConfig;
window.getIceConfig = getIceConfig;
