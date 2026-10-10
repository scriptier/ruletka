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
  duringCallSelfCheck,
  faceWatchSafetyLog,
  FACE_HINT_AFTER_MS,
  faceForSelfCheck,
  preQueueFaceGate,
  pushFaceSample,
  pushVerdict,
  receiverPartnerCheck,
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

const stubCall = duringCallSelfCheck({
  detectorReady: false,
  face: "absent",
  watch: createFaceWatch(),
  nowMs: 0,
});
const stubCallLater = duringCallSelfCheck({
  detectorReady: false,
  face: "absent",
  watch: stubCall.watch,
  nowMs: FACE_HINT_AFTER_MS + 8000,
});
assert.equal(stubCallLater.showHint, false, "stub does not hint during a call");
assert.equal(stubCallLater.selfBlur, false, "stub does not blur outgoing video");
assert.equal(stubCallLater.toast, false, "stub does not toast");
assert.equal(stubCallLater.hardBlock, false, "stub does not end the call");

let callWatch = createFaceWatch();
let callStep = duringCallSelfCheck({
  detectorReady: true,
  face: "absent",
  watch: callWatch,
  nowMs: 2000,
});
assert.equal(callStep.selfBlur, false, "ready + short absence does not blur yet");
assert.equal(callStep.toast, false);
assert.equal(callStep.hardBlock, false);
callStep = duringCallSelfCheck({
  detectorReady: true,
  face: "absent",
  watch: callStep.watch,
  nowMs: 2000 + FACE_HINT_AFTER_MS,
});
assert.equal(callStep.showHint, true);
assert.equal(callStep.selfBlur, true, "ready + no face prepares the self blur");
assert.equal(callStep.toast, true, "toast fires once when the blur starts");
assert.equal(callStep.hardBlock, false, "missing face does not end the call");
callStep = duringCallSelfCheck({
  detectorReady: true,
  face: "absent",
  watch: callStep.watch,
  nowMs: 2000 + FACE_HINT_AFTER_MS + 1000,
});
assert.equal(callStep.selfBlur, true, "blur stays while the face is gone");
assert.equal(callStep.toast, false, "toast does not repeat each second");
callStep = duringCallSelfCheck({
  detectorReady: true,
  face: "present",
  watch: callStep.watch,
  nowMs: 2000 + FACE_HINT_AFTER_MS + 2000,
});
assert.equal(callStep.selfBlur, false, "a face clears the self blur");
assert.equal(callStep.toast, false);
assert.equal(callStep.showHint, false);

const friendCall = duringCallSelfCheck({
  friendCall: true,
  detectorReady: true,
  face: "absent",
  watch: callStep.watch,
  nowMs: 99_000,
});
assert.equal(friendCall.selfBlur, false, "friend calls are not self-blurred");
assert.equal(friendCall.toast, false, "friend calls do not toast");
assert.equal(friendCall.hardBlock, false);
assert.equal(friendCall.showHint, false);

const stubFaceLog = faceWatchSafetyLog({
  detectorReady: false,
  fired: true,
  model: "stub",
  ts: 10,
});
assert.equal(stubFaceLog.send, false, "stub does not send face_ok");
assert.equal(stubFaceLog.record, null);
assert.equal(stubFaceLog.hardBlock, false);
assert.equal(stubFaceLog.skip, false);

const waitingFaceLog = faceWatchSafetyLog({
  detectorReady: true,
  fired: false,
  ts: 10,
});
assert.equal(waitingFaceLog.send, false, "ready model inside the window does not send");
assert.equal(waitingFaceLog.record, null);

const readyFaceLog = faceWatchSafetyLog({
  detectorReady: true,
  fired: true,
  model: "face",
  ts: 20,
});
assert.equal(readyFaceLog.send, true, "ready + no face sends the log");
assert.equal(readyFaceLog.hardBlock, false, "face log does not end the call");
assert.equal(readyFaceLog.skip, false, "face log does not skip");
assert.equal(readyFaceLog.record.type, "safety_log");
assert.equal(readyFaceLog.record.log_only, true);
assert.equal(readyFaceLog.record.reason, "face_absent");
assert.notEqual(readyFaceLog.record.reason, "explicit_ai");
assert.notEqual(readyFaceLog.record.type, "report_user");
assert.equal(readyFaceLog.record.face_ok, false);
assert.equal(readyFaceLog.record.face, "absent");
assert.equal(readyFaceLog.record.model_ready, true);
assert.equal(readyFaceLog.record.target_user_id, "");

const friendFaceLog = faceWatchSafetyLog({
  friendCall: true,
  detectorReady: true,
  fired: true,
  ts: 30,
});
assert.equal(friendFaceLog.send, false, "friend calls do not send face_ok");
assert.equal(friendFaceLog.record, null);
assert.equal(friendFaceLog.hardBlock, false);
assert.equal(friendFaceLog.skip, false);

let faceSent = null;
const faceDelivered = deliverSafetyLog(readyFaceLog.record, {
  send(rec) {
    faceSent = rec;
  },
});
assert.equal(faceDelivered.sent, true);
assert.equal(faceSent.face_ok, false);
assert.equal(faceSent.log_only, true);
assert.equal(faceSent.reason, "face_absent");
const faceNotSent = deliverSafetyLog(stubFaceLog.record, {
  send() {
    throw new Error("stub must not send");
  },
});
assert.equal(faceNotSent.sent, false);

const stubPartner = receiverPartnerCheck({
  detectorReady: false,
  verdict: { nsfw: "explicit", face: "absent" },
  session: createSafetySession(),
  wasBlur: false,
});
assert.equal(stubPartner.blur, false, "stub does not blur the partner");
assert.equal(stubPartner.toast, false, "stub does not toast");
assert.equal(stubPartner.record, null, "stub does not send");
assert.equal(stubPartner.hardBlock, false);
assert.equal(stubPartner.skip, false);

const clearPartner = receiverPartnerCheck({
  detectorReady: true,
  verdict: { nsfw: "clean", face: "present" },
  session: createSafetySession(),
  wasBlur: false,
});
assert.equal(clearPartner.blur, false, "a clean frame does not blur");
assert.equal(clearPartner.toast, false);
assert.equal(clearPartner.record, null);
assert.equal(clearPartner.hardBlock, false);
assert.equal(clearPartner.skip, false);

let partner = receiverPartnerCheck({
  detectorReady: true,
  verdict: { nsfw: "sexy", face: "present", scores: { porn: 0.1, hentai: 0, sexy: 0.7 } },
  session: createSafetySession(),
  wasBlur: false,
  targetUserId: "partner-1",
  model: "face",
  ts: 5,
});
assert.equal(partner.blur, true, "ready + hit blurs the partner");
assert.equal(partner.toast, true, "toast fires once when the blur starts");
assert.equal(partner.hardBlock, false, "partner flag does not end the call");
assert.equal(partner.skip, false, "partner flag does not skip");
assert.equal(partner.record.type, "safety_log");
assert.equal(partner.record.log_only, true);
assert.equal(partner.record.reason, "partner_flag_shadow");
assert.notEqual(partner.record.reason, "explicit_ai");
assert.notEqual(partner.record.type, "report_user");
assert.equal(partner.record.target_user_id, "partner-1");
assert.equal(partner.record.model_ready, true);
partner = receiverPartnerCheck({
  detectorReady: true,
  verdict: { nsfw: "sexy", face: "present" },
  session: partner.session,
  wasBlur: true,
  ts: 6,
});
assert.equal(partner.blur, true, "blur holds while the window is still hot");
assert.equal(partner.toast, false, "toast does not repeat");
assert.equal(partner.record, null, "a latched window does not send again");
assert.equal(partner.skip, false);
for (let i = 0; i < 3; i++) {
  partner = receiverPartnerCheck({
    detectorReady: true,
    verdict: { nsfw: "clean", face: "present" },
    session: partner.session,
    wasBlur: partner.blur,
    ts: 10 + i,
  });
}
assert.equal(partner.blur, false, "a clean window clears the partner blur");
assert.equal(partner.record, null);
assert.equal(partner.toast, false);
assert.equal(partner.hardBlock, false);
assert.equal(partner.skip, false);

const friendPartner = receiverPartnerCheck({
  friendCall: true,
  detectorReady: true,
  verdict: { nsfw: "explicit", face: "absent" },
  session: createSafetySession(),
  wasBlur: false,
});
assert.equal(friendPartner.blur, false, "friend calls are not partner-blurred");
assert.equal(friendPartner.toast, false);
assert.equal(friendPartner.record, null);
assert.equal(friendPartner.hardBlock, false);
assert.equal(friendPartner.skip, false);

let partnerSent = null;
const partnerDelivered = deliverSafetyLog(
  receiverPartnerCheck({
    detectorReady: true,
    verdict: { nsfw: "explicit", face: "present" },
    session: createSafetySession(),
    wasBlur: false,
    targetUserId: "partner-2",
    ts: 8,
  }).record,
  {
    send(rec) {
      partnerSent = rec;
    },
  }
);
assert.equal(partnerDelivered.sent, true);
assert.equal(partnerSent.reason, "partner_flag_shadow");
assert.equal(partnerSent.log_only, true);
assert.notEqual(partnerSent.reason, "explicit_ai");
assert.notEqual(partnerSent.type, "report_user");

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
