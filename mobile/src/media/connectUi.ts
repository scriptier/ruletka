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
    // First path often 3–8s — flag "slow" after 5s of no picture
    slowMs = 5000,
  } = opts;
  if (phase !== "matched") return false;
  if (connSince <= 0) return false;
  if (now - connSince <= slowMs) return false;
  // Healthy checking is normal — only flag real failure or long wait for video
  if (conn === "checking" || conn === "connecting") {
    return !hasRemoteVideo || awaitingRemoteVideo;
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
    // Surface Retry sooner so stuck first-paths aren't a long black wait
    softMs = 4000,
  } = opts;
  if (phase !== "matched") return false;
  if (conn === "failed" || conn === "disconnected") return true;
  if (connSlow && (conn === "failed" || conn === "disconnected")) return true;
  if (hasRemoteVideo && !awaitingRemoteVideo) return false;
  if (matchStartedAt > 0 && now - matchStartedAt > softMs) {
    if (awaitingRemoteVideo && !hasRemoteVideo) return true;
    if (conn === "connecting" || conn === "checking") return true;
  }
  return false;
}

/**
 * Progressive connect copy by match age (seconds).
 * 0–2: Linking · 3–7: Finding path · 8+: Trying relay
 */
export type ConnectProgressBand = "linking" | "finding" | "relay";

export function connectProgressBand(elapsedSecs: number): ConnectProgressBand {
  if (elapsedSecs >= 8) return "relay";
  if (elapsedSecs >= 3) return "finding";
  return "linking";
}

/** i18n key for progressive stage / pill status while not fully video-up. */
export function connectProgressLabelKey(elapsedSecs: number): string {
  const band = connectProgressBand(elapsedSecs);
  if (band === "relay") return "mobile.live.stageTryingRelay";
  if (band === "finding") return "mobile.live.stageFindingPath";
  return "mobile.live.stageConnecting";
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
    // Rebuild = fresh offer. Align with auto hard (~15s) / iceRestart grace.
    hardMs = 14000,
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
 * Auto recovery when partner picture is black (no frames).
 * Soft ICE only — hard rebuild as offerer after a healthy answer is thrash
 * (hub: android offer@17–24s after web offer+answer → worse black).
 * "hard" action = aggressive soft (paint + iceRestart, stay answerer).
 */
export type AutoRetryAction = "soft" | "hard" | "tip" | null;

export function nextAutoRetryAction(
  autoCount: number,
  elapsedMs: number
): AutoRetryAction {
  // Later / rarer — early soft@10s was thrashing answerer (hub drop offer@10s)
  // while first TURN path was still coming up.
  if (elapsedMs >= 16_000 && elapsedMs < 20_000 && autoCount < 1) return "soft";
  if (elapsedMs >= 26_000 && elapsedMs < 30_000 && autoCount < 2) return "hard";
  if (elapsedMs >= 36_000 && elapsedMs < 42_000 && autoCount < 3) return "tip";
  return null;
}
