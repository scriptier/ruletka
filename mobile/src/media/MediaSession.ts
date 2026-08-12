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
  onSignal?: (
    kind: "offer" | "answer" | "ice" | "bye" | "av_path",
    payload: string
  ) => void;
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

/**
 * Normalize TURN URLs for react-native-webrtc.
 * `?transport=udp` is default for turn: — some RN builds never ALLOCATE with it
 * (hub force_relay + peer_usage=0 black video).
 */
function normalizeIceUrl(u: string): string {
  let s = String(u || "").trim();
  if (!s) return s;
  // Strip explicit UDP transport query (keep transport=tcp)
  s = s.replace(/\?transport=udp$/i, "");
  s = s.replace(/([?&])transport=udp(&)?/gi, (_m, p1, p2) =>
    p2 ? p1 : ""
  );
  s = s.replace(/[?&]$/, "");
  return s;
}

/**
 * RN WebRTC is flaky with multi-url iceServer entries — expand to one URL
 * string per object (with username/credential copied). Also why coturn only
 * saw `:web` ALLOCATEs and zero phone peer traffic.
 */
function expandIceServers(servers: RTCIceServer[] | undefined): RTCIceServer[] {
  if (!servers?.length) {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
  const out: RTCIceServer[] = [];
  for (const s of servers) {
    const urls = Array.isArray(s.urls) ? s.urls : s.urls ? [s.urls] : [];
    for (const u of urls) {
      if (!u) continue;
      const nu = normalizeIceUrl(String(u));
      if (!nu) continue;
      const entry: RTCIceServer = { urls: nu };
      if (s.username) entry.username = s.username;
      if (s.credential) entry.credential = s.credential;
      out.push(entry);
    }
  }
  return out.length ? out : [{ urls: "stun:stun.l.google.com:19302" }];
}

function filterIce(
  servers: RTCIceServer[] | undefined,
  mode: "all" | "turn" | "stun"
): RTCIceServer[] {
  const expanded = expandIceServers(servers);
  if (mode === "all") return expanded;
  return expanded.filter((s) => {
    const x = String(
      Array.isArray(s.urls) ? s.urls[0] : s.urls || ""
    ).toLowerCase();
    if (mode === "turn") return x.startsWith("turn:") || x.startsWith("turns:");
    return x.startsWith("stun:") || (!x.startsWith("turn:") && !x.startsWith("turns:"));
  });
}

/**
 * Prefer UDP TURN first for fast first media; TCP/TURNS as fallback.
 * (TCP-first delayed Play↔browser linking by 0.5–2s on normal Wi‑Fi.)
 */
function preferTcpTurnFirst(servers: RTCIceServer[]): RTCIceServer[] {
  const score = (u: string) => {
    const x = String(u).toLowerCase();
    if (x.startsWith("turn:") && !x.includes("transport=tcp")) return 0; // UDP
    if (x.startsWith("turn:") && x.includes("transport=tcp")) return 1;
    if (x.startsWith("turns:")) return 2;
    return 3;
  };
  return (servers || [])
    .slice()
    .sort((a, b) => {
      const ua = String(Array.isArray(a.urls) ? a.urls[0] : a.urls || "");
      const ub = String(Array.isArray(b.urls) ? b.urls[0] : b.urls || "");
      return score(ua) - score(ub);
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

/** Chrome mDNS host (*.local) — RN rarely completes checks; strip always. */
function isMdnsHostIceCandidate(
  c: Record<string, unknown> | string | null | undefined
): boolean {
  if (c == null) return false;
  const s =
    typeof c === "string"
      ? c
      : String((c as { candidate?: string }).candidate || "");
  if (!s) return false;
  return /\.local\b/i.test(s) && /\btyp\s+host\b/i.test(s);
}

/** Drop mDNS host lines from SDP; keep real private host (LAN). */
function stripMdnsHostCandidatesFromSdp(sdp: string): string {
  if (!sdp) return sdp;
  const out: string[] = [];
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
    try {
      console.info(`[media] stripped ${dropped} mDNS host candidates`);
    } catch {
      /* ignore */
    }
  }
  return out.join("\r\n");
}

/** True when SDP candidate is typ relay (TURN). */
function isRelayIceCandidate(
  c: Record<string, unknown> | string | null | undefined
): boolean {
  if (c == null) return false;
  if (typeof c === "string") {
    return /\btyp\s+relay\b/i.test(c);
  }
  // RN sometimes exposes type separately and leaves candidate sparse
  const typ = String(
    (c as { type?: string; candidateType?: string }).type ||
      (c as { candidateType?: string }).candidateType ||
      ""
  ).toLowerCase();
  if (typ === "relay") return true;
  const s = String((c as { candidate?: string }).candidate || "");
  if (!s) return false;
  return /\btyp\s+relay\b/i.test(s);
}

/**
 * Under force_relay: UDP TURN only (TCP dual-path caused ALLOCATE storms and
 * never completed peer_usage for Play↔browser on same public IP).
 */
function udpTurnOnly(servers: RTCIceServer[]): RTCIceServer[] {
  const udp = servers.filter((s) => {
    const u = String(
      Array.isArray(s.urls) ? s.urls[0] : s.urls || ""
    ).toLowerCase();
    if (!(u.startsWith("turn:") || u.startsWith("turns:"))) return false;
    if (u.includes("transport=tcp")) return false;
    if (u.startsWith("turns:")) return false; // keep plain turn: UDP first path
    return true;
  });
  return udp.length ? udp : servers;
}

/**
 * Force video m-line to a=sendrecv (phone answer was often a=recvonly when
 * tracks attached too late → PC black partner, Android saw web cam fine).
 */
function forceVideoSendrecvSdp(sdp: string): string {
  if (!sdp) return sdp;
  const lines = sdp.split(/\r?\n/);
  let inVideo = false;
  let sawDir = false;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^m=video\b/i.test(line)) {
      inVideo = true;
      sawDir = false;
      out.push(line);
      continue;
    }
    if (/^m=/i.test(line)) {
      // Leaving video without a direction line — inject sendrecv
      if (inVideo && !sawDir) {
        out.push("a=sendrecv");
      }
      inVideo = false;
      out.push(line);
      continue;
    }
    if (inVideo && /^a=(sendrecv|recvonly|sendonly|inactive)\b/i.test(line)) {
      if (!sawDir) {
        out.push("a=sendrecv");
        sawDir = true;
      }
      // drop original direction line (already replaced)
      continue;
    }
    out.push(line);
  }
  if (inVideo && !sawDir) {
    out.push("a=sendrecv");
  }
  return out.join("\r\n");
}

/**
 * Web pure-relay offer: has typ relay and no typ host/srflx in SDP.
 * Used to re-arm phone force_relay when sticky was wiped mid-match.
 */
function offerSdpLooksPureRelay(sdp: string): boolean {
  if (!sdp) return false;
  let relay = 0;
  let hostOrSrflx = 0;
  for (const line of sdp.split(/\r?\n/)) {
    if (!/^a=candidate:/i.test(line)) continue;
    if (/\btyp\s+relay\b/i.test(line)) relay += 1;
    else if (/\btyp\s+(host|srflx)\b/i.test(line)) hostOrSrflx += 1;
  }
  return relay > 0 && hostOrSrflx === 0;
}

/**
 * Drop host/srflx ONLY when ≥1 typ relay remains. Never empty the SDP.
 */
function stripNonRelayCandidatesFromSdp(sdp: string): string {
  if (!sdp) return sdp;
  const lines = sdp.split(/\r?\n/);
  let relayN = 0;
  let candN = 0;
  for (const line of lines) {
    if (!/^a=candidate:/i.test(line)) continue;
    candN += 1;
    if (/\btyp\s+relay\b/i.test(line)) relayN += 1;
  }
  if (relayN === 0 || relayN === candN) return sdp;
  const out: string[] = [];
  for (const line of lines) {
    if (/^a=candidate:/i.test(line) && !/\btyp\s+relay\b/i.test(line)) {
      continue;
    }
    out.push(line);
  }
  return out.join("\r\n");
}

/** Wait for TURN relay in local SDP (or gather complete / timeout). */
function waitForIceGatherRelayOrDone(
  pc: RTCPeerConnectionLike | null,
  maxMs = 150
): Promise<number> {
  return new Promise((resolve) => {
    if (!pc) {
      resolve(0);
      return;
    }
    let settled = false;
    const countRelay = () => {
      try {
        const s = String(
          (pc.localDescription as { sdp?: string } | null)?.sdp || ""
        );
        return (s.match(/\btyp\s+relay\b/gi) || []).length;
      } catch {
        return 0;
      }
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(countRelay());
    };
    if (countRelay() > 0 || String(pc.iceGatheringState || "") === "complete") {
      finish();
      return;
    }
    const prev = pc.onicecandidate;
    const prevG = (
      pc as unknown as { onicegatheringstatechange?: (() => void) | null }
    ).onicegatheringstatechange;
    pc.onicecandidate = (ev: { candidate?: unknown }) => {
      try {
        prev?.(ev as never);
      } catch {
        /* ignore */
      }
      if (
        isRelayIceCandidate(
          (ev?.candidate as Record<string, unknown>) || null
        ) ||
        countRelay() > 0
      ) {
        finish();
      }
    };
    (
      pc as unknown as { onicegatheringstatechange?: (() => void) | null }
    ).onicegatheringstatechange = () => {
      try {
        prevG?.();
      } catch {
        /* ignore */
      }
      if (String(pc.iceGatheringState || "") === "complete") finish();
    };
    // Respect caller budget (answer path caps ≤200ms). Old Math.max(250, maxMs)
    // forced a 250ms floor even when hop budgets were tighter — blocked mta.
    setTimeout(finish, Math.max(0, maxMs));
  });
}

export class MediaSession {
  private handlers: MediaHandlers = {};
  private ice: IceConfig | null = null;
  private hideIp = false;
  /** One-shot: force iceTransportPolicy=relay when first path stalls (CGNAT / hairpin). */
  private forceRelayOnce = false;
  /**
   * Hub matched.force_relay latched for this call. Only cleared in closeCall.
   * Prevents startCall(forceRelay:false) / early offer races from wiping pure
   * after matched already armed (av_path force_relay=0 while hub=true).
   */
  private hubForceRelaySticky = false;
  /** Last bindAnswerOutbound live video sender count (av_path bind_v). */
  private lastBindVideoSenders = 0;
  private pc: RTCPeerConnectionLike | null = null;
  private localStream: MediaStreamLike | null = null;
  private remoteStream: MediaStreamLike | null = null;
  private remoteStreamUrl = "";
  private isOfferer = false;
  /** Hub matched role — answerer never promotes even if web offer is late. */
  private hubWantsOfferer = false;
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
  /** We sent an answer this call (answerer path) — never promote/re-startCall. */
  private answeredAsAnswerer = false;
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
  /** True after search warm completed at least one TURN relay candidate. */
  private warmTurnPrimed = false;
  /** iceTransportPolicy used for current pc (reuse warm only if matches). */
  private pcUsesRelayPolicy = false;
  /** Wall time when startCall began (guards early ICE restarts). */
  private callStartAt = 0;
  /** Match timing: first markPhase after match for connect speed logs. */
  private matchMarkT0 = 0;

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

  /** ms since match/startCall (or -1 if not started). */
  private elapsedMs(): number {
    const t0 = this.matchMarkT0 || this.callStartAt || this.connectT0;
    if (!t0) return -1;
    return Math.max(0, Date.now() - t0);
  }

  private markConnectStart(why: string) {
    if (!this.connectT0) {
      this.connectT0 = Date.now();
      this.handlers.onConnectionState?.(`connect_t0 why=${why}`);
    }
    if (!this.matchMarkT0) this.matchMarkT0 = Date.now();
  }

  /** Last match connect stopwatch (for Settings / smoke). */
  private lastTiming: {
    matchAt: number;
    offerMs: number | null;
    answerMs: number | null;
    iceMs: number | null;
    firstFrameMs: number | null;
  } = {
    matchAt: 0,
    offerMs: null,
    answerMs: null,
    iceMs: null,
    firstFrameMs: null,
  };

  private markPhase(phase: string) {
    const ms = this.elapsedMs();
    this.handlers.onConnectionState?.(
      ms >= 0 ? `timing ${phase} +${ms}ms` : `timing ${phase}`
    );
    // Capture key milestones for getLastConnectTiming()
    if (ms >= 0) {
      if (phase.startsWith("offer_sent") || phase === "offer_sent_watchdog") {
        if (this.lastTiming.offerMs == null) this.lastTiming.offerMs = ms;
      } else if (
        phase === "answer_sent" ||
        phase === "answer_applied" ||
        phase === "offer_applied"
      ) {
        // answerer: answer_sent; offerer: answer_applied; answerer also offer_applied
        if (phase === "answer_sent" || phase === "answer_applied") {
          if (this.lastTiming.answerMs == null) this.lastTiming.answerMs = ms;
        }
      } else if (phase === "first_frame") {
        if (this.lastTiming.firstFrameMs == null) {
          this.lastTiming.firstFrameMs = ms;
          this.handlers.onConnectionState?.(
            `CONNECT offer=${this.lastTiming.offerMs ?? "?"} answer=${this.lastTiming.answerMs ?? "?"} frame=${ms}ms`
          );
        }
      }
    }
  }

  /** Snapshot for smoke UI / Settings. */
  getLastConnectTiming(): {
    offerMs: number | null;
    answerMs: number | null;
    iceMs: number | null;
    firstFrameMs: number | null;
    summary: string;
  } {
    const t = this.lastTiming;
    const parts: string[] = [];
    if (t.offerMs != null) parts.push(`offer ${t.offerMs}ms`);
    if (t.answerMs != null) parts.push(`answer ${t.answerMs}ms`);
    if (t.iceMs != null) parts.push(`ice ${t.iceMs}ms`);
    if (t.firstFrameMs != null) parts.push(`frame ${t.firstFrameMs}ms`);
    return {
      offerMs: t.offerMs,
      answerMs: t.answerMs,
      iceMs: t.iceMs,
      firstFrameMs: t.firstFrameMs,
      summary: parts.length ? parts.join(" · ") : "no connect yet",
    };
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
    } else {
      // Normal / same-LAN: drop mDNS only — keep private host for prflx
      batch = batch.filter(
        (c) =>
          !c ||
          !(c as { candidate?: string }).candidate ||
          !isMdnsHostIceCandidate(c as Record<string, unknown>)
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

  /** Public: re-push outbound cam + keyframes (phone→web black recovery). */
  kickMediaAfterIce(why = "ui"): void {
    try {
      if (this.answeredAsAnswerer) {
        void this.bindAnswerOutbound();
      } else {
        void this.attachLocalTracksIfNeeded();
      }
      this.kickMediaAfterIcePrivate(why);
    } catch {
      /* ignore */
    }
  }

  /** True only after inbound-rtp shows frames (not just a video track). */
  hasInboundVideoFrames(): boolean {
    return this._remoteFramesSeen === true;
  }

  /** ICE + PC state for UI recovery decisions (avoid hard rebuild when connected). */
  getIceSnapshot(): { ice: string; cs: string } {
    return {
      ice: String(this.pc?.iceConnectionState || ""),
      cs: String(this.pc?.connectionState || ""),
    };
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
    // Don't re-encode upward until partner first frame (TURN keyframe race)
    if (!this._remoteFramesSeen) return;
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

  /**
   * Force a FRESH live camera track (stale GUM can stay readyState=live /
   * enabled while the encoder emits 0 framesEncoded — 2026-08-10 one-way).
   * Keeps existing audio tracks when possible; notifies UI via onLocalStream.
   */
  private async refreshLocalVideoTrack(why = "refresh"): Promise<unknown | null> {
    const rtc = this.rtc || loadWebrtc();
    this.rtc = rtc;
    if (!rtc?.mediaDevices?.getUserMedia) return null;
    try {
      const oldStream = this.localStream;
      const oldAudio = (oldStream?.getAudioTracks?.() || []).filter(
        (t) => (t as { readyState?: string }).readyState !== "ended"
      );
      // Video-only GUM first (faster); fall back to full A/V
      let fresh: MediaStreamLike | null = null;
      try {
        fresh = await rtc.mediaDevices.getUserMedia({
          audio: false,
          video: this.videoConstraints(this.dataSaver ? "saver" : "soft"),
        });
      } catch {
        try {
          fresh = await rtc.mediaDevices.getUserMedia({
            audio: this.audioConstraints(),
            video: this.videoConstraints(this.dataSaver ? "saver" : "minimal"),
          });
        } catch {
          fresh = null;
        }
      }
      if (!fresh) return null;
      const newV =
        (fresh.getVideoTracks?.() || []).find((t) =>
          this.trackUsable(t as never)
        ) || (fresh.getVideoTracks?.() || [])[0];
      if (!newV) {
        try {
          fresh.getTracks?.().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
        return null;
      }
      try {
        (newV as { enabled: boolean }).enabled = true;
      } catch {
        /* ignore */
      }
      // Stop old video tracks (leave audio alive if we reuse them)
      try {
        for (const t of oldStream?.getVideoTracks?.() || []) {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
      // Compose stream: new video + kept audio (or new audio if full GUM)
      const newAudio =
        (fresh.getAudioTracks?.() || []).length > 0
          ? fresh.getAudioTracks?.() || []
          : oldAudio;
      let composed: MediaStreamLike | null = null;
      try {
        if (rtc.MediaStream) {
          composed = new rtc.MediaStream([
            newV as never,
            ...(newAudio as never[]),
          ]);
        }
      } catch {
        composed = null;
      }
      if (!composed) {
        // Fall back to fresh stream as-is
        composed = fresh;
      } else {
        // Stop unused tracks from fresh if we only took video
        try {
          for (const t of fresh.getTracks?.() || []) {
            if (t === (newV as never)) continue;
            if ((newAudio as unknown[]).includes(t)) continue;
            try {
              t.stop();
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      }
      this.localStream = composed;
      tagLocalTracks(composed as Parameters<typeof tagLocalTracks>[0]);
      this.handlers.onLocalStream?.(composed);
      this.handlers.onConnectionState?.(
        `refresh_local_video why=${why} v=1 a=${newAudio.length}`
      );
      return newV;
    } catch (e) {
      this.handlers.onConnectionState?.(
        `refresh_local_video_fail ${e instanceof Error ? e.message : String(e)}`
      );
      return null;
    }
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
    // hide_ip OR hub force_relay (hide/untrusted only) → pure relay + pool=0.
    // Same-LAN: hub force_relay=false → policy=all, KEEP private host candidates.
    // Pool≥2 caused 437 ALLOCATE storms + peer_usage≈0 (2026-08-10).
    const hasTurn = this.hasTurn() || this.ice?.has_turn === true;
    const pureRelay = !!(
      hasTurn &&
      (this.hideIp || this.forceRelayOnce || this.hubForceRelaySticky)
    );
    let servers = preferTcpTurnFirst(
      filterIce(raw, pureRelay ? "turn" : "all")
    );
    let iceTransportPolicy: "all" | "relay" = pureRelay ? "relay" : "all";
    const iceCandidatePoolSize = 0;
    if (pureRelay) {
      servers = udpTurnOnly(servers);
      if (!servers.length) {
        // Fail-open: no TURN → all (keep host path)
        servers = preferTcpTurnFirst(filterIce(raw, "all"));
        iceTransportPolicy = "all";
      } else {
        if (servers.length > 1) servers = servers.slice(0, 1);
        iceTransportPolicy = "relay";
      }
    }
    try {
      const nTurn = servers.filter((s) =>
        String(Array.isArray(s.urls) ? s.urls[0] : s.urls || "")
          .toLowerCase()
          .startsWith("turn")
      ).length;
      this.handlers.onConnectionState?.(
        `pc_cfg policy=${iceTransportPolicy} servers=${servers.length} turn=${nTurn} pool=${iceCandidatePoolSize} fr=${this.forceRelayOnce ? 1 : 0} hide=${this.hideIp ? 1 : 0} warm=${this.warmed ? 1 : 0}`
      );
    } catch {
      /* ignore */
    }
    return {
      iceServers: servers,
      iceCandidatePoolSize,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceTransportPolicy,
    };
  }

  /**
   * Clean pure-relay PC before SDP (wrong policy or dirty warm have-local-offer).
   */
  private ensureRelayPolicyPc(why: string): void {
    const wantPure = this.desiredRelayPolicy();
    // Never rebuild a PC that already has (or is building) a remote offer/answer —
    // a racing caller (kick()'s delayed startCall vs. the offer handler) could
    // otherwise close the PC an in-flight answer just bound tracks to, orphaning
    // bindAnswerOutbound's work (video sender lost, PC silently swapped under it).
    const offerPending =
      !!this.pendingRemoteOfferSince &&
      Date.now() - this.pendingRemoteOfferSince < 8000;
    const negotiating =
      this.hasRemoteDescription ||
      this.answeredAsAnswerer ||
      this.makingOffer ||
      offerPending;
    const dirty =
      !!this.pc &&
      !negotiating &&
      (!!this.pc.localDescription ||
        String(this.pc.signalingState || "") === "have-local-offer");
    const wrongPolicy =
      !!this.pc && !negotiating && wantPure && !this.pcUsesRelayPolicy;
    if (!this.pc) {
      this.ensurePc();
      this.handlers.onConnectionState?.(`relay_pc_create ${why}`);
      return;
    }
    if (!wrongPolicy && !dirty) return;
    try {
      this.pc.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.warmed = false;
    this.warmTurnPrimed = false;
    this.pendingRemoteIce = [];
    this.makingOffer = false;
    this.ensurePc();
    this.handlers.onConnectionState?.(
      `relay_pc_rebuild ${why} wrong=${wrongPolicy ? 1 : 0} dirty=${dirty ? 1 : 0}`
    );
  }

  /**
   * Pure iceTransportPolicy=relay for Hide IP and hub force_relay
   * (hide_ip / untrusted only). Same-LAN force_relay=false → false.
   */
  private desiredRelayPolicy(): boolean {
    const hasTurn = this.hasTurn() || this.ice?.has_turn === true;
    return !!(
      hasTurn &&
      (this.hideIp || this.forceRelayOnce || this.hubForceRelaySticky)
    );
  }

  /**
   * Drop typ host under pure modes only. Normal same-LAN keeps private
   * 192.168.x host so Chrome can complete checks (prflx OK).
   */
  private shouldStripHostCandidates(): boolean {
    return !!(this.hideIp || this.forceRelayOnce || this.hubForceRelaySticky);
  }

  /**
   * Hub force_relay / hide_ip → pure iceTransportPolicy=relay.
   * Clearing must drop pure-relay PC so next call can use host (same LAN).
   */
  /** Hub force_relay latched (for match logs / offer re-arm). */
  isForceRelay(): boolean {
    return !!(this.forceRelayOnce || this.hubForceRelaySticky);
  }

  setForceRelay(on: boolean): void {
    const next = !!on;
    const was = this.forceRelayOnce || this.hubForceRelaySticky;
    // Always latch flag first so reportAvPath / desiredRelayPolicy see hub truth
    // even if PC rebuild must wait (mid-offer / startCall).
    this.forceRelayOnce = next;
    if (next) {
      // Sticky survives late startCall(forceRelay:false) races until closeCall
      this.hubForceRelaySticky = true;
    } else {
      // Explicit clear (hangup / Next / partner-left) — drop sticky too
      this.hubForceRelaySticky = false;
    }
    if (next === was && !!this.pc) {
      // Still ensure PC policy matches (sticky pure PC after clear race)
      const wantPure = this.desiredRelayPolicy();
      if (this.pcUsesRelayPolicy === wantPure) return;
    } else if (next === was && !this.pc) {
      // Flag already correct and no PC — ensurePc will pick up on startCall
      return;
    }
    if (next) {
      this.handlers.onConnectionState?.("force_relay_armed_pure");
    } else if (was) {
      this.handlers.onConnectionState?.("force_relay_cleared");
    }
    const wantPure = this.desiredRelayPolicy();
    // Never tear PC while an offer is in-flight or startCall is running —
    // that raced web offer@~600ms and left zero answer (linking forever).
    // Mid-negotiation: latch only; signal_offer / startCall ensureRelayPolicyPc.
    const offerPending =
      !!this.pendingRemoteOfferSince &&
      Date.now() - this.pendingRemoteOfferSince < 8000;
    const midNegotiate =
      this.hasRemoteDescription ||
      this.answeredAsAnswerer ||
      this.makingOffer ||
      this.offerSentThisCall ||
      this.startCallInFlight ||
      offerPending ||
      this.gotRemoteVideo;
    if (midNegotiate) {
      this.handlers.onConnectionState?.(
        `force_relay_defer_rebuild fr=${next ? 1 : 0} pendingOffer=${offerPending ? 1 : 0}`
      );
      return;
    }
    if (this.pcUsesRelayPolicy === wantPure && !!this.pc) {
      this.handlers.onConnectionState?.(
        `force_relay_keep_warm policy=${wantPure ? "relay" : "all"}`
      );
      return;
    }
    // Rebuild on pure↔all flip (critical: hangup used to leave pure PC forever)
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.warmed = false;
    this.pcUsesRelayPolicy = false;
    this.pendingRemoteIce = [];
    this.makingOffer = false;
    try {
      if (this.hasIceServers()) {
        this.ensurePc();
        this.warmed = true;
        this.handlers.onConnectionState?.(
          `force_relay_rewarm policy=${wantPure ? "relay" : "all"} pure=${wantPure ? 1 : 0}`
        );
      }
    } catch {
      /* match path will create PC */
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
    this.hubForceRelaySticky = true;
    this.handlers.onConnectionState?.("force_relay_rebuild");
    // Keep answeredAsAnswerer / offerSent — clearing them mid-match made the
    // phone re-offer@9s (hub drops answerer offers → thrash + crash risk).
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.warmed = false;
    this.pcUsesRelayPolicy = false;
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
    const cfg = this.pcConfig() as {
      iceTransportPolicy?: string;
      iceServers?: unknown;
    };
    // Actual policy from config — force_relay + hide_ip use pure "relay"
    this.pcUsesRelayPolicy = cfg.iceTransportPolicy === "relay";
    const pc = new rtc.RTCPeerConnection(cfg);
    this.pc = pc;
    this.hasRemoteDescription = false;
    this.pendingRemoteIce = [];

    const hasTurn = !!(this.ice?.has_turn && this.ice?.ice_servers?.length);
    this.handlers.onConnectionState?.(
      hasTurn
        ? `pc_ready_turn relay=${this.pcUsesRelayPolicy ? 1 : 0}`
        : "pc_ready_stun_only"
    );

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        try {
          const raw = ev.candidate as unknown as Record<string, unknown>;
          // Pure hide/force: only typ relay.
          if (this.shouldFilterToRelayCandidates() && !isRelayIceCandidate(raw)) {
            return;
          }
          const candStr = String(
            (raw as { candidate?: string }).candidate || ""
          );
          // Pure modes: drop all typ host. Normal same-LAN: KEEP private host.
          if (
            this.shouldStripHostCandidates() &&
            /\btyp\s+host\b/i.test(candStr)
          ) {
            return;
          }
          // Always drop mDNS host (*.local) — keep 192.168.x private host.
          if (isMdnsHostIceCandidate(raw) || isMdnsHostIceCandidate(candStr)) {
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
      // Prefer the browser-provided stream when present. When video arrives after
      // audio on a separate ontrack without streams[], rebuild MediaStream so
      // Android RTCView rebinds (addTrack alone often leaves black SurfaceView).
      try {
        const track = ev.track as
          | {
              id?: string;
              kind?: string;
              enabled?: boolean;
              muted?: boolean;
              readyState?: string;
              addEventListener?: (type: string, fn: () => void) => void;
            }
          | undefined;
        const fromPeer = ev.streams?.[0];

        if (fromPeer) {
          this.remoteStream = fromPeer;
        } else if (!this.remoteStream && track && rtc.MediaStream) {
          this.remoteStream = new rtc.MediaStream([track as never]);
        } else if (this.remoteStream && track) {
          const existing = this.remoteStream.getTracks?.() || [];
          const has = existing.some(
            (t) =>
              (t as { id?: string }).id &&
              (t as { id?: string }).id === track.id
          );
          if (!has) {
            // Video after audio: new MediaStream so RTCView key/url changes
            if (track.kind === "video" && rtc.MediaStream) {
              try {
                this.remoteStream = new rtc.MediaStream([
                  ...(existing as never[]),
                  track as never,
                ]);
              } catch {
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
            } else {
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
        }
        if (!this.remoteStream) return;

        // Ensure track is enabled + live (some peers start muted)
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

        // Force enable inbound (browser may mark muted until first keyframe)
        try {
          if (track && track.enabled === false) {
            (track as { enabled: boolean }).enabled = true;
          }
        } catch {
          /* ignore */
        }
        this.pushRemoteStreamToUi(track?.kind || "track");
        // Paint once (+ one late nudge if still no frames). Dense remounts = flicker.
        if (track?.kind === "video") {
          this.repaintRemoteStream("ontrack_v");
          setTimeout(() => {
            if (!this._remoteFramesSeen) {
              this.repaintRemoteStream("ontrack_v_nudge");
            }
          }, 300);
        }
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
        // Keyframe while path is still forming (don't wait for connected)
        this.kickMediaAfterIce("pc_connecting");
      }
      if (pc.connectionState === "connected") {
        this.clearIceRestartProbe();
        this.clearConnectingWatch();
        this.iceRestartCount = 0;
        if (this.lastTiming.iceMs == null) {
          this.lastTiming.iceMs = this.elapsedMs();
        }
        this.scheduleRemoteVideoWatch();
        void this.reportAvPath("connected");
        this.armAvPathBeacons();
        // Hold low until first frame paints (mid re-encode delays TURN keyframe)
        if (!this._remoteFramesSeen) {
          void this.applyQualityTier("low");
        } else {
          void this.applyQualityTier(
            this.dataSaver || this.onCellular ? "low" : this.qualityTier || "mid"
          );
        }
        this.startAdaptiveQuality();
        // Connected: one media kick + harvest. No multi-remount spam (crashes /
        // black thrash). Black watch handles delayed paint if needed.
        this.attachLocalTracksIfNeeded();
        this.kickMediaAfterIce("pc_connected");
        this.harvestRemoteReceivers("pc_connected");
        this.repaintRemoteStream("pc_connected");
        setTimeout(() => {
          if (!this._remoteFramesSeen) {
            this.attachLocalTracksIfNeeded();
            this.kickMediaAfterIce("pc_connected_nudge");
            this.harvestRemoteReceivers("pc_connected_nudge");
            this.repaintRemoteStream("pc_connected_nudge");
          }
        }, 500);
      }
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        this.stopAdaptiveQuality();
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log(
        `[client-ice] iceConnectionState=${pc.iceConnectionState} has_local_desc=${!!pc.localDescription} has_remote_desc=${this.hasRemoteDescription}`
      );
      this.handlers.onIceConnectionState?.(pc.iceConnectionState);
      if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed"
      ) {
        this.scheduleIceRestartProbe();
      }
      if (pc.iceConnectionState === "checking") {
        this.scheduleConnectingWatch();
        // Keyframe while TURN path is still negotiating (don't wait connected)
        this.kickMediaAfterIce("ice_checking");
      }
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        this.clearIceRestartProbe();
        this.clearConnectingWatch();
        this.iceRestartCount = 0;
        if (this.lastTiming.iceMs == null) {
          this.lastTiming.iceMs = this.elapsedMs();
        }
        this.scheduleRemoteVideoWatch();
        void this.reportAvPath("ice_" + pc.iceConnectionState);
        this.armAvPathBeacons();
        // Stay on low until first_frame — mid re-encode on ICE up delayed TURN keyframe
        if (!this._remoteFramesSeen) {
          void this.applyQualityTier("low");
        } else {
          void this.applyQualityTier(
            this.dataSaver || this.onCellular ? "low" : "mid"
          );
        }
        this.startAdaptiveQuality();
        // ICE up: one harvest + keyframe + one paint (no multi-wave flicker)
        this.kickMediaAfterIce("ice_connected");
        this.harvestRemoteReceivers("ice_connected");
        this.repaintRemoteStream("ice_connected");
        setTimeout(() => {
          if (!this._remoteFramesSeen) {
            this.repaintRemoteStream("ice_connected_nudge");
          }
        }, 300);
      }
    };

    // NEVER addTrack here. Hub prefers web as offerer — phone is usually
    // answerer. addTrack before setRemote(offer) creates orphan m-lines so
    // audio may bind while video sender stays empty (PC black partner).
    // Offerer: createAndSendOffer → attachLocalTracksIfNeeded.
    // Answerer: setRemote → bindAnswerOutbound (replaceTrack only).

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
  /**
   * Search-time pre-warm. preferRelay only for hide_ip / hub force_relay pure.
   * Do NOT latch forceRelayOnce from mere "has TURN" (sticky pure → black).
   */
  async warmConnection(opts?: { preferRelay?: boolean }): Promise<void> {
    // NEVER touch PC while answer/offer is in flight. matched kick used to call
    // warmConnection(preferRelay) during await setRemote — hasRemoteDescription
    // still false, hybrid→pure rebuild closed the live PC → answer_sent ice=checking
    // then zero_f ice=new bind_v=0 (app_vc=346 product no-media, linking forever).
    if (
      this.hasRemoteDescription ||
      this.answeredAsAnswerer ||
      this.makingOffer ||
      this.offerSentThisCall ||
      this.startCallInFlight ||
      (!!this.pendingRemoteOfferSince &&
        Date.now() - this.pendingRemoteOfferSince < 8000)
    ) {
      this.handlers.onConnectionState?.("warm_skip_mid_negotiate");
      return;
    }
    if (this.pc?.localDescription || this.pc?.remoteDescription) return;
    // ICE already moving — leave the PC alone (search rewarm must not thrash)
    try {
      const ice = String(this.pc?.iceConnectionState || "");
      const cs = String(this.pc?.connectionState || "");
      if (
        ice === "checking" ||
        ice === "connected" ||
        ice === "completed" ||
        cs === "connecting" ||
        cs === "connected"
      ) {
        this.handlers.onConnectionState?.(`warm_skip_ice_${ice || cs}`);
        return;
      }
    } catch {
      /* ignore */
    }
    if (!this.hasIceServers()) {
      void this.ensureLocalStream().catch(() => {});
      return;
    }
    try {
      // Explicit preferRelay (hub force_relay match kick) → pure policy=relay.
      // Search warm uses preferRelay:false — never sticky pure from mere TURN.
      if (opts?.preferRelay && this.hasTurn()) {
        this.forceRelayOnce = true;
        this.hubForceRelaySticky = true;
      }
      // Cam + PC in parallel (was serial: GUM then PC)
      const gum = this.ensureLocalStream();
      // Re-check after any await path risk: never close mid-offer
      if (
        this.hasRemoteDescription ||
        this.answeredAsAnswerer ||
        this.makingOffer ||
        (!!this.pendingRemoteOfferSince &&
          Date.now() - this.pendingRemoteOfferSince < 8000)
      ) {
        this.handlers.onConnectionState?.("warm_skip_mid_negotiate_post");
        return;
      }
      if (
        this.pc &&
        this.pcUsesRelayPolicy !== this.desiredRelayPolicy() &&
        !this.hasRemoteDescription &&
        !this.answeredAsAnswerer &&
        !this.makingOffer
      ) {
        try {
          this.pc.close();
        } catch {
          /* ignore */
        }
        this.pc = null;
        this.warmed = false;
        this.warmTurnPrimed = false;
      }
      if (!this.pc) {
        this.ensurePc();
      }
      await gum;
      // Do NOT addTrack during search warm. Hub prefers web as offerer — phone
      // is usually answerer. addTrack before setRemote(offer) creates extra
      // m-lines → setRemote fails / no answer ("linking cameras" forever).
      // Offerer match path attaches; answerer uses replaceTrack after setRemote.
      this.warmed = true;
      this.handlers.onConnectionState?.(
        `pc_warmed relay=${this.pcUsesRelayPolicy ? 1 : 0} no_early_track=1`
      );
      // Do NOT createOffer during warm under force_relay — that storm of
      // ALLOCs + dirty have-local-offer left peer_usage=0. Match path gathers
      // a single fresh relay on the real offer/answer PC (pool=0).
      if (this.hasTurn() && (this.pcUsesRelayPolicy || this.forceRelayOnce)) {
        this.warmTurnPrimed = false;
        this.handlers.onConnectionState?.(
          `pc_warm_skip_prime pool0 fr=${this.forceRelayOnce ? 1 : 0}`
        );
      }
    } catch {
      /* non-fatal — match path will retry */
    }
  }

  /** Search-time TURN ALLOCATE finished (for match kick to skip cold wait). */
  isWarmTurnPrimed(): boolean {
    return !!this.warmTurnPrimed && !!this.warmed;
  }

  /**
   * Wait until warm TURN prime completes (or timeout). Call on force_relay match.
   *
   * Pure warm intentionally never primes (pc_warm_skip_prime, pool=0) — do not
   * burn ~1100ms blocking startCall. Only poll briefly while warm is still in
   * flight; once warmed without prime, return false immediately.
   */
  async waitWarmTurnPrimed(maxMs = 1100): Promise<boolean> {
    if (this.warmTurnPrimed) return true;
    // Warm already done without prime (by design under force_relay) — no wait.
    if (this.warmed) return false;
    // Warm still in flight: short poll only (not full maxMs — prime is rare).
    const t0 = Date.now();
    const cap = Math.min(Math.max(0, maxMs), 200);
    while (Date.now() - t0 < cap) {
      if (this.warmTurnPrimed) return true;
      if (this.warmed) return false;
      await new Promise((r) => setTimeout(r, 40));
    }
    return !!this.warmTurnPrimed;
  }

  /**
   * Start a call after matched. Offerer creates the offer.
   * Always waits for ICE/TURN config first (phone NATs need hub TURN).
   *
   * IMPORTANT: do NOT tear down a PC that already has remote offer/answer
   * (browser often sends offer before our matched handler finishes startCall).
   * Destroying it left the phone as answerer with a blank PC → no video / "not matched".
   */
  async startCall(opts: {
    isOfferer: boolean;
    /** Hub Matched.force_relay — must latch pure policy BEFORE offer/answer. */
    forceRelay?: boolean;
  }): Promise<void> {
    // Latch hub force_relay before any skip/early-return so answer path
    // builds pure policy=relay (web already pure; android force_relay=0 was
    // the 20:38 av_path mismatch while hub/web reported force_relay=true).
    // CRITICAL: only ARM on true. Never clear sticky via startCall(false) —
    // early kick can race matched latch and wipe pure (av_path force_relay=0).
    if (opts.forceRelay === true) {
      try {
        this.setForceRelay(true);
      } catch {
        this.forceRelayOnce = true;
        this.hubForceRelaySticky = true;
      }
    } else if (
      opts.forceRelay === false &&
      !this.hubForceRelaySticky &&
      !this.forceRelayOnce
    ) {
      // no-op clear when already clear
    }
    {
      const hubFr =
        opts.forceRelay === true ? 1 : opts.forceRelay === false ? 0 : -1;
      this.handlers.onConnectionState?.(
        `startCall force_relay_hub=${hubFr} forceRelayOnce=${this.forceRelayOnce ? 1 : 0} sticky=${this.hubForceRelaySticky ? 1 : 0} pure=${this.desiredRelayPolicy() ? 1 : 0}`
      );
    }
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
    // Answerer who already applied remote offer (and maybe sent answer) must
    // NEVER re-enter startCall — that re-armed promote watchdog and dual-offered
    // at ~6s while web path was healthy (hub: android match_to_offer_ms~6200).
    // CRITICAL: only real remote SDP counts. answeredAsAnswerer alone was latched
    // pre-setRemote and made startCall skip on empty PC → ice=new forever,
    // zero answer (nightly 2026-08-11 aec9 hybrid, CONNECT answer=?).
    // Claude harvest 223 briefly re-added the latch to hasRemoteSdp — keep out.
    const hasRemoteSdp =
      this.hasRemoteDescription || !!this.pc?.remoteDescription;
    if (hasRemoteSdp && this.pc && !opts.isOfferer) {
      void this.bindAnswerOutbound();
      this.handlers.onConnectionState?.(
        `startCall_skip_answerer_remote ice=${this.pc?.iceConnectionState || "?"} cs=${this.pc?.connectionState || "?"} bind_v=${this.lastBindVideoSenders}`
      );
      this.scheduleConnectingWatch();
      this.scheduleRemoteVideoWatch();
      this.scheduleOutboundVideoWatch();
      return;
    }
    // Offer in flight (setRemote not done yet) — do not thrash PC
    if (
      !opts.isOfferer &&
      this.pc &&
      this.pendingRemoteOfferSince &&
      Date.now() - this.pendingRemoteOfferSince < 8000
    ) {
      this.handlers.onConnectionState?.(
        `startCall_skip_offer_inflight ansLatch=${this.answeredAsAnswerer ? 1 : 0} ice=${this.pc.iceConnectionState || "?"}`
      );
      this.scheduleConnectingWatch();
      return;
    }
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
      if (this.answeredAsAnswerer) void this.bindAnswerOutbound();
      else this.attachLocalTracksIfNeeded();
      this.handlers.onConnectionState?.(
        `startCall_skip_inflight offerSent=${this.offerSentThisCall ? 1 : 0}`
      );
      this.scheduleConnectingWatch();
      return;
    }
    if (alreadyLive) {
      if (this.answeredAsAnswerer) void this.bindAnswerOutbound();
      else this.attachLocalTracksIfNeeded();
      this.handlers.onConnectionState?.(
        `startCall_keep_live ice=${this.pc?.iceConnectionState || "?"} cs=${this.pc?.connectionState || "?"}`
      );
      this.scheduleConnectingWatch();
      return;
    }
    this.startCallInFlight = true;
    this.startCallInFlightAt = Date.now();
    try {
      // Never flip answerer → offerer mid-match (hub answerer grace drops offers)
      if (this.answeredAsAnswerer) {
        this.isOfferer = false;
        // Keep hubWantsOfferer as-is (already latched answerer)
      } else {
        this.hubWantsOfferer = !!opts.isOfferer;
        this.isOfferer = this.hubWantsOfferer;
      }
      this.gotRemoteVideo = false;
      this.remoteVideoWaves = 0;
      this._remoteFramesSeen = false;
      this._lastInboundFrames = 0;
      this.callStartAt = Date.now();
      this.iceRestartCount = 0;
      // Do NOT clear offerSent if we somehow already sent (mutex should prevent)
      if (!this.offerSentThisCall) this.gotAnswerThisCall = false;
      // Offerer: retry soon if createOffer stalls.
      // Answerer: wait for browser (web preferred offerer). Promote only if
      // web silent ~2s — 250ms promote caused glare + hub debounce + 18–24s wait.
      // Answerer: wait longer for web (preferred offerer). Short promote
      // caused dual-offer glare when web offer was only slightly delayed.
      this.armOfferWatchdog(this.isOfferer ? 400 : 3500);
      this.markConnectStart(opts.isOfferer ? "start_offerer" : "start_answerer");
      this.matchMarkT0 = Date.now();
      this.lastTiming = {
        matchAt: this.matchMarkT0,
        offerMs: null,
        answerMs: null,
        iceMs: null,
        firstFrameMs: null,
      };

      // force_relay needs TURN before policy=relay rebuild (desiredRelayPolicy
      // requires hasTurn — arming pure with no TURN left sticky policy=all).
      if ((this.forceRelayOnce || this.hideIp) && !this.hasTurn()) {
        await this.waitForIceConfig(1200);
        this.handlers.onConnectionState?.(
          this.hasTurn()
            ? "ice_force_relay_turn_ok"
            : "ice_force_relay_no_turn"
        );
      } else if (this.hasTurn()) {
        this.handlers.onConnectionState?.("ice_force_relay_turn_prewarmed");
      }
      // AFTER TURN: rebuild warm hybrid → pure relay if hub force_relay.
      this.ensureRelayPolicyPc("startCall");
      if (
        this.pc &&
        !this.hasRemoteDescription &&
        !this.answeredAsAnswerer &&
        !this.makingOffer &&
        this.pcUsesRelayPolicy !== this.desiredRelayPolicy()
      ) {
        try {
          this.pc.close();
        } catch {
          /* ignore */
        }
        this.pc = null;
        this.warmed = false;
        this.pendingRemoteIce = [];
        this.makingOffer = false;
        this.handlers.onConnectionState?.("startCall_policy_rebuild");
      } else if (this.pc && this.warmed) {
        this.handlers.onConnectionState?.(
          `startCall_reuse_warm relay=${this.pcUsesRelayPolicy ? 1 : 0} pure=${this.desiredRelayPolicy() ? 1 : 0}`
        );
      }

      // FAST PATH: cam + ICE already warm from search → zero await
      const camReady = !!(this.localStream?.getVideoTracks?.() || []).some(
        (t) => (t as { readyState?: string }).readyState === "live"
      );
      let local = this.localStream;
      if (!camReady) {
        const iceWaitMs = this.hasIceServers() ? 0 : 200;
        const gum = this.ensureLocalStream();
        const [iceOkSettle, gumResult] = await Promise.all([
          iceWaitMs === 0
            ? Promise.resolve(true)
            : this.waitForIceConfig(iceWaitMs),
          Promise.race([
            gum,
            new Promise<MediaStreamLike | null>((resolve) =>
              setTimeout(() => resolve(this.localStream), 150)
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
        if (!this.hasIceServers()) {
          await this.waitForIceConfig(400);
        }
        this.markPhase(
          this.hasTurn()
            ? this.warmed
              ? "ice_ready_turn_warm"
              : "ice_ready_turn_fast"
            : "ice_ready_fast"
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

      const offerPending =
        !!this.pendingRemoteOfferSince &&
        Date.now() - this.pendingRemoteOfferSince < 8000;
      if (pcBusy || offerPending) {
        // Offerer may attach; answerer must wait for setRemote → replaceTrack.
        if (this.isOfferer) {
          this.attachLocalTracksIfNeeded();
        }
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
      // Answerer: never addTrack before remote offer (Unified Plan m-line thrash).
      if (this.pc && this.warmed && !pcBusy) {
        if (this.isOfferer) {
          this.attachLocalTracksIfNeeded();
        }
        this.handlers.onConnectionState?.(
          `reuse_warm_pc offerer=${this.isOfferer ? 1 : 0}`
        );
      } else if (this.pc) {
        // Never destroy PC while remote offer is mid-flight
        if (offerPending || this.answeredAsAnswerer || this.hasRemoteDescription) {
          this.handlers.onConnectionState?.("startCall_keep_pc_offer_pending");
          this.scheduleConnectingWatch();
          return;
        }
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
          // Once we answered (or applied remote offer), NEVER promote — hub
          // drops answerer offers @~10s and thrash kills phone→PC video.
          if (this.answeredAsAnswerer) {
            this.handlers.onConnectionState?.("offer_watchdog_skip_answerer");
            return;
          }
          if (this.offerSentThisCall || this.hasRemoteDescription) return;
          if (this.gotRemoteVideo) return;
          if (this.pc?.remoteDescription) return;
          if (this.lastRemoteOfferAt > 0) {
            this.handlers.onConnectionState?.("offer_watchdog_skip_had_remote");
            return;
          }
          // Real offer mid-flight (queued behind ICE/GUM) — do not race promote
          if (
            this.pendingRemoteOfferSince &&
            Date.now() - this.pendingRemoteOfferSince < 8000
          ) {
            this.handlers.onConnectionState?.(
              "offer_watchdog_skip_pending_remote"
            );
            // Re-arm once more if still silent after pending window
            if (!this.hasRemoteDescription && !this.answeredAsAnswerer) {
              this.armOfferWatchdog(4000);
            }
            return;
          }
          // Hub designated us answerer (web preferred offerer). NEVER promote —
          // dual-offer glare @~9s left peer_usage≈0 / both black (2026-08-10).
          // Keep waiting; soft re-arm until remote offer lands or call ends.
          if (!this.isOfferer && !this.hubWantsOfferer) {
            const age = this.callStartAt ? Date.now() - this.callStartAt : 0;
            this.handlers.onConnectionState?.(
              `offer_watchdog_wait_web age=${age}`
            );
            // Soft keep-alive: ensure PC + cam ready for instant answer
            if (!this.pc) this.ensurePc();
            if (!this.localStream) {
              try {
                void this.ensureLocalStream();
              } catch {
                /* ignore */
              }
            }
            if (
              !this.hasRemoteDescription &&
              !this.answeredAsAnswerer &&
              !this.offerSentThisCall
            ) {
              this.armOfferWatchdog(5000);
            }
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
          if (this.answeredAsAnswerer) return;
          if (this.pc?.remoteDescription) return;
          if (
            this.pendingRemoteOfferSince &&
            Date.now() - this.pendingRemoteOfferSince < 8000
          ) {
            this.handlers.onConnectionState?.(
              "offer_watchdog_skip_pending_remote"
            );
            return;
          }
          if (!this.pc) this.ensurePc();
          // Only hub offerers (or already latched isOfferer) may emit offers.
          if (!this.isOfferer) {
            this.handlers.onConnectionState?.("offer_watchdog_no_promote");
            return;
          }
          this.handlers.onConnectionState?.("offer_watchdog_retry_offerer");
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

  /**
   * Attach cam/mic to the PC. MUST be awaited before createAnswer.
   * @param opts.answerer — after setRemote(offer): ONLY replaceTrack into
   *   existing senders/transceivers. Never addTrack (extra m-lines without
   *   renego → phone→web black while Android still sees PC).
   */
  private async attachLocalTracksIfNeeded(opts?: {
    answerer?: boolean;
  }): Promise<void> {
    const pc = this.pc;
    const stream = this.localStream;
    if (!pc || !stream) return;
    // Answerer before remote offer: enabling tracks only — never addTrack.
    // Hub designates phone answerer when peer is web; pre-addTrack made
    // setRemote(offer) fail → zero answer for force_relay=false (fast startCall).
    const answerer =
      !!opts?.answerer ||
      this.answeredAsAnswerer ||
      (!this.isOfferer && !this.hasRemoteDescription);
    try {
      // Ensure cam/mic are enabled outbound (privacy veil is UI-only on mobile)
      for (const track of stream.getTracks()) {
        try {
          if ((track as { enabled?: boolean }).enabled === false) {
            (track as { enabled: boolean }).enabled = true;
          }
        } catch {
          /* ignore */
        }
      }
      // Pre-offer answerer: stop here (no senders yet — wait for setRemote)
      if (answerer && !this.hasRemoteDescription && !opts?.answerer) {
        return;
      }
      type SenderRow = {
        track?: {
          kind?: string;
          id?: string;
          readyState?: string;
          enabled?: boolean;
        } | null;
        replaceTrack?: (t: unknown) => Promise<void>;
      };
      type TransceiverRow = {
        sender?: SenderRow;
        receiver?: { track?: { kind?: string } | null };
        mid?: string | null;
        direction?: string;
        setDirection?: (d: string) => void;
      };
      const senders =
        (pc as unknown as { getSenders?: () => SenderRow[] }).getSenders?.() ||
        [];
      const transceivers =
        (
          pc as unknown as { getTransceivers?: () => TransceiverRow[] }
        ).getTransceivers?.() || [];
      // Force sendrecv so createAnswer does not emit a=recvonly on video
      for (const tr of transceivers) {
        try {
          if (typeof tr.setDirection === "function") {
            tr.setDirection("sendrecv");
          } else if (tr) {
            (tr as { direction: string }).direction = "sendrecv";
          }
        } catch {
          /* ignore */
        }
      }
      const claimed = new Set<SenderRow>();
      const pending: Promise<void>[] = [];
      // Prefer audio then video so null-sender claim order matches SDP m-lines
      const tracks = [...stream.getTracks()].sort((a, b) => {
        const ka = (a as { kind?: string }).kind || "";
        const kb = (b as { kind?: string }).kind || "";
        if (ka === kb) return 0;
        return ka === "audio" ? -1 : 1;
      });
      for (const track of tracks) {
        if ((track as { readyState?: string }).readyState === "ended") continue;
        const kind = (track as { kind?: string }).kind;
        const tid = (track as { id?: string }).id;
        // 1) Same track already attached
        let sender = senders.find(
          (s) => s.track && tid && s.track.id === tid
        );
        // 2) Sender already carrying this kind (replace if different/ended)
        if (!sender) {
          sender = senders.find(
            (s) => s.track && s.track.kind === kind && !claimed.has(s)
          );
        }
        // 3) Transceiver whose receiver is this kind (prefer empty, else any)
        if (!sender && kind) {
          let tr = transceivers.find(
            (t) =>
              t.receiver?.track?.kind === kind &&
              t.sender &&
              !t.sender.track &&
              !claimed.has(t.sender)
          );
          if (!tr) {
            tr = transceivers.find(
              (t) =>
                t.receiver?.track?.kind === kind &&
                t.sender &&
                !claimed.has(t.sender)
            );
          }
          if (tr?.sender) sender = tr.sender;
        }
        // 4) Null sender in m-line order (audio first claimed already)
        // Answerer: only claim null after kind-matched transceiver pass —
        // blind null claim can put video on the audio m-line.
        if (!sender && !(answerer && kind === "video")) {
          sender = senders.find((s) => !s.track && !claimed.has(s));
        }
        // 5) Answerer video last-resort: any remaining null sender
        if (!sender && answerer && kind === "video") {
          sender = senders.find((s) => !s.track && !claimed.has(s));
        }
        if (sender) claimed.add(sender);
        if (sender?.replaceTrack) {
          const cur = sender.track;
          if (
            cur &&
            tid &&
            cur.id === tid &&
            cur.readyState === "live" &&
            cur.enabled !== false
          ) {
            continue;
          }
          pending.push(
            sender.replaceTrack(track).catch((e) => {
              this.handlers.onConnectionState?.(
                `replaceTrack_fail kind=${kind} ${e instanceof Error ? e.message : String(e)}`
              );
              // Answerer: never addTrack (orphan m-line). Offerer may.
              if (!answerer) {
                try {
                  pc.addTrack(track, stream);
                } catch {
                  /* ignore */
                }
              }
            })
          );
        } else if (!answerer) {
          try {
            pc.addTrack(track, stream);
          } catch {
            /* already added */
          }
        } else {
          this.handlers.onConnectionState?.(
            `attach_no_sender kind=${kind} answerer=1`
          );
        }
      }
      if (pending.length) {
        await Promise.all(pending);
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Infer m-line kinds from remote offer SDP (audio/video order).
   * RN often has receiver.track.kind empty right after setRemote — matching
   * only by receiver.kind left video unbound → PC frames_in=0 (2026-08-10).
   */
  private remoteOfferMLineKinds(): Array<"audio" | "video"> {
    const kinds: Array<"audio" | "video"> = [];
    try {
      const sdp = String(
        (this.pc as { remoteDescription?: { sdp?: string } | null })
          ?.remoteDescription?.sdp ||
          (this.pc as { currentRemoteDescription?: { sdp?: string } | null })
            ?.currentRemoteDescription?.sdp ||
          ""
      );
      for (const line of sdp.split(/\r?\n/)) {
        if (/^m=audio\b/i.test(line)) kinds.push("audio");
        else if (/^m=video\b/i.test(line)) kinds.push("video");
      }
    } catch {
      /* ignore */
    }
    return kinds;
  }

  /**
   * Local track usable for replaceTrack. RN sometimes omits readyState or
   * reports empty kind until after the first frame — never require both.
   */
  private trackUsable(
    t: { kind?: string; readyState?: string; enabled?: boolean; id?: string } | null | undefined
  ): boolean {
    if (!t) return false;
    const rs = String(t.readyState || "");
    if (rs === "ended") return false;
    // readyState missing / "live" / "" → usable
    return true;
  }

  /**
   * After replaceTrack: force encoding active + keyframe so RN starts encoder.
   * bind_v=1 with framesEncoded=0 was often inactive encodings (2026-08-10).
   */
  private async armVideoSenderEncode(
    sender: {
      track?: {
        kind?: string;
        id?: string;
        readyState?: string;
        enabled?: boolean;
        muted?: boolean;
      } | null;
      replaceTrack?: (t: unknown) => Promise<void>;
      generateKeyFrame?: () => Promise<void>;
      getParameters?: () => {
        encodings?: Array<Record<string, unknown>>;
      };
      setParameters?: (p: object) => Promise<void>;
    } | null | undefined
  ): Promise<void> {
    if (!sender) return;
    const t = sender.track;
    try {
      if (t && t.enabled === false) t.enabled = true;
    } catch {
      /* ignore */
    }
    try {
      const tier =
        QUALITY_TIERS[
          (this.qualityTier as QualityTierName) || "mid"
        ] || QUALITY_TIERS.mid;
      await applySenderEncoding(sender as SenderLike, {
        maxBitrate: tier.maxBitrate,
        maxFramerate: tier.maxFramerate,
        scaleResolutionDownBy: tier.scaleResolutionDownBy || 1,
        degradationPreference: "maintain-framerate",
        active: true,
      });
    } catch {
      /* ignore */
    }
    try {
      if (typeof sender.generateKeyFrame === "function") {
        void sender.generateKeyFrame().catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * After remote offer: ALWAYS bind live local A/V into offer m-lines
   * (replaceTrack only). Force video transceiver sendrecv. Returns true if a
   * live video sender exists — critical for PC frames_in (phone→web).
   */
  private async bindAnswerOutbound(): Promise<boolean> {
    const pc = this.pc;
    const stream = this.localStream;
    if (!pc || !stream) {
      this.lastBindVideoSenders = 0;
      return false;
    }
    // Enable local tracks first (privacy veil is UI-only)
    try {
      for (const t of stream.getTracks?.() || []) {
        try {
          if ((t as { enabled?: boolean }).enabled === false) {
            (t as { enabled: boolean }).enabled = true;
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    // Cold cam: one short GUM attempt. readyState may be empty on RN — still bind.
    // Cap ≤150ms — never block answer emit >200ms when stream already present.
    const pickV = (s: MediaStreamLike | null | undefined) =>
      (s?.getVideoTracks?.() || []).find((t) => this.trackUsable(t as never)) ||
      (s?.getVideoTracks?.() || [])[0];
    const pickA = (s: MediaStreamLike | null | undefined) =>
      (s?.getAudioTracks?.() || []).find((t) => this.trackUsable(t as never)) ||
      (s?.getAudioTracks?.() || [])[0];
    let localV = pickV(stream);
    let localA = pickA(stream);
    if (!localV || !localA) {
      try {
        await Promise.race([
          this.ensureLocalStream(),
          new Promise<null>((r) => setTimeout(() => r(null), 150)),
        ]);
      } catch {
        /* ignore */
      }
      const s2 = this.localStream || stream;
      localV = pickV(s2) || localV;
      localA = pickA(s2) || localA;
    }
    await this.attachLocalTracksIfNeeded({ answerer: true });
    // Bind by SDP m-line order first (reliable on RN), then by receiver kind
    try {
      type Tr = {
        sender?: {
          track?: {
            kind?: string;
            id?: string;
            readyState?: string;
            enabled?: boolean;
            muted?: boolean;
          } | null;
          replaceTrack?: (t: unknown) => Promise<void>;
          generateKeyFrame?: () => Promise<void>;
          getParameters?: () => {
            encodings?: Array<Record<string, unknown>>;
          };
          setParameters?: (p: object) => Promise<void>;
        };
        receiver?: { track?: { kind?: string } | null };
        direction?: string;
        setDirection?: (d: string) => void;
        mid?: string | null;
      };
      let trs =
        (pc as unknown as { getTransceivers?: () => Tr[] }).getTransceivers?.() ||
        [];
      // RN: transceivers can be empty for a tick after setRemote — brief retry
      if (!trs.length) {
        await new Promise((r) => setTimeout(r, 40));
        trs =
          (pc as unknown as { getTransceivers?: () => Tr[] }).getTransceivers?.() ||
          [];
      }
      const forceSendrecv = (tr: Tr) => {
        try {
          if (typeof tr.setDirection === "function") {
            tr.setDirection("sendrecv");
          } else {
            (tr as { direction: string }).direction = "sendrecv";
          }
        } catch {
          /* ignore */
        }
      };
      let mKinds = this.remoteOfferMLineKinds();
      // Fallback when SDP not yet on remoteDescription: assume audio then video
      if (!mKinds.length && trs.length >= 2) {
        mKinds = ["audio", "video"];
      } else if (!mKinds.length && trs.length === 1) {
        mKinds = ["video"];
      }
      const bindOne = async (
        tr: Tr,
        kind: "audio" | "video",
        want: unknown
      ) => {
        if (!want || !tr.sender?.replaceTrack) return;
        forceSendrecv(tr);
        try {
          await tr.sender.replaceTrack(want);
          this.handlers.onConnectionState?.(
            `bind_force_replace kind=${kind}`
          );
        } catch (e) {
          this.handlers.onConnectionState?.(
            `bind_replace_fail kind=${kind} ${e instanceof Error ? e.message : String(e)}`
          );
        }
        // Arm encode off critical path — replaceTrack already set bind_v;
        // kickMediaAfterIce + post_answer waves re-keyframe.
        if (kind === "video") {
          void this.armVideoSenderEncode(tr.sender);
        }
      };
      // Pass 1: SDP m-line order ↔ transceiver order (Unified Plan)
      // Even when receiver.track.kind is empty, index match binds video.
      // Parallel A/V replaceTrack — serial was 2× replaceTrack latency on mta.
      if (mKinds.length && trs.length) {
        const n = Math.min(mKinds.length, trs.length);
        const pass1: Promise<void>[] = [];
        for (let i = 0; i < n; i++) {
          const kind = mKinds[i];
          const want = kind === "video" ? localV : localA;
          pass1.push(bindOne(trs[i], kind, want || null));
        }
        if (pass1.length) await Promise.all(pass1);
      }
      // Pass 1b: if mKinds empty but we have senders, bind by index audio/video
      if (!mKinds.length && trs.length) {
        const pass1b: Promise<void>[] = [];
        if (localA && trs[0]) pass1b.push(bindOne(trs[0], "audio", localA));
        if (localV && trs[1]) pass1b.push(bindOne(trs[1], "video", localV));
        else if (localV && trs[0] && !localA)
          pass1b.push(bindOne(trs[0], "video", localV));
        if (pass1b.length) await Promise.all(pass1b);
      }
      // Pass 2: by receiver/sender kind (fill any missed).
      // ALWAYS re-replace live local video — RN can report same id with a dead encoder.
      // Empty kind: still try video on non-audio senders (RN kind lag).
      for (const tr of trs) {
        forceSendrecv(tr);
        const rKind =
          tr.receiver?.track?.kind ||
          tr.sender?.track?.kind ||
          undefined;
        // Detect wrong-kind: video m-line carrying audio (or vice versa)
        if (
          rKind === "video" &&
          tr.sender?.track?.kind === "audio" &&
          localV &&
          tr.sender.replaceTrack
        ) {
          try {
            await tr.sender.replaceTrack(localV);
            this.handlers.onConnectionState?.("bind_fix_wrong_kind_video");
            void this.armVideoSenderEncode(tr.sender);
          } catch {
            /* ignore */
          }
          continue;
        }
        let want: unknown =
          rKind === "video" ? localV : rKind === "audio" ? localA : null;
        // Empty kind + local video + sender not carrying audio → try video
        if (
          !want &&
          !rKind &&
          localV &&
          tr.sender?.track?.kind !== "audio" &&
          tr.receiver?.track?.kind !== "audio"
        ) {
          want = localV;
        }
        if (!want || !tr.sender?.replaceTrack) continue;
        const cur = tr.sender.track;
        const sameLive =
          rKind === "audio" &&
          !!cur &&
          (cur as { id?: string }).id === (want as { id?: string }).id &&
          cur.readyState !== "ended" &&
          cur.enabled !== false;
        if (sameLive) continue;
        try {
          await tr.sender.replaceTrack(want);
          this.handlers.onConnectionState?.(
            `bind_force_replace kind=${rKind || "empty"}`
          );
          if (rKind === "video" || !rKind) {
            void this.armVideoSenderEncode(tr.sender);
          }
        } catch (e) {
          this.handlers.onConnectionState?.(
            `bind_force_replace_fail kind=${rKind || "empty"} ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
      // Video still unbound: claim any video-capable transceiver / null sender
      const localVidId = (localV as { id?: string } | undefined)?.id;
      const liveVideoOnSender = (pc.getSenders?.() || []).some((s) => {
        const t = (s as { track?: { kind?: string; readyState?: string; id?: string } | null })
          .track;
        if (!t || t.readyState === "ended") return false;
        if (t.kind === "video") return true;
        // kind empty but same id as local video track
        if (localVidId && t.id === localVidId) return true;
        return false;
      });
      if (localV && !liveVideoOnSender) {
        // Prefer transceiver with video receiver, then any non-audio, then null
        const candidates = [
          ...trs.filter((t) => t.receiver?.track?.kind === "video"),
          ...trs.filter(
            (t) =>
              t.receiver?.track?.kind !== "audio" &&
              t.sender?.track?.kind !== "audio"
          ),
          ...trs,
        ];
        for (const tr of candidates) {
          forceSendrecv(tr);
          if (!tr.sender?.replaceTrack) continue;
          // Do not clobber a live audio sender with video
          if (tr.sender.track?.kind === "audio") continue;
          try {
            await tr.sender.replaceTrack(localV);
            this.handlers.onConnectionState?.("bind_video_fallback_ok");
            void this.armVideoSenderEncode(tr.sender);
            break;
          } catch {
            /* try next */
          }
        }
      }
      // Final: arm every video sender off critical path (encodings + keyframe)
      for (const s of pc.getSenders?.() || []) {
        const t = (s as { track?: { kind?: string; id?: string } | null }).track;
        const isVid =
          t?.kind === "video" ||
          (!!localVidId && t?.id === localVidId);
        if (!isVid) continue;
        void this.armVideoSenderEncode(s as never);
      }
      // Snapshot video transceiver direction for debug
      try {
        const vDirs = trs
          .map((tr) => {
            const k =
              tr.receiver?.track?.kind || tr.sender?.track?.kind || "?";
            return `${k}:${tr.direction || "?"}`;
          })
          .join(",");
        this.handlers.onConnectionState?.(`bind_dirs ${vDirs}`);
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
    const localVidId2 = (localV as { id?: string } | undefined)?.id;
    const vSend = (pc.getSenders?.() || []).filter((s) => {
      const t = (s as { track?: { kind?: string; readyState?: string; id?: string } | null })
        .track;
      if (!t || t.readyState === "ended") return false;
      if (t.kind === "video") return true;
      if (localVidId2 && t.id === localVidId2) return true;
      return false;
    }).length;
    this.lastBindVideoSenders = vSend;
    const vMeta = localV as
      | { kind?: string; enabled?: boolean; readyState?: string; muted?: boolean }
      | undefined;
    this.handlers.onConnectionState?.(
      `bind_answer_outbound vLiveSenders=${vSend} localV=${localV ? 1 : 0} en=${vMeta?.enabled !== false ? 1 : 0} rs=${vMeta?.readyState || "?"} muted=${vMeta?.muted ? 1 : 0}`
    );
    return vSend > 0;
  }

  /** Sync wrapper for call sites that cannot await (ICE handlers, etc.). */
  private attachLocalTracksFireAndForget(): void {
    void this.attachLocalTracksIfNeeded();
  }

  /**
   * After answer/ICE: verify outbound video is actually encoding. Phone→web
   * black with HOT peer_usage one-way was often a live GUM track not bound to
   * the answer transceiver (null-track sender left empty).
   * Strong recovery: framesEncoded=0 after 2s → re-bind + keyframe.
   */
  private scheduleOutboundVideoWatch(): void {
    if (this._outboundWatchArmed) return;
    this._outboundWatchArmed = true;
    // 2s is the critical gate (user: frames_out growing, frames_in=0)
    const waves = [600, 1200, 2000, 3500, 6000, 10000];
    for (const delay of waves) {
      setTimeout(() => {
        void this.pollOutboundVideo(delay);
      }, delay);
    }
  }

  private _outboundWatchArmed = false;
  private _outboundFramesSeen = false;
  private _avPathArmed = false;
  private _avPathTimers: ReturnType<typeof setTimeout>[] = [];

  /**
   * Emit av_path for scripts/av-verify.sh — ICE pair types + frame/byte counts.
   * Also reports outbound track health (v_kind/enabled/readyState) for one-way
   * diagnosis when bind_v=1 but frames_out stays 0.
   */
  async reportAvPath(why = "tick"): Promise<void> {
    const pc = this.pc as {
      iceConnectionState?: string;
      connectionState?: string;
      signalingState?: string;
      getSenders?: () => Array<{
        track?: {
          kind?: string;
          enabled?: boolean;
          readyState?: string;
          muted?: boolean;
          id?: string;
        } | null;
        getParameters?: () => {
          encodings?: Array<Record<string, unknown>>;
        };
      }>;
      getTransceivers?: () => Array<{
        direction?: string;
        sender?: { track?: { kind?: string } | null };
        receiver?: { track?: { kind?: string } | null };
      }>;
      getStats?: () => Promise<
        Map<
          string,
          Record<string, unknown> & {
            type?: string;
            kind?: string;
            mediaType?: string;
            framesReceived?: number;
            framesEncoded?: number;
            framesSent?: number;
            bytesReceived?: number;
            bytesSent?: number;
            packetsSent?: number;
            qualityLimitationReason?: string;
            nominated?: boolean;
            selected?: boolean;
            state?: string;
            localCandidateId?: string;
            remoteCandidateId?: string;
            candidateType?: string;
            protocol?: string;
            id?: string;
          }
        >
      >;
    } | null;
    if (!pc) return;
    let appVc = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Constants = require("expo-constants") as {
        expoConfig?: { android?: { versionCode?: number }; version?: string };
        android?: { versionCode?: number };
        nativeBuildVersion?: string | number;
      };
      appVc =
        Number(Constants?.expoConfig?.android?.versionCode || 0) ||
        Number(Constants?.android?.versionCode || 0) ||
        Number(Constants?.nativeBuildVersion || 0) ||
        0;
    } catch {
      /* ignore */
    }
    if (!appVc) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const App = require("expo-application") as {
          nativeBuildVersion?: string | null;
        };
        appVc = Number(App?.nativeBuildVersion || 0) || 0;
      } catch {
        /* ignore */
      }
    }
    // Outbound video track snapshot (before stats)
    let vKind = "";
    let vEnabled: number | null = null;
    let vReady = "";
    let vMuted: number | null = null;
    let encActive: number | null = null;
    let vDir = "";
    try {
      const senders = pc.getSenders?.() || [];
      const vSender =
        senders.find((s) => s.track?.kind === "video") ||
        senders.find((s) => !!s.track);
      const vt = vSender?.track;
      if (vt) {
        vKind = String(vt.kind || "");
        vEnabled = vt.enabled === false ? 0 : 1;
        vReady = String(vt.readyState || "");
        vMuted = vt.muted ? 1 : 0;
      }
      try {
        const params = vSender?.getParameters?.();
        const enc0 = params?.encodings?.[0];
        if (enc0 && typeof enc0.active === "boolean") {
          encActive = enc0.active ? 1 : 0;
        } else if (enc0) {
          encActive = 1; // absent → treat as active-default
        }
      } catch {
        /* ignore */
      }
      const trs = pc.getTransceivers?.() || [];
      for (const tr of trs) {
        const k = tr.sender?.track?.kind || tr.receiver?.track?.kind || "";
        if (k === "video" || (!vDir && k !== "audio")) {
          vDir = String(tr.direction || "");
          if (k === "video") break;
        }
      }
    } catch {
      /* ignore */
    }
    const snap: Record<string, unknown> = {
      v: 1,
      t: Date.now(),
      why: String(why).slice(0, 32),
      platform: "android",
      force_relay:
        this.forceRelayOnce || this.hubForceRelaySticky ? 1 : 0,
      hub_fr: this.hubForceRelaySticky ? 1 : 0,
      hide_ip: this.hideIp ? 1 : 0,
      policy: this.pcUsesRelayPolicy ? "relay" : "all",
      ice: String(pc.iceConnectionState || ""),
      cs: String(pc.connectionState || ""),
      sig: String(pc.signalingState || ""),
      offerer: this.isOfferer ? 1 : 0,
      bind_v: this.lastBindVideoSenders,
      app_vc: appVc,
      v_kind: vKind || "?",
      v_enabled: vEnabled,
      v_readyState: vReady || "?",
      v_muted: vMuted,
      v_dir: vDir || "?",
      enc_active: encActive,
    };
    try {
      if (typeof pc.getStats === "function") {
        const report = await pc.getStats();
        let framesIn = 0;
        let framesOut = 0;
        let framesEncodedRaw = 0;
        let framesSent = 0;
        let bytesIn = 0;
        let bytesOut = 0;
        let packetsOut = 0;
        let outVStats = 0;
        let qlim = "";
        let localType = "";
        let remoteType = "";
        const cands: Record<string, string> = {};
        report.forEach((r) => {
          if (r.type === "local-candidate" || r.type === "remote-candidate") {
            cands[String(r.id)] = String(r.candidateType || "");
          }
        });
        report.forEach((r) => {
          if (
            r.type === "inbound-rtp" &&
            (r.kind === "video" || r.mediaType === "video")
          ) {
            if (typeof r.framesReceived === "number") framesIn += r.framesReceived;
            if (typeof r.bytesReceived === "number") bytesIn += r.bytesReceived;
          }
          if (
            r.type === "outbound-rtp" &&
            (r.kind === "video" || r.mediaType === "video")
          ) {
            outVStats += 1;
            if (typeof r.framesEncoded === "number") {
              framesOut += r.framesEncoded;
              framesEncodedRaw += r.framesEncoded;
            }
            if (typeof r.framesSent === "number") framesSent += r.framesSent;
            if (typeof r.bytesSent === "number") bytesOut += r.bytesSent;
            if (typeof r.packetsSent === "number") packetsOut += r.packetsSent;
            if (r.qualityLimitationReason && r.qualityLimitationReason !== "none") {
              qlim = String(r.qualityLimitationReason);
            }
          }
          if (
            r.type === "candidate-pair" &&
            (r.nominated || r.selected || r.state === "succeeded")
          ) {
            localType = cands[String(r.localCandidateId)] || localType;
            remoteType = cands[String(r.remoteCandidateId)] || remoteType;
          }
        });
        snap.frames_in = framesIn;
        snap.frames_out = framesOut;
        snap.frames_encoded = framesEncodedRaw;
        snap.frames_sent = framesSent;
        snap.bytes_in = bytesIn;
        snap.bytes_out = bytesOut;
        snap.packets_out = packetsOut;
        snap.out_v_stats = outVStats;
        if (qlim) snap.qlim = qlim;
        snap.local_type = localType || "?";
        snap.remote_type = remoteType || "?";
        snap.ok =
          (framesIn > 2 || bytesIn > 8000) &&
          (framesOut > 2 || bytesOut > 8000);
      }
    } catch {
      /* ignore */
    }
    try {
      this.handlers.onSignal?.("av_path", JSON.stringify(snap));
      this.handlers.onConnectionState?.(
        `av_path ice=${snap.ice} ${snap.local_type}→${snap.remote_type} fin=${snap.frames_in} fout=${snap.frames_out} vk=${snap.v_kind} en=${snap.v_enabled} rs=${snap.v_readyState} dir=${snap.v_dir} enc=${snap.enc_active}`
      );
    } catch {
      /* ignore */
    }
  }

  private armAvPathBeacons(): void {
    if (this._avPathArmed) return;
    this._avPathArmed = true;
    // 8s: still-linking snapshot for black paths (ice=checking frames=0)
    for (const ms of [2000, 5000, 8000, 12000]) {
      const t = setTimeout(() => {
        if (!this.pc) return;
        const ice = String(
          (this.pc as { iceConnectionState?: string }).iceConnectionState || ""
        );
        const cs = String(
          (this.pc as { connectionState?: string }).connectionState || ""
        );
        const why =
          ms === 8000 &&
          ice !== "connected" &&
          ice !== "completed" &&
          cs !== "connected"
            ? "linking_8s"
            : `wave_${ms}`;
        void this.reportAvPath(why);
      }, ms);
      this._avPathTimers.push(t);
    }
  }

  private async pollOutboundVideo(waveMs: number): Promise<void> {
    const pc = this.pc as unknown as {
      getStats?: () => Promise<
        Map<
          string,
          {
            type?: string;
            kind?: string;
            mediaType?: string;
            framesEncoded?: number;
            bytesSent?: number;
            packetsSent?: number;
          }
        >
      >;
      getSenders?: () => Array<{
        track?: {
          kind?: string;
          enabled?: boolean;
          readyState?: string;
          muted?: boolean;
        } | null;
        replaceTrack?: (t: unknown) => Promise<void>;
        generateKeyFrame?: () => Promise<void>;
        getParameters?: () => {
          encodings?: Array<Record<string, unknown>>;
        };
        setParameters?: (p: object) => Promise<void>;
      }>;
    } | null;
    if (!pc || !this.localStream) return;
    try {
      // Answerer: always re-bind via replaceTrack (never addTrack)
      if (this.answeredAsAnswerer || !this.isOfferer) {
        await this.bindAnswerOutbound();
      } else {
        await this.attachLocalTracksIfNeeded();
      }
      // Force enable + keyframe on every video sender
      const senders = pc.getSenders?.() || [];
      let vSenders = 0;
      let vLive = 0;
      for (const s of senders) {
        const t = s?.track;
        if (!t || t.kind !== "video") continue;
        vSenders += 1;
        if (t.readyState === "live") vLive += 1;
        try {
          if (t.enabled === false) t.enabled = true;
        } catch {
          /* ignore */
        }
        await this.armVideoSenderEncode(s as never);
      }
      // Prefer live video; fall back to any non-ended track (RN readyState lag)
      let localV = (this.localStream.getVideoTracks?.() || []).filter(
        (t) => (t as { readyState?: string }).readyState === "live"
      );
      if (!localV.length) {
        localV = (this.localStream.getVideoTracks?.() || []).filter(
          (t) => (t as { readyState?: string }).readyState !== "ended"
        );
      }
      // No video sender but we have a cam → hard re-bind (answerer-safe)
      if (vSenders === 0 && localV.length > 0) {
        this.handlers.onConnectionState?.(
          `outbound_no_sender wave=${waveMs} localV=${localV.length}`
        );
        await this.bindAnswerOutbound();
        // Belt: replaceTrack on any null sender with live cam
        for (const s of pc.getSenders?.() || []) {
          if (s.track) continue;
          if (typeof s.replaceTrack === "function" && localV[0]) {
            try {
              await s.replaceTrack(localV[0]);
              this.handlers.onConnectionState?.("outbound_replace_null_ok");
              await this.armVideoSenderEncode(s as never);
            } catch {
              /* ignore */
            }
          }
        }
      }
      if (!pc.getStats) {
        this.handlers.onConnectionState?.(
          `outbound_check wave=${waveMs} vSend=${vSenders} vLive=${vLive}`
        );
        return;
      }
      const report = await pc.getStats();
      let frames = 0;
      let bytes = 0;
      let packets = 0;
      report.forEach((r) => {
        if (
          r.type === "outbound-rtp" &&
          (r.kind === "video" || r.mediaType === "video")
        ) {
          if (typeof r.framesEncoded === "number") frames += r.framesEncoded;
          if (typeof r.bytesSent === "number") bytes += r.bytesSent;
          if (typeof r.packetsSent === "number") packets += r.packetsSent;
        }
      });
      if (frames > 2 || bytes > 8000) {
        this._outboundFramesSeen = true;
        this.handlers.onConnectionState?.(
          `outbound_video_ok wave=${waveMs} frames=${frames} bytes=${bytes}`
        );
        return;
      }
      this.handlers.onConnectionState?.(
        `outbound_video_weak wave=${waveMs} frames=${frames} bytes=${bytes} pkts=${packets} vSend=${vSenders} vLive=${vLive}`
      );
      // framesEncoded=0 after ≥2s: FRESH cam + null/replace + encode arm (P0)
      // Same-track rebind alone left bind_v=1 frames_out=0 (app_vc=304).
      // Skip hard GUM while ICE still forming pure TURN — replaceTrack(null)
      // mid-checking + concurrent warm rebuild made ice fall back to "new".
      if (waveMs >= 2000 && frames === 0) {
        const iceNow = String(
          (this.pc as { iceConnectionState?: string } | null)
            ?.iceConnectionState || ""
        );
        const csNow = String(
          (this.pc as { connectionState?: string } | null)?.connectionState ||
            ""
        );
        if (
          iceNow === "checking" ||
          iceNow === "new" ||
          csNow === "connecting" ||
          csNow === "new"
        ) {
          this.handlers.onConnectionState?.(
            `outbound_zero_soft_ice wave=${waveMs} ice=${iceNow} cs=${csNow}`
          );
          await this.bindAnswerOutbound();
          this.kickMediaAfterIce(`outbound_soft_${waveMs}`);
          void this.reportAvPath(`zero_f_${waveMs}`);
          return;
        }
        this.handlers.onConnectionState?.(
          `outbound_zero_frames_hard wave=${waveMs} vSend=${vSenders}`
        );
        try {
          // Always re-GUM video when encoder is dead (track may look "live")
          await Promise.race([
            this.refreshLocalVideoTrack(`zero_f_${waveMs}`),
            new Promise<null>((r) => setTimeout(() => r(null), 1200)),
          ]);
        } catch {
          try {
            await this.ensureLocalStream();
          } catch {
            /* ignore */
          }
        }
        const freshV =
          (this.localStream?.getVideoTracks?.() || []).find(
            (t) => (t as { readyState?: string }).readyState !== "ended"
          ) || null;
        try {
          if (freshV) (freshV as { enabled: boolean }).enabled = true;
        } catch {
          /* ignore */
        }
        // Encoder restart: replaceTrack(null) then FRESH live track on VIDEO senders only
        // (never claim null/audio m-lines — that swaps kinds → PC still black).
        for (const s of pc.getSenders?.() || []) {
          const t = s?.track;
          if (!t || t.kind !== "video") continue;
          if (!s.replaceTrack || !freshV) continue;
          try {
            await s.replaceTrack(null);
          } catch {
            /* ignore */
          }
          try {
            await s.replaceTrack(freshV);
            await this.armVideoSenderEncode(s as never);
            this.handlers.onConnectionState?.(
              `outbound_null_replace_ok wave=${waveMs}`
            );
          } catch (e) {
            this.handlers.onConnectionState?.(
              `outbound_null_replace_fail ${e instanceof Error ? e.message : String(e)}`
            );
          }
        }
        // m-line bind covers unbound video senders without touching audio
        await this.bindAnswerOutbound();
        // Keyframe burst on all video senders
        for (const s of pc.getSenders?.() || []) {
          const t = s?.track;
          if (!t || t.kind !== "video") continue;
          try {
            if (t.enabled === false) t.enabled = true;
          } catch {
            /* ignore */
          }
          await this.armVideoSenderEncode(s as never);
          try {
            if (typeof s.generateKeyFrame === "function") {
              void s.generateKeyFrame().catch(() => {});
            }
          } catch {
            /* ignore */
          }
        }
        this.kickMediaAfterIce(`outbound_zero_${waveMs}`);
        void this.reportAvPath(`zero_f_${waveMs}`);
        return;
      }
      // Recover: re-enable tracks + keyframes; re-GUM if track ended
      if (localV.length === 0) {
        try {
          await this.refreshLocalVideoTrack(`weak_${waveMs}`);
          await this.bindAnswerOutbound();
        } catch {
          try {
            await this.ensureLocalStream();
            await this.bindAnswerOutbound();
          } catch {
            /* ignore */
          }
        }
      } else {
        await this.bindAnswerOutbound();
        this.kickMediaAfterIce(`outbound_weak_${waveMs}`);
      }
    } catch {
      /* ignore */
    }
  }

  /** Strip host/srflx for pure-relay only (Hide IP + hub force hide/untrusted). */
  private shouldFilterToRelayCandidates(): boolean {
    return this.desiredRelayPolicy();
  }

  /**
   * Wait for typ relay before first SDP — pure modes only.
   * Normal / same-LAN: emit immediately with private host; TURN trickles
   * as fail-open (do not block host ICE for 550ms+).
   */
  private shouldWaitForFirstRelay(): boolean {
    return this.desiredRelayPolicy();
  }

  private relayWaitBudgetMs(): number {
    // Pure TURN: wait for first typ relay then emit (exits early). Cap so mta
    // isn't stuck ~3.8s after product.ok (2026-08-10). Fail-open if n=0.
    return this.desiredRelayPolicy() ? 1200 : 0;
  }

  private async createAndSendOffer(
    iceRestart = false,
    opts?: { earlyBlack?: boolean }
  ): Promise<void> {
    // Already answered / applied remote offer — NEVER re-offer (hub drops
    // answerer offers @~10s; thrash → peer_usage≈0 + PC black).
    if (
      this.answeredAsAnswerer ||
      this.lastRemoteOfferAt > 0 ||
      (this.hasRemoteDescription && !this.isOfferer)
    ) {
      this.handlers.onConnectionState?.(
        iceRestart
          ? "offer_skip_answerer_ice_restart"
          : "offer_skip_was_answerer"
      );
      if (iceRestart && typeof this.pc?.restartIce === "function") {
        try {
          this.pc.restartIce();
          this.kickMediaAfterIce("answerer_offer_blocked_restart");
        } catch {
          /* ignore */
        }
      } else if (!iceRestart) {
        // Soft recovery: re-bind outbound + keyframes only
        void this.bindAnswerOutbound();
        this.kickMediaAfterIce("answerer_soft_outbound");
      }
      return;
    }
    if (this.desiredRelayPolicy()) {
      this.ensureRelayPolicyPc("create_offer");
    }
    const pc = this.ensurePc();
    const rtc = this.rtc;
    if (!pc || !rtc) return;
    if (this.makingOffer) return;
    const now = Date.now();
    const gen = this.callGen;
    const earlyBlack = !!opts?.earlyBlack;
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
    if (
      this.hasRemoteDescription &&
      !iceRestart &&
      !this.isOfferer
    ) {
      this.handlers.onConnectionState?.("offer_skip_has_remote_answerer");
      return;
    }
    // iceRestart grace: earlyBlack / zero-frames → ~3.5s; frames OK → 18s.
    // (Was 8.5–18s always → earlyBlack tryIceRestart no-op as offerer.)
    if (iceRestart) {
      const age = this.callStartAt ? Date.now() - this.callStartAt : 99999;
      // 45s first-path freeze (align with web) — earlyBlack no longer short-circuits
      const minAge = this._remoteFramesSeen ? 45000 : 45000;
      if (age < minAge) {
        this.handlers.onConnectionState?.(
          `offer_skip_restart_grace age=${age} need=${minAge} early=${earlyBlack ? 1 : 0}`
        );
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
      // Codec prefs affect SDP — keep before createOffer. Quality after emit.
      try {
        this.applyCodecPrefs(pc);
      } catch {
        /* ignore */
      }
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
      // setLocal first — pure force_relay/hide waits for typ relay then strips host.
      try {
        await pc.setLocalDescription(offer);
      } catch (e) {
        this.handlers.onConnectionState?.(
          `offer_setLocal_fail ${e instanceof Error ? e.message : String(e)}`
        );
      }
      if (gen !== this.callGen || this.pc !== pc) {
        this.handlers.onConnectionState?.("offer_skip_stale_after_local");
        return;
      }
      if (this.shouldWaitForFirstRelay()) {
        // Offerer pure: single capped wait (was budget 1200 + second budget+900).
        // Early exit on first typ relay; fail-open + trickle if n=0 — don't stall
        // when android is offerer. Cap 400 so match→offer stays responsive.
        const budget = Math.min(this.relayWaitBudgetMs(), 400);
        let n = await waitForIceGatherRelayOrDone(pc, budget);
        this.handlers.onConnectionState?.(
          `offer_first_relay n=${n} budget=${budget} pure=${this.desiredRelayPolicy() ? 1 : 0}`
        );
        if (n === 0) {
          this.handlers.onConnectionState?.("offer_emit_no_relay_failopen");
        }
      }
      if (gen !== this.callGen || this.pc !== pc) {
        this.handlers.onConnectionState?.("offer_skip_stale_after_relay");
        return;
      }
      const local = pc.localDescription as { type?: string; sdp?: string } | null;
      const off = (local || offer) as { type?: string; sdp?: string };
      let sdp = String(off?.sdp || "");
      // Always drop mDNS; pure → relay only; normal same-LAN keeps private host.
      if (sdp) sdp = stripMdnsHostCandidatesFromSdp(sdp);
      if (this.shouldFilterToRelayCandidates() && sdp) {
        sdp = stripNonRelayCandidatesFromSdp(sdp);
      } else if (this.shouldStripHostCandidates() && sdp) {
        sdp = sdp
          .split(/\r?\n/)
          .filter(
            (line) =>
              !(/^a=candidate:/i.test(line) && /\btyp\s+host\b/i.test(line))
          )
          .join("\r\n");
      }
      if (sdp && gen === this.callGen && this.pc === pc) {
        this.lastOfferAt = Date.now();
        this.offerSentThisCall = true;
        this.handlers.onSignal?.(
          "offer",
          JSON.stringify({ type: off?.type || "offer", sdp })
        );
        this.handlers.onConnectionState?.(
          `offer_sent bytes=${sdp.length} restart=${iceRestart ? 1 : 0}`
        );
        this.armStuckIceWatch();
      } else if (!iceRestart) {
        this.offerSentThisCall = false;
      }
      // First path always low bitrate → faster TURN keyframe; ramp on ICE up.
      void this.applyQualityTier("low");
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
    // Recover failed/long-disconnect without thrashing healthy checking.
    // Align with force iceRestart grace (~8.5s); was 16s first wave.
    const waves: Array<{ delay: number; force: boolean }> = [
      { delay: 10000, force: true },
      { delay: 18000, force: true },
      { delay: 28000, force: true },
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
    // Do NOT clear stuck/black watch here — ICE "connected" often fires with
    // zero frames; black_watch must keep running until first_frame.
  }

  /**
   * After SDP: recover black / stuck TURN without waiting 14–18s call grace.
   * Waves: keyframe-only while ICE up; soft restart if still no frames.
   * (0.1.202 stuck watch called tryIceRestart but grace blocked until 14s.)
   */
  private stuckIceTimers: ReturnType<typeof setTimeout>[] = [];
  private armStuckIceWatch(): void {
    this.clearStuckIceWatch();
    // Answerer: keyframes + outbound only — NEVER iceRestart/re-offer (hub drops
    // answerer offers @~10s and thrash kills phone→web video).
    // Offerer: soft restart after 7s if still black.
    const answerer = !!this.answeredAsAnswerer || !this.isOfferer;
    // LOCK: no iceRestart / remount for 45s after SDP (web re-offer@20s/@40s
    // killed pure force_relay media that had peer_usage rising).
    const waves: Array<{ delay: number; restart: boolean; rebuild: boolean }> =
      answerer
        ? [
            { delay: 2000, restart: false, rebuild: false },
            { delay: 6000, restart: false, rebuild: false },
            { delay: 15000, restart: false, rebuild: false },
            { delay: 45000, restart: false, rebuild: true },
          ]
        : [
            { delay: 2500, restart: false, rebuild: false },
            { delay: 8000, restart: false, rebuild: false },
            { delay: 20000, restart: false, rebuild: false },
            { delay: 45000, restart: true, rebuild: false },
          ];
    for (const w of waves) {
      const t = setTimeout(() => {
        const pc = this.pc;
        if (!pc) return;
        // Frames only — track presence with black SurfaceView must still recover
        if (this._remoteFramesSeen) return;
        if (!this.hasRemoteDescription && !pc.remoteDescription) return;
        const ice = String(pc.iceConnectionState || "");
        const cs = String(pc.connectionState || "");
        this.pollInboundFrames();
        this.handlers.onConnectionState?.(
          `black_watch ice=${ice} cs=${cs} d=${w.delay} restart=${w.restart ? 1 : 0} ans=${this.answeredAsAnswerer ? 1 : 0}`
        );
        this.kickMediaAfterIce(`black_${w.delay}`);
        this.requestInboundKeyframes(`black_${w.delay}`);
        this.repaintRemoteStream(`black_${w.delay}`);
        // Always push outbound (phone→web black)
        this.attachLocalTracksIfNeeded();
        void this.bindAnswerOutbound();
        void this.pollOutboundVideo(w.delay);
        if (w.rebuild) {
          this.forceRebuildRemoteStreamForPaint(`black_${w.delay}`);
        }
        if (w.restart && !this.answeredAsAnswerer) {
          void this.tryIceRestart({ force: true, earlyBlack: true });
        }
      }, w.delay);
      this.stuckIceTimers.push(t);
    }
  }

  private clearStuckIceWatch(): void {
    for (const t of this.stuckIceTimers) clearTimeout(t);
    this.stuckIceTimers = [];
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
    // Answerer: wait for browser offer (Play↔browser often 0.2–3s, rarely 8s).
    // Offerer: wait for answer/ICE before restart. Early promote = glare thrash.
    // Was 12s/6s — left "Linking…" dead for too long when browser silent.
    const delay = noRemoteYet ? 9000 : 4500;
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
        age < 10000 &&
        (ice === "new" || ice === "checking" || cs === "connecting") &&
        !noRemote
      ) {
        this.scheduleConnectingWatch();
        return;
      }
      // Recent remote offer — never promote (browser is driving)
      const recentRemoteOffer =
        this.lastRemoteOfferAt > 0 &&
        Date.now() - this.lastRemoteOfferAt < 5000;
      if (
        cs === "failed" ||
        ice === "failed" ||
        (noRemote && age >= 9000 && !recentRemoteOffer) ||
        ((cs === "disconnected" || ice === "disconnected") && age >= 9000)
      ) {
        this.handlers.onConnectionState?.(
          `ice_stuck_retry ice=${ice} cs=${cs} noRemote=${noRemote ? 1 : 0} age=${age}`
        );
        // Never promote if we already answered web. Only after long true silence.
        const promote =
          !this.isOfferer &&
          !this.answeredAsAnswerer &&
          noRemote &&
          age >= 25000 &&
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
            getReceivers?: () => Array<{
              track?: {
                id?: string;
                kind?: string;
                enabled?: boolean;
                readyState?: string;
              } | null;
            }>;
          }
        ).getReceivers?.() || [];
      const found: unknown[] = [];
      let addedVideo = false;
      for (const r of receivers) {
        const track = r?.track;
        if (!track) continue;
        if (track.readyState === "ended") continue;
        try {
          if (track.enabled === false) track.enabled = true;
        } catch {
          /* ignore */
        }
        found.push(track);
      }
      if (!found.length) return;

      // Always rebuild MediaStream from receivers when video appears.
      // addTrack-only left Android RTCView black (same streamURL, no rebind).
      const hadVideo =
        (this.remoteStream?.getVideoTracks?.()?.length ?? 0) > 0;
      const nowVideo = found.some(
        (t) => (t as { kind?: string }).kind === "video"
      );
      if (!this.remoteStream || (nowVideo && !hadVideo) || rtc.MediaStream) {
        try {
          if (rtc.MediaStream) {
            // Prefer full rebuild when we can — forces new toURL for RTCView
            if (!this.remoteStream || (nowVideo && !hadVideo)) {
              this.remoteStream = new rtc.MediaStream(found as never[]);
              addedVideo = nowVideo && !hadVideo;
            } else {
              for (const track of found) {
                const existing = this.remoteStream.getTracks?.() || [];
                const id = (track as { id?: string }).id;
                const has = existing.some(
                  (t) => (t as { id?: string }).id && (t as { id?: string }).id === id
                );
                if (!has) {
                  try {
                    (
                      this.remoteStream as unknown as {
                        addTrack?: (t: unknown) => void;
                      }
                    ).addTrack?.(track);
                    if ((track as { kind?: string }).kind === "video") {
                      addedVideo = true;
                    }
                  } catch {
                    /* ignore */
                  }
                }
              }
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (this.remoteStream) {
        this.pushRemoteStreamToUi(
          addedVideo ? `harvest_v_${why}` : `harvest_${why}`
        );
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
      this.markPhase(`remote_tracks_v=${videoCount}`);
    }
    // Stable signature — do NOT include Date.now() (that remounted RTCView every
    // repaint and caused visible flicker). Only notify UI when stream/tracks change
    // or caller forces a rebuild (why starts with rebuild_).
    const base = `${url}#t${trackCount}v${videoCount}`;
    const force =
      why.startsWith("rebuild_") || why.startsWith("force_");
    if (!force && base === this.remoteStreamUrl) {
      return;
    }
    // Audio-only spam: keep first notification only
    if (
      !force &&
      videoCount === 0 &&
      this.remoteStreamUrl.startsWith(`${url}#t`) &&
      this.remoteStreamUrl.includes("v0")
    ) {
      return;
    }
    this.remoteStreamUrl = base;
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

  /**
   * After ICE: enable tracks + request outbound keyframes so first frame
   * arrives sooner on TURN (common 2–8s black after "connected").
   */
  private kickMediaAfterIcePrivate(why: string): void {
    const pc = this.pc;
    if (!pc) return;
    try {
      if (this.answeredAsAnswerer) {
        void this.bindAnswerOutbound();
      } else {
        void this.attachLocalTracksIfNeeded();
      }
    } catch {
      /* ignore */
    }
    try {
      const senders =
        (
          pc as unknown as {
            getSenders?: () => Array<{
              track?: { kind?: string; enabled?: boolean; readyState?: string } | null;
              generateKeyFrame?: () => Promise<void>;
              requestKeyFrame?: () => void;
            }>;
          }
        ).getSenders?.() || [];
      for (const s of senders) {
        const t = s?.track;
        if (!t || t.kind !== "video" || t.readyState === "ended") continue;
        try {
          if (t.enabled === false) t.enabled = true;
        } catch {
          /* ignore */
        }
        try {
          if (typeof s.generateKeyFrame === "function") {
            void s.generateKeyFrame().catch(() => {});
          } else if (typeof s.requestKeyFrame === "function") {
            s.requestKeyFrame();
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    this.handlers.onConnectionState?.(`kick_media_${why}`);
    // Burst: 0 + 80 + 200 + 500ms keyframes (TURN first-frame often late)
    if (!String(why).includes("_retry")) {
      setTimeout(() => {
        try {
          this.kickMediaAfterIce(`${why}_retry`);
        } catch {
          /* ignore */
        }
      }, 80);
      setTimeout(() => {
        try {
          this.kickMediaAfterIce(`${why}_retry2`);
        } catch {
          /* ignore */
        }
      }, 200);
      setTimeout(() => {
        try {
          this.kickMediaAfterIce(`${why}_retry3`);
        } catch {
          /* ignore */
        }
      }, 500);
    }
  }

  /** True if this call already answered a remote offer (must not re-offer). */
  hasAnsweredAsAnswerer(): boolean {
    return !!this.answeredAsAnswerer;
  }

  private scheduleRemoteVideoWatch() {
    if (!this.pc) return;
    if (this.remoteVideoWatchTimer) return;
    // Sparse: poll frames; only remount if still black. Stop after first frame.
    // First wave ASAP — first paint target is <2.5s after answer.
    const delays = [80, 400, 1200, 3000, 7000, 14000];
    const wave = this.remoteVideoWaves;
    if (wave >= delays.length) return;
    this.remoteVideoWatchTimer = setTimeout(() => {
      this.remoteVideoWatchTimer = null;
      if (!this.pc) return;
      this.pollInboundFrames();
      const framesOk = this.remoteFramesSeenRecently();
      if (framesOk) {
        this.markPhase("first_frame");
        this.handlers.onConnectionState?.(
          `remote_frames_ok w=${wave} age=${this.elapsedMs()}`
        );
        this.clearRemoteVideoWatch();
        this.clearStuckIceWatch();
        // First paint done — ramp quality (held low for faster TURN keyframe)
        if (!this.dataSaver && !this.onCellular) {
          void this.applyQualityTier("mid");
        }
        return;
      }
      this.harvestRemoteReceivers(`watch_w${wave}`);
      if (wave === 0 || wave === 2) {
        try {
          this.requestInboundKeyframes(`watch_w${wave}`);
          this.kickMediaAfterIce(`watch_w${wave}`);
        } catch {
          /* ignore */
        }
      }
      // One remount only if still black at ~3s
      if (wave === 2) {
        this.forceRebuildRemoteStreamForPaint(`watch_w${wave}`);
      } else {
        this.repaintRemoteStream(`video_watch_w${wave}`);
      }
      const v = this.remoteStream?.getVideoTracks?.()?.length ?? 0;
      if (v > 0) this.gotRemoteVideo = true;
      const age = this.callStartAt ? Date.now() - this.callStartAt : 0;
      this.remoteVideoWaves = wave + 1;
      this.handlers.onConnectionState?.(
        `remote_paint_retry w=${this.remoteVideoWaves} v=${v} age=${age}`
      );
      // Black path: soft ICE restart only, stay answerer, never before 8s
      // (early thrash @3s caused answerer re-offer drops + crash loops).
      if (age >= 8000 && wave >= 3 && !this.answeredAsAnswerer) {
        void this.tryIceRestart({
          force: true,
          promoteOfferer: false,
          earlyBlack: true,
        });
      } else if (age >= 8000 && wave >= 3 && this.answeredAsAnswerer) {
        if (typeof this.pc?.restartIce === "function") {
          try {
            this.pc.restartIce();
            this.kickMediaAfterIce("black_watch_answerer_soft");
          } catch {
            /* ignore */
          }
        }
      }
      this.scheduleRemoteVideoWatch();
    }, delays[wave] ?? 5000);
  }

  /** True if inbound video has received frames recently (getStats). */
  private remoteFramesSeenRecently(): boolean {
    // Sync peek of last polled frame count (updated async by pollInboundFrames)
    return this._remoteFramesSeen === true;
  }

  private _remoteFramesSeen = false;
  private _lastInboundFrames = 0;

  /** Poll getStats for inbound-rtp video framesDecoded/framesReceived. */
  private pollInboundFrames(): void {
    const pc = this.pc as unknown as {
      getStats?: () => Promise<Map<string, { type?: string; kind?: string; framesDecoded?: number; framesReceived?: number; mediaType?: string }>>;
    } | null;
    if (!pc?.getStats) return;
    void pc
      .getStats()
      .then((stats) => {
        let frames = 0;
        stats.forEach((r) => {
          if (r.type !== "inbound-rtp") return;
          if (r.kind !== "video" && r.mediaType !== "video") return;
          frames = Math.max(
            frames,
            r.framesDecoded || 0,
            r.framesReceived || 0
          );
        });
        if (frames > this._lastInboundFrames) {
          this._lastInboundFrames = frames;
          this._remoteFramesSeen = true;
        }
      })
      .catch(() => {});
  }

  /** Ask remote encoder for a keyframe via receiver API when available. */
  private requestInboundKeyframes(why: string): void {
    const pc = this.pc as unknown as {
      getReceivers?: () => Array<{
        track?: { kind?: string } | null;
        requestKeyFrame?: () => void;
        play?: () => void;
      }>;
    } | null;
    if (!pc?.getReceivers) return;
    try {
      for (const r of pc.getReceivers() || []) {
        if (r?.track?.kind !== "video") continue;
        try {
          r.requestKeyFrame?.();
        } catch {
          /* ignore */
        }
      }
      this.handlers.onConnectionState?.(`inbound_kf_${why}`);
    } catch {
      /* ignore */
    }
    this.pollInboundFrames();
  }

  /**
   * Clone remote tracks into a brand-new MediaStream so RTCView toURL() changes
   * and the SurfaceView rebinds (track-present-but-black case).
   */
  private forceRebuildRemoteStreamForPaint(why: string): void {
    const rtc = this.rtc;
    const rs = this.remoteStream;
    if (!rtc?.MediaStream || !rs) return;
    try {
      const tracks = (rs.getTracks?.() || []).filter(
        (t) => (t as { readyState?: string }).readyState !== "ended"
      );
      if (!tracks.length) return;
      for (const t of tracks) {
        try {
          if ((t as { enabled?: boolean }).enabled === false) {
            (t as { enabled: boolean }).enabled = true;
          }
        } catch {
          /* ignore */
        }
      }
      // Prefer empty stream + addTrack — some RN builds crash if tracks are
      // still owned by another MediaStream when passed to the constructor.
      let next: MediaStreamLike;
      try {
        next = new rtc.MediaStream() as MediaStreamLike;
        for (const t of tracks) {
          try {
            (
              next as unknown as { addTrack?: (tr: unknown) => void }
            ).addTrack?.(t);
          } catch {
            /* skip track */
          }
        }
      } catch {
        try {
          next = new rtc.MediaStream(tracks as never[]) as MediaStreamLike;
        } catch {
          this.repaintRemoteStream(`rebuild_fail_${why}`);
          return;
        }
      }
      this.remoteStream = next;
      this.remoteStreamUrl = "";
      this.pushRemoteStreamToUi(`rebuild_${why}`);
    } catch {
      /* never crash the app from paint recovery */
    }
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
    /**
     * Connected/checking but zero frames after SDP — bypass long call grace.
     * Used by black_watch (was no-op until 14s → 30s black product lag).
     */
    earlyBlack?: boolean;
  }): Promise<boolean> {
    const force = !!opts?.force;
    const promote = !!opts?.promoteOfferer;
    const earlyBlack = !!opts?.earlyBlack;
    const now = Date.now();
    // First seconds of force-relay: let TURN finish. Early restarts = thrash.
    const age = this.callStartAt ? now - this.callStartAt : 99999;
    // Relay first path needs time for ALLOCATE + first frames — do not thrash
    // earlyBlack is already past that window by design (≥2s media, ≥4s restart).
    if (
      !force &&
      !earlyBlack &&
      this.shouldFilterToRelayCandidates() &&
      age < 9000
    ) {
      this.handlers.onConnectionState?.(
        `ice_restart_skip_relay_grace age=${age}`
      );
      return false;
    }
    // At most ONE ice restart attempt per call after SDP
    if (this.iceRestartCount >= 1 && this.hasRemoteDescription) {
      this.handlers.onConnectionState?.(
        `ice_restart_skip_once n=${this.iceRestartCount}`
      );
      return false;
    }
    // Frames OK → long grace. Black: never renego before 20s.
    if (this._remoteFramesSeen) {
      if (age < 18000) {
        this.handlers.onConnectionState?.(
          `ice_restart_skip_call_grace age=${age} frames=1`
        );
        return false;
      }
    } else {
      const grace = 20000;
      if (age < grace) {
        this.handlers.onConnectionState?.(
          `ice_restart_skip_call_grace age=${age} need=${grace} force=${force ? 1 : 0} early=${earlyBlack ? 1 : 0} frames=0`
        );
        return false;
      }
    }
    // Still checking — do not renego at all
    if (
      this.pc &&
      (this.pc.iceConnectionState === "checking" ||
        this.pc.iceConnectionState === "new" ||
        this.pc.connectionState === "connecting")
    ) {
      this.handlers.onConnectionState?.(
        `ice_restart_skip_checking ice=${this.pc.iceConnectionState}`
      );
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
      // Answerer with SDP done: only soft restartIce — never re-offer (hub 30s drop)
      if (this.answeredAsAnswerer || (this.hasRemoteDescription && !this.isOfferer)) {
        if (typeof pc.restartIce === "function") {
          pc.restartIce();
          this.handlers.onConnectionState?.("ice_restart_answerer_soft");
          this.kickMediaAfterIce("answerer_restart");
          return true;
        }
        this.handlers.onConnectionState?.("ice_restart_answerer_no_api");
        return false;
      }
      if (this.isOfferer || canPromote) {
        if (canPromote && !this.isOfferer) this.isOfferer = true;
        await this.createAndSendOffer(true, { earlyBlack });
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
          await this.createAndSendOffer(true, { earlyBlack });
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
    // TEMP diagnostic (task 223): trace offer→answer path for black-remote debug.
    if (kind === "offer" || kind === "answer") {
      console.log(
        `[client-ice] recv kind=${kind} ice=${String(this.pc?.iceConnectionState || "none")} has_local_desc=${!!this.pc?.localDescription} has_remote_desc=${this.hasRemoteDescription}`
      );
    }
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
    // Peer echo of hub forensics beacon — ignore (server already logged sender)
    if (kind === "av_path") return;

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
        // Pure: only typ relay. Normal: drop Chrome mDNS, keep private host.
        if (
          this.shouldFilterToRelayCandidates() &&
          c?.candidate &&
          !isRelayIceCandidate(c)
        ) {
          return;
        }
        if (c?.candidate && isMdnsHostIceCandidate(c)) {
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
    // On inbound offer: NEVER attach/addTrack before setRemote (answerer rule).
    // Only warm GUM so bindAnswerOutbound has a live cam after setRemote.
    const isInboundOffer = kind === "offer";
    // Offer often races matched by 100–400ms. Prefer pure-SDP proof before any
    // poll: residual pure web→android always has typ relay + no host/srflx in
    // offer after web first-relay wait. Hop4: latch from SDP first — skip the
    // old 800ms unlatched poll entirely on pure (was serial on mta). Non-pure
    // still polls briefly for hub matched.force_relay.
    if (
      isInboundOffer &&
      !this.hubForceRelaySticky &&
      !this.forceRelayOnce &&
      !this.hideIp
    ) {
      let pureFromOffer = false;
      try {
        const raw = JSON.parse(payload) as { sdp?: string };
        const sdp = String(raw?.sdp || "");
        if (sdp && offerSdpLooksPureRelay(sdp)) {
          this.setForceRelay(true);
          pureFromOffer = true;
          this.handlers.onConnectionState?.(
            "force_relay_from_offer_sdp_pure"
          );
        }
      } catch {
        /* ignore */
      }
      if (
        !pureFromOffer &&
        !this.hubForceRelaySticky &&
        !this.forceRelayOnce
      ) {
        // Hop5 (android mta lag): hybrid force_relay=false was burning a full
        // 800ms poll every answer waiting for sticky pure that hub never arms
        // (mta max ~3.9s, relay_candidates=0). hop4 already latched pure offer
        // SDP; live.tsx re-arms on offer if forceRelayHubRef. If startCall already
        // ran, hub hybrid is known — skip. Offer-before-matched pure race only:
        // short window (was 800).
        const hubAlreadyApplied =
          this.matchMarkT0 > 0 || this.callStartAt > 0;
        if (!hubAlreadyApplied) {
          const t0 = Date.now();
          // Hop8: 120→80; hop9: 80→40 — pure SDP latch above; fail-open hybrid.
          const budget = 40;
          while (
            Date.now() - t0 < budget &&
            !this.hubForceRelaySticky &&
            !this.forceRelayOnce
          ) {
            await new Promise((r) => setTimeout(r, 15));
          }
          if (this.hubForceRelaySticky || this.forceRelayOnce) {
            this.handlers.onConnectionState?.(
              `offer_waited_force_relay ms=${Date.now() - t0}`
            );
          }
        } else {
          this.handlers.onConnectionState?.(
            "offer_skip_force_relay_poll hybrid_matched"
          );
        }
      }
    }
    const camLive = !!(this.localStream?.getVideoTracks?.() || []).some(
      (t) =>
        this.trackUsable(
          t as { kind?: string; readyState?: string; enabled?: boolean }
        )
    );
    if (isInboundOffer) {
      // Warm path: cam+ICE already live from search — zero prep await.
      if (camLive && this.hasIceServers()) {
        this.handlers.onConnectionState?.(
          `answer_fast_path cam=1 ice=1 warm=${this.warmed ? 1 : 0} fr=${this.forceRelayOnce || this.hubForceRelaySticky ? 1 : 0}`
        );
      } else if (!camLive || !this.hasIceServers()) {
        await Promise.all([
          this.hasIceServers()
            ? Promise.resolve(true)
            : this.waitForIceConfig(200),
          Promise.race([
            this.ensureLocalStream(),
            new Promise<MediaStreamLike | null>((resolve) =>
              setTimeout(() => resolve(this.localStream), 150)
            ),
          ]),
        ]);
      }
    } else if (camLive && this.hasIceServers()) {
      this.attachLocalTracksIfNeeded();
    } else if (!(this.localStream && this.hasIceServers())) {
      await Promise.all([
        this.hasIceServers()
          ? Promise.resolve(true)
          : this.waitForIceConfig(250),
        Promise.race([
          this.ensureLocalStream(),
          new Promise<MediaStreamLike | null>((resolve) =>
            // 150ms — was 280/700; cold GUM still fail-opens for SDP
            setTimeout(() => resolve(this.localStream), 150)
          ),
        ]),
      ]);
    } else {
      this.attachLocalTracksIfNeeded();
    }
    // Mark call started on first signal so timers work.
    if (!this.callStartAt) this.callStartAt = Date.now();
    // force_relay: clean relay PC before setRemote (wrong policy / dirty warm).
    if (kind === "offer" && !this.hasRemoteDescription && !this.answeredAsAnswerer) {
      this.handlers.onConnectionState?.(
        `answer_prep force_relay_hub=${this.hubForceRelaySticky ? 1 : 0} forceRelayOnce=${this.forceRelayOnce ? 1 : 0} pure=${this.desiredRelayPolicy() ? 1 : 0} policy=${this.pcUsesRelayPolicy ? "relay" : "all"}`
      );
      if (this.desiredRelayPolicy()) {
        this.ensureRelayPolicyPc("signal_offer");
      } else if (
        this.pc &&
        !this.makingOffer &&
        this.pcUsesRelayPolicy !== this.desiredRelayPolicy()
      ) {
        try {
          this.pc.close();
        } catch {
          /* ignore */
        }
        this.pc = null;
        this.warmed = false;
        this.pendingRemoteIce = [];
        this.handlers.onConnectionState?.("signal_offer_policy_rebuild");
      }
    }
    // Do not replace PC if we already negotiated — attach tracks only
    // Offer path: ensurePc without attach (setRemote → bindAnswerOutbound).
    if (!this.pc) {
      this.ensurePc();
    } else if (!isInboundOffer) {
      this.attachLocalTracksIfNeeded();
    }
    const pc = this.pc;
    if (!pc) return;

    try {
      if (kind === "offer") {
        // Do NOT set answeredAsAnswerer until setRemote succeeds. Early latch
        // made startCall treat empty PC as "has remote" and skip forever
        // (nightly black remote). Still mark answerer role + kill promote.
        this.isOfferer = false;
        this.lastRemoteOfferAt = Date.now();
        if (this.offerWatchTimer) {
          clearTimeout(this.offerWatchTimer);
          this.offerWatchTimer = null;
        }
        console.log(
          `[client-ice] offer_rx ice=${String(pc.iceConnectionState || "none")} has_remote=${this.hasRemoteDescription ? 1 : 0}`
        );
        const raw = JSON.parse(payload) as { type?: string; sdp?: string };
        let desc = raw;
        if (raw?.sdp) {
          let sdp = String(raw.sdp);
          // Always strip Chrome mDNS; keep private host on normal same-LAN.
          sdp = stripMdnsHostCandidatesFromSdp(sdp);
          if (this.shouldFilterToRelayCandidates()) {
            sdp = stripNonRelayCandidatesFromSdp(sdp);
          } else if (this.shouldStripHostCandidates()) {
            sdp = sdp
              .split(/\r?\n/)
              .filter(
                (line) =>
                  !(
                    /^a=candidate:/i.test(line) && /\btyp\s+host\b/i.test(line)
                  )
              )
              .join("\r\n");
          }
          desc = { ...raw, sdp };
        }
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
        // Answerer Unified Plan: NEVER addTrack before setRemote — that creates
        // extra m-lines not in the web offer → phone→PC black (Android still
        // sees PC on the real recv m-line). Flow: GUM → setRemote → replaceTrack
        // into offer senders → createAnswer.
        // Cap 150ms — warm path already has localStream; cold fail-opens for SDP.
        if (!this.localStream) {
          try {
            await Promise.race([
              this.ensureLocalStream(),
              new Promise<null>((r) => setTimeout(() => r(null), 150)),
            ]);
          } catch {
            /* continue — answer without cam still better than linking forever */
          }
        }
        try {
          (this.localStream?.getTracks?.() || []).forEach((t) => {
            try {
              (t as { enabled: boolean }).enabled = true;
            } catch {
              /* ignore */
            }
          });
        } catch {
          /* ignore */
        }
        tagLocalTracks(
          this.localStream as Parameters<typeof tagLocalTracks>[0]
        );
        console.log(
          `[client-ice] offer setRemoteDescription:start sigState=${String(pc2.signalingState || "")}`
        );
        try {
          await pc2.setRemoteDescription(new rtc.RTCSessionDescription(desc));
          console.log("[client-ice] offer setRemoteDescription:ok");
        } catch (e1) {
          // Warm PC may have had early addTrack (old builds) — rebuild once
          console.log(
            `[client-ice] offer setRemoteDescription:fail err=${e1 instanceof Error ? e1.message : String(e1)}`
          );
          this.handlers.onConnectionState?.(
            `offer_setRemote_fail ${e1 instanceof Error ? e1.message : String(e1)}`
          );
          try {
            pc2.close();
          } catch {
            /* ignore */
          }
          this.pc = null;
          this.hasRemoteDescription = false;
          this.pendingRemoteIce = [];
          this.ensurePc();
          const pc3 = this.pc as RTCPeerConnectionLike | null;
          if (!pc3) throw e1;
          await pc3.setRemoteDescription(
            new rtc.RTCSessionDescription(desc)
          );
          console.log("[client-ice] offer setRemoteDescription:ok_retry");
        }
        const pcAnswer = this.pc;
        if (!pcAnswer) return;
        this.hasRemoteDescription = true;
        // Keep answerer latch (already set at offer ingress)
        this.answeredAsAnswerer = true;
        this.isOfferer = false;
        this.pendingRemoteOfferSince = 0;
        this.lastRemoteOfferAt = Date.now();
        this.markPhase("offer_applied");
        if (this.offerWatchTimer) {
          clearTimeout(this.offerWatchTimer);
          this.offerWatchTimer = null;
        }
        // Codec prefs AFTER setRemote (transceiver kinds exist)
        try {
          this.applyCodecPrefs(pcAnswer);
        } catch {
          /* ignore */
        }
        // Bind cam/mic into web offer m-lines only
        const bound = await this.bindAnswerOutbound();
        if (!bound) {
          // Cam late: one more GUM + bind. Hop10: when cam already live, no
          // serial GUM race — re-bind only (never add >200ms waits on warm path).
          try {
            if (!camLive) {
              await Promise.race([
                this.ensureLocalStream(),
                new Promise<null>((r) => setTimeout(() => r(null), 150)),
              ]);
            }
            await this.bindAnswerOutbound();
          } catch {
            /* ignore */
          }
        }
        try {
          const senders = pcAnswer.getSenders?.() || [];
          const vSend = senders.filter(
            (s) => (s as { track?: { kind?: string } }).track?.kind === "video"
          ).length;
          const vNull = senders.filter(
            (s) => !(s as { track?: unknown }).track
          ).length;
          const vLive = (this.localStream?.getVideoTracks?.() || []).filter(
            (t) => (t as { readyState?: string }).readyState === "live"
          ).length;
          this.handlers.onConnectionState?.(
            `answer_outbound vSenders=${vSend} vNull=${vNull} vLive=${vLive}`
          );
        } catch {
          /* ignore */
        }
        const iceFlush = this.flushPendingIce(pcAnswer, rtc);
        console.log("[client-ice] createAnswer:start");
        const answer = await pcAnswer.createAnswer();
        console.log("[client-ice] createAnswer:ok");
        // Always force video sendrecv in answer SDP (belt)
        try {
          const ansObj = answer as { type?: string; sdp?: string };
          if (ansObj?.sdp && /m=video/i.test(ansObj.sdp)) {
            const before = ansObj.sdp;
            ansObj.sdp = forceVideoSendrecvSdp(ansObj.sdp);
            if (ansObj.sdp !== before) {
              this.handlers.onConnectionState?.("answer_sdp_force_sendrecv");
            }
          }
        } catch {
          /* ignore */
        }
        console.log("[client-ice] answer setLocalDescription:start");
        try {
          await pcAnswer.setLocalDescription(answer);
          console.log(
            `[client-ice] answer setLocalDescription:ok has_local_desc=${!!pcAnswer.localDescription} ice=${String(pcAnswer.iceConnectionState || "")}`
          );
        } catch (e) {
          console.log(
            `[client-ice] answer setLocalDescription:fail err=${e instanceof Error ? e.message : String(e)}`
          );
          this.handlers.onConnectionState?.(
            `answer_setLocal_fail ${e instanceof Error ? e.message : String(e)}`
          );
        }
        // Confirm answer local SDP has video sendrecv + re-bind if needed
        try {
          const loc = pcAnswer.localDescription as { sdp?: string } | null;
          const sdp = String(loc?.sdp || "");
          const vSend = /m=video[\s\S]*?a=sendrecv/i.test(sdp) ? 1 : 0;
          const vRecv = /m=video[\s\S]*?a=recvonly/i.test(sdp) ? 1 : 0;
          const vSenders = (pcAnswer.getSenders?.() || []).filter(
            (s) => (s as { track?: { kind?: string } }).track?.kind === "video"
          ).length;
          this.handlers.onConnectionState?.(
            `answer_sdp_check vSendrecv=${vSend} vRecvonly=${vRecv} vSenders=${vSenders}`
          );
        } catch {
          /* ignore */
        }
        // Re-bind after setLocal — transceiver mids/senders settle post-answer SDP.
        // Non-blocking: product already had first await bind before createAnswer;
        // post-emit waves re-bind. Awaiting here blocked mta for hundreds of ms.
        void this.bindAnswerOutbound()
          .then((ok) => {
            this.handlers.onConnectionState?.(
              `answer_setLocal_bind ok=${ok ? 1 : 0}`
            );
          })
          .catch((e) => {
            this.handlers.onConnectionState?.(
              `answer_setLocal_bind_fail ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          });
        this.kickMediaAfterIce("answer_setLocal");
        // Prefer mid bitrate outbound so PC gets real frames (low was too thin on TURN)
        void this.applyQualityTier(
          this.dataSaver || this.onCellular ? "low" : "mid"
        );
        this.scheduleOutboundVideoWatch();
        // force_relay / Hide IP: wait briefly for typ relay (onicecandidate also
        // trickles pure relay after emit). Answer path is serial on mta — single
        // capped budget, no second pass (was budget+500 pure hope after n=0).
        if (this.shouldWaitForFirstRelay()) {
          // Pure answer: wait for first typ relay (early-exit). Hop10 hard-capped
          // at 150ms → answer relay_candidates=0 + slow/failed pure ICE on cold
          // TURN (mto ok but linking felt multi-second / black). Restore ~700ms
          // budget; still exits as soon as first relay appears.
          const budget = Math.min(
            this.relayWaitBudgetMs(),
            camLive ? 700 : 900
          );
          let n = 0;
          try {
            const sdpNow = String(
              (pcAnswer.localDescription as { sdp?: string } | null)?.sdp || ""
            );
            n = (sdpNow.match(/\btyp\s+relay\b/gi) || []).length;
          } catch {
            n = 0;
          }
          if (n > 0) {
            this.handlers.onConnectionState?.(
              `answer_relay_already_in_sdp n=${n}`
            );
          } else {
            n = await waitForIceGatherRelayOrDone(pcAnswer, budget);
          }
          this.handlers.onConnectionState?.(
            `answer_first_relay n=${n} budget=${budget}`
          );
          if (n === 0) {
            // Fail-open: keep host/srflx (stripNonRelay no-ops when relayN=0)
            this.handlers.onConnectionState?.("answer_emit_no_relay_failopen");
          }
        }
        const local = pcAnswer.localDescription as {
          type?: string;
          sdp?: string;
        } | null;
        const ans = (local || answer) as { type?: string; sdp?: string };
        let sdp = String(ans?.sdp || "");
        // Belt: never emit video recvonly answer (PC black partner)
        if (sdp && /m=video/i.test(sdp)) {
          sdp = forceVideoSendrecvSdp(sdp);
        }
        // Keep private host in answer for same-LAN Chrome prflx; drop mDNS only.
        if (sdp) sdp = stripMdnsHostCandidatesFromSdp(sdp);
        if (this.shouldFilterToRelayCandidates() && sdp) {
          sdp = stripNonRelayCandidatesFromSdp(sdp);
        } else if (this.shouldStripHostCandidates() && sdp) {
          sdp = sdp
            .split(/\r?\n/)
            .filter(
              (line) =>
                !(/^a=candidate:/i.test(line) && /\btyp\s+host\b/i.test(line))
            )
            .join("\r\n");
        }
        if (sdp) {
          this.handlers.onSignal?.(
            "answer",
            JSON.stringify({ type: ans?.type || "answer", sdp })
          );
          this.answeredAsAnswerer = true;
          this.isOfferer = false;
          this.markPhase("answer_sent");
          this.handlers.onConnectionState?.(
            `answer force_relay_hub=${this.hubForceRelaySticky ? 1 : 0} forceRelayOnce=${this.forceRelayOnce ? 1 : 0} pure=${this.desiredRelayPolicy() ? 1 : 0} policy=${this.pcUsesRelayPolicy ? "relay" : "all"} bind_v=${this.lastBindVideoSenders}`
          );
          this.armStuckIceWatch();
          // av-verify: beacon even if ICE never leaves checking
          void this.reportAvPath("answer_sent");
          this.armAvPathBeacons();
        } else {
          this.handlers.onConnectionState?.("answer_emit_empty_sdp");
        }
        void iceFlush;
        // After answer is out: hard push outbound + keyframes (phone→PC)
        void this.bindAnswerOutbound();
        this.kickMediaAfterIce("answer_sent");
        this.kickMediaAfterIce("post_answer");
        this.scheduleConnectingWatch();
        this.scheduleRemoteVideoWatch();
        // Immediate harvest + early nudge — first paint target <2.5s after answer
        this.harvestRemoteReceivers("post_answer");
        setTimeout(() => this.harvestRemoteReceivers("post_answer_40"), 40);
        setTimeout(() => {
          if (!this._remoteFramesSeen) {
            this.repaintRemoteStream("post_answer_nudge");
          }
        }, 100);
        // Outbound re-bind waves: SDP m-line bind often needs a second pass on RN
        // after ICE settles (frames_out=0 with live cam was the 20:38 failure).
        [200, 600, 1500, 3000].forEach((ms) => {
          setTimeout(() => {
            try {
              void this.bindAnswerOutbound();
              this.kickMediaAfterIce(`post_answer_${ms}`);
              if (!this._remoteFramesSeen) {
                this.harvestRemoteReceivers(`post_answer_${ms}`);
                this.repaintRemoteStream(`post_answer_${ms}`);
              }
            } catch {
              /* ignore */
            }
          }, ms);
        });
      } else if (kind === "answer") {
        const parseAns = () => {
          const raw = JSON.parse(payload) as { type?: string; sdp?: string };
          if (!raw?.sdp) return raw;
          let sdp = stripMdnsHostCandidatesFromSdp(String(raw.sdp));
          if (this.shouldFilterToRelayCandidates()) {
            sdp = stripNonRelayCandidatesFromSdp(sdp);
          }
          return { ...raw, sdp };
        };
        if (!pc.currentRemoteDescription) {
          const desc = parseAns();
          console.log(
            `[client-ice] answer setRemoteDescription:start sigState=${String(pc.signalingState || "")} has_local_desc=${!!pc.localDescription} ice=${String(pc.iceConnectionState || "")}`
          );
          await pc.setRemoteDescription(new rtc.RTCSessionDescription(desc));
          console.log(
            `[client-ice] answer setRemoteDescription:ok has_local_desc=${!!pc.localDescription} ice=${String(pc.iceConnectionState || "")}`
          );
          this.hasRemoteDescription = true;
          this.gotAnswerThisCall = true;
          this.markPhase("answer_applied");
          // Parallel media kick — don't await ICE flush before keyframes
          void this.flushPendingIce(pc, rtc);
          this.kickMediaAfterIce("got_answer");
          this.armStuckIceWatch();
          this.scheduleRemoteVideoWatch();
          // av-verify: beacon while linking (black path still reports)
          void this.reportAvPath("answer_applied");
          this.armAvPathBeacons();
          this.harvestRemoteReceivers("got_answer");
          setTimeout(() => this.harvestRemoteReceivers("got_answer_40"), 40);
          setTimeout(() => {
            if (!this._remoteFramesSeen) {
              this.repaintRemoteStream("got_answer_nudge");
            }
          }, 100);
        } else {
          // Renego answer when we re-offered (hard retry as offerer)
          console.log(
            `[client-ice] answer setRemoteDescription:start_renego sigState=${String(pc.signalingState || "")} has_local_desc=${!!pc.localDescription} ice=${String(pc.iceConnectionState || "")}`
          );
          try {
            const desc = parseAns();
            await pc.setRemoteDescription(new rtc.RTCSessionDescription(desc));
            console.log(
              `[client-ice] answer setRemoteDescription:ok_renego has_local_desc=${!!pc.localDescription} ice=${String(pc.iceConnectionState || "")}`
            );
            this.hasRemoteDescription = true;
            this.gotAnswerThisCall = true;
            this.markPhase("answer_renego");
            await this.flushPendingIce(pc, rtc);
            this.scheduleRemoteVideoWatch();
            this.repaintRemoteStream("answer_renego");
          } catch (e) {
            // ignore stale answer — but log for diagnosis, was previously silent
            console.log(
              `[client-ice] answer setRemoteDescription:fail_renego err=${e instanceof Error ? e.message : String(e)}`
            );
          }
        }
      }
    } catch (e) {
      if (kind === "offer" || kind === "answer") {
        console.log(
          `[client-ice] ${kind} handleRemoteSignal:fail err=${e instanceof Error ? e.message : String(e)}`
        );
      }
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

  closeCall(
    opts: {
      keepLocal?: boolean;
      sendBye?: boolean;
      /** When true (default if !keepLocal), drop hub pure-relay sticky. */
      clearForceRelay?: boolean;
    } = {}
  ) {
    const { keepLocal = false, sendBye = true } = opts;
    // Mid-match rebuilds use keepLocal=true — MUST NOT wipe hub force_relay sticky.
    // Bug (app_vc=303 2026-08-10): setForceRelay(true) then closeCall(keepLocal)
    // cleared hub_fr → answer policy=all, relay_candidates=0, frames_out=0.
    const clearForceRelay = opts.clearForceRelay ?? !keepLocal;
    this.callGen += 1; // invalidate in-flight createOffer/answer
    this.clearIceRestartProbe();
    this.clearStuckIceWatch();
    this.clearConnectingWatch();
    this.clearRemoteVideoWatch();
    for (const t of this._avPathTimers) {
      try {
        clearTimeout(t);
      } catch {
        /* ignore */
      }
    }
    this._avPathTimers = [];
    this._avPathArmed = false;
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
    this.answeredAsAnswerer = false;
    this.hubWantsOfferer = false;
    this.isOfferer = false;
    this.startCallInFlight = false;
    this.makingOffer = false;
    this.gotRemoteVideo = false;
    this.remoteVideoWaves = 0;
    this._outboundWatchArmed = false;
    this._outboundFramesSeen = false;
    this.pendingRemoteIce = [];
    this.hasRemoteDescription = false;
    this.warmed = false;
    this.warmTurnPrimed = false;
    this.pcUsesRelayPolicy = false;
    this.callStartAt = 0;
    this.matchMarkT0 = 0;
    this.connectT0 = 0;
    this._remoteFramesSeen = false;
    this._lastInboundFrames = 0;
    this.rttEma = 0;
    this.lossEma = 0;
    this.relayPath = false;
    this.qualityTier = this.dataSaver || this.onCellular ? "low" : "mid";
    this.signalChain = Promise.resolve();
    // Clear sticky only on full hangup (clearForceRelay). keepLocal rebuilds
    // must retain hub pure so answer PC is policy=relay (see answer_sent hub_fr=0).
    if (clearForceRelay && !this.hideIp) {
      this.forceRelayOnce = false;
      this.hubForceRelaySticky = false;
    }
    this.lastBindVideoSenders = 0;
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
    // Rewarm: pure if hide_ip OR sticky hub force_relay still latched
    try {
      if (this.hasIceServers() && keepLocal) {
        const pure =
          !!this.hideIp ||
          !!this.hubForceRelaySticky ||
          !!this.forceRelayOnce;
        void this.warmConnection({ preferRelay: pure });
        this.handlers.onConnectionState?.(
          `closeCall_rewarm_async pure=${pure ? 1 : 0} sticky=${this.hubForceRelaySticky ? 1 : 0} fr=${this.forceRelayOnce ? 1 : 0}`
        );
      }
    } catch {
      /* next startCall will create */
    }
  }

  close() {
    this.closeCall({ keepLocal: false, sendBye: true });
  }
}
