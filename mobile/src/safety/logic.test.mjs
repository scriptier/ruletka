/**
 * Safety filter policy. Run: node src/safety/logic.test.mjs
 */
import assert from "node:assert/strict";
import {
  FACE_ABSENT_SUSPICION,
  HUB_ACCEPTS_SAFETY_LOG,
  beginDisableFilter,
  buildSafetyLog,
  cancelDisableFilter,
  classifyScores,
  confirmDisableFilter,
  createFaceWatch,
  createSafetyDetector,
  createSafetySession,
  deliverSafetyLog,
  FACE_HINT_AFTER_MS,
  faceForSelfCheck,
  preQueueFaceGate,
  pushFaceSample,
  pushVerdict,
  safetyFilterEnabled,
} from "./logic.js";

assert.equal(classifyScores({ porn: 0.8, hentai: 0, sexy: 0 }), "explicit");
assert.equal(classifyScores({ porn: 0, hentai: 0.8, sexy: 0 }), "explicit");
assert.equal(classifyScores({ porn: 0.55, hentai: 0, sexy: 0.5 }), "explicit");
assert.equal(classifyScores({ porn: 0.2, hentai: 0, sexy: 0.7 }), "sexy");
assert.equal(classifyScores({ porn: 0.1, hentai: 0.1, sexy: 0.2 }), "clean");

assert.equal(safetyFilterEnabled(undefined), true);
assert.equal(safetyFilterEnabled(null), true);
assert.equal(safetyFilterEnabled(true), true);
assert.equal(safetyFilterEnabled(false), false);

const asked = beginDisableFilter();
assert.equal(asked.enabled, true);
assert.equal(asked.confirmPending, true);
const off = confirmDisableFilter();
assert.equal(off.enabled, false);
assert.equal(off.confirmPending, false);
const back = cancelDisableFilter();
assert.equal(back.enabled, true);
assert.equal(back.confirmPending, false);

let session = createSafetySession();
let step = pushVerdict(session, { face: "present", nsfw: "clean" });
assert.equal(step.action, "none");
session = step.session;

step = pushVerdict(session, { face: "present", nsfw: "sexy" });
assert.equal(step.action, "suspicion");
session = step.session;
step = pushVerdict(session, { face: "present", nsfw: "sexy" });
assert.equal(step.action, "none", "suspicion does not re-fire");

session = createSafetySession();
step = pushVerdict(session, { face: "absent", nsfw: "unknown" });
assert.equal(step.action, "none");
session = step.session;
step = pushVerdict(session, { face: "absent", nsfw: "unknown" });
assert.equal(step.action, "none");
session = step.session;
assert.equal(FACE_ABSENT_SUSPICION, 3);
step = pushVerdict(session, { face: "absent", nsfw: "unknown" });
assert.equal(step.action, "suspicion");

session = createSafetySession();
step = pushVerdict(session, { face: "present", nsfw: "explicit" });
assert.equal(step.action, "suspicion");
session = step.session;
step = pushVerdict(session, { face: "present", nsfw: "clean" });
session = step.session;
step = pushVerdict(session, { face: "present", nsfw: "explicit" });
assert.equal(step.action, "confirmed", "2 of last 3 explicit frames");
session = step.session;
step = pushVerdict(session, { face: "present", nsfw: "explicit" });
assert.equal(step.action, "none", "confirmed latches once per match");

const det = createSafetyDetector("tflite");
assert.equal(det.ready, false);
assert.equal(det.id, "stub");
const verdict = await det.classify(null);
assert.equal(verdict.nsfw, "unknown");
assert.equal(verdict.face, "unknown");

const log = buildSafetyLog({
  targetUserId: "abc",
  model: "stub",
  modelReady: false,
  face: "absent",
  nsfw: "explicit",
  window: ["explicit", "explicit"],
  ts: 10,
});
assert.equal(log.type, "safety_log");
assert.equal(log.log_only, true);
assert.equal(log.reason, "explicit_shadow");
assert.notEqual(log.reason, "explicit_ai");
assert.equal(HUB_ACCEPTS_SAFETY_LOG, true);

let face = createFaceWatch();
let faceStep = pushFaceSample(face, "unknown", 0);
assert.equal(faceStep.showHint, false);
assert.equal(faceStep.blocked, false);
face = faceStep.watch;
faceStep = pushFaceSample(face, "unknown", 10_000);
assert.equal(faceStep.showHint, false, "stub unknown never warns");
assert.equal(faceStep.blocked, false);

face = createFaceWatch();
faceStep = pushFaceSample(face, "absent", 0);
assert.equal(faceStep.showHint, false);
face = faceStep.watch;
faceStep = pushFaceSample(face, "absent", FACE_HINT_AFTER_MS - 1);
assert.equal(faceStep.showHint, false);
face = faceStep.watch;
faceStep = pushFaceSample(face, "absent", FACE_HINT_AFTER_MS);
assert.equal(faceStep.showHint, true, "no face for N ms shows the hint");
assert.equal(faceStep.blocked, false, "missing face does not block Start");
face = faceStep.watch;
faceStep = pushFaceSample(face, "present", FACE_HINT_AFTER_MS + 50);
assert.equal(faceStep.showHint, false);
faceStep = pushFaceSample(faceStep.watch, "unknown", FACE_HINT_AFTER_MS + 100);
assert.equal(faceStep.showHint, false);

assert.equal(faceForSelfCheck(false, "absent"), "unknown");
assert.equal(faceForSelfCheck(true, "absent"), "absent");
assert.equal(faceForSelfCheck(true, "maybe"), "unknown");

const stubGate = preQueueFaceGate({
  detectorReady: false,
  face: "absent",
  watch: createFaceWatch(),
  nowMs: 0,
});
const stubLater = preQueueFaceGate({
  detectorReady: false,
  face: "absent",
  watch: stubGate.watch,
  nowMs: FACE_HINT_AFTER_MS + 5000,
});
assert.equal(stubLater.showHint, false, "stub does not hint");
assert.equal(stubLater.softGate, false, "stub does not gate the queue");
assert.equal(stubLater.hardBlock, false, "stub does not hard-block Start");

let readyWatch = createFaceWatch();
let readyGate = preQueueFaceGate({
  detectorReady: true,
  face: "absent",
  watch: readyWatch,
  nowMs: 1000,
});
assert.equal(readyGate.showHint, false);
assert.equal(readyGate.softGate, false);
assert.equal(readyGate.hardBlock, false);
readyGate = preQueueFaceGate({
  detectorReady: true,
  face: "absent",
  watch: readyGate.watch,
  nowMs: 1000 + FACE_HINT_AFTER_MS,
});
assert.equal(readyGate.showHint, true, "ready + no face shows the hint");
assert.equal(readyGate.softGate, true, "ready + no face soft-gates the queue");
assert.equal(readyGate.hardBlock, false, "soft gate leaves Start tappable");
readyGate = preQueueFaceGate({
  detectorReady: true,
  face: "present",
  watch: readyGate.watch,
  nowMs: 1000 + FACE_HINT_AFTER_MS + 10,
});
assert.equal(readyGate.showHint, false);
assert.equal(readyGate.softGate, false);

const friendGate = preQueueFaceGate({
  friendCall: true,
  detectorReady: true,
  face: "absent",
  watch: readyGate.watch,
  nowMs: 99_000,
});
assert.equal(friendGate.showHint, false, "friend calls skip the face hint");
assert.equal(friendGate.softGate, false, "friend calls are not gated");
assert.equal(friendGate.hardBlock, false);

const shadow = buildSafetyLog({ targetUserId: "abc", nsfw: "explicit" });
const held = deliverSafetyLog(shadow, {
  accept: false,
  send() {
    throw new Error("must not send when accept is false");
  },
});
assert.equal(held.sent, false);
assert.equal(held.reason, "hub_log_disabled");
let sent = null;
const passed = deliverSafetyLog(shadow, {
  send(rec) {
    sent = rec;
  },
});
assert.equal(passed.sent, true);
assert.equal(sent.type, "safety_log");
assert.notEqual(sent.type, "report_user");
assert.equal(sent.reason, "explicit_shadow");
const banned = deliverSafetyLog(
  { ...shadow, reason: "explicit_ai" },
  { accept: true, send() {} }
);
assert.equal(banned.sent, false);
assert.equal(banned.reason, "not_a_report");

console.log("logic.test.mjs OK");
