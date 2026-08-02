/**
 * MediaSession — Phase 0 stub.
 *
 * Full implementation will use `react-native-webrtc` (RTCPeerConnection,
 * mediaDevices.getUserMedia) after `npx expo prebuild` + native link.
 *
 * Until native modules are linked, UI can still exercise HubClient match flow;
 * A/V attach is a no-op with a clear error.
 */

import type { IceConfig } from "../hub/types";

export type MediaHandlers = {
  onLocalStream?: (stream: unknown) => void;
  onRemoteStream?: (stream: unknown) => void;
  onIceCandidate?: (json: string) => void;
  onConnectionState?: (state: string) => void;
  onError?: (err: Error) => void;
};

export class MediaSession {
  private handlers: MediaHandlers = {};
  private ice: IceConfig | null = null;
  private hideIp = false;

  setHandlers(h: MediaHandlers) {
    this.handlers = h;
  }

  setIceConfig(cfg: IceConfig) {
    this.ice = cfg;
  }

  setHideIp(on: boolean) {
    this.hideIp = on;
  }

  /** True once react-native-webrtc is available in the runtime. */
  static webrtcAvailable(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const w = require("react-native-webrtc");
      return !!(w && w.RTCPeerConnection && w.mediaDevices);
    } catch {
      return false;
    }
  }

  async startLocalPreview(): Promise<void> {
    if (!MediaSession.webrtcAvailable()) {
      this.handlers.onError?.(
        new Error(
          "WebRTC native module not linked. Run: npx expo prebuild && npx expo run:android|ios"
        )
      );
      return;
    }
    // Implementation lands in Phase 0 exit criterion (device build).
    this.handlers.onError?.(
      new Error("MediaSession.startLocalPreview: wire getUserMedia in Phase 0 device build")
    );
  }

  async handleRemoteOffer(_sdp: string): Promise<void> {
    this.handlers.onError?.(new Error("MediaSession not fully wired yet"));
  }

  async handleRemoteAnswer(_sdp: string): Promise<void> {
    /* Phase 0 */
  }

  async addRemoteIce(_json: string): Promise<void> {
    /* Phase 0 */
  }

  async createOffer(): Promise<string | null> {
    return null;
  }

  close(): void {
    /* release PC + tracks in full impl */
  }

  get hideIpEnabled(): boolean {
    return this.hideIp;
  }

  get hasTurn(): boolean {
    return !!this.ice?.has_turn;
  }
}
