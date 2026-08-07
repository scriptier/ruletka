/**
 * Pure helpers for Live connection chip / retry visibility.
 * Kept free of React so we can unit-test later without mounting Live.
 */

export type ConnPhase = "idle" | "search" | "matched" | "error";

export function computeConnSlow(opts: {
  phase: string;
  conn: string;
  awaitingRemoteVideo: boolean;
  hasRemoteVideo: boolean;
  connSince: number;
  now: number;
  slowMs?: number;
}): boolean {
  const {
    phase,
    conn,
    awaitingRemoteVideo,
    hasRemoteVideo,
    connSince,
    now,
    // First path often 3–8s — don't label "slow" during normal ICE
    slowMs = 7000,
  } = opts;
  if (phase !== "matched") return false;
  if (connSince <= 0) return false;
  if (now - connSince <= slowMs) return false;
  // Healthy checking is normal — only flag real failure or long wait for video
  if (conn === "checking" || conn === "connecting") {
    return (
      (awaitingRemoteVideo && !hasRemoteVideo && now - connSince > slowMs) ||
      false
    );
  }
  return (
    conn === "failed" ||
    conn === "disconnected" ||
    (awaitingRemoteVideo && !hasRemoteVideo)
  );
}

export function computeShowConnRetry(opts: {
  phase: string;
  conn: string;
  connSlow: boolean;
  awaitingRemoteVideo: boolean;
  hasRemoteVideo: boolean;
  matchStartedAt: number;
  now: number;
  softMs?: number;
}): boolean {
  const {
    phase,
    conn,
    connSlow,
    awaitingRemoteVideo,
    hasRemoteVideo,
    matchStartedAt,
    now,
    softMs = 7000,
  } = opts;
  if (phase !== "matched") return false;
  if (conn === "failed" || conn === "disconnected") return true;
  if (connSlow && (conn === "failed" || conn === "disconnected")) return true;
  if (
    awaitingRemoteVideo &&
    !hasRemoteVideo &&
    matchStartedAt > 0 &&
    now - matchStartedAt > softMs
  ) {
    return true;
  }
  return false;
}

export function computeShowHardRetry(opts: {
  phase: string;
  conn: string;
  connSlow: boolean;
  linkTier: string;
  awaitingRemoteVideo: boolean;
  hasRemoteVideo: boolean;
  matchStartedAt: number;
  now: number;
  hardMs?: number;
}): boolean {
  const {
    phase,
    conn,
    connSlow,
    linkTier,
    awaitingRemoteVideo,
    hasRemoteVideo,
    matchStartedAt,
    now,
    // Tapping Rebuild does closeCall+startCall (a genuine fresh offer). Never
    // surface it before MediaSession's 15s no-duplicate-offer grace or it
    // re-offers the same peer mid-match (hub thrash / double-offer black cams).
    hardMs = 15000,
  } = opts;
  if (phase !== "matched") return false;
  if (matchStartedAt > 0 && now - matchStartedAt < hardMs) return false;
  if (conn === "failed" || conn === "disconnected") return true;
  // Don't push Rebuild for "weak" early — often TURN warmup, not a dead path
  if (linkTier === "bad" && matchStartedAt > 0 && now - matchStartedAt > hardMs) {
    return true;
  }
  if (
    awaitingRemoteVideo &&
    !hasRemoteVideo &&
    matchStartedAt > 0 &&
    now - matchStartedAt > hardMs
  ) {
    return true;
  }
  return false;
}

/** i18n key for connection label (caller resolves with t()). */
export function connLabelKey(
  conn: string,
  connSlow: boolean
): string {
  if (conn === "connected") return "mobile.live.connOk";
  if (conn === "connecting" || conn === "checking") {
    return connSlow ? "mobile.live.connStill" : "mobile.live.connConnecting";
  }
  if (conn === "failed") return "mobile.live.connFailed";
  if (conn === "disconnected") return "mobile.live.connWeak";
  return "";
}

/**
 * Auto recovery when no remote video.
 * Soft ~16s (relay arm), hard ~20s (TURN rebuild), tip ~27s.
 * "hard" does closeCall+startCall — a genuine fresh offer, not a restart — so
 * it must clear MediaSession's 15s no-duplicate-offer grace (tryIceRestart /
 * createAndSendOffer) or it re-offers the same peer mid-match (hub thrash).
 */
export type AutoRetryAction = "soft" | "hard" | "tip" | null;

export function nextAutoRetryAction(
  autoCount: number,
  elapsedMs: number
): AutoRetryAction {
  if (elapsedMs >= 16_000 && elapsedMs < 19_000 && autoCount < 1) return "soft";
  if (elapsedMs >= 20_000 && elapsedMs < 24_000 && autoCount < 2) return "hard";
  if (elapsedMs >= 27_000 && elapsedMs < 31_000 && autoCount < 3) return "tip";
  return null;
}
