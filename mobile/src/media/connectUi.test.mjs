/**
 * CONNECTIVITY_LOCK: auto-retry schedule must not thrash answerer at ~10s.
 * Transpiles connectUi.ts on the fly (no ts-node dep) so the test exercises
 * the real implementation, not a mirror. Run: node src/media/connectUi.test.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, "connectUi.ts");
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
const { nextAutoRetryAction } = mod.exports;

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

console.log("connectUi.test.mjs OK (connectivity lock auto-retry, real module)");
