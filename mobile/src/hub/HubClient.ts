import { configUrl, hubBase, wsUrl } from "../config";
import type { ClientMsg, IceConfig, ServerMsg } from "./types";

export type HubClientHandlers = {
  onOpen?: () => void;
  onClose?: (ev: { code: number; reason: string }) => void;
  onError?: (err: unknown) => void;
  onMessage?: (msg: ServerMsg) => void;
};

/**
 * Thin WebSocket client for roulette-bridge.
 */
export class HubClient {
  private ws: WebSocket | null = null;
  private handlers: HubClientHandlers = {};
  private base: string;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private reconnectAttempt = 0;
  private intentionalClose = false;

  constructor(base = hubBase()) {
    this.base = base.replace(/\/$/, "");
  }

  setHandlers(h: HubClientHandlers) {
    this.handlers = h;
  }

  get connected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  async fetchIceConfig(): Promise<IceConfig> {
    const res = await fetch(configUrl(this.base));
    if (!res.ok) throw new Error(`config.json HTTP ${res.status}`);
    return (await res.json()) as IceConfig;
  }

  /** Connect and keep trying if the socket drops (until disconnect()). */
  connect(opts: { autoReconnect?: boolean } = {}): void {
    this.shouldReconnect = opts.autoReconnect !== false;
    this.intentionalClose = false;
    this.openSocket();
  }

  private openSocket(): void {
    this.clearReconnect();
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    const url = wsUrl(this.base);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.startPing();
      this.handlers.onOpen?.();
    };
    ws.onclose = (ev) => {
      this.stopPing();
      this.handlers.onClose?.({
        code: ev.code,
        reason: String(ev.reason || ""),
      });
      this.ws = null;
      if (this.shouldReconnect && !this.intentionalClose) {
        this.scheduleReconnect();
      }
    };
    ws.onerror = (err) => {
      this.handlers.onError?.(err);
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as ServerMsg;
        this.handlers.onMessage?.(data);
      } catch (e) {
        this.handlers.onError?.(e);
      }
    };
  }

  private scheduleReconnect() {
    this.clearReconnect();
    const delay = Math.min(15000, 800 * Math.pow(1.6, this.reconnectAttempt++));
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect && !this.intentionalClose) this.openSocket();
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.shouldReconnect = false;
    this.clearReconnect();
    this.stopPing();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  send(msg: ClientMsg): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("HubClient: not connected");
    }
    this.ws.send(JSON.stringify(msg));
  }

  hello(opts: {
    user_id: string;
    name: string;
    gender?: string;
    looking?: string;
  }): void {
    this.send({
      type: "hello",
      user_id: opts.user_id,
      name: opts.name || "anon",
      gender: opts.gender || "",
      looking: opts.looking || "any",
      flag: "",
      avatar: "",
      tags: [],
    });
  }

  setPrefs(opts: { gender?: string; looking?: string }): void {
    this.send({
      type: "set_prefs",
      gender: opts.gender || "",
      looking: opts.looking || "any",
      flag: "",
      avatar: "",
      tags: [],
    });
  }

  spin(room = ""): void {
    this.send({ type: "spin", room });
  }

  next(room = ""): void {
    this.send({ type: "next", room });
  }

  stop(): void {
    this.send({ type: "stop" });
  }

  signal(kind: string, payload: string, to = ""): void {
    this.send({ type: "signal", kind, payload, to });
  }

  blockUser(user_id: string): void {
    this.send({ type: "block_user", user_id });
  }

  reportUser(user_id: string, reason = "other"): void {
    this.send({ type: "report_user", user_id, reason });
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      try {
        if (this.connected) this.send({ type: "ping" });
      } catch {
        /* ignore */
      }
    }, 20000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
