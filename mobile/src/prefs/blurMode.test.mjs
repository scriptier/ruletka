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
  if (j.blurStrangers === false) return "off";
  if (j.blurStrangers === true) return "intro";
  return "intro";
}

/** Want auto-veil on stranger match? */
function wantStrangerBlur(mode, isFriend) {
  if (isFriend) return false;
  return mode === "hold" || mode === "intro";
}

assert.equal(normalizeBlurMode({ blurStrangersMode: "off" }), "off");
assert.equal(normalizeBlurMode({ blurStrangersMode: "intro" }), "intro");
assert.equal(normalizeBlurMode({ blurStrangersMode: "hold" }), "hold");
assert.equal(normalizeBlurMode({ blurStrangersMode: "nope" }), "intro");
assert.equal(normalizeBlurMode({ blurStrangersMode: "" }), "intro");
assert.equal(normalizeBlurMode({ blurStrangers: false }), "off");
assert.equal(normalizeBlurMode({ blurStrangers: true }), "intro");
assert.equal(normalizeBlurMode({}), "intro");
// unknown mode string falls through to legacy boolean fallback
assert.equal(
  normalizeBlurMode({ blurStrangersMode: "bogus", blurStrangers: false }),
  "off"
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

console.log("blurMode.test.mjs OK");
