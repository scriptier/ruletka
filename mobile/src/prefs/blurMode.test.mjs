/**
 * Pure blur-mode normalization (keep in sync with store.ts normalizeBlurMode).
 * Run: node src/prefs/blurMode.test.mjs
 */
import assert from "node:assert/strict";

/** @typedef {"off"|"intro"|"hold"} BlurStrangersMode */

/**
 * @param {{ blurStrangersMode?: string, blurStrangers?: boolean }} j
 * @returns {BlurStrangersMode}
 */
function normalizeBlurMode(j) {
  const m = j.blurStrangersMode;
  if (m === "off" || m === "intro" || m === "hold") return m;
  // Keep in sync with store.ts: product default hold.
  if (j.blurStrangers === false) return "off";
  if (j.blurStrangers === true) return "hold";
  return "hold";
}

/** Want auto-veil on stranger match? */
function wantStrangerBlur(mode, isFriend) {
  if (isFriend) return false;
  return mode === "hold" || mode === "intro";
}

assert.equal(normalizeBlurMode({ blurStrangersMode: "off" }), "off");
assert.equal(normalizeBlurMode({ blurStrangersMode: "intro" }), "intro");
assert.equal(normalizeBlurMode({ blurStrangersMode: "hold" }), "hold");
assert.equal(normalizeBlurMode({ blurStrangersMode: "nope" }), "hold");
assert.equal(normalizeBlurMode({ blurStrangersMode: "" }), "hold");
assert.equal(normalizeBlurMode({ blurStrangers: false }), "off");
assert.equal(normalizeBlurMode({ blurStrangers: true }), "hold");
assert.equal(normalizeBlurMode({}), "hold");
// unknown mode string falls through to legacy boolean fallback
assert.equal(
  normalizeBlurMode({ blurStrangersMode: "bogus", blurStrangers: false }),
  "off"
);

// --- normalizeBlurMode: additional edge cases ---
// non-string / nullish blurStrangersMode falls through to legacy boolean
assert.equal(normalizeBlurMode({ blurStrangersMode: null }), "hold");
assert.equal(normalizeBlurMode({ blurStrangersMode: undefined }), "hold");
assert.equal(normalizeBlurMode({ blurStrangersMode: 0 }), "hold");
assert.equal(
  normalizeBlurMode({ blurStrangersMode: null, blurStrangers: false }),
  "off"
);
// case-sensitive: capitalized/whitespace variants are not valid modes
assert.equal(normalizeBlurMode({ blurStrangersMode: "Off" }), "hold");
assert.equal(normalizeBlurMode({ blurStrangersMode: " off" }), "hold");
assert.equal(normalizeBlurMode({ blurStrangersMode: "off " }), "hold");
// valid mode string wins even when legacy blurStrangers disagrees
assert.equal(
  normalizeBlurMode({ blurStrangersMode: "off", blurStrangers: true }),
  "off"
);
assert.equal(
  normalizeBlurMode({ blurStrangersMode: "intro", blurStrangers: false }),
  "intro"
);

assert.equal(wantStrangerBlur("off", false), false);
assert.equal(wantStrangerBlur("intro", false), true);
assert.equal(wantStrangerBlur("hold", false), true);
assert.equal(wantStrangerBlur("hold", true), false);
assert.equal(wantStrangerBlur("intro", true), false);
// friend never auto-blurs, regardless of mode (including invalid/off modes)
assert.equal(wantStrangerBlur("off", true), false);
assert.equal(wantStrangerBlur("bogus", true), false);
assert.equal(wantStrangerBlur("", true), false);
// --- wantStrangerBlur: additional edge cases ---
// non-string / nullish mode never counts as hold/intro
assert.equal(wantStrangerBlur(null, false), false);
assert.equal(wantStrangerBlur(undefined, false), false);
assert.equal(wantStrangerBlur("HOLD", false), false);
// isFriend is checked first, short-circuiting before mode is read
assert.equal(wantStrangerBlur(undefined, true), false);
// typical pipeline: feed normalizeBlurMode output straight into wantStrangerBlur
assert.equal(
  wantStrangerBlur(normalizeBlurMode({ blurStrangersMode: "nope" }), false),
  true // unknown mode normalizes to "hold" → auto-veils strangers
);
assert.equal(
  wantStrangerBlur(normalizeBlurMode({ blurStrangers: false }), false),
  false
);

/**
 * Pure decision core of live.tsx's scheduleIntroUnblur poll loop
 * (keep in sync: mobile/app/live.tsx INTRO_* constants + tick()).
 * Given whether partner frames are visible yet, elapsed wait, and how many
 * re-arms already happened, decide the next action.
 * @param {boolean} framesAvailable
 * @param {number} waitedMs
 * @param {number} rearmCount
 * @returns {{ action: "reveal" | "peel_timeout" | "rearm", rearmCount: number }}
 */
const INTRO_FRAME_REARM_MAX = 3;
const INTRO_UNBLUR_MAX_WAIT_MS = 8000;
function introTimerDecision(framesAvailable, waitedMs, rearmCount) {
  if (framesAvailable) return { action: "reveal", rearmCount };
  const hitRearmCap = rearmCount >= INTRO_FRAME_REARM_MAX;
  const hitWall = waitedMs >= INTRO_UNBLUR_MAX_WAIT_MS;
  if (hitRearmCap || hitWall) return { action: "peel_timeout", rearmCount };
  return { action: "rearm", rearmCount: rearmCount + 1 };
}

assert.deepEqual(introTimerDecision(true, 0, 0), {
  action: "reveal",
  rearmCount: 0,
});
// frames show up late but before any cap is hit — still reveals, not peels
assert.deepEqual(introTimerDecision(true, 7999, 3), {
  action: "reveal",
  rearmCount: 3,
});
// no frames yet, under both caps — re-arm and bump the counter
assert.deepEqual(introTimerDecision(false, 2800, 0), {
  action: "rearm",
  rearmCount: 1,
});
// rearm cap reached exactly — give up regardless of elapsed time
assert.deepEqual(introTimerDecision(false, 4000, 3), {
  action: "peel_timeout",
  rearmCount: 3,
});
assert.deepEqual(introTimerDecision(false, 4000, 4), {
  action: "peel_timeout",
  rearmCount: 4,
});
// wall-clock cap reached exactly, rearm count still low — give up on time alone
assert.deepEqual(introTimerDecision(false, 8000, 1), {
  action: "peel_timeout",
  rearmCount: 1,
});
assert.deepEqual(introTimerDecision(false, 7999, 2), {
  action: "rearm",
  rearmCount: 3,
});

console.log("blurMode.test.mjs OK");
