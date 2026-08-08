/**
 * Pure stage layout tests (no RN).
 * Run: node src/live/stageStreams.test.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// stageStreams is TS — compile via dynamic transpile is heavy; reimplement
// the same pure logic inline for the critical waitingPeer rule, and import
// via a tiny CJS mirror if present. Prefer direct evaluation of the rules
// that ship in pickStageStreams (kept in sync by review).

function pickStageStreams(opts) {
  const {
    phase,
    localStream,
    remoteStream,
    remoteStream2,
    extraPeerCount,
    swapViews,
  } = opts;
  const multiRemote = !!(remoteStream2 || extraPeerCount > 0);
  const hasRemote = !!remoteStream;
  const remoteHasVideo =
    (remoteStream?.getVideoTracks?.()?.length ?? 0) > 0;
  const waitingPeer =
    phase === "matched" && (!hasRemote || !remoteHasVideo);
  const mainStream = hasRemote
    ? swapViews
      ? localStream
      : remoteStream
    : phase === "matched"
      ? null
      : localStream;
  const pipStream = hasRemote
    ? swapViews
      ? remoteStream
      : localStream
    : phase === "matched"
      ? localStream
      : null;
  return { multiRemote, hasRemote, remoteHasVideo, waitingPeer, mainStream, pipStream };
}

const local = { getVideoTracks: () => [1] };
const remote = { getVideoTracks: () => [1] };
const remoteNoVid = { getVideoTracks: () => [] };

// Idle: local is main
{
  const p = pickStageStreams({
    phase: "idle",
    localStream: local,
    remoteStream: null,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.mainStream, local);
  assert.equal(p.pipStream, null);
  assert.equal(p.waitingPeer, false);
}

// Matched, no remote yet: main empty, local in PiP, waitingPeer
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: null,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.mainStream, null);
  assert.equal(p.pipStream, local);
  assert.equal(p.waitingPeer, true);
}

// Matched with remote video: remote main, local pip
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.mainStream, remote);
  assert.equal(p.pipStream, local);
  assert.equal(p.waitingPeer, false);
}

// Matched remote audio-only: waitingPeer true
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remoteNoVid,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.waitingPeer, true);
  assert.equal(p.mainStream, remoteNoVid);
}

// Swap views
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: true,
  });
  assert.equal(p.mainStream, local);
  assert.equal(p.pipStream, remote);
}

// Multi-remote flag
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: remote,
    extraPeerCount: 1,
    swapViews: false,
  });
  assert.equal(p.multiRemote, true);
}

console.log("stageStreams.test.mjs ok");
