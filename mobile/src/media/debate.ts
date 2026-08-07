/**
 * Formal debate — P2P control plane (same messages as web ui/live.js).
 * Channel: MediaSession "ruletka-chat" data channel.
 *
 * Messages: debate_invite | debate_accept | debate_decline | debate_cancel
 *           debate_start | debate_turn | debate_end
 * Inviter (host) speaks first; non-speaker mic is forced mute.
 */

export const DEBATE_TURN_MS = 30_000;
export const DEBATE_TURN_CHOICES_S = [15, 30, 45, 60] as const;
export const DEBATE_INVITE_TTL_MS = 35_000;
export const DEBATE_START_TIMEOUT_MS = 12_000;

export type DebatePending = "out" | "in" | null;

export type DebateSnapshot = {
  active: boolean;
  pending: DebatePending;
  inviteId: string;
  hostId: string;
  partnerId: string;
  speakerId: string;
  turnMs: number;
  topic: string;
  turnIndex: number;
  turnEndsAt: number;
  composeTurnSecs: number;
  /** Local display clock (ms remaining, clamped). */
  remMs: number;
};

export type DebateMsg = Record<string, unknown> & { type?: string };

export function debateUidEq(a: string, b: string): boolean {
  const x = String(a || "")
    .trim()
    .toLowerCase();
  const y = String(b || "")
    .trim()
    .toLowerCase();
  if (!x || !y) return false;
  return x === y;
}

export function normalizeDebateTurnMs(ms: unknown): number {
  const n = Number(ms) || DEBATE_TURN_MS;
  const secs = Math.round(n / 1000);
  if ((DEBATE_TURN_CHOICES_S as readonly number[]).includes(secs)) {
    return secs * 1000;
  }
  return Math.min(120_000, Math.max(10_000, Math.round(n / 1000) * 1000));
}

export function normalizeDebateTopic(raw: unknown): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function debateRoundNumber(turnIndex: number): number {
  const idx = Math.max(0, Number(turnIndex) || 0);
  return Math.floor(idx / 2) + 1;
}

function newInviteId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type DebateCallbacks = {
  send: (msg: DebateMsg) => boolean;
  myUserId: () => string;
  myName: () => string;
  partnerUserId: () => string;
  partnerName: () => string;
  isMatched: () => boolean;
  isDcOpen: () => boolean;
  onStatus: (text: string) => void;
  onMicLock: (lockedMute: boolean) => void;
  onChange: (snap: DebateSnapshot) => void;
  track?: (name: string, props?: Record<string, unknown>) => void;
};

const idleSnap = (): DebateSnapshot => ({
  active: false,
  pending: null,
  inviteId: "",
  hostId: "",
  partnerId: "",
  speakerId: "",
  turnMs: DEBATE_TURN_MS,
  topic: "",
  turnIndex: 0,
  turnEndsAt: 0,
  composeTurnSecs: 30,
  remMs: 0,
});

/**
 * Imperative debate session for the live screen.
 * Call handleMessage on every data-channel JSON; tick() every ~100ms while active.
 */
export class DebateSession {
  private active = false;
  private pending: DebatePending = null;
  private inviteId = "";
  private hostId = "";
  private partnerId = "";
  private speakerId = "";
  private turnMs = DEBATE_TURN_MS;
  private topic = "";
  private turnIndex = 0;
  private turnEndsAt = 0;
  private composeTurnSecs = 30;
  private inviteTimer: ReturnType<typeof setTimeout> | null = null;
  private tickIv: ReturnType<typeof setInterval> | null = null;
  private cb: DebateCallbacks;

  constructor(cb: DebateCallbacks) {
    this.cb = cb;
  }

  setCallbacks(cb: Partial<DebateCallbacks>) {
    this.cb = { ...this.cb, ...cb };
  }

  snapshot(): DebateSnapshot {
    const now = Date.now();
    return {
      active: this.active,
      pending: this.pending,
      inviteId: this.inviteId,
      hostId: this.hostId,
      partnerId: this.partnerId,
      speakerId: this.speakerId,
      turnMs: this.turnMs,
      topic: this.topic,
      turnIndex: this.turnIndex,
      turnEndsAt: this.turnEndsAt,
      composeTurnSecs: this.composeTurnSecs,
      remMs: this.active
        ? Math.max(0, this.turnEndsAt - now)
        : 0,
    };
  }

  private emit() {
    this.cb.onChange(this.snapshot());
    this.applyMic();
  }

  private applyMic() {
    if (!this.active) {
      this.cb.onMicLock(false);
      return;
    }
    const iSpeak = this.iAmSpeaker();
    this.cb.onMicLock(!iSpeak);
  }

  iAmSpeaker(): boolean {
    return debateUidEq(this.speakerId, this.cb.myUserId());
  }

  private clearInviteTimer() {
    if (this.inviteTimer) {
      clearTimeout(this.inviteTimer);
      this.inviteTimer = null;
    }
  }

  private clearTick() {
    if (this.tickIv) {
      clearInterval(this.tickIv);
      this.tickIv = null;
    }
  }

  private clearPending() {
    this.pending = null;
    this.inviteId = "";
    this.clearInviteTimer();
  }

  private send(obj: DebateMsg): boolean {
    const payload: DebateMsg = {
      v: 1,
      ...obj,
      user_id: this.cb.myUserId() || "",
      name: this.cb.myName() || "anon",
      ts: typeof obj.ts === "number" ? obj.ts : Date.now(),
    };
    return this.cb.send(payload);
  }

  private startTick() {
    this.clearTick();
    this.tickIv = setInterval(() => {
      if (!this.active) {
        this.clearTick();
        return;
      }
      if (!this.cb.isMatched()) {
        this.end({ notify: false, silent: true });
        return;
      }
      this.emit();
      const now = Date.now();
      if (now >= this.turnEndsAt) {
        const isHost = debateUidEq(this.hostId, this.cb.myUserId());
        if (isHost) {
          this.advanceTurn({ force: true });
        } else if (now >= this.turnEndsAt + 900) {
          this.advanceTurn({ force: true });
        }
      }
    }, 100);
  }

  canStart(): boolean {
    return !!(
      this.cb.isMatched() &&
      this.cb.partnerUserId() &&
      this.cb.partnerUserId() !== this.cb.myUserId() &&
      !this.active &&
      !this.pending
    );
  }

  /** Open compose or cancel outbound invite / end active debate. */
  inviteOrToggle(): "compose" | "cancelled" | "ended" | "blocked" | "need_p2p" {
    if (this.active) {
      this.end({ notify: true, reason: "user" });
      return "ended";
    }
    if (this.pending === "out") {
      this.send({ type: "debate_cancel", invite_id: this.inviteId });
      this.clearPending();
      this.cb.onStatus("debate.inviteCancelled");
      this.emit();
      return "cancelled";
    }
    if (!this.canStart()) {
      this.cb.onStatus("debate.needLive");
      return "blocked";
    }
    if (!this.cb.isDcOpen()) {
      this.cb.onStatus("debate.needP2p");
      return "need_p2p";
    }
    return "compose";
  }

  sendInviteFromCompose(opts: { turnSecs?: number; topic?: string }): boolean {
    if (!this.canStart()) {
      this.cb.onStatus("debate.needLive");
      return false;
    }
    if (!this.cb.isDcOpen()) {
      this.cb.onStatus("debate.needP2p");
      return false;
    }
    const secs = Number(opts.turnSecs) || this.composeTurnSecs || 30;
    const turnMs = normalizeDebateTurnMs(secs * 1000);
    const topic = normalizeDebateTopic(opts.topic);
    this.composeTurnSecs = Math.round(turnMs / 1000);
    this.turnMs = turnMs;
    this.topic = topic;

    const inviteId = newInviteId();
    this.pending = "out";
    this.inviteId = inviteId;
    this.partnerId = this.cb.partnerUserId();
    this.hostId = this.cb.myUserId() || "";

    const sent = this.send({
      type: "debate_invite",
      invite_id: inviteId,
      turn_ms: turnMs,
      topic,
      from_name: this.cb.myName() || "anon",
    });
    if (!sent) {
      this.clearPending();
      this.cb.onStatus("debate.needP2p");
      this.emit();
      return false;
    }
    this.cb.onStatus("debate.inviteSent");
    this.cb.track?.("debate_invite", {
      turn_s: Math.round(turnMs / 1000),
      has_topic: topic ? 1 : 0,
    });
    this.clearInviteTimer();
    this.inviteTimer = setTimeout(() => {
      if (this.pending === "out" && this.inviteId === inviteId) {
        this.send({ type: "debate_cancel", invite_id: inviteId });
        this.clearPending();
        this.cb.onStatus("debate.inviteExpired");
        this.emit();
      }
    }, DEBATE_INVITE_TTL_MS);
    this.emit();
    return true;
  }

  acceptIncoming(): void {
    if (this.pending !== "in" || !this.inviteId) return;
    const inviteId = this.inviteId;
    this.send({ type: "debate_accept", invite_id: inviteId });
    this.cb.onStatus("debate.acceptedWait");
    this.cb.track?.("debate_accept");
    this.clearInviteTimer();
    this.inviteTimer = setTimeout(() => {
      if (!this.active && this.pending === "in") {
        this.clearPending();
        this.cb.onStatus("debate.startTimeout");
        this.emit();
      }
    }, DEBATE_START_TIMEOUT_MS);
    this.emit();
  }

  declineIncoming(reason?: string): void {
    if (this.pending !== "in") return;
    this.send({
      type: "debate_decline",
      invite_id: this.inviteId,
      ...(reason ? { reason } : {}),
    });
    this.clearPending();
    this.cb.onStatus("debate.youDeclined");
    this.cb.track?.("debate_decline");
    this.emit();
  }

  passTurn(): boolean {
    if (!this.active) {
      this.cb.onStatus("debate.needLive");
      return false;
    }
    const me = String(this.cb.myUserId() || "").trim();
    if (!me) {
      this.cb.onStatus("debate.needId");
      return false;
    }
    if (!this.iAmSpeaker()) {
      this.cb.onStatus("debate.notYourTurn");
      return false;
    }
    this.cb.track?.("debate_pass");
    this.advanceTurn({ yieldTurn: true });
    return true;
  }

  end(opts: { notify?: boolean; reason?: string; silent?: boolean } = {}): void {
    const notify = opts.notify !== false;
    const wasActive = this.active || !!this.pending;
    this.clearTick();
    this.clearInviteTimer();
    if (notify && this.active) {
      this.send({
        type: "debate_end",
        reason: opts.reason || "user",
        invite_id: this.inviteId,
      });
    }
    this.active = false;
    this.pending = null;
    this.speakerId = "";
    this.hostId = "";
    this.partnerId = "";
    this.inviteId = "";
    this.turnEndsAt = 0;
    this.turnIndex = 0;
    this.topic = "";
    this.cb.onMicLock(false);
    if (wasActive && !opts.silent) {
      this.cb.onStatus("debate.ended");
      this.cb.track?.("debate_end", { reason: opts.reason || "user" });
    }
    this.emit();
  }

  /** Reset when call ends (next/stop/matched teardown). */
  reset(): void {
    this.end({ notify: false, silent: true });
  }

  handleMessage(msg: DebateMsg): void {
    if (!msg || !msg.type) return;
    const type = String(msg.type);
    if (!type.startsWith("debate_")) return;
    const fromUid = String(msg.user_id || "").slice(0, 64);

    switch (type) {
      case "debate_invite":
        this.handleInviteIncoming(msg, fromUid);
        break;
      case "debate_accept":
        this.handleAccept(msg, fromUid);
        break;
      case "debate_decline":
        this.handleDecline(msg);
        break;
      case "debate_cancel":
        if (this.pending === "in" && msg.invite_id === this.inviteId) {
          this.clearPending();
          this.cb.onStatus("debate.inviteCancelled");
          this.emit();
        }
        break;
      case "debate_start":
        this.applyStart(msg);
        break;
      case "debate_turn":
        this.applyTurn(msg);
        break;
      case "debate_end":
        if (this.active || this.pending) {
          this.end({
            notify: false,
            reason: String(msg.reason || "peer"),
            silent: false,
          });
        }
        break;
      default:
        break;
    }
  }

  private handleInviteIncoming(msg: DebateMsg, fromUid: string): void {
    if (this.active || this.pending) {
      this.send({
        type: "debate_decline",
        invite_id: msg.invite_id,
        reason: "busy",
      });
      return;
    }
    // Must be in a call. partnerUserId can lag a tick after Matched — allow
    // invite with fromUid only so Play↔web debate is not dropped silently.
    if (!this.cb.isMatched()) return;
    const partner = this.cb.partnerUserId() || "";
    if (
      fromUid &&
      partner &&
      !debateUidEq(fromUid, partner)
    ) {
      return;
    }
    this.pending = "in";
    this.inviteId = String(msg.invite_id || "");
    this.partnerId = fromUid || partner;
    this.hostId = fromUid || partner;
    this.turnMs = normalizeDebateTurnMs(msg.turn_ms || DEBATE_TURN_MS);
    this.topic = normalizeDebateTopic(msg.topic);
    this.cb.onStatus("debate.incomingStatus");
    this.clearInviteTimer();
    this.inviteTimer = setTimeout(() => {
      if (this.pending === "in") {
        this.send({
          type: "debate_decline",
          invite_id: this.inviteId,
          reason: "timeout",
        });
        this.clearPending();
        this.emit();
      }
    }, DEBATE_INVITE_TTL_MS);
    this.emit();
  }

  private handleAccept(msg: DebateMsg, fromUid: string): void {
    if (this.pending !== "out") return;
    if (
      msg.invite_id &&
      this.inviteId &&
      msg.invite_id !== this.inviteId
    ) {
      return;
    }
    const turnMs = normalizeDebateTurnMs(this.turnMs || DEBATE_TURN_MS);
    const topic = normalizeDebateTopic(this.topic);
    const now = Date.now();
    const firstSpeaker = this.cb.myUserId() || "";
    const turnEndsAt = now + turnMs;
    const startMsg: DebateMsg = {
      type: "debate_start",
      invite_id: this.inviteId,
      host_id: this.cb.myUserId() || "",
      first_speaker_id: firstSpeaker,
      partner_id: fromUid || this.cb.partnerUserId(),
      turn_ms: turnMs,
      topic,
      turn_index: 0,
      turn_ends_at: turnEndsAt,
      started_at: now,
    };
    this.send(startMsg);
    this.applyStart(startMsg);
    this.cb.track?.("debate_start", {
      host: 1,
      turn_s: Math.round(turnMs / 1000),
      has_topic: topic ? 1 : 0,
    });
  }

  private handleDecline(msg: DebateMsg): void {
    if (this.pending !== "out") return;
    if (
      msg.invite_id &&
      this.inviteId &&
      msg.invite_id !== this.inviteId
    ) {
      return;
    }
    this.clearPending();
    this.cb.onStatus("debate.theyDeclined");
    this.cb.track?.("debate_declined");
    this.emit();
  }

  private applyStart(msg: DebateMsg): void {
    this.clearPending();
    const turnMs = normalizeDebateTurnMs(
      msg.turn_ms || this.turnMs || DEBATE_TURN_MS
    );
    const topic = normalizeDebateTopic(
      msg.topic != null ? msg.topic : this.topic
    );
    const first =
      String(msg.first_speaker_id || msg.host_id || "").slice(0, 64) ||
      this.cb.partnerUserId();
    const partner =
      String(msg.partner_id || "").slice(0, 64) ||
      (first === this.cb.myUserId()
        ? this.cb.partnerUserId()
        : first);
    this.active = true;
    this.pending = null;
    this.hostId = String(msg.host_id || first).slice(0, 64);
    this.partnerId = partner || this.cb.partnerUserId();
    this.speakerId = first;
    this.inviteId = String(msg.invite_id || this.inviteId || "");
    this.turnMs = turnMs;
    this.topic = topic;
    this.turnIndex = Number(msg.turn_index) || 0;
    this.turnEndsAt = Number(msg.turn_ends_at) || Date.now() + turnMs;
    this.startTick();
    this.emit();
    const iSpeak = this.iAmSpeaker();
    this.cb.onStatus(iSpeak ? "debate.yourTurnRound" : "debate.theirTurnRound");
  }

  private applyTurn(msg: DebateMsg): void {
    if (!this.active) return;
    const speaker = String(msg.speaker_id || "").slice(0, 64);
    if (!speaker) return;
    const idx = Number(msg.turn_index);
    if (Number.isFinite(idx) && idx < this.turnIndex) return;
    this.speakerId = speaker;
    this.turnIndex = Number.isFinite(idx) ? idx : this.turnIndex + 1;
    this.turnEndsAt =
      Number(msg.turn_ends_at) || Date.now() + (this.turnMs || DEBATE_TURN_MS);
    if (msg.turn_ms) {
      this.turnMs = normalizeDebateTurnMs(msg.turn_ms);
    }
    this.emit();
    const iSpeak = this.iAmSpeaker();
    this.cb.onStatus(iSpeak ? "debate.yourTurnRound" : "debate.theirTurnRound");
  }

  private otherSpeaker(): string {
    if (this.iAmSpeaker()) {
      return (
        String(this.partnerId || this.cb.partnerUserId() || "").trim() ||
        this.cb.myUserId()
      );
    }
    return String(this.cb.myUserId() || "").trim();
  }

  private advanceTurn(opts: { force?: boolean; yieldTurn?: boolean } = {}): void {
    if (!this.active) return;
    const now = Date.now();
    if (!opts.force && !opts.yieldTurn && now < this.turnEndsAt - 40) return;
    const isHost = debateUidEq(this.hostId, this.cb.myUserId());
    const iAmSpeaker = this.iAmSpeaker();
    if (!isHost && !(opts.yieldTurn && iAmSpeaker)) {
      if (!opts.force || now < this.turnEndsAt + 900) return;
    }
    const nextSpeaker = this.otherSpeaker();
    if (!nextSpeaker) {
      this.cb.onStatus("debate.noPartner");
      return;
    }
    const turnMs = this.turnMs || DEBATE_TURN_MS;
    const turnEndsAt = now + turnMs;
    const turnIndex = (this.turnIndex || 0) + 1;
    this.speakerId = nextSpeaker;
    this.turnIndex = turnIndex;
    this.turnEndsAt = turnEndsAt;
    if (isHost || (opts.yieldTurn && iAmSpeaker)) {
      this.send({
        type: "debate_turn",
        speaker_id: nextSpeaker,
        turn_index: turnIndex,
        turn_ends_at: turnEndsAt,
        turn_ms: turnMs,
        round: debateRoundNumber(turnIndex),
        invite_id: this.inviteId,
      });
    }
    this.emit();
    const iSpeak = this.iAmSpeaker();
    this.cb.onStatus(iSpeak ? "debate.yourTurnRound" : "debate.theirTurnRound");
  }
}

export function formatDebateTimer(remMs: number): string {
  const secs = Math.ceil(Math.max(0, remMs) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0
    ? `${m}:${String(s).padStart(2, "0")}`
    : `0:${String(s).padStart(2, "0")}`;
}

export { idleSnap as idleDebateSnapshot };
