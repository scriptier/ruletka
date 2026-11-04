/**
 * Static invariants for MediaSession multi safety (P1-mediasession-multi).
 * Run: node src/media/mediasessionMultiSafety.test.mjs
 *
 * Rules:
 * 1. Secondary never stop() primary tracks (closeCall ownership)
 * 2. iceCandidatePoolSize = 0
 * 3. Pure answer uses full relayWaitBudgetMs() (not 180/220 hard-cap —
 *    that emitted relay_candidates=0 and ICE failed / black linking)
 * 4. No getUserMedia on secondaryLink paths
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "MediaSession.ts"), "utf8");

// --- pool=0 ---
assert.match(
  src,
  /const iceCandidatePoolSize\s*=\s*0/,
  "iceCandidatePoolSize must be hardcoded 0"
);
assert.doesNotMatch(
  src,
  /iceCandidatePoolSize\s*=\s*[1-9]/,
  "iceCandidatePoolSize must never be set to a positive number"
);

assert.match(
  src,
  /startCall_recycle_stale_answerer/,
  "rematch must recycle leftover connected answerer PC (20s have-remote-offer)"
);
assert.match(
  src,
  /offer_retry_stuck_have_remote/,
  "stuck have-remote-offer >2s must retry answer"
);
assert.ok(
  /pendingRemoteOfferSince < 1500/.test(src.replace(/\s+/g, " ")) ||
    src.includes("pendingRemoteOfferSince < 1500"),
  "offer-inflight startCall skip must be 1.5s not 8s"
);

// TURNS kept on force_relay path (RU/DPI); TCP 3478 still dropped
assert.match(
  src,
  /if \(u\.startsWith\("turns:"\)\) return true/,
  "udpTurnOnly must keep turns: TLS URLs"
);

// --- pure answer: full relayWaitBudgetMs (1200), poll only, never overwrite onicecandidate
const answerBudgetBlock = src.slice(
  src.indexOf("force_relay / Hide IP: wait briefly for typ relay"),
  src.indexOf("const local = pcAnswer.localDescription")
);
assert.ok(
  !/warmAnswer\s*\?\s*180\s*:\s*220/.test(answerBudgetBlock),
  "must not reintroduce 180/220 answer hard-cap"
);
assert.ok(
  !/Math\.min\(\s*this\.relayWaitBudgetMs\(\)[^)]*,\s*480\s*\)/.test(
    answerBudgetBlock
  ),
  "must not hard-cap answer wait at 480 (0-relay ICE fail)"
);
assert.ok(
  /relayWaitBudgetMs\(\)\s*\|\|\s*1200/.test(answerBudgetBlock) ||
    answerBudgetBlock.includes("1200"),
  "answer wait uses full relayWaitBudgetMs / 1200"
);
const waitFn = src.slice(
  src.indexOf("function waitForIceGatherRelayOrDone"),
  src.indexOf("export class MediaSession")
);
assert.ok(
  waitFn.includes("setInterval"),
  "waitForIceGather must poll localDescription (not overwrite onicecandidate)"
);
assert.ok(
  !/pc\.onicecandidate\s*=/.test(waitFn),
  "waitForIceGather must not assign pc.onicecandidate (trickle sender)"
);
const waitFnCode = waitFn
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, ""))
  .join("\n");
assert.doesNotMatch(
  waitFnCode,
  /Math\.max\(\s*250/,
  "waitForIceGather must not force 250ms floor"
);

// --- no GUM secondary / 3-way primary ---
for (const marker of [
  "ensure_local_skip_secondary_no_gum",
  "open_local_skip_secondary_no_gum",
  "refresh_local_skip_multi",
]) {
  assert.ok(src.includes(marker), `missing secondary no-GUM guard: ${marker}`);
assert.ok(
  src.includes("!this.secondaryLink && !this.multiPeerAudio"),
  "startCall must skip applyFullAudioProcessing on extra 3-way PC"
);
}
assert.ok(
  src.includes("this.secondaryLink || (liveV && !outboundDead)"),
  "refreshLocalVideoTrack: extras never GUM; primary may GUM on zero_f even in 3-way"
);
assert.ok(
  !src.includes(
    "this.secondaryLink || this.multiPeerAudio || (liveV && !outboundDead)"
  ),
  "must not skip primary GUM solely because multiPeerAudio (203759Z fout=0)"
);
assert.ok(
  src.includes('const outboundDead = /^zero_f_/.test(why) || /^weak_/.test(why)'),
  "1v1 zero_f_/weak_ must be allowed to re-GUM (399 fout=0 after liveV skip)"
);
assert.ok(
  src.includes("refresh_local_1v1_dead_gum"),
  "1v1 outbound-dead must stop old track before GUM (not mid-onConfigured)"
);
assert.ok(
  src.includes("open_local_skip_other_owner"),
  "openLocalStream must skip GUM when another session owns the camera"
);
assert.ok(
  src.includes("ensure_local_skip_other_owner"),
  "ensureLocalStream must skip GUM when another session owns the camera"
);
assert.ok(
  src.includes("const gumOwners = new Set"),
  "process-wide gumOwners set required (one Camera2 session)"
);
assert.match(
  src,
  /async ensureLocalStream[\s\S]*?if \(this\.secondaryLink\)[\s\S]*?return null/,
  "ensureLocalStream must early-return on secondaryLink"
);
assert.match(
  src,
  /private async openLocalStream[\s\S]*?if \(this\.secondaryLink\)[\s\S]*?return null/,
  "openLocalStream must early-return on secondaryLink"
);
assert.match(
  src,
  /private async refreshLocalVideoTrack[\s\S]*?if \(this\.secondaryLink\)/,
  "refreshLocalVideoTrack must skip GUM on secondary"
);

// --- secondary never stop primary ---
assert.match(
  src,
  /const mayStopLocal =\s*!keepLocal && this\.localStreamOwned && !this\.secondaryLink/,
  "closeCall mayStopLocal requires !keepLocal && owned && !secondary"
);
assert.ok(
  src.includes("closeCall_no_stop_shared"),
  "closeCall logs when skipping stop on shared/secondary"
);
assert.ok(
  src.includes("closeCall_secondary_drop_local_ref"),
  "closeCall drops secondary local ref without stop"
);
assert.ok(
  src.includes("detachLocalSenders"),
  "closeCall must detach senders before pc.close"
);
assert.ok(
  src.includes("releaseOwnedClones"),
  "secondary clones released without stopping primary"
);
assert.ok(
  src.includes("open_local_audio_only"),
  "openLocalStream must fall back to audio-only when camera missing"
);
assert.ok(
  src.includes("adoptLocalStream"),
  "adoptLocalStream present for no-GUM secondary"
);
assert.match(
  src,
  /const preferClone = opts\?\.preferClone !== false/,
  "adoptLocalStream clones video for secondary by default"
);
assert.ok(
  src.includes("tryBuildSecondaryOutbound"),
  "clone path for secondary outbound"
);
assert.ok(
  src.includes("clonedVideo"),
  "secondary outbound reports cloned video"
);
assert.ok(
  src.includes("closeCall_keep_local_preview"),
  "closeCall({keepLocal}) keeps primary preview (no stop)"
);
assert.ok(
  src.includes("flip_skip_secondary") || src.includes("flipCamera"),
  "flipCamera exists"
);
assert.match(
  src,
  /async flipCamera[\s\S]*?if \(this\.secondaryLink\)/,
  "flipCamera must no-op on secondary"
);
assert.ok(
  src.includes("ensureUserFacingPreview"),
  "new 1v1 resets leftover rear cam (desk black)"
);
assert.ok(
  src.includes("facing_reset_user"),
  "rear leftover logs facing_reset_user"
);
assert.match(
  src,
  /ensureUserFacingPreview[\s\S]*?if \(this\.secondaryLink\) return false/,
  "ensureUserFacingPreview must no-op on secondary"
);
{
  const i = src.indexOf("ensureUserFacingPreview(): boolean");
  const body = i >= 0 ? src.slice(i, i + 900) : "";
  assert.ok(body.includes("_switchCamera"), "rear leftover uses _switchCamera");
  assert.ok(!body.includes("getUserMedia"), "ensureUserFacingPreview must not GUM (gotcha 58)");
}
assert.ok(
  src.includes("!this.inAnsweredCall()") &&
    src.includes("ensureUserFacingPreview()"),
  "startCall/preview reset facing only when not already in a live call"
);

// Multi encode floor: never apply "min" while multiPeerAudio / secondaryLink
// (web mobileSafeMultiTier parity — min freezes mobile HW encoders).
assert.match(
  src,
  /async applyQualityTier[\s\S]*?multiPeerAudio[\s\S]*?secondaryLink[\s\S]*?capped === "min"[\s\S]*?capped = "low"/,
  "applyQualityTier must floor multi min→low"
);
assert.match(
  src,
  /this\.qualityCeiling = clampQualityTier\(this\.qualityCeiling, "low"\)/,
  "3-way primary encode ceiling is low (walk budget)"
);
assert.match(
  src,
  /multi && t\.label === "low"/,
  "3-way low uses scale×2 (half-res, not min bitrate)"
);

// Pure decision table (mirrors closeCall ownership + keepLocal)
function mayStopLocalTracks({ localStreamOwned, secondaryLink, keepLocal = false }) {
  return !keepLocal && !!(localStreamOwned && !secondaryLink);
}
assert.equal(mayStopLocalTracks({ localStreamOwned: true, secondaryLink: false }), true);
assert.equal(mayStopLocalTracks({ localStreamOwned: true, secondaryLink: true }), false);
assert.equal(mayStopLocalTracks({ localStreamOwned: false, secondaryLink: true }), false);
assert.equal(mayStopLocalTracks({ localStreamOwned: false, secondaryLink: false }), false);
assert.equal(
  mayStopLocalTracks({ localStreamOwned: true, secondaryLink: false, keepLocal: true }),
  false,
  "keepLocal must never stop primary preview"
);
assert.equal(
  mayStopLocalTracks({ localStreamOwned: true, secondaryLink: true, keepLocal: true }),
  false
);

function pureAnswerBudgetMs(relayWaitBudgetMs) {
  return relayWaitBudgetMs;
}
assert.equal(pureAnswerBudgetMs(1200), 1200);
assert.equal(pureAnswerBudgetMs(0), 0);

// Closed PC must not be reused for setRemote (laptop↔Android ICE failed 387)
assert.ok(src.includes("pc_drop_closed"), "must log pc_drop_closed");
assert.ok(src.includes("private isPcDead"), "isPcDead helper");
assert.ok(src.includes("private dropDeadPc"), "dropDeadPc helper");
assert.ok(
  src.includes('this.dropDeadPc("ensurePc")'),
  "ensurePc must drop closed PC before reuse"
);
assert.ok(
  /if \(!this\.inAnsweredCall\(\)\) this\.dropDeadPc\("startCall"\)/.test(src),
  "startCall must not dropDeadPc after we already answered"
);
assert.ok(
  /if \(!this\.inAnsweredCall\(\)\) this\.dropDeadPc\("ensurePc"\)/.test(src),
  "ensurePc must not replace a live answered PC"
);
assert.ok(src.includes("pc_keep_incall"), "must log when keeping in-call PC");
assert.ok(
  /dropDeadPc\("signal_offer"[\s\S]{0,80}keepPendingIce:\s*true/.test(src),
  "offer path drops closed PC but keeps queued trickle ICE"
);
assert.ok(
  /const pcBusy =[\s\S]*!this\.isPcDead\(this\.pc\)/.test(src),
  "pcBusy must ignore closed leftover PC"
);
assert.ok(
  !src.includes("spreadRelayCandidatesAcrossMlines("),
  "do not apply relay-spread on offer/answer (382/383 broke PC↔Android)"
);
assert.ok(
  !src.includes("remote_offer_video_recvonly"),
  "do not latch no-cam from recvonly SDP (PC cam painted as no-cam)"
);

// --- answered primary rejects foreign 3-way offer (i3-ms) ---
// Extra-peer SDP must not dropDeadPc / setRemote on an already-answered PC.
assert.ok(
  src.includes("offer_reject_answered"),
  "must log offer_reject_answered when ignoring extra-peer SDP"
);
assert.match(
  src,
  /if \(kind === "offer" && this\.inAnsweredCall\(\)\)/,
  "handleRemoteSignal offer must reject when inAnsweredCall"
);
assert.ok(
  src.includes("private hasLiveAnsweredIce"),
  "hasLiveAnsweredIce helper for remoteDesc + ice checking/connected/completed + tracks"
);
assert.match(
  src,
  /if \(kind === "offer" && this\.hasLiveAnsweredIce\(\) && this\.secondaryLink\)/,
  "handleRemoteSignal offer must reject live answered ICE only on secondary (foreign 3-way)"
);
assert.ok(
  src.includes("offer_apply_rematch_answered"),
  "primary rematch must apply leftover-answered offer (not sit 20s)"
);
assert.match(
  src,
  /if \(kind === "offer" && !this\.inAnsweredCall\(\)\)[\s\S]{0,80}dropDeadPc\("signal_offer"/,
  "signal_offer dropDeadPc must never run on inAnsweredCall"
);
assert.doesNotMatch(
  src,
  /dropDeadPc\("signal_offer"[\s\S]{0,80}allowInCall:\s*true/,
  "signal_offer must not allowInCall dropDeadPc (tears answered primary)"
);
// Reject path must return before setRemote — no rebuild on extra-peer offer.
const offerRejectBlock = src.slice(
  src.indexOf('if (kind === "offer" && this.inAnsweredCall())'),
  src.indexOf("Trickle ICE can arrive before offer/answer")
);
assert.ok(
  offerRejectBlock.includes("return;"),
  "answered-offer reject must return (not fall through to setRemote)"
);
assert.ok(
  !offerRejectBlock.includes("setRemoteDescription"),
  "answered-offer reject must not setRemote a foreign offer"
);
assert.ok(
  !offerRejectBlock.includes("dropDeadPc"),
  "answered-offer reject must not dropDeadPc"
);

console.log("mediasessionMultiSafety.test.mjs: ok");
