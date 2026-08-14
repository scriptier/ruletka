/**
 * Pure stage layout tests (no RN).
 * Run: node src/live/stageStreams.test.mjs
 */
import assert from "node:assert/strict";

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
  const mainMirror = hasRemote ? swapViews : true;
  const pipMirror = hasRemote ? !swapViews : true;
  return {
    multiRemote,
    hasRemote,
    remoteHasVideo,
    waitingPeer,
    mainStream,
    pipStream,
    mainMirror,
    pipMirror,
  };
}

// Mirrors stageStreams.ts pickMultiTiles — split-screen tile assignment for
// the 2-remote layout (partner + second peer tiles; self stays in a separate
// PiP, never one of the two split tiles).
function pickMultiTiles(opts) {
  const {
    focusExtra,
    mainStream,
    remoteStream2,
    remoteEpoch,
    remoteEpoch2,
    swapViews,
    mainMirror,
    partnerName,
    secondName,
  } = opts;
  const tileA = {
    stream: focusExtra ? remoteStream2 : mainStream,
    epoch: focusExtra ? remoteEpoch2 : swapViews ? 0 : remoteEpoch,
    mirror: focusExtra ? false : mainMirror,
    name: focusExtra ? secondName : partnerName || "…",
    placeholder: focusExtra ? !remoteStream2 : !mainStream,
    isExtra: focusExtra,
  };
  const tileB = {
    stream: focusExtra ? mainStream : remoteStream2,
    epoch: focusExtra ? (swapViews ? 0 : remoteEpoch) : remoteEpoch2,
    mirror: focusExtra ? mainMirror : false,
    name: focusExtra ? partnerName || "…" : secondName,
    placeholder: focusExtra ? !mainStream : !remoteStream2,
    isExtra: !focusExtra,
  };
  return { tileA, tileB };
}

const local = { getVideoTracks: () => [{ readyState: "live" }] };
const remote = { getVideoTracks: () => [{ readyState: "live" }] };
const remoteNoVid = { getVideoTracks: () => [] };
const remoteAudioOnly = {
  getVideoTracks: () => [],
  getAudioTracks: () => [{ readyState: "live" }],
};

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

// Matched, no remote yet: main empty, local in PiP
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

// Matched, remote stream exists even without video: REMOTE on main
// (audio-first — old bug left main null = black while sound worked)
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remoteNoVid,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.mainStream, remoteNoVid);
  assert.equal(p.pipStream, local);
  assert.equal(p.hasRemote, true);
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

// Swap
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

// Audio-only remote still on main
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remoteAudioOnly,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.mainStream, remoteAudioOnly);
  assert.equal(p.pipStream, local);
}

// multiRemote flag: false with a single remote, no extras
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.multiRemote, false);
}

// multiRemote flag: true when a second remote stream is present
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: remote,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.multiRemote, true);
}

// multiRemote flag: true when extraPeerCount > 0 (no second stream object yet)
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    extraPeerCount: 2,
    swapViews: false,
  });
  assert.equal(p.multiRemote, true);
}

// mainMirror/pipMirror: remote on main (not swapped) — main not mirrored, pip (self) mirrored
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.mainMirror, false);
  assert.equal(p.pipMirror, true);
}

// mainMirror/pipMirror: swapped — self on main (mirrored), remote in pip (not mirrored)
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    extraPeerCount: 0,
    swapViews: true,
  });
  assert.equal(p.mainMirror, true);
  assert.equal(p.pipMirror, false);
}

// Edge: matched with a second remote peer but the primary remote hasn't
// arrived yet — main/pip fall back to waiting-peer layout even though
// multiRemote is already true (group call where the "main" partner drops
// mid-call while an extra peer is still connected).
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: null,
    remoteStream2: remote,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.multiRemote, true);
  assert.equal(p.hasRemote, false);
  assert.equal(p.mainStream, null);
  assert.equal(p.pipStream, local);
  assert.equal(p.waitingPeer, true);
}

// 2 remotes => split tiles are partner + second peer; self is never one of
// the two split tiles (self rides a separate PiP — see LiveStageVideo's
// `multiRemote && localStream` PiP block, which is independent of tileA/tileB).
{
  const remote2 = { getVideoTracks: () => [{ readyState: "live" }] };
  const { tileA, tileB } = pickMultiTiles({
    focusExtra: false,
    mainStream: remote,
    remoteStream2: remote2,
    remoteEpoch: 1,
    remoteEpoch2: 2,
    swapViews: false,
    mainMirror: false,
    partnerName: "Partner",
    secondName: "Second",
  });
  assert.equal(tileA.stream, remote);
  assert.equal(tileA.name, "Partner");
  assert.equal(tileB.stream, remote2);
  assert.equal(tileB.name, "Second");
  assert.notEqual(tileA.stream, local);
  assert.notEqual(tileB.stream, local);
}

// focusExtra flips which remote leads the split (tap second peer to focus it)
{
  const remote2 = { getVideoTracks: () => [{ readyState: "live" }] };
  const { tileA, tileB } = pickMultiTiles({
    focusExtra: true,
    mainStream: remote,
    remoteStream2: remote2,
    remoteEpoch: 1,
    remoteEpoch2: 2,
    swapViews: false,
    mainMirror: false,
    partnerName: "Partner",
    secondName: "Second",
  });
  assert.equal(tileA.stream, remote2);
  assert.equal(tileA.name, "Second");
  assert.equal(tileB.stream, remote);
  assert.equal(tileB.name, "Partner");
}

console.log("stageStreams.test.mjs: ok");
