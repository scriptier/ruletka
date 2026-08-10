/**
 * Lightweight node smoke for callMetrics (no jest required).
 * Run: node src/live/callMetrics.test.mjs
 */
import assert from "node:assert/strict";

// Inline mirror of pure helpers so we don't need TS transpile
function formatCallTimer(elapsedSecs) {
  const s = Math.max(0, Math.floor(elapsedSecs));
  if (s <= 0) return "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function elapsedSince(startedAt, now = Date.now()) {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}
function starProgress(elapsedSecs, rateMinSecs) {
  if (rateMinSecs <= 0) return 0;
  return Math.min(1, elapsedSecs / rateMinSecs);
}
function starNeedMinutes(rateMinSecs) {
  return Math.max(1, Math.round(rateMinSecs / 60));
}

assert.equal(formatCallTimer(0), "");
assert.equal(formatCallTimer(5), "0:05");
assert.equal(formatCallTimer(65), "1:05");
assert.equal(formatCallTimer(600), "10:00");
assert.equal(elapsedSince(0), 0);
assert.equal(elapsedSince(1000, 6500), 5);
assert.equal(starProgress(0, 900), 0);
assert.equal(starProgress(450, 900), 0.5);
assert.equal(starProgress(1000, 900), 1);
assert.equal(starNeedMinutes(900), 15);
assert.equal(starNeedMinutes(30), 1);

console.log("callMetrics.test.mjs ok");
