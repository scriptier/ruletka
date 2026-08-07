/**
 * WebRTC media session for react-native-webrtc.
 * Signal kinds match web: offer | answer | ice | bye (JSON string payloads).
 *
 * Requires a native build (`npx expo prebuild` + run:android|ios).
 * In pure JS Expo Go, webrtcAvailable() is false and methods no-op with errors.
 */

import type { IceConfig, RTCIceServer } from "../hub/types";
import {
  applySenderEncoding,
  clampQualityTier,
  networkQualityCeiling,
  pickAdaptiveTier,
  preferCodecs,
  QUALITY_TIERS,
  tagLocalTracks,
  type QualityTierName,
  type SenderLike,
} from "./adaptiveQuality";

export type MediaHandlers = {
  onLocalStream?: (stream: MediaStreamLike) => void;
  onRemoteStream?: (stream: MediaStreamLike) => void;
  onSignal?: (kind: "offer" | "answer" | "ice" | "bye", payload: string) => void;
  onConnectionState?: (state: string) => void;
  onIceConnectionState?: (state: string) => void;
  onError?: (err: Error) => void;
  /** P2P data channel open/closed (chat + debate control plane). */
  onDataChannel?: (open: boolean) => void;
  /** Parsed JSON from data channel (debate_*, chat, …). */
  onDataMessage?: (msg: Record<string, unknown>) => void;
  /** Adaptive quality tier label (high|mid|low|min). */
  onQualityTier?: (tier: string) => void;
};

/** Must match web webrtc.js CHAT_DC_LABEL — debate uses this channel. */
const CHAT_DC_LABEL = "ruletka-chat";

type DataChannelLike = {
  label: string;
  readyState: string;
  binaryType?: string;
  send: (data: string) => void;
  close: () => void;
  onopen: ((ev?: unknown) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
};

/** Minimal stream shape used by UI (RTCView streamURL). */
export type MediaStreamLike = {
  toURL: () => string;
  getTracks: () => { kind: string; enabled: boolean; stop: () => void }[];
  getAudioTracks: () => { enabled: boolean; stop: () => void }[];
  getVideoTracks: () => { enabled: boolean; stop: () => void }[];
};

type WebrtcMod = {
  RTCPeerConnection: new (config?: object) => RTCPeerConnectionLike;
  RTCSessionDescription: new (init: object) => object;
  RTCIceCandidate: new (init: object) => object;
  RTCRtpSender?: {
    getCapabilities?: (kind: string) => { codecs?: object[] } | null;
  };
  mediaDevices: {
    getUserMedia: (c: object) => Promise<MediaStreamLike>;
  };
  MediaStream: new (tracks?: unknown[]) => MediaStreamLike;
  registerGlobals?: () => void;
};

type RTCPeerConnectionLike = {
  localDescription: { type?: string; sdp?: string } | null;
  remoteDescription: object | null;
  currentRemoteDescription: object | null;
  connectionState: string;
  iceConnectionState: string;
  signalingState?: string;
  addTrack: (track: unknown, stream: MediaStreamLike) => void;
  addIceCandidate: (c: object) => Promise<void>;
  createOffer: (opts?: object) => Promise<object>;
  createAnswer: () => Promise<object>;
  setLocalDescription: (d: object) => Promise<void>;
  setRemoteDescription: (d: object) => Promise<void>;
  close: () => void;
  restartIce?: () => void;
  getSenders?: () => SenderLike[];
  getTransceivers?: () => Array<{
    setCodecPreferences?: (c: object[]) => void;
    receiver?: { track?: { kind?: string } | null };
    sender?: { track?: { kind?: string } | null };
  }>;
  getStats?: () => Promise<
    | Map<string, Record<string, unknown>>
    | { forEach: (cb: (v: Record<string, unknown>) => void) => void }
  >;
  createDataChannel?: (label: string, opts?: object) => DataChannelLike;
  onicecandidate: ((ev: { candidate: object | null }) => void) | null;
  ontrack:
    | ((ev: {
        streams: MediaStreamLike[];
        track?: unknown;
      }) => void)
    | null;
  ondatachannel: ((ev: { channel: DataChannelLike }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  oniceconnectionstatechange: (() => void) | null;
};

function loadWebrtc(): WebrtcMod | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const w = require("react-native-webrtc") as WebrtcMod;
    if (w?.registerGlobals) {
      try {
        w.registerGlobals();
      } catch {
        /* already registered */
      }
    }
    if (w?.RTCPeerConnection && w?.mediaDevices) return w;
  } catch {
    /* not linked */
  }
  return null;
}

function filterIce(
  servers: RTCIceServer[] | undefined,
  mode: "all" | "turn" | "stun"
): RTCIceServer[] {
  if (!servers?.length) {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
  if (mode === "all") return servers;
  return servers
    .map((s) => {
      const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => {
        const x = String(u).toLowerCase();
        if (mode === "turn") return x.startsWith("turn:") || x.startsWith("turns:");
        return x.startsWith("stun:") || (!x.startsWith("turn:") && !x.startsWith("turns:"));
      });
      if (!urls.length) return null;
      return {
        urls: urls.length === 1 ? urls[0] : urls,
        username: s.username,
        credential: s.credential,
      } as RTCIceServer;
    })
    .filter(Boolean) as RTCIceServer[];
}

/**
 * Prefer TCP/TLS TURN before UDP — cellular / corporate Wi‑Fi often block UDP.
 * Mirrors ui/webrtc.js preferTcpTurnFirst (critical phone↔browser).
 */
function preferTcpTurnFirst(servers: RTCIceServer[]): RTCIceServer[] {
  return (servers || []).map((s) => {
    const urls = Array.isArray(s.urls)
      ? s.urls.slice()
      : s.urls
        ? [s.urls]
        : [];
    if (urls.length < 2) return s;
    const score = (u: string) => {
      const x = String(u).toLowerCase();
      if (x.startsWith("turns:")) return 0;
      if (x.includes("transport=tcp")) return 1;
      if (x.startsWith("turn:")) return 2;
      return 3;
    };
    urls.sort((a, b) => score(String(a)) - score(String(b)));
    return {
      urls: urls.length === 1 ? urls[0] : urls,
      username: s.username,
      credential: s.credential,
    } as RTCIceServer;
  });
}

function serializeIceCandidate(c: Record<string, unknown> | null | undefined): string {
  if (!c) return "";
  // RN + browser both accept this shape; avoid dumping class extras.
  // Do not invent sdpMLineIndex=0 when missing — breaks trickle mid matching.
  const plain: Record<string, unknown> = {
    candidate: String(c.candidate || ""),
    sdpMid: c.sdpMid ?? null,
  };
  if (typeof c.sdpMLineIndex === "number" && !Number.isNaN(c.sdpMLineIndex)) {
    plain.sdpMLineIndex = c.sdpMLineIndex;
  } else if (c.sdpMLineIndex != null && c.sdpMLineIndex !== "") {
    const n = Number(c.sdpMLineIndex);
    if (!Number.isNaN(n)) plain.sdpMLineIndex = n;
  }
  if (c.usernameFragment != null) plain.usernameFragment = c.usernameFragment;
  return JSON.stringify(plain);
}

/** True when SDP candidate is typ relay (TURN). */
function isRelayIceCandidate(
  c: Record<string, unknown> | string | null | undefined
): boolean {
  if (c == null) return false;
  const s =
    typeof c === "string"
      ? c
      : String((c as { candidate?: string }).candidate || "");
  if (!s) return false;
  return /\btyp\s+relay\b/i.test(s);
}

/** Drop host/srflx lines from SDP (remote host still triggers TURN CREATE_PERMISSION). */
function stripNonRelayCandidatesFromSdp(sdp: string): string {
  if (!sdp) return sdp;
  const lines = sdp.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^a=candidate:/i.test(line) && !/\btyp\s+relay\b/i.test(line)) {
      continue;
    }
    out.push(line);
  }
  return out.join("\r\n");
}

export class MediaSession {
  private handlers: MediaHandlers = {};
  private ice: IceConfig | null = null;
  private hideIp = false;
  /** One-shot: force iceTransportPolicy=relay when first path stalls (CGNAT / hairpin). */
  private forceRelayOnce = false;
  private pc: RTCPeerConnectionLike | null = null;
  private localStream: MediaStreamLike | null = null;
  private remoteStream: MediaStreamLike | null = null;
  private remoteStreamUrl = "";
  private isOfferer = false;
  private makingOffer = false;
  /** Wall clock of last offer we sent (debounce double-offer / glare thrash). */
  private lastOfferAt = 0;
  /** At most one non-restart offer per call (hub: second offer kills media). */
  private offerSentThisCall = false;
  /** Answerer promote timer when peer never sends an offer. */
  private offerWatchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bump on closeCall so in-flight createOffer cannot send a late thrash offer. */
  private callGen = 0;
  /** Remote answer applied — never re-offer until hangup/rebuild. */
  private gotAnswerThisCall = false;
  /** Mutex: concurrent startCall was racing two offers before offerSent latched. */
  private startCallInFlight = false;
  /** When startCallInFlight latched — break if hung (getUserMedia stall). */
  private startCallInFlightAt = 0;
  /** Wall clock of last remote offer applied (blocks early promote). */
  private lastRemoteOfferAt = 0;
  /**
   * Wall clock when a real remote "offer" signal was received but not yet
   * applied (hasRemoteDescription still flips async after ICE-config / GUM wait).
   * armOfferWatchdog must not promote while a real offer is already in this pipe
   * — that race caused hub ~0.8s/~4s duplicate-offer debounce drops (003).
   */
  private pendingRemoteOfferSince = 0;
  private rtc: WebrtcMod | null = null;
  private iceRestartCount = 0;
  private iceRestartAt = 0;
  private discIceTimers: Array<ReturnType<typeof setTimeout>> = [];
  private connectWatchTimer: ReturnType<typeof setTimeout> | null = null;
  private remoteVideoWatchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Serialize getUserMedia so preview + startCall never open the cam twice. */
  private localStreamPromise: Promise<MediaStreamLike | null> | null = null;
  /** Waiters for first /config.json ICE servers (TURN is required phone↔browser). */
  private iceWaiters: Array<() => void> = [];
  /** ICE that arrived before remote description — classic trickle bug if dropped. */
  private pendingRemoteIce: object[] = [];
  private hasRemoteDescription = false;
  private gotRemoteVideo = false;
  private chatDc: DataChannelLike | null = null;
  private chatDcOpen = false;
  /** Serialize offer/answer handling (avoids concurrent setRemoteDescription races). */
  private signalChain: Promise<void> = Promise.resolve();
  /** Wall clock for connect timing (set on startCall / first signal). */
  private connectT0 = 0;
  /** Adaptive outbound quality (web parity). */
  private qualityTier: QualityTierName = "mid";
  private qualityCeiling: QualityTierName = "high";
  private adaptTimer: ReturnType<typeof setInterval> | null = null;
  private rttEma = 0;
  private lossEma = 0;
  private relayPath = false;
  /** Cellular path — caps quality ceiling. */
  private onCellular = false;
  /** PC created during search to pre-gather ICE (poolSize) before match. */
  private warmed = false;
  /** Wall time when startCall began (guards early ICE restarts). */
  private callStartAt = 0;

  constructor() {
    this.rtc = loadWebrtc();
  }

  /** ms since connect start (for analytics). */
  connectElapsedMs(): number {
    return this.elapsedMs();
  }

  getQualityTier(): QualityTierName {
    return this.qualityTier;
  }

  /**
   * Network / settings policy for adaptive ceiling.
   * Call when cellular / data-saver / hide-ip changes.
   */
  setNetworkHints(opts: {
    cellular?: boolean;
    dataSaver?: boolean;
    hideIp?: boolean;
  }): void {
    if (opts.cellular != null) this.onCellular = !!opts.cellular;
    if (opts.dataSaver != null) this.dataSaver = !!opts.dataSaver;
    if (opts.hideIp != null) this.hideIp = !!opts.hideIp;
    this.qualityCeiling = networkQualityCeiling({
      cellular: this.onCellular,
      dataSaver: this.dataSaver,
      hideIp: this.hideIp,
    });
    // Immediate clamp if already in a call
    if (this.pc) {
      const next = clampQualityTier(this.qualityTier, this.qualityCeiling);
      if (next !== this.qualityTier) {
        void this.applyQualityTier(next);
      }
    }
  }

  /** ms since connectT0 (or -1 if not started). */
  private elapsedMs(): number {
    if (!this.connectT0) return -1;
    return Math.max(0, Date.now() - this.connectT0);
  }

  private markConnectStart(why: string) {
    if (!this.connectT0) {
      this.connectT0 = Date.now();
      this.handlers.onConnectionState?.(
        `connect_t0 why=${why}`
      );
    }
  }

  private markPhase(phase: string) {
    const ms = this.elapsedMs();
    this.handlers.onConnectionState?.(
      ms >= 0 ? `timing ${phase} +${ms}ms` : `timing ${phase}`
    );
  }

  setHandlers(h: MediaHandlers) {
    this.handlers = h;
  }

  isDataChannelOpen(): boolean {
    return !!(
      this.chatDc &&
      this.chatDcOpen &&
      this.chatDc.readyState === "open"
    );
  }

  /** Send JSON over P2P data channel (debate + partner_mute + chat). */
  sendDataMessage(obj: Record<string, unknown>): boolean {
    if (!this.isDataChannelOpen() || !this.chatDc) return false;
    try {
      const s = JSON.stringify(obj);
      if (s.length > 8000) return false;
      this.chatDc.send(s);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Decode datachannel payload. react-native-webrtc often delivers strings as
   * ArrayBuffer when binaryType is "arraybuffer" — dropping those silently
   * broke partner_mute + debate on Play builds.
   */
  private static decodeDcData(data: unknown): string {
    if (data == null) return "";
    if (typeof data === "string") return data;
    try {
      if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
        return new TextDecoder("utf-8").decode(new Uint8Array(data));
      }
      if (ArrayBuffer.isView(data)) {
        const v = data as ArrayBufferView;
        return new TextDecoder("utf-8").decode(
          new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
        );
      }
      // Some RN bridges wrap { data: ArrayBuffer } or ByteBuffer-like
      const any = data as { data?: unknown; buffer?: ArrayBuffer };
      if (any?.data != null && any.data !== data) {
        return MediaSession.decodeDcData(any.data);
      }
      if (any?.buffer instanceof ArrayBuffer) {
        return new TextDecoder("utf-8").decode(new Uint8Array(any.buffer));
      }
    } catch {
      /* fall through */
    }
    try {
      return String(data);
    } catch {
      return "";
    }
  }

  private attachChatDc(dc: DataChannelLike) {
    if (!dc) return;
    if (
      this.chatDc &&
      this.chatDc !== dc &&
      this.chatDc.readyState === "open"
    ) {
      try {
        dc.close();
      } catch {
        /* ignore */
      }
      return;
    }
    this.chatDc = dc;
    // Prefer string messages when supported — fewer RN binary edge cases.
    // Fall back: still decode ArrayBuffer in onmessage.
    try {
      dc.binaryType = "arraybuffer";
    } catch {
      /* ignore */
    }
    dc.onopen = () => {
      this.chatDcOpen = true;
      this.handlers.onDataChannel?.(true);
      this.handlers.onConnectionState?.("datachannel_open");
    };
    dc.onclose = () => {
      if (this.chatDc === dc) {
        this.chatDcOpen = false;
        this.chatDc = null;
        this.handlers.onDataChannel?.(false);
      }
    };
    dc.onerror = () => {
      /* close follows */
    };
    dc.onmessage = (ev) => {
      try {
        const raw = MediaSession.decodeDcData(ev?.data);
        if (!raw) {
          this.handlers.onConnectionState?.("datachannel_empty_payload");
          return;
        }
        const msg = JSON.parse(raw) as Record<string, unknown>;
        if (!msg || typeof msg !== "object") return;
        this.handlers.onDataMessage?.(msg);
      } catch (e) {
        this.handlers.onConnectionState?.(
          `datachannel_parse_err ${e instanceof Error ? e.message : String(e)}`
        );
      }
    };
    if (dc.readyState === "open") {
      this.chatDcOpen = true;
      this.handlers.onDataChannel?.(true);
    }
  }

  setIceConfig(cfg: IceConfig) {
    this.ice = cfg;
    const waiters = this.iceWaiters.splice(0);
    for (const w of waiters) w();
  }

  setHideIp(on: boolean) {
    this.hideIp = on;
    this.setNetworkHints({ hideIp: on });
  }

  /**
   * Block until TURN/STUN config is loaded (or timeout).
   * Without this, a fast match can open a PeerConnection with STUN-only defaults
   * and never connect phone (CGNAT) ↔ browser.
   */
  /** True when we already have ICE servers (prefer starting call without waiting). */
  hasIceServers(): boolean {
    return !!(this.ice?.ice_servers && this.ice.ice_servers.length > 0);
  }

  hasTurn(): boolean {
    return !!(this.ice?.has_turn && this.hasIceServers());
  }

  async waitForIceConfig(timeoutMs = 4000): Promise<boolean> {
    if (this.ice?.ice_servers?.length) return true;
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      const t = setTimeout(
        () => finish(!!this.ice?.ice_servers?.length),
        timeoutMs
      );
      this.iceWaiters.push(() => {
        clearTimeout(t);
        finish(!!this.ice?.ice_servers?.length);
      });
    });
  }

  private async flushPendingIce(pc: RTCPeerConnectionLike, rtc: WebrtcMod) {
    let batch = this.pendingRemoteIce.splice(0);
    if (!batch.length) return;
    if (this.shouldFilterToRelayCandidates()) {
      batch = batch.filter(
        (c) =>
          !c ||
          !(c as { candidate?: string }).candidate ||
          isRelayIceCandidate(c as Record<string, unknown>)
      );
    }
    if (!batch.length) return;
    // Parallel add — sequential await added RTT * N on phone↔browser
    await Promise.all(
      batch.map(async (c) => {
        try {
          await pc.addIceCandidate(new rtc.RTCIceCandidate(c));
        } catch {
          /* stale / mismatched mid */
        }
      })
    );
  }

  static webrtcAvailable(): boolean {
    return !!loadWebrtc();
  }

  getLocalStream(): MediaStreamLike | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStreamLike | null {
    return this.remoteStream;
  }

  /**
   * UI unblur / surface rebind: harvest receivers + re-emit stream so Android
   * RTCView remounts with video tracks (opaque safety veil often hid frames).
   */
  forceRepaintRemote(why = "ui_unblur"): void {
    try {
      this.harvestRemoteReceivers(why);
      this.repaintRemoteStream(why);
    } catch {
      /* ignore */
    }
  }

  /**
   * Reuse another session's local tracks (multi-peer secondary PC).
   * Avoids a second getUserMedia on the same camera.
   */
  adoptLocalStream(stream: MediaStreamLike | null): void {
    if (!stream) return;
    this.localStream = stream;
    tagLocalTracks(stream as Parameters<typeof tagLocalTracks>[0]);
    this.attachLocalTracksIfNeeded();
  }

  /** Multi-peer (1v2 / 2v2 / trio): force noise suppression + AGC. */
  private multiPeerAudio = false;
  /** Lower res / fps for heat + data (settings toggle). */
  private dataSaver = false;

  setMultiPeerAudio(on: boolean): void {
    this.multiPeerAudio = !!on;
    // Secondary / multi-peer links stay cheaper to encode
    if (on) {
      this.qualityCeiling = clampQualityTier(this.qualityCeiling, "mid");
    }
  }

  setDataSaver(on: boolean): void {
    this.dataSaver = !!on;
    this.setNetworkHints({ dataSaver: on });
  }

  isDataSaver(): boolean {
    return this.dataSaver;
  }

  /** Apply outbound encoding tier (high|mid|low|min). */
  async applyQualityTier(tier: string): Promise<void> {
    const capped = clampQualityTier(tier, this.qualityCeiling);
    const t = QUALITY_TIERS[capped] || QUALITY_TIERS.mid;
    this.qualityTier = t.label;
    const pc = this.pc;
    if (!pc || typeof pc.getSenders !== "function") {
      this.handlers.onQualityTier?.(this.qualityTier);
      return;
    }
    for (const sender of pc.getSenders() || []) {
      if (!sender?.track) continue;
      if (sender.track.kind === "video") {
        await applySenderEncoding(sender, {
          maxBitrate: t.maxBitrate,
          maxFramerate: t.maxFramerate,
          scaleResolutionDownBy: t.scaleResolutionDownBy || 1,
          // Prefer smooth motion over crisp stills on phone chat
          degradationPreference: "maintain-framerate",
        });
      } else if (sender.track.kind === "audio") {
        await applySenderEncoding(sender, { maxBitrate: 32_000 });
      }
    }
    this.handlers.onQualityTier?.(this.qualityTier);
    this.handlers.onConnectionState?.(
      `quality_tier ${this.qualityTier} ceil=${this.qualityCeiling}`
    );
  }

  private applyCodecPrefs(pc: RTCPeerConnectionLike) {
    const getCaps =
      this.rtc?.RTCRtpSender?.getCapabilities?.bind(this.rtc.RTCRtpSender) ||
      // global after registerGlobals
      (
        globalThis as unknown as {
          RTCRtpSender?: {
            getCapabilities?: (k: string) => { codecs?: object[] } | null;
          };
        }
      ).RTCRtpSender?.getCapabilities?.bind(
        (
          globalThis as unknown as {
            RTCRtpSender?: {
              getCapabilities?: (k: string) => { codecs?: object[] } | null;
            };
          }
        ).RTCRtpSender
      );
    preferCodecs(pc, getCaps as ((k: string) => { codecs?: object[] } | null) | undefined);
  }

  private startAdaptiveQuality() {
    this.stopAdaptiveQuality();
    this.rttEma = 0;
    this.lossEma = 0;
    // Relay / cellular: adapt faster
    const period =
      this.relayPath || this.onCellular || this.hideIp ? 1800 : 2500;
    this.adaptTimer = setInterval(() => {
      void this.adaptQualityOnce();
    }, period);
  }

  private stopAdaptiveQuality() {
    if (this.adaptTimer) {
      clearInterval(this.adaptTimer);
      this.adaptTimer = null;
    }
  }

  private async adaptQualityOnce() {
    const pc = this.pc;
    if (!pc || typeof pc.getStats !== "function") return;
    if (
      pc.connectionState !== "connected" &&
      pc.iceConnectionState !== "connected" &&
      pc.iceConnectionState !== "completed"
    ) {
      return;
    }
    try {
      const report = await pc.getStats();
      let rtt = 0;
      let rttN = 0;
      let loss = 0;
      let lossN = 0;
      const byId = new Map<string, Record<string, unknown>>();
      const each = (r: Record<string, unknown>) => {
        if (r?.id) byId.set(String(r.id), r);
      };
      if (typeof (report as { forEach?: unknown }).forEach === "function") {
        (
          report as { forEach: (cb: (v: Record<string, unknown>) => void) => void }
        ).forEach(each);
      }
      byId.forEach((r) => {
        const type = String(r.type || "");
        if (
          type === "candidate-pair" &&
          (r.state === "succeeded" || r.nominated)
        ) {
          if (typeof r.currentRoundTripTime === "number") {
            rtt += (r.currentRoundTripTime as number) * 1000;
            rttN++;
          }
          try {
            const local = byId.get(String(r.localCandidateId || ""));
            const remote = byId.get(String(r.remoteCandidateId || ""));
            const lt = String(
              local?.candidateType || local?.type || ""
            ).toLowerCase();
            const rt = String(
              remote?.candidateType || remote?.type || ""
            ).toLowerCase();
            if (lt === "relay" || rt === "relay") this.relayPath = true;
          } catch {
            /* ignore */
          }
        }
        if (
          type === "outbound-rtp" &&
          !r.isRemote &&
          (r.kind === "video" || r.mediaType === "video")
        ) {
          if (String(r.qualityLimitationReason || "") === "bandwidth") {
            loss += 0.05;
            lossN++;
          }
        }
        if (
          type === "inbound-rtp" &&
          !r.isRemote &&
          (r.kind === "video" || r.mediaType === "video")
        ) {
          if (
            typeof r.packetsLost === "number" &&
            typeof r.packetsReceived === "number"
          ) {
            const tot =
              (r.packetsLost as number) + (r.packetsReceived as number);
            if (tot > 20) {
              loss += (r.packetsLost as number) / tot;
              lossN++;
            }
          }
          if (typeof r.jitter === "number") {
            const jLim = this.relayPath || this.hideIp ? 0.055 : 0.04;
            if ((r.jitter as number) > jLim) {
              loss += 0.02;
              lossN++;
            }
          }
        }
        if (
          type === "inbound-rtp" &&
          !r.isRemote &&
          (r.kind === "audio" || r.mediaType === "audio")
        ) {
          if (typeof r.jitter === "number") {
            const jLim = this.relayPath || this.hideIp ? 0.065 : 0.05;
            if ((r.jitter as number) > jLim) {
              loss += 0.015;
              lossN++;
            }
          }
        }
      });
      if (rttN) {
        this.rttEma = this.rttEma
          ? this.rttEma * 0.7 + (rtt / rttN) * 0.3
          : rtt / rttN;
      }
      if (lossN) {
        this.lossEma = this.lossEma
          ? this.lossEma * 0.6 + (loss / lossN) * 0.4
          : loss / lossN;
      }
      const next = pickAdaptiveTier({
        current: this.qualityTier,
        rttMs: this.rttEma,
        lossP: this.lossEma,
        relay: this.relayPath || this.hideIp,
        ceiling: this.qualityCeiling,
      });
      if (next !== this.qualityTier) {
        await this.applyQualityTier(next);
      }
    } catch {
      /* ignore stats blips */
    }
  }

  private audioConstraints(): object {
    // Default full processing (NS + AGC); multi-peer keeps the same path
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    };
  }

  /**
   * Softer defaults than 720p@30 — many Android cameras reconfigure (blink)
   * when asked for high ideal sizes, then again when the peer connection starts.
   * dataSaver: ~360p@15 for mobile data / heat.
   */
  private videoConstraints(level: "soft" | "minimal" | "saver"): object {
    if (level === "saver" || this.dataSaver) {
      return {
        facingMode: "user",
        width: { ideal: 480, max: 640 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 15, max: 20 },
      };
    }
    if (level === "minimal") {
      return { facingMode: "user", width: 640, height: 480 };
    }
    return {
      facingMode: "user",
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 24, max: 30 },
    };
  }

  /** Soft re-apply resolution/fps when data-saver toggles (no full restart if possible). */
  async reapplyLocalVideoConstraints(): Promise<void> {
    const tracks = this.localStream?.getVideoTracks?.() || [];
    const c = this.videoConstraints(this.dataSaver ? "saver" : "soft") as {
      width?: unknown;
      height?: unknown;
      frameRate?: unknown;
    };
    let applied = false;
    for (const t of tracks) {
      try {
        const anyT = t as { applyConstraints?: (x: object) => Promise<void> };
        if (anyT.applyConstraints) {
          await anyT.applyConstraints({
            width: c.width,
            height: c.height,
            frameRate: c.frameRate,
          });
          applied = true;
        }
      } catch {
        /* device may reject mid-call */
      }
    }
    if (applied) return;
    // No track or applyConstraints failed — leave stream; next open uses saver
  }

  async ensureLocalStream(): Promise<MediaStreamLike | null> {
    if (this.localStream) return this.localStream;
    if (this.localStreamPromise) return this.localStreamPromise;

    this.localStreamPromise = this.openLocalStream().finally(() => {
      this.localStreamPromise = null;
    });
    return this.localStreamPromise;
  }

  private async openLocalStream(): Promise<MediaStreamLike | null> {
    const rtc = this.rtc || loadWebrtc();
    this.rtc = rtc;
    if (!rtc) {
      this.handlers.onError?.(
        new Error(
          "WebRTC not linked. Use a dev build: npx expo prebuild && npx expo run:android|ios"
        )
      );
      return null;
    }

    const tryGum = async (video: object, audio: object | boolean) => {
      const stream = await rtc.mediaDevices.getUserMedia({ audio, video });
      this.localStream = stream;
      tagLocalTracks(stream as Parameters<typeof tagLocalTracks>[0]);
      this.handlers.onLocalStream?.(stream);
      return stream;
    };

    try {
      return await tryGum(
        this.videoConstraints(this.dataSaver ? "saver" : "soft"),
        this.audioConstraints()
      );
    } catch {
      // Fallback if device rejects advanced constraints
      try {
        return await tryGum(
          this.videoConstraints(this.dataSaver ? "saver" : "minimal"),
          true
        );
      } catch (e2) {
        const err = e2 instanceof Error ? e2 : new Error(String(e2));
        this.handlers.onError?.(err);
        return null;
      }
    }
  }

  /** Re-apply NS/AGC when entering multi-peer (if track supports applyConstraints). */
  async applyFullAudioProcessing(): Promise<void> {
    this.multiPeerAudio = true;
    const tracks = this.localStream?.getAudioTracks?.() || [];
    for (const t of tracks) {
      try {
        // applyConstraints exists on native MediaStreamTrack
        const anyT = t as { applyConstraints?: (c: object) => Promise<void> };
        if (anyT.applyConstraints) {
          await anyT.applyConstraints({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  private pcConfig(): object {
    const raw = this.ice?.ice_servers;
    // Default iceTransportPolicy=all (STUN + TURN). Always-relay caused endless
    // "Connection weak — reconnecting" (ICE disconnected flaps + soft-recover
    // thrash) and black video when TURN CHANNEL_BIND failed.
    // force_relay only when hub asks, hide-ip, or explicit rebuild after fail.
    const hasTurn = this.hasTurn() || this.ice?.has_turn !== false;
    const forceRelay =
      this.forceRelayOnce || (this.hideIp && hasTurn);
    const warmOnly = !this.callStartAt && !this.forceRelayOnce && !this.hideIp;
    const useRelay = forceRelay && !warmOnly;
    const mode = useRelay ? "turn" : this.hideIp ? "turn" : "all";
    let servers = preferTcpTurnFirst(filterIce(raw, mode));
    let iceTransportPolicy: "all" | "relay" = useRelay ? "relay" : "all";
    if (useRelay && !servers.length) {
      servers = preferTcpTurnFirst(filterIce(raw, "all"));
      iceTransportPolicy = "all";
    }
    return {
      iceServers: servers,
      iceCandidatePoolSize: 8,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceTransportPolicy,
    };
  }

  /**
   * Prefer TURN relay for the next PC.
   * Hub sends force_relay on same-IP / cross-country matches.
   * Drops a warm (non-relay) PC so startCall builds with iceTransportPolicy=relay.
   */
  setForceRelay(on: boolean): void {
    const next = !!on;
    const was = this.forceRelayOnce;
    this.forceRelayOnce = next;
    if (next) {
      this.handlers.onConnectionState?.("force_relay_armed");
      // Warm search PC is STUN-first — must not keep it for a relay match
      if (this.pc && !this.hasRemoteDescription && !this.gotRemoteVideo) {
        try {
          this.pc.close();
        } catch {
          /* ignore */
        }
        this.pc = null;
        this.warmed = false;
        this.pendingRemoteIce = [];
        this.makingOffer = false;
      }
    } else if (was) {
      // Hub cleared force_relay — drop relay-only PC so next startCall uses "all"
      this.handlers.onConnectionState?.("force_relay_cleared");
      if (
        this.pc &&
        !this.hasRemoteDescription &&
        !this.gotRemoteVideo &&
        !this.makingOffer
      ) {
        try {
          this.pc.close();
        } catch {
          /* ignore */
        }
        this.pc = null;
        this.warmed = false;
        this.pendingRemoteIce = [];
      }
    }
  }

  /**
   * Rebuild PC as TURN-only (relay). Used once when first path never gets media
   * (same-NAT hairpin / UDP blocked). Caller then startCall as offerer.
   */
  forceRelayRebuild(): void {
    if (!this.hasTurn()) {
      this.handlers.onConnectionState?.("force_relay_skip_no_turn");
      return;
    }
    this.forceRelayOnce = true;
    this.handlers.onConnectionState?.("force_relay_rebuild");
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.warmed = false;
    this.hasRemoteDescription = false;
    this.pendingRemoteIce = [];
    this.makingOffer = false;
    this.gotRemoteVideo = false;
    this.chatDc = null;
    this.chatDcOpen = false;
  }

  private ensurePc(): RTCPeerConnectionLike | null {
    if (this.pc) return this.pc;
    const rtc = this.rtc || loadWebrtc();
    this.rtc = rtc;
    if (!rtc) {
      this.handlers.onError?.(new Error("WebRTC not linked"));
      return null;
    }
    const cfg = this.pcConfig();
    const pc = new rtc.RTCPeerConnection(cfg);
    this.pc = pc;
    this.hasRemoteDescription = false;
    this.pendingRemoteIce = [];

    const hasTurn = !!(this.ice?.has_turn && this.ice?.ice_servers?.length);
    this.handlers.onConnectionState?.(
      hasTurn ? "pc_ready_turn" : "pc_ready_stun_only"
    );

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        try {
          const raw = ev.candidate as unknown as Record<string, unknown>;
          // Live calls use relay policy — never trickle host/srflx (coturn 403).
          if (this.shouldFilterToRelayCandidates() && !isRelayIceCandidate(raw)) {
            return;
          }
          const payload = serializeIceCandidate(raw);
          if (payload) this.handlers.onSignal?.("ice", payload);
        } catch {
          /* ignore */
        }
      }
    };

    pc.ontrack = (ev) => {
      // Prefer the browser-provided stream object when present — wrapping into a
      // fresh MediaStream often leaves RTCView black on Android (no frames).
      // Audio usually arrives first; video is a later ontrack on the same stream.
      try {
        const track = ev.track as
          | {
              id?: string;
              kind?: string;
              enabled?: boolean;
              muted?: boolean;
              addEventListener?: (type: string, fn: () => void) => void;
            }
          | undefined;
        const fromPeer = ev.streams?.[0];

        if (fromPeer) {
          // Always adopt the peer stream so subsequent video tracks bind correctly
          this.remoteStream = fromPeer;
        } else if (!this.remoteStream && track && rtc.MediaStream) {
          this.remoteStream = new rtc.MediaStream([track]);
        } else if (this.remoteStream && track) {
          const existing = this.remoteStream.getTracks?.() || [];
          const has = existing.some(
            (t) =>
              (t as { id?: string }).id &&
              (t as { id?: string }).id === track.id
          );
          if (!has) {
            const add = (
              this.remoteStream as unknown as {
                addTrack?: (t: unknown) => void;
              }
            ).addTrack;
            if (typeof add === "function") {
              try {
                add.call(this.remoteStream, track);
              } catch {
                /* already on stream */
              }
            }
          }
        }
        if (!this.remoteStream) return;

        // Ensure track is enabled (some peers start muted)
        try {
          if (track && track.enabled === false) {
            (track as { enabled: boolean }).enabled = true;
          }
        } catch {
          /* ignore */
        }
        // When browser video unmutes after audio-first, force RTCView rebind
        try {
          if (track?.kind === "video" && typeof track.addEventListener === "function") {
            const onLive = () => {
              this.repaintRemoteStream("track_unmute");
            };
            track.addEventListener("unmute", onLive);
            track.addEventListener("mute", () => {
              /* keep stream; repaint when unmuted again */
            });
          }
        } catch {
          /* ignore */
        }

        this.pushRemoteStreamToUi(track?.kind || "track");
      } catch (e) {
        this.handlers.onError?.(
          e instanceof Error ? e : new Error(String(e))
        );
      }
    };

    pc.onconnectionstatechange = () => {
      this.handlers.onConnectionState?.(pc.connectionState);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        this.scheduleIceRestartProbe();
      }
      if (pc.connectionState === "connecting") {
        this.scheduleConnectingWatch();
      }
      if (pc.connectionState === "connected") {
        this.clearIceRestartProbe();
        this.clearConnectingWatch();
        this.iceRestartCount = 0;
        this.scheduleRemoteVideoWatch();
        void this.applyQualityTier(this.qualityTier || "mid");
        this.startAdaptiveQuality();
        this.harvestRemoteReceivers("pc_connected");
        this.repaintRemoteStream("pc_connected");
        setTimeout(() => this.repaintRemoteStream("pc_connected_500"), 500);
        setTimeout(() => this.repaintRemoteStream("pc_connected_2s"), 2000);
      }
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        this.stopAdaptiveQuality();
      }
    };
    pc.oniceconnectionstatechange = () => {
      this.handlers.onIceConnectionState?.(pc.iceConnectionState);
      if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed"
      ) {
        this.scheduleIceRestartProbe();
      }
      if (pc.iceConnectionState === "checking") {
        this.scheduleConnectingWatch();
      }
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        this.clearIceRestartProbe();
        this.clearConnectingWatch();
        this.iceRestartCount = 0;
        this.scheduleRemoteVideoWatch();
        void this.applyQualityTier(this.qualityTier || "mid");
        this.startAdaptiveQuality();
        // Android: ICE connected but RTCView still black — harvest receivers
        // (ontrack may have only delivered audio) and re-push to RTCView.
        this.harvestRemoteReceivers("ice_connected");
        this.repaintRemoteStream("ice_connected");
        setTimeout(() => this.repaintRemoteStream("ice_connected_500"), 500);
        setTimeout(() => this.repaintRemoteStream("ice_connected_2s"), 2000);
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        try {
          pc.addTrack(track, this.localStream);
        } catch (e) {
          this.handlers.onError?.(
            e instanceof Error ? e : new Error(String(e))
          );
        }
      }
    }

    // Answerer: remote creates ruletka-chat for debate + P2P chat
    pc.ondatachannel = (ev) => {
      if (ev?.channel && ev.channel.label === CHAT_DC_LABEL) {
        this.attachChatDc(ev.channel);
      }
    };

    return pc;
  }

  /**
   * Optional micro-pause after setLocalDescription. Trickle ICE carries
   * candidates via onicecandidate — do NOT block long here (200ms+ made
   * phone↔browser feel “forever” while waiting for SDP). Skip when warm
   * pool already gathered. Does NOT overwrite onicecandidate.
   */
  private waitForInitialIce(
    _pc: RTCPeerConnectionLike,
    maxMs = 40
  ): Promise<void> {
    if (maxMs <= 0 || this.warmed) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, maxMs));
  }

  /**
   * During search: open cam + create PC (iceCandidatePoolSize pre-gathers).
   * No second "gatherer" PC — dual PCs on Android regressed connect reliability.
   */
  async warmConnection(): Promise<void> {
    if (this.hasRemoteDescription || this.makingOffer) return;
    if (this.pc?.localDescription || this.pc?.remoteDescription) return;
    if (!this.hasIceServers()) {
      void this.ensureLocalStream().catch(() => {});
      return;
    }
    try {
      await this.ensureLocalStream();
      if (!this.pc) {
        this.ensurePc();
        this.warmed = true;
        this.handlers.onConnectionState?.("pc_warmed");
      } else {
        this.attachLocalTracksIfNeeded();
      }
    } catch {
      /* non-fatal — match path will retry */
    }
  }

  /**
   * Start a call after matched. Offerer creates the offer.
   * Always waits for ICE/TURN config first (phone NATs need hub TURN).
   *
   * IMPORTANT: do NOT tear down a PC that already has remote offer/answer
   * (browser often sends offer before our matched handler finishes startCall).
   * Destroying it left the phone as answerer with a blank PC → no video / "not matched".
   */
  async startCall(opts: { isOfferer: boolean }): Promise<void> {
    // Break stuck mutex (hung getUserMedia left startCallInFlight forever → 25s silence)
    if (this.startCallInFlight) {
      if (
        this.startCallInFlightAt &&
        Date.now() - this.startCallInFlightAt > 2500
      ) {
        this.handlers.onConnectionState?.("startCall_break_stuck_mutex");
        this.startCallInFlight = false;
      } else {
        this.handlers.onConnectionState?.("startCall_skip_mutex");
        return;
      }
    }
    // Already mid-call / mid-signal — do not reset or re-offer (re-Matched thrash).
    // CRITICAL: ice=checking alone is NOT live — force_relay + broken path sat in
    // checking forever and skipped startCall → hub match with zero offer/answer.
    const iceOk =
      this.pc?.iceConnectionState === "connected" ||
      this.pc?.iceConnectionState === "completed" ||
      this.pc?.connectionState === "connected";
    const alreadyLive =
      !!this.pc &&
      (this.gotRemoteVideo ||
        (this.hasRemoteDescription && iceOk) ||
        (!!this.pc.remoteDescription && iceOk));
    // Mid-offer or already sent SDP this call — never restart startCall
    // (but allow re-entry if we only have a warm PC with no real offer yet)
    const hasRealLocalOffer =
      !!this.pc &&
      (String(this.pc.signalingState || "") === "have-local-offer" ||
        (!!this.pc.localDescription &&
          String((this.pc.localDescription as { type?: string })?.type || "") ===
            "offer"));
    if (
      this.makingOffer ||
      this.offerSentThisCall ||
      this.gotAnswerThisCall ||
      hasRealLocalOffer
    ) {
      this.attachLocalTracksIfNeeded();
      this.handlers.onConnectionState?.(
        `startCall_skip_inflight offerSent=${this.offerSentThisCall ? 1 : 0}`
      );
      this.scheduleConnectingWatch();
      return;
    }
    if (alreadyLive) {
      this.attachLocalTracksIfNeeded();
      this.handlers.onConnectionState?.(
        `startCall_keep_live ice=${this.pc?.iceConnectionState || "?"} cs=${this.pc?.connectionState || "?"}`
      );
      this.scheduleConnectingWatch();
      return;
    }
    this.startCallInFlight = true;
    this.startCallInFlightAt = Date.now();
    try {
      this.isOfferer = !!opts.isOfferer;
      this.gotRemoteVideo = false;
      this.remoteVideoWaves = 0;
      this.callStartAt = Date.now();
      this.iceRestartCount = 0;
      // Do NOT clear offerSent if we somehow already sent (mutex should prevent)
      if (!this.offerSentThisCall) this.gotAnswerThisCall = false;
      // Offerer: retry soon if createOffer stalls.
      // Answerer: wait for browser (web preferred offerer). Promote only if
      // web silent ~2s — 250ms promote caused glare + hub debounce + 18–24s wait.
      this.armOfferWatchdog(this.isOfferer ? 400 : 2000);
      // Only drop warm PC when hub/hide-ip armed force_relay (relay policy change).
      // Do NOT always force_relay — that caused endless reconnect thrash.
      if (this.forceRelayOnce || this.hideIp) {
        if (this.pc && !this.hasRemoteDescription && !this.makingOffer) {
          try {
            this.pc.close();
          } catch {
            /* ignore */
          }
          this.pc = null;
          this.warmed = false;
          this.pendingRemoteIce = [];
          this.makingOffer = false;
          this.handlers.onConnectionState?.("startCall_relay_rebuild");
        }
      }
      this.markConnectStart(opts.isOfferer ? "start_offerer" : "start_answerer");

      // FAST PATH: preview cam already live → do not await GUM / ICE HTTP
      const camReady = !!(this.localStream?.getVideoTracks?.() || []).some(
        (t) => (t as { readyState?: string }).readyState === "live"
      );
      let local = this.localStream;
      if (!camReady) {
        // Cap GUM wait — hung camera was the 25s "matched with no offer" case
        const iceWaitMs = this.hasIceServers() ? 0 : 400;
        const gum = this.ensureLocalStream();
        const [iceOkSettle, gumResult] = await Promise.all([
          iceWaitMs === 0
            ? Promise.resolve(true)
            : this.waitForIceConfig(iceWaitMs),
          Promise.race([
            gum,
            // Offerer: fail-open faster so SDP can leave without full GUM
            new Promise<MediaStreamLike | null>((resolve) =>
              setTimeout(
                () => resolve(this.localStream),
                this.isOfferer ? 700 : 1100
              )
            ),
          ]),
        ]);
        local = gumResult;
        this.markPhase(
          this.hasTurn()
            ? "ice_ready_turn"
            : iceOkSettle
              ? "ice_ready_stun"
              : "ice_timeout"
        );
      } else {
        this.markPhase(
          this.hasTurn() ? "ice_ready_turn_fast" : "ice_ready_fast"
        );
      }
      if (!local && !this.localStream) {
        this.handlers.onConnectionState?.("startCall_no_local_yet");
        // Watchdog will retry offer once cam lands; still open PC for answerer
      } else {
        local = local || this.localStream;
      }

      const pcBusy =
        !!this.pc &&
        (this.hasRemoteDescription ||
          this.makingOffer ||
          !!this.pc.localDescription ||
          !!this.pc.remoteDescription ||
          (!!this.pc.signalingState &&
            this.pc.signalingState !== "stable" &&
            this.pc.signalingState !== "closed"));

      if (pcBusy) {
        this.attachLocalTracksIfNeeded();
        if (
          this.isOfferer &&
          this.pc?.createDataChannel &&
          !this.chatDc &&
          !this.pc.localDescription
        ) {
          try {
            const dc = this.pc.createDataChannel(CHAT_DC_LABEL, {
              ordered: true,
            });
            this.attachChatDc(dc);
          } catch {
            /* ignore */
          }
        }
        if (this.isOfferer && this.pc && !this.pc.localDescription) {
          await this.createAndSendOffer();
        }
        this.scheduleConnectingWatch();
        return;
      }

      // Reuse warm PC (pre-gathered ICE pool) — do not rebuild.
      if (this.pc && this.warmed && !pcBusy) {
        this.attachLocalTracksIfNeeded();
        this.handlers.onConnectionState?.("reuse_warm_pc");
      } else if (this.pc) {
        try {
          this.pc.close();
        } catch {
          /* ignore */
        }
        this.pc = null;
        this.warmed = false;
        this.hasRemoteDescription = false;
        this.pendingRemoteIce = [];
      }

      const pc = this.ensurePc();
      if (!pc) return;
      this.warmed = false;

      if (this.isOfferer && pc.createDataChannel && !this.chatDc) {
        try {
          const dc = pc.createDataChannel(CHAT_DC_LABEL, { ordered: true });
          this.attachChatDc(dc);
        } catch (e) {
          this.handlers.onError?.(
            e instanceof Error ? e : new Error(String(e))
          );
        }
      }

      if (this.isOfferer) {
        const t0 = Date.now();
        await this.createAndSendOffer();
        this.markPhase(`offer_sent_ms=${Date.now() - t0}`);
        this.scheduleConnectingWatch();
      } else {
        this.markPhase("await_offer");
        this.scheduleConnectingWatch();
      }
    } finally {
      this.startCallInFlight = false;
      this.startCallInFlightAt = 0;
    }
  }

  /** Promote answerer → offerer if no remote SDP lands quickly. */
  private armOfferWatchdog(ms = 900): void {
    if (this.offerWatchTimer) {
      clearTimeout(this.offerWatchTimer);
      this.offerWatchTimer = null;
    }
    this.offerWatchTimer = setTimeout(() => {
      this.offerWatchTimer = null;
      void (async () => {
        try {
          if (this.offerSentThisCall || this.hasRemoteDescription) return;
          if (this.gotRemoteVideo) return;
          if (this.pc?.remoteDescription) return;
          // Real offer mid-flight (queued behind ICE/GUM) — do not race promote
          if (
            this.pendingRemoteOfferSince &&
            Date.now() - this.pendingRemoteOfferSince < 4000
          ) {
            this.handlers.onConnectionState?.(
              "offer_watchdog_skip_pending_remote"
            );
            return;
          }
          // Ensure we have a PC + try cam once more before offering
          if (!this.localStream) {
            try {
              await Promise.race([
                this.ensureLocalStream(),
                new Promise((r) => setTimeout(r, 800)),
              ]);
            } catch {
              /* ignore */
            }
          }
          // Re-check — real offer may have landed during GUM race above
          if (this.offerSentThisCall || this.hasRemoteDescription) return;
          if (this.pc?.remoteDescription) return;
          if (
            this.pendingRemoteOfferSince &&
            Date.now() - this.pendingRemoteOfferSince < 4000
          ) {
            this.handlers.onConnectionState?.(
              "offer_watchdog_skip_pending_remote"
            );
            return;
          }
          if (!this.pc) this.ensurePc();
          if (!this.isOfferer) {
            this.handlers.onConnectionState?.("offer_watchdog_promote");
            this.isOfferer = true;
          } else {
            this.handlers.onConnectionState?.("offer_watchdog_retry_offerer");
          }
          await this.createAndSendOffer(false);
          this.markPhase("offer_sent_watchdog");
        } catch (e) {
          this.handlers.onError?.(
            e instanceof Error ? e : new Error(String(e))
          );
        }
      })();
    }, ms);
  }

  private attachLocalTracksIfNeeded() {
    const pc = this.pc;
    const stream = this.localStream;
    if (!pc || !stream) return;
    try {
      for (const track of stream.getTracks()) {
        try {
          pc.addTrack(track, stream);
        } catch {
          /* already added */
        }
      }
    } catch {
      /* ignore */
    }
  }

  /** Hide-ip / hub force_relay / explicit rebuild: only exchange typ relay. */
  private shouldFilterToRelayCandidates(): boolean {
    if (this.hideIp || this.forceRelayOnce) return true;
    return false;
  }

  private async createAndSendOffer(iceRestart = false): Promise<void> {
    const pc = this.ensurePc();
    const rtc = this.rtc;
    if (!pc || !rtc) return;
    if (this.makingOffer) return;
    const now = Date.now();
    const gen = this.callGen;
    // ONE offer per match unless iceRestart AFTER 15s grace (see tryIceRestart).
    // Hub logs: offer→answer→offer in ~0.3s kills media (black cams).
    if (this.offerSentThisCall && !iceRestart) {
      this.handlers.onConnectionState?.("offer_skip_already_sent");
      return;
    }
    if (this.gotAnswerThisCall && !iceRestart) {
      this.handlers.onConnectionState?.("offer_skip_already_answered");
      return;
    }
    // Even iceRestart must not fire early
    if (iceRestart) {
      const age = this.callStartAt ? Date.now() - this.callStartAt : 99999;
      if (age < 15000) {
        this.handlers.onConnectionState?.(`offer_skip_restart_grace age=${age}`);
        return;
      }
    }
    // Hard debounce — duplicate offers within 8s thrash Play↔browser
    if (!iceRestart && this.lastOfferAt && now - this.lastOfferAt < 8000) {
      this.handlers.onConnectionState?.("offer_skip_debounce");
      return;
    }
    // Stable + remote answer already applied → never renego unless iceRestart
    const state = String(pc.signalingState || "");
    if (
      !iceRestart &&
      state === "stable" &&
      this.hasRemoteDescription
    ) {
      this.handlers.onConnectionState?.("offer_skip_stable");
      return;
    }
    // Already have local offer outstanding — do not stack
    if (!iceRestart && state === "have-local-offer" && this.lastOfferAt) {
      this.handlers.onConnectionState?.("offer_skip_have_local");
      return;
    }
    // Latch before any await so a concurrent startCall cannot double-offer
    if (!iceRestart) this.offerSentThisCall = true;
    this.makingOffer = true;
    try {
      this.attachLocalTracksIfNeeded();
      tagLocalTracks(
        this.localStream as Parameters<typeof tagLocalTracks>[0]
      );
      this.applyCodecPrefs(pc);
      // Don't await setParameters before offer — shaves 50–200ms on first SDP.
      // Encoding still applies for subsequent frames via adaptive ladder.
      void this.applyQualityTier(
        this.dataSaver || this.onCellular ? "low" : "mid"
      );
      // Match web: offerToReceive* so browser answerers always get A/V m-lines
      const offer = await pc.createOffer(
        iceRestart
          ? {
              iceRestart: true,
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            }
          : { offerToReceiveAudio: true, offerToReceiveVideo: true }
      );
      // Hangup / rematch while createOffer was in flight — never send late offer
      if (gen !== this.callGen || this.pc !== pc) {
        this.handlers.onConnectionState?.("offer_skip_stale_gen");
        return;
      }
      await pc.setLocalDescription(offer);
      if (gen !== this.callGen || this.pc !== pc) {
        this.handlers.onConnectionState?.("offer_skip_stale_after_local");
        return;
      }
      // Micro-gather only (trickle sends the rest). Long waits delayed first media.
      if (!iceRestart && !this.warmed) {
        await this.waitForInitialIce(pc, 40);
      }
      const desc = pc.localDescription as { type?: string; sdp?: string } | null;
      if (desc && gen === this.callGen && this.pc === pc) {
        this.lastOfferAt = Date.now();
        this.offerSentThisCall = true;
        let sdp = String(desc.sdp || "");
        // NEVER strip candidates unless force_relay is still on — stripping
        // host lines on same-WiFi left both sides black with no path.
        if (this.shouldFilterToRelayCandidates() && sdp) {
          sdp = stripNonRelayCandidatesFromSdp(sdp);
        }
        this.handlers.onSignal?.(
          "offer",
          JSON.stringify({ type: desc.type, sdp })
        );
        this.handlers.onConnectionState?.(
          `offer_sent bytes=${sdp.length} restart=${iceRestart ? 1 : 0}`
        );
      } else if (!iceRestart) {
        // Failed to produce SDP — allow one retry
        this.offerSentThisCall = false;
      }
    } catch (e) {
      if (!iceRestart && gen === this.callGen) this.offerSentThisCall = false;
      this.handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (gen === this.callGen) this.makingOffer = false;
      else this.makingOffer = false;
    }
  }

  /**
   * Multi-wave recovery. First wave must NOT kill healthy TURN setup
   * (900ms restart thrash was a common “takes forever / works 2nd try” cause).
   */
  private scheduleIceRestartProbe() {
    if (this.discIceTimers.length) return;
    // Recover failed/long-disconnect without thrashing healthy checking
    // First wave only after 15s — early force restarts caused double-offer thrash
    const waves: Array<{ delay: number; force: boolean }> = [
      { delay: 16000, force: true },
      { delay: 24000, force: true },
      { delay: 32000, force: true },
    ];
    for (const w of waves) {
      const t = setTimeout(() => {
        const pc = this.pc;
        if (!pc) return;
        const ice = pc.iceConnectionState;
        const cs = pc.connectionState;
        // Only restart on real failure / long stuck — not mid-check
        if (
          ice === "failed" ||
          cs === "failed" ||
          ((ice === "disconnected" || cs === "disconnected") &&
            this.callStartAt &&
            Date.now() - this.callStartAt > 3000)
        ) {
          void this.tryIceRestart({ force: w.force });
        }
      }, w.delay);
      this.discIceTimers.push(t);
    }
  }

  private clearIceRestartProbe() {
    for (const t of this.discIceTimers) clearTimeout(t);
    this.discIceTimers = [];
  }

  /**
   * Multi-wave recovery. Healthy first-try ICE (checking 2–8s with TURN / same
   * Wi‑Fi hairpin) must NOT be restarted; answerer must wait for browser offer
   * before promote (early promote → glare thrash → endless weak-link UI).
   */
  private scheduleConnectingWatch() {
    if (this.connectWatchTimer) return;
    const noRemoteYet =
      !this.isOfferer && !this.hasRemoteDescription && !this.gotRemoteVideo;
    // Answerer: wait for browser offer (Play↔browser TURN often 3–8s).
    // Offerer: wait for answer/ICE before restart. Early promote = glare thrash.
    const delay = noRemoteYet ? 12000 : 6000;
    this.connectWatchTimer = setTimeout(() => {
      this.connectWatchTimer = null;
      const pc = this.pc;
      if (!pc) return;
      const ice = pc.iceConnectionState;
      const cs = pc.connectionState;
      const noRemote =
        !this.hasRemoteDescription && !this.gotRemoteVideo;
      const age = this.callStartAt ? Date.now() - this.callStartAt : 99999;
      if (
        cs === "connected" ||
        ice === "connected" ||
        ice === "completed" ||
        this.gotRemoteVideo
      ) {
        return;
      }
      // Still checking / connecting with SDP applied — give TURN more time
      if (
        age < 12000 &&
        (ice === "new" || ice === "checking" || cs === "connecting") &&
        !noRemote
      ) {
        this.scheduleConnectingWatch();
        return;
      }
      // Recent remote offer — never promote (browser is driving)
      const recentRemoteOffer =
        this.lastRemoteOfferAt > 0 &&
        Date.now() - this.lastRemoteOfferAt < 6000;
      if (
        cs === "failed" ||
        ice === "failed" ||
        (noRemote && age >= 12000 && !recentRemoteOffer) ||
        ((cs === "disconnected" || ice === "disconnected") && age >= 10000)
      ) {
        this.handlers.onConnectionState?.(
          `ice_stuck_retry ice=${ice} cs=${cs} noRemote=${noRemote ? 1 : 0} age=${age}`
        );
        // Promote only after long wait with no offer at all
        const promote =
          !this.isOfferer &&
          noRemote &&
          age >= 12000 &&
          !recentRemoteOffer &&
          !this.makingOffer;
        void this.tryIceRestart({
          force: true,
          promoteOfferer: promote,
        });
        this.scheduleConnectingWatch();
      } else if (
        cs === "connecting" ||
        ice === "checking" ||
        ice === "new"
      ) {
        // Soft re-watch without restart — let path complete
        this.scheduleConnectingWatch();
      }
    }, delay);
  }

  private clearConnectingWatch() {
    if (this.connectWatchTimer) {
      clearTimeout(this.connectWatchTimer);
      this.connectWatchTimer = null;
    }
  }

  private remoteVideoWaves = 0;

  /**
   * ICE can be "connected" while video track never arrives — multi-wave nudge.
   * First restart only after a real wait so good first paths aren't killed.
   */
  /**
   * Pull tracks from pc.getReceivers() into remoteStream when ontrack is late
   * or incomplete (common on RN: audio ontrack first, video never re-notifies UI).
   */
  private harvestRemoteReceivers(why: string): void {
    const pc = this.pc;
    const rtc = this.rtc;
    if (!pc || !rtc) return;
    try {
      const receivers =
        (
          pc as unknown as {
            getReceivers?: () => Array<{ track?: { id?: string; kind?: string; enabled?: boolean } | null }>;
          }
        ).getReceivers?.() || [];
      for (const r of receivers) {
        const track = r?.track;
        if (!track) continue;
        try {
          if (track.enabled === false) track.enabled = true;
        } catch {
          /* ignore */
        }
        if (!this.remoteStream && rtc.MediaStream) {
          this.remoteStream = new rtc.MediaStream([track as never]);
          continue;
        }
        if (!this.remoteStream) continue;
        const existing = this.remoteStream.getTracks?.() || [];
        const has = existing.some(
          (t) =>
            (t as { id?: string }).id &&
            (t as { id?: string }).id === track.id
        );
        if (!has) {
          try {
            (
              this.remoteStream as unknown as {
                addTrack?: (t: unknown) => void;
              }
            ).addTrack?.(track);
          } catch {
            /* ignore */
          }
        }
      }
      if (this.remoteStream) {
        this.pushRemoteStreamToUi(`harvest_${why}`);
      }
    } catch {
      /* ignore */
    }
  }

  /** Notify React / RTCView of remote stream + track counts. */
  private pushRemoteStreamToUi(why: string): void {
    const rs = this.remoteStream;
    if (!rs) return;
    let url = "";
    try {
      url = rs.toURL();
    } catch {
      url = "";
    }
    const trackCount = (rs.getTracks?.() || []).length;
    const videoCount = (rs.getVideoTracks?.() || []).length;
    if (videoCount > 0) {
      if (!this.gotRemoteVideo) {
        this.gotRemoteVideo = true;
        this.markPhase("remote_video");
      }
      this.clearRemoteVideoWatch();
    }
    // Include why + time so React streamEpoch always bumps on video events
    // (same toURL() after audio-then-video used to leave RTCView black).
    const sig = `${url}#t${trackCount}v${videoCount}-${why}-${Date.now()}`;
    // Always notify on video; skip only pure audio spam with same signature
    if (
      sig.split("-")[0] === this.remoteStreamUrl.split("-")[0] &&
      videoCount === 0 &&
      this.remoteStreamUrl.includes("v0")
    ) {
      // still allow periodic audio-only push once
      if (this.remoteStreamUrl.includes(`#t${trackCount}v0`)) return;
    }
    this.remoteStreamUrl = sig;
    this.handlers.onRemoteStream?.(rs);
    this.handlers.onConnectionState?.(
      videoCount > 0
        ? `remote_video_ok a=${trackCount - videoCount} v=${videoCount} t=${this.elapsedMs()}ms why=${why}`
        : `remote_tracks a=${trackCount - videoCount} v=${videoCount} why=${why}`
    );
  }

  /**
   * Re-emit remote stream to React after ICE settles. Android RTCView often
   * stays black if streamURL was set while only audio had arrived, or Surface
   * was covered during connect.
   */
  private repaintRemoteStream(why: string): void {
    // Pull any receiver tracks that never fired ontrack (or fired too early)
    this.harvestRemoteReceivers(why);
    const rs = this.remoteStream;
    if (!rs) return;
    try {
      (rs.getTracks?.() || []).forEach((t) => {
        try {
          if ((t as { enabled?: boolean }).enabled === false) {
            (t as { enabled: boolean }).enabled = true;
          }
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
    this.pushRemoteStreamToUi(`repaint_${why}`);
  }

  private scheduleRemoteVideoWatch() {
    if (!this.pc) return;
    if (this.remoteVideoWatchTimer) return;
    // Faster waves: browser→phone video often lands after audio; RTCView needs rebind
    const delays = [800, 1500, 2500, 4000, 6000];
    const wave = this.remoteVideoWaves;
    if (wave >= delays.length) return;
    this.remoteVideoWatchTimer = setTimeout(() => {
      this.remoteVideoWatchTimer = null;
      if (!this.pc) return;
      // Always harvest + repaint — even if tracks exist (black RTCView case)
      this.harvestRemoteReceivers(`watch_w${wave}`);
      const v = this.remoteStream?.getVideoTracks?.()?.length ?? 0;
      if (v > 0) {
        this.gotRemoteVideo = true;
        this.repaintRemoteStream(`video_watch_w${wave}`);
        // One more repaint after surface settles
        setTimeout(() => this.repaintRemoteStream("video_watch_settle"), 400);
        return;
      }
      // ICE still checking / just connected — wait, don't restart yet
      const ice = this.pc.iceConnectionState;
      const cs = this.pc.connectionState;
      if (
        ice === "checking" ||
        ice === "new" ||
        (ice === "connected" && wave === 0)
      ) {
        // First wave after ICE connected: give frames time before restart
        this.remoteVideoWaves = ice === "connected" ? 1 : this.remoteVideoWaves;
        this.scheduleRemoteVideoWatch();
        return;
      }
      if (cs === "connected" && wave < 1) {
        this.remoteVideoWaves = 1;
        this.scheduleRemoteVideoWatch();
        return;
      }
      this.remoteVideoWaves += 1;
      this.handlers.onConnectionState?.(
        `no_remote_video_retry w=${this.remoteVideoWaves}`
      );
      void this.tryIceRestart({ force: true });
      this.scheduleRemoteVideoWatch();
    }, delays[wave] ?? 6000);
  }

  private clearRemoteVideoWatch() {
    if (this.remoteVideoWatchTimer) {
      clearTimeout(this.remoteVideoWatchTimer);
      this.remoteVideoWatchTimer = null;
    }
    this.remoteVideoWaves = 0;
  }

  /**
   * Soft ICE restart (mirrors web webrtc.js).
   * Offerer: iceRestart offer. Answerer: restartIce() then, if still stuck
   * after prior waves, flip to offerer so phone can drive recovery (browser
   * now supports glare rollback).
   */
  async tryIceRestart(opts?: {
    force?: boolean;
    /** Answerer: become offerer and send iceRestart offer (phone-driven recover). */
    promoteOfferer?: boolean;
  }): Promise<boolean> {
    const force = !!opts?.force;
    const promote = !!opts?.promoteOfferer;
    const now = Date.now();
    // First 12s of force-relay call: let TURN finish. Early restarts = thrash.
    const age = this.callStartAt ? now - this.callStartAt : 99999;
    if (!force && this.shouldFilterToRelayCandidates() && age < 12000) {
      this.handlers.onConnectionState?.(`ice_restart_skip_relay_grace age=${age}`);
      return false;
    }
    // Hard gate: no iceRestart offer for first 15s of any call (force or not).
    // force:true at 3.5s was still able to bypass softer guards.
    if (age < 15000) {
      this.handlers.onConnectionState?.(`ice_restart_skip_call_grace age=${age}`);
      return false;
    }
    // Never iceRestart while first answer is still landing
    if (this.offerSentThisCall && !this.gotAnswerThisCall) {
      this.handlers.onConnectionState?.("ice_restart_skip_await_answer");
      return false;
    }
    // Wider gaps — stacked soft retries were restarting every ~1s
    if (!force && now - this.iceRestartAt < 8000) return false;
    if (force && now - this.iceRestartAt < 5000 && this.iceRestartCount > 0) {
      return true; // coalesce burst
    }
    if (this.iceRestartCount >= (force ? 3 : 2)) return false;
    const pc = this.pc;
    if (!pc) return false;
    this.iceRestartAt = now;
    this.iceRestartCount += 1;
    this.handlers.onConnectionState?.(
      `ice_restart n=${this.iceRestartCount} force=${force} promote=${promote ? 1 : 0}`
    );
    try {
      const recentRemoteOffer =
        this.lastRemoteOfferAt > 0 &&
        Date.now() - this.lastRemoteOfferAt < 6000;
      // Never promote while browser offer just landed (causes double-offer glare)
      const canPromote =
        promote &&
        !this.hasRemoteDescription &&
        !recentRemoteOffer &&
        !this.makingOffer;
      if (this.isOfferer || canPromote) {
        if (canPromote && !this.isOfferer) this.isOfferer = true;
        await this.createAndSendOffer(true);
        return true;
      }
      if (typeof pc.restartIce === "function") {
        pc.restartIce();
        // After several answerer restarts with no SDP at all, phone takes offerer
        if (
          force &&
          this.iceRestartCount >= 3 &&
          !this.hasRemoteDescription &&
          !recentRemoteOffer &&
          !this.makingOffer
        ) {
          this.handlers.onConnectionState?.("ice_restart_promote_offerer");
          this.isOfferer = true;
          await this.createAndSendOffer(true);
        }
        return true;
      }
      // No restartIce: only promote if we still have no remote SDP
      if (!this.hasRemoteDescription && !recentRemoteOffer) {
        this.isOfferer = true;
        await this.createAndSendOffer(true);
      }
      return true;
    } catch (e) {
      this.handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
    return false;
  }

  async handleRemoteSignal(kind: string, payload: string): Promise<void> {
    // Mark offer inbound BEFORE queueing / ICE-config+GUM await so promote
    // watchdog does not race a real offer already in the pipe (003).
    if (kind === "offer") this.pendingRemoteOfferSince = Date.now();
    // Serialize SDP handling; ICE can still queue in parallel via pendingRemoteIce
    this.signalChain = this.signalChain
      .then(() => this.handleRemoteSignalInner(kind, payload))
      .catch((e) => {
        this.handlers.onError?.(
          e instanceof Error ? e : new Error(String(e))
        );
      });
    return this.signalChain;
  }

  private async handleRemoteSignalInner(
    kind: string,
    payload: string
  ): Promise<void> {
    const rtc = this.rtc || loadWebrtc();
    this.rtc = rtc;
    if (!rtc) return;

    if (kind === "bye") {
      this.closeCall({ keepLocal: true, sendBye: false });
      return;
    }

    // Trickle ICE can arrive before offer/answer — queue until remote desc is set
    if (kind === "ice") {
      try {
        const c = JSON.parse(payload) as Record<string, unknown>;
        // Drop host/srflx under relay policy (browser may still send them).
        if (
          this.shouldFilterToRelayCandidates() &&
          c?.candidate &&
          !isRelayIceCandidate(c)
        ) {
          return;
        }
        if (!this.pc || !this.hasRemoteDescription) {
          this.pendingRemoteIce.push(c);
          return;
        }
        await this.pc.addIceCandidate(new rtc.RTCIceCandidate(c));
      } catch (e) {
        console.warn("[media] ice", e);
      }
      return;
    }

    this.markConnectStart(`signal_${kind}`);
    // Parallel prep — browser often sends offer before startCall finishes.
    // Don't stall answer on ICE HTTP if we already have servers.
    // Cap GUM like startCall — uncapped await left answerer silent on cold cam (002).
    await Promise.all([
      this.hasIceServers()
        ? Promise.resolve(true)
        : this.waitForIceConfig(1000),
      Promise.race([
        this.ensureLocalStream(),
        new Promise<MediaStreamLike | null>((resolve) =>
          setTimeout(() => resolve(this.localStream), 1100)
        ),
      ]),
    ]);
    // Mark call started on first signal so timers work.
    if (!this.callStartAt) this.callStartAt = Date.now();
    // Only rebuild warm PC for force_relay/hide-ip (not always).
    if (
      (this.forceRelayOnce || this.hideIp) &&
      this.pc &&
      !this.hasRemoteDescription &&
      !this.makingOffer &&
      kind === "offer"
    ) {
      try {
        this.pc.close();
      } catch {
        /* ignore */
      }
      this.pc = null;
      this.warmed = false;
      this.pendingRemoteIce = [];
      this.handlers.onConnectionState?.("signal_offer_relay_rebuild");
    }
    // Do not replace PC if we already negotiated — attach tracks only
    if (!this.pc) {
      this.ensurePc();
    } else {
      this.attachLocalTracksIfNeeded();
    }
    const pc = this.pc;
    if (!pc) return;

    try {
      if (kind === "offer") {
        const raw = JSON.parse(payload) as { type?: string; sdp?: string };
        const desc =
          this.shouldFilterToRelayCandidates() && raw?.sdp
            ? {
                ...raw,
                sdp: stripNonRelayCandidatesFromSdp(String(raw.sdp)),
              }
            : raw;
        const state = String(pc.signalingState || "");
        // Web always applies remote offers (renego). Only skip exact duplicate
        // while still processing the first offer (have-remote-offer mid-answer).
        if (
          this.hasRemoteDescription &&
          pc.remoteDescription &&
          state === "have-remote-offer"
        ) {
          this.markPhase("offer_skip_inflight");
          return;
        }
        // Glare: we have a local offer — roll back so we can answer theirs
        if (this.makingOffer || state === "have-local-offer") {
          try {
            await pc.setLocalDescription({ type: "rollback" } as object);
            this.markPhase("glare_rollback");
          } catch {
            /* RN may not support rollback — close and recreate as answerer */
            try {
              pc.close();
            } catch {
              /* ignore */
            }
            this.pc = null;
            this.hasRemoteDescription = false;
            this.pendingRemoteIce = [];
            this.ensurePc();
          }
        }
        const pc2 = this.pc;
        if (!pc2) return;
        await pc2.setRemoteDescription(new rtc.RTCSessionDescription(desc));
        this.hasRemoteDescription = true;
        this.pendingRemoteOfferSince = 0;
        this.isOfferer = false;
        this.lastRemoteOfferAt = Date.now();
        this.markPhase("offer_applied");
        // Flush ICE while building answer (don't block answer SDP on mid adds)
        const iceFlush = this.flushPendingIce(pc2, rtc);
        this.attachLocalTracksIfNeeded();
        tagLocalTracks(
          this.localStream as Parameters<typeof tagLocalTracks>[0]
        );
        this.applyCodecPrefs(pc2);
        void this.applyQualityTier(
          this.dataSaver || this.onCellular ? "low" : "mid"
        );
        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        // Send answer ASAP — trickle ICE carries candidates (no 180ms stall)
        const local = pc2.localDescription as {
          type?: string;
          sdp?: string;
        } | null;
        if (local) {
          let sdp = String(local.sdp || "");
          if (this.shouldFilterToRelayCandidates() && sdp) {
            sdp = stripNonRelayCandidatesFromSdp(sdp);
          }
          this.handlers.onSignal?.(
            "answer",
            JSON.stringify({ type: local.type, sdp })
          );
          this.markPhase("answer_sent");
          void iceFlush;
          this.scheduleConnectingWatch();
          this.scheduleRemoteVideoWatch();
          // Browser→phone: harvest receivers + repaint ASAP (audio-first black RTCView)
          setTimeout(() => this.harvestRemoteReceivers("post_answer"), 200);
          setTimeout(() => this.repaintRemoteStream("post_answer_400"), 400);
          setTimeout(() => this.repaintRemoteStream("post_answer_1200"), 1200);
          setTimeout(() => this.repaintRemoteStream("post_answer_3000"), 3000);
        } else {
          await iceFlush;
        }
      } else if (kind === "answer") {
        const parseAns = () => {
          const raw = JSON.parse(payload) as { type?: string; sdp?: string };
          if (this.shouldFilterToRelayCandidates() && raw?.sdp) {
            return {
              ...raw,
              sdp: stripNonRelayCandidatesFromSdp(String(raw.sdp)),
            };
          }
          return raw;
        };
        if (!pc.currentRemoteDescription) {
          const desc = parseAns();
          await pc.setRemoteDescription(new rtc.RTCSessionDescription(desc));
          this.hasRemoteDescription = true;
          this.gotAnswerThisCall = true;
          this.markPhase("answer_applied");
          await this.flushPendingIce(pc, rtc);
        } else {
          // Renego answer when we re-offered (hard retry as offerer)
          try {
            const desc = parseAns();
            await pc.setRemoteDescription(new rtc.RTCSessionDescription(desc));
            this.hasRemoteDescription = true;
            this.gotAnswerThisCall = true;
            this.markPhase("answer_renego");
            await this.flushPendingIce(pc, rtc);
          } catch {
            /* ignore stale answer */
          }
        }
      }
    } catch (e) {
      this.handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (kind === "offer") this.pendingRemoteOfferSince = 0;
    }
  }

  setMicEnabled(on: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }

  setCamEnabled(on: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = on;
    });
  }

  /** Local-only: mute remote audio (partner still sends; you stop hearing). */
  setRemoteAudioEnabled(on: boolean) {
    this.remoteStream?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }

  /**
   * Lightweight link quality for Live pill.
   * RTT from selected candidate-pair; loss from inbound video RTP.
   */
  async getLinkStats(): Promise<{
    rttMs: number;
    loss: number;
    relay: boolean;
    tier: "good" | "ok" | "weak" | "bad" | "unknown";
  }> {
    const pc = this.pc;
    if (!pc || typeof pc.getStats !== "function") {
      return { rttMs: 0, loss: 0, relay: false, tier: "unknown" };
    }
    try {
      const report = await pc.getStats();
      let rtt = 0;
      let rttN = 0;
      let loss = 0;
      let lossN = 0;
      let relay = false;
      const byId = new Map<string, Record<string, unknown>>();
      const each = (r: Record<string, unknown>) => {
        if (r && r.id) byId.set(String(r.id), r);
      };
      if (typeof (report as Map<string, unknown>).forEach === "function") {
        (report as { forEach: (cb: (v: Record<string, unknown>) => void) => void }).forEach(
          each
        );
      }
      byId.forEach((r) => {
        const type = String(r.type || "");
        if (
          type === "candidate-pair" &&
          (r.state === "succeeded" || r.nominated)
        ) {
          if (typeof r.currentRoundTripTime === "number") {
            rtt += (r.currentRoundTripTime as number) * 1000;
            rttN++;
          }
          try {
            const local = byId.get(String(r.localCandidateId || ""));
            const remote = byId.get(String(r.remoteCandidateId || ""));
            const lt = String(
              local?.candidateType || local?.type || ""
            ).toLowerCase();
            const rt = String(
              remote?.candidateType || remote?.type || ""
            ).toLowerCase();
            if (lt === "relay" || rt === "relay") relay = true;
          } catch {
            /* ignore */
          }
        }
        if (
          type === "inbound-rtp" &&
          !r.isRemote &&
          (r.kind === "video" || r.mediaType === "video")
        ) {
          if (
            typeof r.packetsLost === "number" &&
            typeof r.packetsReceived === "number"
          ) {
            const tot =
              (r.packetsLost as number) + (r.packetsReceived as number);
            if (tot > 15) {
              loss += (r.packetsLost as number) / tot;
              lossN++;
            }
          }
        }
      });
      const rttMs = rttN ? rtt / rttN : 0;
      const lossAvg = lossN ? loss / lossN : 0;
      let tier: "good" | "ok" | "weak" | "bad" | "unknown" = "unknown";
      if (rttN || lossN) {
        if (lossAvg > 0.12 || rttMs > 450) tier = "bad";
        else if (lossAvg > 0.06 || rttMs > 280) tier = "weak";
        else if (lossAvg > 0.02 || rttMs > 160) tier = "ok";
        else tier = "good";
      }
      return { rttMs: Math.round(rttMs), loss: lossAvg, relay, tier };
    } catch {
      return { rttMs: 0, loss: 0, relay: false, tier: "unknown" };
    }
  }

  async flipCamera(): Promise<void> {
    // RN WebRTC: replace track via switchCamera if available on track
    const track = this.localStream?.getVideoTracks()?.[0] as
      | { _switchCamera?: () => void }
      | undefined;
    if (track && typeof track._switchCamera === "function") {
      track._switchCamera();
      return;
    }
    this.handlers.onError?.(new Error("Camera flip not supported on this build"));
  }

  closeCall(opts: { keepLocal?: boolean; sendBye?: boolean } = {}) {
    const { keepLocal = false, sendBye = true } = opts;
    this.callGen += 1; // invalidate in-flight createOffer/answer
    this.clearIceRestartProbe();
    this.clearConnectingWatch();
    this.clearRemoteVideoWatch();
    if (this.offerWatchTimer) {
      clearTimeout(this.offerWatchTimer);
      this.offerWatchTimer = null;
    }
    this.stopAdaptiveQuality();
    this.iceRestartCount = 0;
    this.iceRestartAt = 0;
    this.lastOfferAt = 0;
    this.lastRemoteOfferAt = 0;
    this.pendingRemoteOfferSince = 0;
    this.offerSentThisCall = false;
    this.gotAnswerThisCall = false;
    this.startCallInFlight = false;
    this.makingOffer = false;
    this.gotRemoteVideo = false;
    this.remoteVideoWaves = 0;
    this.pendingRemoteIce = [];
    this.hasRemoteDescription = false;
    this.warmed = false;
    this.callStartAt = 0;
    this.connectT0 = 0;
    this.rttEma = 0;
    this.lossEma = 0;
    this.relayPath = false;
    this.qualityTier = this.dataSaver || this.onCellular ? "low" : "mid";
    this.signalChain = Promise.resolve();
    if (sendBye) {
      try {
        this.handlers.onSignal?.("bye", "{}");
      } catch {
        /* ignore */
      }
    }
    try {
      this.chatDc?.close();
    } catch {
      /* ignore */
    }
    this.chatDc = null;
    this.chatDcOpen = false;
    this.handlers.onDataChannel?.(false);
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.remoteStream = null;
    this.remoteStreamUrl = "";
    if (!keepLocal) {
      try {
        this.localStream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      this.localStream = null;
      this.localStreamPromise = null;
    }
  }

  close() {
    this.closeCall({ keepLocal: false, sendBye: true });
  }
}
