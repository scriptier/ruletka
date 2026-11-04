/**
 * Web NSFW filter: lite devices still scan, 2-of-3 confirm, first hit blurs,
 * strangers stay blurred while the model loads or fails, same-origin first.
 * Runs the real ui/live.js functions in a vm with small stubs.
 * Run: node ui/nsfw-filter.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.join(dir, "live.js"), "utf8");

const a = js.indexOf("function nsfwAutoEnabled() {");
const endMark = "    nsfwHitCooldown = false;\n  }, 4000);\n}\n";
const b = js.indexOf(endMark, a);
assert.ok(a > 0 && b > a, "nsfw block found in live.js");
const block = js.slice(a, b + endMark.length);

// Static guards
assert.doesNotMatch(block, /isFxLite\(\)\s*\|\|\s*!nsfwAutoEnabled/, "lite must not skip the filter");
assert.doesNotMatch(block, /!isFxLite\(\)/, "chip / watch must not depend on isFxLite");
assert.match(block, /\/vendor\/nsfw\/tfjs-4\.22\.0\/tf\.min\.js/, "local tfjs first");
assert.ok(
  block.indexOf('name: "local"') < block.indexOf('name: "cdn"'),
  "same-origin before jsDelivr"
);
const fx = js.match(/function isFxLite\(\) \{[\s\S]*?\n\}/)[0];
assert.match(fx, /_fxLiteHw = !discrete && !!\(weakChip \|\| safariBlind \|\| !_fxHasGl\)/, "reduced motion not in _fxLiteHw");
const peel = js.match(/function peelIntroBlurOnFrames\(\) \{[\s\S]*?\n\}/)[0];
assert.match(peel, /nsfwGuardHoldsBlur\(\)/, "frames peel waits for the filter");
const intro = js.match(/function applyStrangerIntroBlur\(\) \{[\s\S]*?\n\}/)[0];
assert.match(intro, /nsfwGuardHoldsBlur\(\)/, "intro timer waits for the filter");

function makeEnv({ lite = false } = {}) {
  const sent = [];
  const logs = [];
  const intervals = [];
  const ctx = {
    console: { info() {}, warn() {}, log() {} },
    sent,
    logs,
    intervals,
    location: { href: "https://ruletka.me/live.html" },
    URL,
    Date,
    WebAssembly,
    window: {},
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) },
    setInterval: (fn, ms) => {
      intervals.push(ms);
      return intervals.length;
    },
    clearInterval() {},
    setTimeout: () => 0,
  };
  vm.createContext(ctx);
  const prelude = `
    var prefs = {};
    var matched = true, matchMode = "stranger", partnerBlurred = false;
    var nsfwModel = null, nsfwLoadPromise = null, nsfwTimer = 0, nsfwHitCooldown = false, nsfwWatchGen = 0;
    var _fxLiteHw = ${lite}, _fxHasGl = true, _fxGlRenderer = "ANGLE (NVIDIA)";
    var introBlurPending = false, introBlurGen = 0, primaryPartnerUserId = "u1";
    var lastMatchMeta = {}, wantSearch = false, pendingNextTear = false, pendingNextKeepFriend = false;
    var chip = { hidden: true, classList: { add() {}, remove() {} }, removeAttribute() {}, textContent: "", title: "" };
    var remoteVideo = { readyState: 4, videoWidth: 640 };
    var nextScores = [];
    function loadPrefs() { return prefs; }
    function isFxLite() { return true; }
    function $(id) { return id === "ai-safety-chip" ? chip : id === "remote" ? remoteVideo : null; }
    function _t() { return ""; }
    function log(m) { logs.push(m); }
    function setStatus() {}
    function setPartnerBlur(on) { partnerBlurred = !!on; }
    function syncPartnerBlurButtonLabels() {}
    function clearIntroBlurTimer() {}
    function peelIntroBlurOnFrames() {}
    function send(m) { sent.push(m); }
    function saveLocalReport() {}
    function captureReportEvidenceB64() { return ""; }
    function currentRoom() { return "r"; }
    function setPhase() {}
    var fakeModel = { classify: async () => {
      const s = nextScores.shift() || { porn: 0, hentai: 0, sexy: 0 };
      return [{ className: "Porn", probability: s.porn }, { className: "Hentai", probability: s.hentai }, { className: "Sexy", probability: s.sexy }];
    } };
  `;
  vm.runInContext(prelude + block + "\nthis.api = { get partnerBlurred() { return partnerBlurred; }, set model(m) { nsfwModel = m; }, set timer(t) { nsfwTimer = t; }, get timer() { return nsfwTimer; }, set matched(v) { matched = v; }, set mode(v) { matchMode = v; }, set prefs(v) { prefs = v; }, set failedAt(v) { nsfwLoadFailedAt = v; }, push(s) { nextScores.push(s); }, fakeModel, chip, scan: scanRemoteForNsfw, guard: nsfwGuardHoldsBlur, start: startNsfwWatch, ensure: ensureNsfwModel, sync: syncAiSafetyChip };", ctx);
  return ctx;
}

const HIT = { porn: 0.9, hentai: 0, sexy: 0.1 };
const CLEAN = { porn: 0.01, hentai: 0, sexy: 0.02 };

// 1) single hit: blur, no report
{
  const env = makeEnv();
  const api = env.api;
  api.model = api.fakeModel;
  api.timer = 1;
  api.push(HIT);
  await api.scan();
  assert.equal(api.partnerBlurred, true, "first hit blurs");
  assert.equal(env.sent.length, 0, "first hit sends nothing");
  // clean, then hit → 2 of last 3 → confirm
  api.push(CLEAN);
  await api.scan();
  assert.equal(env.sent.length, 0);
  api.push(HIT);
  await api.scan();
  const types = env.sent.map((m) => m.type);
  assert.deepEqual(types, ["report_user", "block_user", "next"], "2 of 3 → report + block + next");
  assert.equal(env.sent[0].reason, "explicit_ai");
}

// 2) hits spread out (hit, clean, clean, hit) never confirm
{
  const env = makeEnv();
  const api = env.api;
  api.model = api.fakeModel;
  api.timer = 1;
  for (const s of [HIT, CLEAN, CLEAN, HIT, CLEAN, CLEAN]) {
    api.push(s);
    await api.scan();
  }
  assert.equal(env.sent.length, 0, "1-of-3 windows never report");
}

// 3) guard: model missing → hold blur; running → release
{
  const env = makeEnv();
  const api = env.api;
  assert.equal(api.guard(), true, "loading/failed holds blur");
  api.model = api.fakeModel;
  assert.equal(api.guard(), true, "model but no scan timer yet holds blur");
  api.timer = 1;
  assert.equal(api.guard(), false, "running releases");
  api.timer = 0;
  api.mode = "friend";
  assert.equal(api.guard(), false, "friend calls never held");
  api.mode = "stranger";
  api.prefs = { nsfwAuto: false };
  assert.equal(api.guard(), false, "filter off → not held");
}

// 4) failed load shows the failed chip
{
  const env = makeEnv();
  const api = env.api;
  api.failedAt = Date.now();
  api.sync();
  assert.equal(api.chip.hidden, false);
  assert.equal(api.chip.textContent, "Safety filter off");
}

// 5) lite device still starts a (slower) scan; normal uses 2200
for (const [lite, ms] of [[true, 6000], [false, 2200]]) {
  const env = makeEnv({ lite });
  const api = env.api;
  api.model = api.fakeModel;
  api.start();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(env.intervals, [ms], `lite=${lite} interval ${ms}`);
}

console.log("nsfw-filter.test.mjs OK");
