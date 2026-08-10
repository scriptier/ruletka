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
  /** Short-lived /config.json cache so match path never blocks on HTTP. */
  private iceCache: { at: number; cfg: IceConfig } | null = null;
  private iceInflight: Promise<IceConfig> | null = null;

  constructor(base = hubBase()) {
    this.base = base.replace(/\/$/, "");
  }

  setBase(base: string) {
    this.base = String(base || "").replace(/\/$/, "") || hubBase();
    this.iceCache = null;
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

  /**
   * Fetch ICE/TURN. Cached ~5 min (ephemeral TURN is ~6h).
   * Fresh match often hits cache → zero RTT before startCall.
   */
  async fetchIceConfig(opts?: { force?: boolean }): Promise<IceConfig> {
    const force = !!opts?.force;
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;
    const softAge = 90 * 1000;
    if (!force && this.iceCache && now - this.iceCache.at < maxAge) {
      // Background refresh when aging (don't block caller)
      if (now - this.iceCache.at > softAge && !this.iceInflight) {
        void this.refreshIceConfig().catch(() => {});
      }
      return this.iceCache.cfg;
    }
    return this.refreshIceConfig();
  }

  private async refreshIceConfig(): Promise<IceConfig> {
    if (this.iceInflight) return this.iceInflight;
    this.iceInflight = (async () => {
      // Bound the request — a hung /config.json must never block startCall
      // forever (matched → no offer). Callers fall back to STUN / cached ICE.
      const ac =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ac ? setTimeout(() => ac.abort(), 4000) : null;
      try {
        const res = await fetch(configUrl(this.base), {
          signal: ac?.signal,
        });
        if (!res.ok) throw new Error(`config.json HTTP ${res.status}`);
        const cfg = (await res.json()) as IceConfig;
        this.iceCache = { at: Date.now(), cfg };
        return cfg;
      } finally {
        if (timer) clearTimeout(timer);
        this.iceInflight = null;
      }
    })();
    return this.iceInflight;
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
    flag?: string;
    hide_ip?: boolean;
  }): void {
    this.send({
      type: "hello",
      user_id: opts.user_id,
      name: opts.name || "anon",
      gender: opts.gender || "",
      looking: opts.looking || "any",
      flag: opts.hide_ip ? String(opts.flag || "").toUpperCase().slice(0, 2) : "",
      avatar: "",
      tags: [],
      platform: "android",
      hide_ip: !!opts.hide_ip,
    });
  }

  setPrefs(opts: {
    gender?: string;
    looking?: string;
    flag?: string;
    hide_ip?: boolean;
  }): void {
    this.send({
      type: "set_prefs",
      gender: opts.gender || "",
      looking: opts.looking || "any",
      flag: opts.hide_ip ? String(opts.flag || "").toUpperCase().slice(0, 2) : "",
      avatar: "",
      tags: [],
      hide_ip: !!opts.hide_ip,
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
  unblockUser(user_id: string): void {
    this.send({ type: "unblock_user", user_id });
  }
  reportUser(
    user_id: string,
    reason = "other",
    screenshotJpegB64?: string
  ): void {
    const msg: {
      type: "report_user";
      user_id: string;
      reason: string;
      screenshot_jpeg_b64?: string;
    } = { type: "report_user", user_id, reason };
    // Cap ~90KB decoded; keep WS frames reasonable
    if (screenshotJpegB64 && screenshotJpegB64.length > 0) {
      const capped =
        screenshotJpegB64.length > 120_000
          ? screenshotJpegB64.slice(0, 120_000)
          : screenshotJpegB64;
      msg.screenshot_jpeg_b64 = capped;
    }
    this.send(msg);
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
  /** Private 1:1 ring, or join=true to invite into current live 1v1 as 3rd. */
  callFriend(user_id: string, opts?: { join?: boolean }): void {
    this.send({
      type: "call_friend",
      user_id,
      join: !!opts?.join,
    });
  }
  /** Friend call → form party of 2 and hunt a stranger together. */
  browseTogether(room = ""): void {
    this.send({ type: "browse_together", room });
  }
  /** Stranger (or friend) 1v1 → invite partner to find a 3rd. */
  findThirdInvite(): void {
    this.send({ type: "find_third_invite" });
  }
  findThirdRespond(accept: boolean): void {
    this.send({ type: "find_third_respond", accept: !!accept });
  }
  findThirdCancel(): void {
    this.send({ type: "find_third_cancel" });
  }
  /** DM a mutual friend (stored if offline). */
  friendChat(to_user_id: string, body: string): void {
    this.send({
      type: "friend_chat",
      to_user_id,
      body: String(body || "").trim().slice(0, 2000),
    });
  }
  /** Load last N stored DMs with a friend. */
  friendChatHistory(with_user_id: string): void {
    this.send({ type: "friend_chat_history", with_user_id });
  }
  callRespond(user_id: string, accept: boolean): void {
    this.send({ type: "call_respond", user_id, accept });
  }
  callCancel(user_id: string): void {
    this.send({ type: "call_cancel", user_id });
  }
  /** Register device token for offline friend-call rings (hub stores; delivery via push webhook / FCM later). */
  registerPush(token: string, platform = "expo", clear = false): void {
    this.send({
      type: "register_push",
      token: clear ? "" : token,
      platform,
      clear,
    });
  }
  hangupFriend(): void {
    this.send({ type: "hangup_friend" });
  }

  /**
   * Post-chat rate. star=true gifts 1–3★; star=false + thanks=true is vouch (no mint);
   * bare skip is star=false, thanks=false.
   */
  ratePartner(
    user_id: string,
    star: boolean,
    amount = 1,
    opts?: { thanks?: boolean }
  ): void {
    this.send({
      type: "rate_partner",
      user_id,
      star: !!star,
      amount: star ? Math.max(1, Math.min(3, amount)) : 0,
      thanks: !star && !!opts?.thanks,
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
