/** Source-level FX hop markers. Run: node src/stars/giftFxVisual.test.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fx = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "GiftFxOverlay.tsx"),
  "utf8"
);

function sliceFn(src, name, nextName) {
  const start = src.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing function ${name}`);
  const end = nextName ? src.indexOf(`function ${nextName}`, start + 1) : src.length;
  assert.ok(end > start, `missing end marker for ${name}`);
  return src.slice(start, end);
}

function pairConst(name) {
  const m = fx.match(
    new RegExp(`export const ${name} = \\[(-?\\d+),\\s*(-?\\d+)\\]`)
  );
  assert.ok(m, `missing ${name}`);
  return [Number(m[1]), Number(m[2])];
}

assert.match(fx, /const n = 18/);
assert.match(fx, /6 \+ \(\(i \* 5\) % 16\)/);
assert.match(fx, /80 \+ \(\(i \* 7\) % 16\)/);
assert.match(fx, /balloonShade/);
assert.match(fx, /function FallingCrystal/);
assert.match(fx, /left > 22 && left < 78/);
assert.match(fx, /\[22, 30, 42, 30, 22\]/);
assert.match(fx, /crownOrbKing/);
assert.match(fx, /function DiscoOrb/);
assert.match(fx, /DISCO_ORBS/);
assert.match(fx, /DISCO_ORB_HUES/);
assert.match(fx, /#ff2bd6/);
assert.match(fx, /#22d3ee/);
assert.match(fx, /#fbbf24/);
assert.match(fx, /#84cc16/);
assert.match(fx, /#fb923c/);
assert.doesNotMatch(fx, /function DiscoFlash/);
assert.doesNotMatch(fx, /const spikes = \[30, 30, 30, 30, 30\]/);
assert.equal(fx.includes("filter:"), false, "must not CSS-filter video");

const [snowY0, snowY1] = pairConst("SNOW_FALL_Y");
assert.ok(snowY0 <= -80, `snow start above tile, got ${snowY0}`);
assert.ok(snowY1 >= 640, `snow end covers tile, got ${snowY1}`);
const [balloonY0, balloonY1] = pairConst("BALLOON_RISE_Y");
assert.ok(balloonY0 > 0, `balloon starts below, got ${balloonY0}`);
assert.ok(balloonY1 <= -520, `balloon rises off top, got ${balloonY1}`);

const snowFn = sliceFn(fx, "FallingCrystal", "SnowLayer");
assert.match(snowFn, /SNOW_FALL_Y/);
assert.match(snowFn, /useNativeDriver:\s*true/);
assert.match(snowFn, /toValue:\s*0/);
assert.match(snowFn, /snowDendrite/);
assert.match(snowFn, /plate/);
assert.match(snowFn, /needle/);
assert.match(snowFn, /dot/);
assert.doesNotMatch(snowFn, /timing\([^)]*\b(top|bottom)\b/);
assert.doesNotMatch(
  snowFn,
  /top:\s*[^\n]*interpolate|bottom:\s*[^\n]*interpolate/
);

const balloonFn = sliceFn(fx, "RisingBalloon", "FallingConfetti");
assert.match(balloonFn, /BALLOON_RISE_Y/);
assert.match(balloonFn, /useNativeDriver:\s*true/);
assert.match(balloonFn, /toValue:\s*0/);
assert.doesNotMatch(balloonFn, /timing\([^)]*\b(top|bottom)\b/);
assert.doesNotMatch(
  balloonFn,
  /top:\s*[^\n]*interpolate|bottom:\s*[^\n]*interpolate/
);

const snowSpecsFn = sliceFn(fx, "snowSpecs", "balloonSpecs");
assert.match(snowSpecsFn, /band === "near" && left > 22 && left < 78/);

const balloonSpecsFn = sliceFn(fx, "balloonSpecs", "fireworkBursts");
assert.match(balloonSpecsFn, /6 \+ \(\(i \* 5\) % 16\)/);
assert.match(balloonSpecsFn, /80 \+ \(\(i \* 7\) % 16\)/);

const discoOrbFn = sliceFn(fx, "DiscoOrb", "DiscoLayer");
assert.match(discoOrbFn, /ping-pong/);
assert.match(discoOrbFn, /translateX/);
assert.match(discoOrbFn, /toValue:\s*1/);
assert.match(discoOrbFn, /toValue:\s*0/);
assert.match(discoOrbFn, /useNativeDriver:\s*true/);
assert.match(discoOrbFn, /Animated\.loop/);
assert.match(discoOrbFn, /Animated\.sequence/);
assert.match(discoOrbFn, /borderRadius: spec\.size/);
assert.match(
  discoOrbFn,
  /<View[\s\S]*left: `\$\{spec\.left\}%`[\s\S]*<Animated\.View[\s\S]*transform:/
);

const confettiFn = sliceFn(fx, "FallingConfetti", "ShootingStarLayer");
assert.match(confettiFn, /useNativeDriver:\s*true/);
assert.match(
  confettiFn,
  /<View[\s\S]*left: `\$\{spec\.left\}%`[\s\S]*<Animated\.View[\s\S]*transform:/
);

const discoFn = sliceFn(fx, "DiscoLayer", "SoftTint");
assert.match(discoFn, /360deg/);
assert.match(discoFn, /discoFacetGrid/);
assert.match(discoFn, /discoLit/);
assert.match(discoFn, /DiscoOrb/);
assert.match(discoFn, /useNativeDriver:\s*true/);
assert.ok(
  /discoBall:\s*\{[^}]*\bwidth:\s*(?:96|"96")/.test(fx),
  "expected discoBall width 96 or \"96\""
);
assert.ok(
  /DiscoBeam/.test(fx) || /i\s*\*\s*45/.test(fx),
  "expected DiscoBeam or 8 beams / i*45"
);
assert.ok(
  /FF2EA6/i.test(fx) || /22D3EE/i.test(fx),
  "expected FF2EA6 or 22D3EE beam color"
);
assert.match(fx, /backgroundColor: "transparent"/);
assert.match(fx, /borderWidth: 72/);

console.log("giftFxVisual.test.mjs OK");
