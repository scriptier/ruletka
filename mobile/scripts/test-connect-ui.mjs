/**
 * Pure unit checks for connectUi helpers (no RN runtime).
 * Keep in sync with src/media/connectUi.ts
 * Run: node scripts/test-connect-ui.mjs
 */
import assert from "node:assert/strict";

function computeConnSlow(opts) {
  const {
    phase,
    conn,
    awaitingRemoteVideo,
    hasRemoteVideo,
    connSince,
    now,
    slowMs = 6000,
  } = opts;
  if (phase !== "matched") return false;
  if (connSince <= 0) return false;
  if (now - connSince <= slowMs) return false;
  if (conn === "checking" || conn === "connecting") {
    return awaitingRemoteVideo && !hasRemoteVideo && now - connSince > slowMs;
  }
  return (
    conn === "failed" ||
    conn === "disconnected" ||
    (awaitingRemoteVideo && !hasRemoteVideo)
  );
}

function nextAutoRetryAction(autoCount, elapsedMs) {
  // Keep in sync with src/media/connectUi.ts
  if (elapsedMs >= 10_000 && elapsedMs < 14_000 && autoCount < 1) return "soft";
  if (elapsedMs >= 18_000 && elapsedMs < 22_000 && autoCount < 2) return "hard";
  if (elapsedMs >= 28_000 && elapsedMs < 34_000 && autoCount < 3) return "tip";
  return null;
}

function computeShowHardRetry(opts) {
  const {
    phase,
    conn,
    linkTier,
    awaitingRemoteVideo,
    hasRemoteVideo,
    matchStartedAt,
    now,
    hardMs = 14000,
  } = opts;
  if (phase !== "matched") return false;
  if (matchStartedAt > 0 && now - matchStartedAt < hardMs) return false;
  if (conn === "failed" || conn === "disconnected") return true;
  if (linkTier === "bad" && matchStartedAt > 0 && now - matchStartedAt > hardMs)
    return true;
  if (
    awaitingRemoteVideo &&
    !hasRemoteVideo &&
    matchStartedAt > 0 &&
    now - matchStartedAt > hardMs
  )
    return true;
  return false;
}

// Early connecting is NOT "slow"
assert.equal(
  computeConnSlow({
    phase: "matched",
    conn: "connecting",
    awaitingRemoteVideo: true,
    hasRemoteVideo: false,
    connSince: 1000,
    now: 4000,
  }),
  false
);
// Long wait without video is slow
assert.equal(
  computeConnSlow({
    phase: "matched",
    conn: "connecting",
    awaitingRemoteVideo: true,
    hasRemoteVideo: false,
    connSince: 1000,
    now: 9000,
  }),
  true
);

// Auto-retry: soft ~10s, hard(demoted soft) ~18s, tip ~28s
assert.equal(nextAutoRetryAction(0, 3500), null);
assert.equal(nextAutoRetryAction(0, 9500), null);
assert.equal(nextAutoRetryAction(0, 10500), "soft");
assert.equal(nextAutoRetryAction(1, 18500), "hard");
assert.equal(nextAutoRetryAction(2, 29000), "tip");

assert.equal(
  computeShowHardRetry({
    phase: "matched",
    conn: "connecting",
    linkTier: "weak",
    awaitingRemoteVideo: true,
    hasRemoteVideo: false,
    matchStartedAt: 1000,
    now: 5000,
  }),
  false
);

// Hard-rebuild affordance must not appear before ~14s grace.
assert.equal(
  computeShowHardRetry({
    phase: "matched",
    conn: "failed",
    linkTier: "bad",
    awaitingRemoteVideo: true,
    hasRemoteVideo: false,
    matchStartedAt: 1000,
    now: 1000 + 13999,
  }),
  false
);
assert.equal(
  computeShowHardRetry({
    phase: "matched",
    conn: "failed",
    linkTier: "bad",
    awaitingRemoteVideo: true,
    hasRemoteVideo: false,
    matchStartedAt: 1000,
    now: 1000 + 14001,
  }),
  true
);


// Extra edges (089)
assert.equal(
  computeConnSlow({
    phase: "matched",
    conn: "failed",
    awaitingRemoteVideo: false,
    hasRemoteVideo: true,
    connSince: 1,
    now: 20_000,
  }),
  true
);
assert.equal(
  computeConnSlow({
    phase: "idle",
    conn: "failed",
    awaitingRemoteVideo: true,
    hasRemoteVideo: false,
    connSince: 1,
    now: 20_000,
  }),
  false
);

console.log("test-connect-ui: ok");
