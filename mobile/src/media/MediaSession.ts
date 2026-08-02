/**
 * WebRTC media session for react-native-webrtc.
 * Signal kinds match web: offer | answer | ice | bye (JSON string payloads).
 *
 * Requires a native build (`npx expo prebuild` + run:android|ios).
 * In pure JS Expo Go, webrtcAvailable() is false and methods no-op with errors.
 */

import type { IceConfig, RTCIceServer } from "../hub/types";

export type MediaHandlers = {
  onLocalStream?: (stream: MediaStreamLike) => void;
  onRemoteStream?: (stream: MediaStreamLike) => void;
  onSignal?: (kind: "offer" | "answer" | "ice" | "bye", payload: string) => void;
  onConnectionState?: (state: string) => void;
  onIceConnectionState?: (state: string) => void;
  onError?: (err: Error) => void;
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
  addTrack: (track: unknown, stream: MediaStreamLike) => void;
  addIceCandidate: (c: object) => Promise<void>;
  createOffer: (opts?: object) => Promise<object>;
  createAnswer: () => Promise<object>;
  setLocalDescription: (d: object) => Promise<void>;
  setRemoteDescription: (d: object) => Promise<void>;
  close: () => void;
  restartIce?: () => void;
  onicecandidate: ((ev: { candidate: object | null }) => void) | null;
  ontrack: ((ev: { streams: MediaStreamLike[]; track: unknown }) => void) | null;
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

export class MediaSession {
  private handlers: MediaHandlers = {};
  private ice: IceConfig | null = null;
  private hideIp = false;
  private pc: RTCPeerConnectionLike | null = null;
  private localStream: MediaStreamLike | null = null;
  private remoteStream: MediaStreamLike | null = null;
  private isOfferer = false;
  private makingOffer = false;
  private rtc: WebrtcMod | null = null;
  private iceRestartCount = 0;
  private discIceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.rtc = loadWebrtc();
  }

  setHandlers(h: MediaHandlers) {
    this.handlers = h;
  }

  setIceConfig(cfg: IceConfig) {
    this.ice = cfg;
  }

  setHideIp(on: boolean) {
    this.hideIp = on;
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

  async ensureLocalStream(): Promise<MediaStreamLike | null> {
    if (this.localStream) return this.localStream;
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
    try {
      const stream = await rtc.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      this.localStream = stream;
      this.handlers.onLocalStream?.(stream);
      return stream;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.handlers.onError?.(err);
      return null;
    }
  }

  private pcConfig(): object {
    const raw = this.ice?.ice_servers;
    const mode = this.hideIp ? "turn" : "all";
    let servers = filterIce(raw, mode);
    let iceTransportPolicy: "all" | "relay" = "all";
    if (this.hideIp) {
      if (servers.length && this.ice?.has_turn !== false) {
        iceTransportPolicy = "relay";
      } else {
        servers = filterIce(raw, "all");
        iceTransportPolicy = "all";
      }
    }
    return {
      iceServers: servers,
      iceCandidatePoolSize: 8,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceTransportPolicy,
    };
  }

  private ensurePc(): RTCPeerConnectionLike | null {
    if (this.pc) return this.pc;
    const rtc = this.rtc || loadWebrtc();
    this.rtc = rtc;
    if (!rtc) {
      this.handlers.onError?.(new Error("WebRTC not linked"));
      return null;
    }
    const pc = new rtc.RTCPeerConnection(this.pcConfig());
    this.pc = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        try {
          this.handlers.onSignal?.(
            "ice",
            JSON.stringify(ev.candidate)
          );
        } catch {
          /* ignore */
        }
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams?.[0];
      if (stream) {
        this.remoteStream = stream;
        this.handlers.onRemoteStream?.(stream);
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
    };
    pc.oniceconnectionstatechange = () => {
      this.handlers.onIceConnectionState?.(pc.iceConnectionState);
      if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed"
      ) {
        this.scheduleIceRestartProbe();
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

    return pc;
  }

  /**
   * Start a call after matched. Offerer creates the offer.
   */
  async startCall(opts: { isOfferer: boolean }): Promise<void> {
    this.isOfferer = !!opts.isOfferer;
    const local = await this.ensureLocalStream();
    if (!local) return;
    const pc = this.ensurePc();
    if (!pc) return;

    if (this.isOfferer) {
      await this.createAndSendOffer();
    }
  }

  private async createAndSendOffer(iceRestart = false): Promise<void> {
    const pc = this.ensurePc();
    const rtc = this.rtc;
    if (!pc || !rtc) return;
    if (this.makingOffer) return;
    this.makingOffer = true;
    try {
      const offer = await pc.createOffer(
        iceRestart ? { iceRestart: true } : {}
      );
      await pc.setLocalDescription(offer);
      const desc = pc.localDescription;
      if (desc) {
        this.handlers.onSignal?.(
          "offer",
          JSON.stringify({ type: desc.type, sdp: desc.sdp })
        );
      }
    } catch (e) {
      this.handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
    } finally {
      this.makingOffer = false;
    }
  }

  private scheduleIceRestartProbe() {
    if (this.discIceTimer) return;
    this.discIceTimer = setTimeout(() => {
      this.discIceTimer = null;
      const pc = this.pc;
      if (!pc) return;
      const ice = pc.iceConnectionState;
      const cs = pc.connectionState;
      if (
        ice === "disconnected" ||
        ice === "failed" ||
        cs === "disconnected" ||
        cs === "failed"
      ) {
        void this.tryIceRestart();
      }
    }, 4000);
  }

  private clearIceRestartProbe() {
    if (this.discIceTimer) {
      clearTimeout(this.discIceTimer);
      this.discIceTimer = null;
    }
  }

  /** Soft ICE restart (mirrors web webrtc.js). Offerer sends new offer. */
  async tryIceRestart(): Promise<boolean> {
    if (this.iceRestartCount >= 3) return false;
    const pc = this.pc;
    if (!pc) return false;
    this.iceRestartCount += 1;
    try {
      if (this.isOfferer) {
        await this.createAndSendOffer(true);
        return true;
      }
      if (typeof pc.restartIce === "function") {
        pc.restartIce();
        return true;
      }
    } catch (e) {
      this.handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
    return false;
  }

  async handleRemoteSignal(kind: string, payload: string): Promise<void> {
    const rtc = this.rtc || loadWebrtc();
    this.rtc = rtc;
    if (!rtc) return;

    if (kind === "bye") {
      this.closeCall({ keepLocal: true, sendBye: false });
      return;
    }

    await this.ensureLocalStream();
    const pc = this.ensurePc();
    if (!pc) return;

    try {
      if (kind === "offer") {
        const desc = JSON.parse(payload);
        await pc.setRemoteDescription(new rtc.RTCSessionDescription(desc));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const local = pc.localDescription;
        if (local) {
          this.handlers.onSignal?.(
            "answer",
            JSON.stringify({ type: local.type, sdp: local.sdp })
          );
        }
      } else if (kind === "answer") {
        if (!pc.currentRemoteDescription) {
          const desc = JSON.parse(payload);
          await pc.setRemoteDescription(new rtc.RTCSessionDescription(desc));
        }
      } else if (kind === "ice") {
        try {
          const c = JSON.parse(payload);
          await pc.addIceCandidate(new rtc.RTCIceCandidate(c));
        } catch (e) {
          console.warn("[media] ice", e);
        }
      }
    } catch (e) {
      this.handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
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
    this.clearIceRestartProbe();
    this.iceRestartCount = 0;
    if (sendBye) {
      try {
        this.handlers.onSignal?.("bye", "{}");
      } catch {
        /* ignore */
      }
    }
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.remoteStream = null;
    if (!keepLocal) {
      try {
        this.localStream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      this.localStream = null;
    }
  }

  close() {
    this.closeCall({ keepLocal: false, sendBye: true });
  }
}
