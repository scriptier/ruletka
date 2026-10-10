/** Pure giftFxHoldMs edges. Run: node src/stars/giftFxHold.test.mjs */
import assert from "node:assert/strict";

const GIFT_FX_HOLD_MS = {
  heart: 3000,
  bars: 15500,
  fence: 15000,
  flowers: 15000,
  balloons: 15000,
  confetti: 15000,
  pass_mic: 5200,
  fireworks: 20000,
  please_stay: 15000,
  shooting_star: 15000,
  snow: 15000,
  spotlight: 15000,
  crown: 12000,
  disco: 12000,
};

function giftFxHoldMs(effect) {
  if (!effect) return 1800;
  return GIFT_FX_HOLD_MS[effect] ?? 2000;
}

assert.equal(giftFxHoldMs(null), 1800);
assert.equal(giftFxHoldMs(undefined), 1800);
assert.equal(giftFxHoldMs(""), 1800);
assert.equal(giftFxHoldMs("heart"), 3000);
assert.equal(giftFxHoldMs("bars"), 15500);
assert.equal(giftFxHoldMs("unknown_fx"), 2000);
assert.equal(giftFxHoldMs("crown"), 12000);
console.log("giftFxHold.test.mjs OK");
