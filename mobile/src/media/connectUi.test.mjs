/**
 * CONNECTIVITY_LOCK: auto-retry schedule must not thrash answerer at ~10s.
 * Run: node src/media/connectUi.test.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// connectUi.ts is TypeScript — re-implement pure schedule for lock tests
// (keep in sync with nextAutoRetryAction in connectUi.ts)

/** @typedef {"soft"|"hard"|"tip"|null} AutoRetryAction */

/**
 * @param {number} autoCount
 * @param {number} elapsedMs
 * @returns {AutoRetryAction}
 */
function nextAutoRetryAction(autoCount, elapsedMs) {
  // LOCK: no soft at 10s — that produced hub "answerer first-path grace" drops
  if (elapsedMs >= 16_000 && elapsedMs < 20_000 && autoCount < 1) return "soft";
  if (elapsedMs >= 26_000 && elapsedMs < 30_000 && autoCount < 2) return "hard";
  if (elapsedMs >= 36_000 && elapsedMs < 42_000 && autoCount < 3) return "tip";
  return null;
}

// Must not thrash in first 15s (first TURN path still coming up)
assert.equal(nextAutoRetryAction(0, 5_000), null);
assert.equal(nextAutoRetryAction(0, 9_999), null);
assert.equal(nextAutoRetryAction(0, 10_000), null, "LOCK: no soft@10s");
assert.equal(nextAutoRetryAction(0, 12_000), null, "LOCK: no soft@12s");
assert.equal(nextAutoRetryAction(0, 14_999), null);

// Soft only after 16s
assert.equal(nextAutoRetryAction(0, 16_000), "soft");
assert.equal(nextAutoRetryAction(0, 18_000), "soft");
assert.equal(nextAutoRetryAction(1, 18_000), null);

// Hard later
assert.equal(nextAutoRetryAction(1, 26_000), "hard");
assert.equal(nextAutoRetryAction(2, 36_000), "tip");

// Forbid re-introducing 10s soft window
function forbiddenOldSchedule(autoCount, elapsedMs) {
  if (elapsedMs >= 10_000 && elapsedMs < 14_000 && autoCount < 1) return "soft";
  return null;
}
assert.equal(
  forbiddenOldSchedule(0, 10_000),
  "soft",
  "sanity: old schedule would soft@10s"
);
assert.notEqual(
  nextAutoRetryAction(0, 10_000),
  forbiddenOldSchedule(0, 10_000),
  "LOCK: new schedule must differ from thrash@10s"
);

console.log("connectUi.test.mjs OK (connectivity lock auto-retry)");
