import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// Load the real TS module (Node 20 CI has no type stripping): transpile → tmp .mjs.
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "pipLayout.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const tmp = join(mkdtempSync(join(tmpdir(), "piplayout-")), "pipLayout.mjs");
writeFileSync(tmp, js);
const {
  pipBounds,
  clampPip,
  cornerToPos,
  nearestCorner,
  isDragMove,
  parseCorner,
  parseStageView,
  cornerFromLegacyXY,
  resolveSplitView,
} = await import(pathToFileURL(tmp).href);

const W = 108;
const H = 148;

// Phone portrait 412×915, top chrome 140, bottom dock 150.
{
  const b = pipBounds(412, 915, W, H, 140, 150);
  assert.equal(b.minX, 8);
  assert.equal(b.maxX, 412 - W - 8);
  assert.equal(b.minY, 148);
  assert.equal(b.maxY, 915 - 150 - H - 8);
  // Bottom-right corner never overlaps the dock.
  const br = cornerToPos("br", b);
  assert.ok(br.y + H <= 915 - 150);
  // Top-left never overlaps the top chrome.
  const tl = cornerToPos("tl", b);
  assert.ok(tl.y >= 140);
  // Clamp drags outside the box.
  assert.deepEqual(clampPip(-50, 2000, b), { x: 8, y: b.maxY });
  // Nearest corner.
  assert.equal(nearestCorner(10, 160, W, H, b), "tl");
  assert.equal(nearestCorner(300, 160, W, H, b), "tr");
  assert.equal(nearestCorner(10, 600, W, H, b), "bl");
  assert.equal(nearestCorner(290, 590, W, H, b), "br");
}

// Landscape 915×412: chrome leaves little room — bottom wins, stays in stage.
{
  const b = pipBounds(915, 412, W, H, 200, 150);
  assert.equal(b.minY, b.maxY);
  assert.ok(b.maxY + H <= 412 - 150 + 1e-9 || b.maxY === 8);
  assert.ok(b.minY >= 8);
}

// No chrome = old behaviour (8dp pad).
{
  const b = pipBounds(400, 800, W, H);
  assert.deepEqual(cornerToPos("br", b), { x: 400 - W - 8, y: 800 - H - 8 });
}

// Tap vs drag threshold.
assert.equal(isDragMove(3, 3), false);
assert.equal(isDragMove(8, 0), false);
assert.equal(isDragMove(9, 0), true);
assert.equal(isDragMove(0, -12), true);

assert.equal(parseCorner("tl"), "tl");
assert.equal(parseCorner("x"), null);
assert.equal(parseStageView("split"), "split");
assert.equal(parseStageView("pip"), "pip");
assert.equal(parseStageView(undefined), null);
assert.equal(cornerFromLegacyXY(8, 8, 412, 800, W, H), "tl");
assert.equal(cornerFromLegacyXY(296, 640, 412, 800, W, H), "br");
assert.equal(cornerFromLegacyXY(-1, -1, 412, 800, W, H), null);

// Split resolution.
const base = {
  pref: null,
  browserLayout: true,
  phase: "matched",
  hasPartner: true,
  multiRemote: false,
  huntingThird: false,
  extraPeerCount: 0,
  pipYou: true,
  hasSelf: true,
};
assert.equal(resolveSplitView(base), true, "legacy browser matched = split");
assert.equal(resolveSplitView({ ...base, phase: "search" }), false);
assert.equal(resolveSplitView({ ...base, browserLayout: false }), false);
assert.equal(resolveSplitView({ ...base, pref: "pip" }), false);
assert.equal(resolveSplitView({ ...base, pref: "split", phase: "search" }), true);
assert.equal(
  resolveSplitView({ ...base, pref: "split", phase: "search", hasSelf: false }),
  false
);
assert.equal(resolveSplitView({ ...base, pref: "split", browserLayout: false }), true);
assert.equal(resolveSplitView({ ...base, pref: "split", multiRemote: true }), false);
assert.equal(resolveSplitView({ ...base, pref: "split", huntingThird: true }), false);
assert.equal(resolveSplitView({ ...base, pref: "split", extraPeerCount: 1 }), false);
assert.equal(resolveSplitView({ ...base, pref: "split", pipYou: false }), false);

console.log("pipLayout.test.mjs ok");
