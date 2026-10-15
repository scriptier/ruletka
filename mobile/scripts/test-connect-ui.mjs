/**
 * Unit checks for connectUi helpers (no RN runtime).
 * Transpiles src/media/connectUi.ts on the fly (no ts-node dep) so the test
 * exercises the real implementation, not a mirror.
 * Run: node scripts/test-connect-ui.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, "..", "src", "media", "connectUi.ts");
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
const { computeConnSlow, nextAutoRetryAction, computeShowHardRetry } = mod.exports;

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

// Auto-retry LOCK: no soft@10s; real schedule soft>=16s, hard>=26s, tip>=36s
assert.equal(nextAutoRetryAction(0, 3500), null);
assert.equal(nextAutoRetryAction(0, 9500), null);
assert.equal(nextAutoRetryAction(0, 10_500), null, "LOCK: no soft@10s");
assert.equal(nextAutoRetryAction(0, 16_500), "soft");
assert.equal(nextAutoRetryAction(1, 26_500), "hard");
assert.equal(nextAutoRetryAction(2, 36_500), "tip");

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

console.log("test-connect-ui: ok (real module)");
