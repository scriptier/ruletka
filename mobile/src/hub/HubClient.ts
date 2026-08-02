import { configUrl, hubBase, wsUrl } from "../config";
import type { ClientMsg, IceConfig, ServerMsg } from "./types";

export type HubClientHandlers = {
  onOpen?: () => void;
  onClose?: (ev: { code: number; reason: string }) => void;
  onError?: (err: unknown) => void;
  onMessage?: (msg: ServerMsg) => void;
};

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
    this.handlers = { ...this.handlers, ...h };
  }

  get connected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  get hubBaseUrl(): string {
    return this.base;
  }

  async fetchIceConfig(): Promise<IceConfig> {
    const res = await fetch(configUrl(this.base));
    if (!res.ok) throw new Error(`config.json HTTP ${res.status}`);
    return (await res.json()) as IceConfig;
  }

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
    const ws = new WebSocket(wsUrl(this.base));
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
    ws.onerror = (err) => this.handlers.onError?.(err);
    ws.onmessage = (ev) => {
      try {
        this.handlers.onMessage?.(JSON.parse(String(ev.data)) as ServerMsg);
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

  trySend(msg: ClientMsg): boolean {
    try {
      this.send(msg);
      return true;
    } catch {
      return false;
    }
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
  chat(body: string): void {
    this.send({ type: "chat", body });
  }
  blockUser(user_id: string): void {
    this.send({ type: "block_user", user_id });
  }
  reportUser(user_id: string, reason = "other"): void {
    this.send({ type: "report_user", user_id, reason });
  }
  addFriend(code: string): void {
    this.send({ type: "add_friend", code: code.trim().toUpperCase() });
  }
  acceptFriend(user_id: string): void {
    this.send({ type: "accept_friend", user_id });
  }
  declineFriend(user_id: string): void {
    this.send({ type: "decline_friend", user_id });
  }
  removeFriend(user_id: string): void {
    this.send({ type: "remove_friend", user_id });
  }
  callFriend(user_id: string): void {
    this.send({ type: "call_friend", user_id });
  }
  callRespond(user_id: string, accept: boolean): void {
    this.send({ type: "call_respond", user_id, accept });
  }
  callCancel(user_id: string): void {
    this.send({ type: "call_cancel", user_id });
  }
  hangupFriend(): void {
    this.send({ type: "hangup_friend" });
  }

  ratePartner(user_id: string, star: boolean, amount = 1): void {
    this.send({
      type: "rate_partner",
      user_id,
      star,
      amount: star ? Math.max(1, Math.min(3, amount)) : 0,
    });
  }

  spendStars(to_user_id: string, effect: string, op_id?: string): void {
    this.send({
      type: "spend_stars",
      to_user_id,
      effect,
      op_id:
        op_id ||
        `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });
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
