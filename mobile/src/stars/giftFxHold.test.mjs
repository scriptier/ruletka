/** Pure giftFxHoldMs edges. Run: node src/stars/giftFxHold.test.mjs */
import assert from "node:assert/strict";

const GIFT_FX_HOLD_MS = {
  heart: 2200,
  bars: 15500,
  flowers: 2800,
  balloons: 3600,
  confetti: 3400,
  pass_mic: 5200,
  fireworks: 4000,
  please_stay: 3500,
};

function giftFxHoldMs(effect) {
  if (!effect) return 1800;
  return GIFT_FX_HOLD_MS[effect] ?? 2000;
}

assert.equal(giftFxHoldMs(null), 1800);
assert.equal(giftFxHoldMs(undefined), 1800);
assert.equal(giftFxHoldMs(""), 1800);
assert.equal(giftFxHoldMs("heart"), 2200);
assert.equal(giftFxHoldMs("bars"), 15500);
assert.equal(giftFxHoldMs("unknown_fx"), 2000);
console.log("giftFxHold.test.mjs OK");
