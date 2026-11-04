/**
 * Partner ICE reconnect: 2s flap debounce, 3 chances × 10s, remainingSecs.
 * Transpiles partnerReconnect.ts (same pattern as connectUi.test.mjs).
 * Run: node src/media/partnerReconnect.test.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, "partnerReconnect.ts");
const src = fs.readFileSync(srcPath, "utf8");
const { outputText } = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
  },
});

const mod = { exports: {} };
new Function("exports", "module", "require", outputText)(
  mod.exports,
  mod,
  require
);
const {
  RECONNECT_CHANCES,
  RECONNECT_CHANCE_MS,
  RECONNECT_FLAP_MS,
  shouldStartReconnect,
  remainingSecs,
  startReconnect,
  tickReconnect,
} = mod.exports;

assert.equal(RECONNECT_CHANCES, 3);
assert.equal(RECONNECT_CHANCE_MS, 10_000);
assert.equal(RECONNECT_FLAP_MS, 2_000);

// start → chance 1, 10s window
const t0 = 1_000_000;
const snap1 = startReconnect(t0);
assert.deepEqual(snap1, { chance: 1, until: t0 + 10_000 });

// mid-wait: still chance 1
const mid = tickReconnect(snap1, t0 + 4_000, false);
assert.equal(mid.giveUp, false);
assert.equal(mid.recovered, false);
assert.deepEqual(mid.snap, snap1);

// recover mid-wait
const recovered = tickReconnect(snap1, t0 + 5_000, true);
assert.equal(recovered.recovered, true);
assert.equal(recovered.giveUp, false);
assert.equal(recovered.snap, null);

// ICE ok clears even at expiry (connected/completed wins)
const iceOkAtExpiry = tickReconnect(snap1, t0 + 10_000, true);
assert.equal(iceOkAtExpiry.recovered, true);
assert.equal(iceOkAtExpiry.giveUp, false);
assert.equal(iceOkAtExpiry.snap, null);

// 3 ticks giveUp: chance 1 → 2 → 3 → giveUp
const c1 = startReconnect(0);
assert.equal(c1.chance, 1);
const tick1 = tickReconnect(c1, 10_000, false);
assert.equal(tick1.giveUp, false);
assert.equal(tick1.recovered, false);
assert.equal(tick1.snap.chance, 2);
assert.equal(tick1.snap.until, 20_000);

const tick2 = tickReconnect(tick1.snap, 20_000, false);
assert.equal(tick2.giveUp, false);
assert.equal(tick2.snap.chance, 3);
assert.equal(tick2.snap.until, 30_000);

const tick3 = tickReconnect(tick2.snap, 30_000, false);
assert.equal(tick3.giveUp, true);
assert.equal(tick3.recovered, false);
assert.equal(tick3.snap, null);

// ICE ok after chance 2 still clears (not giveUp)
const after2ok = tickReconnect(tick2.snap, 25_000, true);
assert.equal(after2ok.recovered, true);
assert.equal(after2ok.giveUp, false);
assert.equal(after2ok.snap, null);

// null snap is a no-op
const idle = tickReconnect(null, 99_000, false);
assert.deepEqual(idle, { snap: null, giveUp: false, recovered: false });
const idleOk = tickReconnect(null, 99_000, true);
assert.equal(idleOk.recovered, false);
assert.equal(idleOk.giveUp, false);

// flap debounce: 1s down is not enough to start chance 1
const downAt = t0;
assert.equal(shouldStartReconnect(downAt, t0 + 1_000), false);
assert.equal(shouldStartReconnect(downAt, t0 + 1_999), false);
assert.equal(shouldStartReconnect(0, t0 + 2_000), false);
// flap 1s then iceOk → never started, never giveUp
const flapOk = tickReconnect(null, t0 + 1_000, true);
assert.equal(flapOk.giveUp, false);
assert.equal(flapOk.recovered, false);
assert.equal(flapOk.snap, null);
// down 2s → start chance 1
assert.equal(shouldStartReconnect(downAt, t0 + 2_000), true);
const afterFlap = startReconnect(t0 + 2_000);
assert.equal(afterFlap.chance, 1);
assert.equal(afterFlap.until, t0 + 2_000 + 10_000);

// remainingSecs: ceil((until-now)/1000) clipped 0..10
const waitSnap = startReconnect(t0);
assert.equal(remainingSecs(waitSnap, t0), 10);
assert.equal(remainingSecs(waitSnap, t0 + 1), 10);
assert.equal(remainingSecs(waitSnap, t0 + 1_000), 9);
assert.equal(remainingSecs(waitSnap, t0 + 1_500), 9);
assert.equal(remainingSecs(waitSnap, t0 + 9_001), 1);
assert.equal(remainingSecs(waitSnap, t0 + 10_000), 0);
assert.equal(remainingSecs(waitSnap, t0 + 12_000), 0);
assert.equal(remainingSecs(null, t0), 0);
assert.equal(remainingSecs({ chance: 1, until: t0 + 15_000 }, t0), 10);

// live.tsx: giveUp → next(); 1v1 stranger only; no closeCall on wait
const liveSrc = fs.readFileSync(
  path.join(__dirname, "../../app/live.tsx"),
  "utf8"
);
assert.match(liveSrc, /startReconnect/);
assert.match(liveSrc, /tickReconnect/);
assert.match(liveSrc, /shouldStartReconnect/);
assert.match(liveSrc, /remainingSecs/);
assert.match(
  liveSrc,
  /giveUp[\s\S]{0,500}nextActionRef\.current\(\)/,
  "live.tsx must call next() on giveUp"
);
assert.match(liveSrc, /mobile\.live\.reconnectChance/);
assert.match(liveSrc, /mobile\.live\.reconnectSecs/);
assert.match(
  liveSrc,
  /Do not closeCall during reconnect wait/,
  "wait path must keep the PC (no closeCall)"
);
assert.match(
  liveSrc,
  /hadConnectedThisMatchRef/,
  "wait only after ICE connected once this match"
);
assert.match(
  liveSrc,
  /huntingWithPartnerRef/,
  "hunt must not start 3×10s (keep partner)"
);
assert.match(
  liveSrc,
  /party_browse/,
  "party_browse hunt must skip reconnect wait"
);
assert.match(
  liveSrc,
  /canAndroidPartnerReconnectWait/,
  "Android wait gate must mirror web canPartnerReconnectWait"
);
assert.doesNotMatch(
  liveSrc,
  /key=\{[`'"]live-first-remote/,
  "must not remount live-first-remote from live.tsx"
);

console.log(
  "partnerReconnect.test.mjs OK (flap 2s / remainingSecs / 3x10s recover)"
);
