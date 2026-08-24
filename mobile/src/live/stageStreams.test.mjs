/**
 * Pure stage layout tests (no RN).
 * Mirrors stageStreams.ts — keep in sync when changing layout helpers.
 * Run: node src/live/stageStreams.test.mjs
 *
 * NOTE: "hunting" / find-3rd split UI (top=partner, bottom=looking strip) is
 * NOT modeled here. That state (huntingWithPartner / huntingThird) lives in
 * LiveStageVideo.tsx + app/live.tsx and intentionally keeps multiRemote/
 * pickMultiTiles out of the picture while hunting alone with one partner —
 * see LiveStageVideo.tsx "Real multi only (2 remotes). Hunt layout uses 1v1
 * VideoView + looking strip." stageStreams.ts only orders/picks streams once
 * real remotes exist; it has no concept of "hunting".
 */
import assert from "node:assert/strict";

const MAX_REMOTE_TILES = 3;

function pickStageStreams(opts) {
  const {
    phase,
    localStream,
    remoteStream,
    remoteStream2,
    remoteStream3 = null,
    extraPeerCount,
    swapViews,
  } = opts;
  // True multi = stream2/3 only. extraPeerCount / hunt ≠ multi.
  const multiRemote = !!(remoteStream2 || remoteStream3);
  const hasRemote = !!remoteStream;
  const remoteHasVideo =
    (remoteStream?.getVideoTracks?.()?.length ?? 0) > 0;
  const remoteHasAudio =
    (remoteStream?.getAudioTracks?.()?.length ?? 0) > 0;
  // Source contract (stageStreams.ts): matched && !hasRemote.
  // Audio-only laptop (stream object exists, no video) is linked, not waiting.
  const waitingPeer = phase === "matched" && !hasRemote;
  let remoteCount = 0;
  if (remoteStream) remoteCount += 1;
  if (remoteStream2) remoteCount += 1;
  if (remoteStream3) remoteCount += 1;
  if (extraPeerCount > 0) {
    remoteCount = Math.max(
      remoteCount,
      Math.min(MAX_REMOTE_TILES, 1 + Math.floor(Number(extraPeerCount) || 0))
    );
  }
  remoteCount = Math.min(MAX_REMOTE_TILES, remoteCount);
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
    remoteHasAudio,
    waitingPeer,
    mainStream,
    pipStream,
    mainMirror,
    pipMirror,
    remoteCount,
  };
}

function pickMultiRemoteTiles(opts) {
  const remotes = (opts.remotes || []).slice(0, MAX_REMOTE_TILES);
  if (!remotes.length) return [];
  const n = remotes.length;
  const focus = Math.max(
    0,
    Math.min(n - 1, Math.floor(Number(opts.focusIndex) || 0))
  );
  const order = [focus];
  for (let i = 0; i < n; i++) {
    if (i !== focus) order.push(i);
  }
  return order.map((i, pos) => {
    const r = remotes[i];
    const stream = r?.stream ?? null;
    return {
      stream,
      epoch: Number(r?.epoch) || 0,
      mirror: !!r?.mirror,
      name: String(r?.name || "").trim() || "…",
      placeholder: !stream,
      isExtra: i > 0,
      focused: pos === 0,
      remoteIndex: i,
    };
  });
}

function pickMultiTiles(opts) {
  const remotes = [
    {
      stream: opts.mainStream,
      epoch: opts.swapViews ? 0 : opts.remoteEpoch,
      name: opts.partnerName || "…",
      mirror: opts.mainMirror,
    },
    {
      stream: opts.remoteStream2,
      epoch: opts.remoteEpoch2,
      name: opts.secondName || "…",
      mirror: false,
    },
  ];
  if (opts.remoteStream3 || opts.thirdName) {
    remotes.push({
      stream: opts.remoteStream3 || null,
      epoch: opts.remoteEpoch3 || 0,
      name: opts.thirdName || "…",
      mirror: false,
    });
  }
  const tiles = pickMultiRemoteTiles({
    focusIndex: opts.focusExtra ? 1 : 0,
    remotes,
  });
  return {
    tileA: tiles[0],
    tileB: tiles[1],
    tileC: tiles[2],
    tiles,
  };
}

function shouldShowExtraRemoteTile(opts) {
  if (opts.remoteStream2) return true;
  return Math.max(0, Math.floor(Number(opts.extraPeerCount) || 0)) >= 1;
}

function shouldShowExtraRemoteTile3(opts) {
  if (opts.remoteStream3) return true;
  return Math.max(0, Math.floor(Number(opts.extraPeerCount) || 0)) >= 2;
}

function shouldLockFirstRemote(opts) {
  if (opts.remoteStream3) return true;
  return shouldShowExtraRemoteTile({
    extraPeerCount: opts.extraPeerCount,
    remoteStream2: opts.remoteStream2,
  });
}

function extraTilePaint(opts) {
  if (opts.advertisedNoCam) return "nocam";
  if (opts.hasStream && !opts.hasVideo && opts.hasAudio) return "nocam";
  if (!opts.hasStream) return "connecting";
  return "video";
}

function isLookingForThird(opts) {
  if (opts.remoteStream2 || opts.remoteStream3) return false;
  if (Math.max(0, Math.floor(Number(opts.extraPeerCount) || 0)) >= 1) {
    return false;
  }
  void opts.findThirdPending;
  return !!opts.remoteStream && !!opts.huntingWithPartner;
}

function canShowGrid2x2(opts) {
  void opts.remoteStream3;
  return Math.floor(Number(opts.extraPeerCount) || 0) >= 2;
}

function pickStageChromeLayout(opts) {
  const has2 = !!opts.remoteStream2;
  const has3 = !!opts.remoteStream3;
  const extra = Math.max(0, Math.floor(Number(opts.extraPeerCount) || 0));
  let remoteCount = 0;
  if (opts.hasRemote) remoteCount += 1;
  if (has2) remoteCount += 1;
  if (has3) remoteCount += 1;
  if (extra > 0) {
    remoteCount = Math.max(
      remoteCount,
      Math.min(MAX_REMOTE_TILES, (opts.hasRemote ? 1 : 0) + extra)
    );
  }
  const people = remoteCount === 0 ? 1 : Math.min(4, remoteCount + 1);
  const showGrid2x2Toggle = canShowGrid2x2({
    remoteStream3: opts.remoteStream3,
    extraPeerCount: extra,
  });
  const useGrid2x2 = showGrid2x2Toggle && opts.grid2x2 !== false;
  const wrapFirstPartner = has2 || has3 || extra >= 1;
  const includeLocalTile = has3 || extra >= 2;
  const pipYou = !includeLocalTile;
  const youParty = String(opts.yourRole || "") === "party";
  void opts.splitWide;
  const portraitColumn = wrapFirstPartner && !useGrid2x2;
  return {
    people,
    portraitColumn,
    includeLocalTile,
    pipYou,
    useGrid2x2,
    showGrid2x2Toggle,
    wrapFirstPartner,
    youParty,
  };
}

const local = { getVideoTracks: () => [{ readyState: "live" }] };
const remote = { getVideoTracks: () => [{ readyState: "live" }] };
const remoteNoVid = { getVideoTracks: () => [] };
const remoteAudioOnly = {
  getVideoTracks: () => [],
  getAudioTracks: () => [{ readyState: "live" }],
};
const remote2 = { getVideoTracks: () => [{ readyState: "live" }] };
const remote3 = { getVideoTracks: () => [{ readyState: "live" }] };

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
  assert.equal(p.remoteCount, 0);
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
  assert.equal(p.waitingPeer, false);
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
  assert.equal(p.remoteCount, 1);
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
  assert.equal(p.hasRemote, true);
  assert.equal(p.remoteHasAudio, true);
  assert.equal(p.waitingPeer, false);
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
  assert.equal(p.remoteCount, 2);
}

// multiRemote flag: extraPeerCount alone is NOT multi (hunt / hub hint)
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    extraPeerCount: 2,
    swapViews: false,
  });
  assert.equal(p.multiRemote, false);
  assert.equal(p.remoteCount, 3);
}

// third remote stream (4-way)
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: remote2,
    remoteStream3: remote3,
    extraPeerCount: 2,
    swapViews: false,
  });
  assert.equal(p.multiRemote, true);
  assert.equal(p.remoteCount, 3);
  assert.equal(MAX_REMOTE_TILES, 3);
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

// pickMultiTiles: focus primary
{
  const { tileA, tileB, tiles } = pickMultiTiles({
    focusExtra: false,
    mainStream: remote,
    remoteStream2: remote2,
    remoteEpoch: 1,
    remoteEpoch2: 2,
    swapViews: false,
    mainMirror: false,
    partnerName: "Alice",
    secondName: "Bob",
  });
  assert.equal(tileA.stream, remote);
  assert.equal(tileA.name, "Alice");
  assert.equal(tileA.focused, true);
  assert.equal(tileB.stream, remote2);
  assert.equal(tileB.name, "Bob");
  assert.equal(tileB.isExtra, true);
  assert.equal(tiles.length, 2);
}

// pickMultiTiles: focus extra
{
  const { tileA, tileB } = pickMultiTiles({
    focusExtra: true,
    mainStream: remote,
    remoteStream2: remote2,
    remoteEpoch: 1,
    remoteEpoch2: 2,
    swapViews: false,
    mainMirror: false,
    partnerName: "Alice",
    secondName: "Bob",
  });
  assert.equal(tileA.stream, remote2);
  assert.equal(tileA.name, "Bob");
  assert.equal(tileB.stream, remote);
  assert.equal(tileB.name, "Alice");
}

// pickMultiTiles + third remote
{
  const { tileA, tileB, tileC, tiles } = pickMultiTiles({
    focusExtra: false,
    mainStream: remote,
    remoteStream2: remote2,
    remoteStream3: remote3,
    remoteEpoch: 1,
    remoteEpoch2: 2,
    remoteEpoch3: 3,
    swapViews: false,
    mainMirror: false,
    partnerName: "A",
    secondName: "B",
    thirdName: "C",
  });
  assert.equal(tiles.length, 3);
  assert.equal(tileA.name, "A");
  assert.equal(tileB.name, "B");
  assert.equal(tileC?.name, "C");
  assert.equal(tileC?.stream, remote3);
  assert.equal(tileC?.isExtra, true);
}

// pickMultiRemoteTiles: focus third of three
{
  const tiles = pickMultiRemoteTiles({
    focusIndex: 2,
    remotes: [
      { stream: remote, epoch: 1, name: "A" },
      { stream: remote2, epoch: 2, name: "B" },
      { stream: remote3, epoch: 3, name: "C" },
    ],
  });
  assert.equal(tiles.length, 3);
  assert.equal(tiles[0].name, "C");
  assert.equal(tiles[0].focused, true);
  assert.equal(tiles[0].remoteIndex, 2);
  assert.equal(tiles[1].name, "A");
  assert.equal(tiles[2].name, "B");
}

// Cap at MAX_REMOTE_TILES
{
  const tiles = pickMultiRemoteTiles({
    focusIndex: 0,
    remotes: [
      { stream: remote, epoch: 1, name: "A" },
      { stream: remote2, epoch: 2, name: "B" },
      { stream: remote3, epoch: 3, name: "C" },
      { stream: remote, epoch: 4, name: "D" },
    ],
  });
  assert.equal(tiles.length, 3);
}

// pickMultiRemoteTiles: focus middle (index 1) of three — stable order for rest
{
  const tiles = pickMultiRemoteTiles({
    focusIndex: 1,
    remotes: [
      { stream: remote, epoch: 1, name: "A" },
      { stream: remote2, epoch: 2, name: "B" },
      { stream: remote3, epoch: 3, name: "C" },
    ],
  });
  assert.equal(tiles.length, 3);
  assert.equal(tiles[0].name, "B");
  assert.equal(tiles[0].focused, true);
  assert.equal(tiles[0].remoteIndex, 1);
  assert.equal(tiles[1].name, "A");
  assert.equal(tiles[1].focused, false);
  assert.equal(tiles[1].remoteIndex, 0);
  assert.equal(tiles[2].name, "C");
  assert.equal(tiles[2].remoteIndex, 2);
}

// pickMultiRemoteTiles: focusIndex out of range clamps into [0, n-1]
{
  const remotes = [
    { stream: remote, epoch: 1, name: "A" },
    { stream: remote2, epoch: 2, name: "B" },
    { stream: remote3, epoch: 3, name: "C" },
  ];
  const tooHigh = pickMultiRemoteTiles({ focusIndex: 99, remotes });
  assert.equal(tooHigh[0].name, "C"); // clamps to n-1 = 2
  const negative = pickMultiRemoteTiles({ focusIndex: -5, remotes });
  assert.equal(negative[0].name, "A"); // clamps to 0
}

// pickMultiRemoteTiles: isExtra/placeholder correct across all 3 slots,
// including a still-connecting (null stream) middle remote
{
  const tiles = pickMultiRemoteTiles({
    focusIndex: 0,
    remotes: [
      { stream: remote, epoch: 1, name: "A" },
      { stream: null, epoch: 0, name: "B" },
      { stream: remote3, epoch: 3, name: "C" },
    ],
  });
  assert.equal(tiles.length, 3);
  assert.equal(tiles[0].isExtra, false);
  assert.equal(tiles[0].placeholder, false);
  assert.equal(tiles[1].name, "B");
  assert.equal(tiles[1].isExtra, true);
  assert.equal(tiles[1].placeholder, true);
  assert.equal(tiles[2].name, "C");
  assert.equal(tiles[2].isExtra, true);
  assert.equal(tiles[2].placeholder, false);
}

// pickMultiRemoteTiles: empty remotes → empty array
{
  const tiles = pickMultiRemoteTiles({ focusIndex: 0, remotes: [] });
  assert.deepEqual(tiles, []);
}

// pickMultiTiles: third remote present but no thirdName → placeholder name
{
  const { tileC, tiles } = pickMultiTiles({
    focusExtra: false,
    mainStream: remote,
    remoteStream2: remote2,
    remoteStream3: remote3,
    remoteEpoch: 1,
    remoteEpoch2: 2,
    remoteEpoch3: 3,
    swapViews: false,
    mainMirror: false,
    partnerName: "A",
    secondName: "B",
  });
  assert.equal(tiles.length, 3);
  assert.equal(tileC?.name, "…");
  assert.equal(tileC?.stream, remote3);
}

// pickMultiTiles: no third stream and no thirdName → stays 2-way (no tileC)
{
  const { tileC, tiles } = pickMultiTiles({
    focusExtra: false,
    mainStream: remote,
    remoteStream2: remote2,
    remoteEpoch: 1,
    remoteEpoch2: 2,
    swapViews: false,
    mainMirror: false,
    partnerName: "A",
    secondName: "B",
  });
  assert.equal(tiles.length, 2);
  assert.equal(tileC, undefined);
}

// remoteCount caps at MAX_REMOTE_TILES even with a large extraPeerCount
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    extraPeerCount: 10,
    swapViews: false,
  });
  assert.equal(p.multiRemote, false);
  assert.equal(p.remoteCount, MAX_REMOTE_TILES);
}

// 1v1: 2 people, pip you, no wrap, no 2×2
{
  const L = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: null,
    remoteStream3: null,
    extraPeerCount: 0,
  });
  assert.equal(L.people, 2);
  assert.equal(L.portraitColumn, false);
  assert.equal(L.wrapFirstPartner, false);
  assert.equal(L.pipYou, true);
  assert.equal(L.includeLocalTile, false);
  assert.equal(L.useGrid2x2, false);
  assert.equal(L.showGrid2x2Toggle, false);
}

// Hunt (no stream2, extras=0): same 1v1 tree — do not wrap (400 SurfaceView tear)
{
  const L = pickStageChromeLayout({
    hasRemote: true,
    huntingThird: true,
    remoteStream2: null,
    remoteStream3: null,
    extraPeerCount: 0,
  });
  assert.equal(L.people, 2);
  assert.equal(L.wrapFirstPartner, false);
  assert.equal(L.portraitColumn, false);
  assert.equal(L.pipYou, true);
  assert.equal(L.showGrid2x2Toggle, false);
}

// extras listed, stream2 not bound: wrap first partner, 3 people, extra tile
{
  const L = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: null,
    remoteStream3: null,
    extraPeerCount: 1,
  });
  assert.equal(L.people, 3);
  assert.equal(L.wrapFirstPartner, true);
  assert.equal(L.portraitColumn, true);
  assert.equal(L.pipYou, true);
  assert.equal(L.includeLocalTile, false);
  assert.equal(shouldShowExtraRemoteTile({ extraPeerCount: 1, remoteStream2: null }), true);
}

// extras=2 (4-way listed, stream3 not bound): 4 tiles, you on stage
{
  const L = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: null,
    remoteStream3: null,
    extraPeerCount: 2,
  });
  assert.equal(L.people, 4);
  assert.equal(L.includeLocalTile, true);
  assert.equal(L.pipYou, false);
  assert.equal(
    shouldShowExtraRemoteTile3({ extraPeerCount: 2, remoteStream3: null }),
    true
  );
  assert.equal(
    shouldShowExtraRemoteTile3({ extraPeerCount: 1, remoteStream3: null }),
    false
  );
}

// 223218Z: extras=1 + stream2 null + no-cam/audio-only partner still splits
{
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remoteAudioOnly,
    remoteStream2: null,
    extraPeerCount: 1,
    swapViews: false,
  });
  assert.equal(p.hasRemote, true);
  assert.equal(p.mainStream, remoteAudioOnly);
  assert.equal(p.waitingPeer, false);
  assert.equal(p.remoteCount, 2);
  // stream picker multiRemote stays stream2/3-only; chrome/tile helpers split
  assert.equal(p.multiRemote, false);
  const L = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: null,
    extraPeerCount: 1,
  });
  assert.equal(L.people, 3);
  assert.equal(L.wrapFirstPartner, true);
  assert.equal(L.portraitColumn, true);
  assert.equal(
    shouldShowExtraRemoteTile({ extraPeerCount: 1, remoteStream2: null }),
    true
  );
  assert.equal(
    shouldLockFirstRemote({ extraPeerCount: 1, remoteStream2: null }),
    true
  );
}

// ExtraRemoteTile: extras>=1 even if remoteStream2 null
assert.equal(
  extraTilePaint({ advertisedNoCam: true, hasStream: false }),
  "nocam",
  "laptop advertised no-cam is cylinder, not Almost there"
);
assert.equal(
  extraTilePaint({ hasStream: true, hasVideo: false, hasAudio: true }),
  "nocam"
);
assert.equal(extraTilePaint({ hasStream: false }), "connecting");
assert.equal(
  extraTilePaint({ hasStream: true, hasVideo: true }),
  "video"
);
assert.equal(
  shouldShowExtraRemoteTile({ extraPeerCount: 1, remoteStream2: null }),
  true
);
assert.equal(
  shouldShowExtraRemoteTile({ extraPeerCount: 0, remoteStream2: null }),
  false
);
assert.equal(
  shouldShowExtraRemoteTile({ extraPeerCount: 0, remoteStream2: remote2 }),
  true
);

// First VideoView lock: extras>=1 or stream2/3 (no swap/epoch remount)
assert.equal(
  shouldLockFirstRemote({ extraPeerCount: 1, remoteStream2: null }),
  true
);
assert.equal(
  shouldLockFirstRemote({ extraPeerCount: 0, remoteStream2: null }),
  false
);
assert.equal(
  shouldLockFirstRemote({ extraPeerCount: 0, remoteStream2: remote2 }),
  true
);
assert.equal(
  shouldLockFirstRemote({
    extraPeerCount: 0,
    remoteStream2: null,
    remoteStream3: remote3,
  }),
  true
);

// 1v1 → extras>=1 (no hunt): wrap first partner + extra tile + lock
{
  const oneVone = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: null,
    extraPeerCount: 0,
  });
  const extrasJoin = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: null,
    extraPeerCount: 1,
  });
  assert.equal(oneVone.wrapFirstPartner, false);
  assert.equal(oneVone.people, 2);
  assert.equal(extrasJoin.wrapFirstPartner, true);
  assert.equal(extrasJoin.people, 3);
  assert.equal(extrasJoin.portraitColumn, true);
  assert.equal(extrasJoin.pipYou, true);
  assert.equal(
    shouldShowExtraRemoteTile({ extraPeerCount: 1, remoteStream2: null }),
    true
  );
  assert.equal(
    shouldLockFirstRemote({ extraPeerCount: 1, remoteStream2: null }),
    true
  );
}

// pickMultiTiles: extras listed, stream2 null → placeholder extra tile
{
  const { tileB, tiles } = pickMultiTiles({
    focusExtra: false,
    mainStream: remote,
    remoteStream2: null,
    remoteEpoch: 1,
    remoteEpoch2: 0,
    swapViews: false,
    mainMirror: false,
    partnerName: "Courtier",
    secondName: "Laptop",
  });
  assert.equal(tiles.length, 2);
  assert.equal(tileB.stream, null);
  assert.equal(tileB.placeholder, true);
  assert.equal(tileB.isExtra, true);
  assert.equal(tileB.name, "Laptop");
}

// Hunt: wrap stays false until a 3rd is listed (then split). Hunt start
// must not restyle 1v1 remoteFill (400: overflow hidden tore SurfaceView).
{
  const huntingAlone = pickStageChromeLayout({
    hasRemote: true,
    huntingThird: true,
    remoteStream2: null,
    remoteStream3: null,
    extraPeerCount: 0,
  });
  const secondLands = pickStageChromeLayout({
    hasRemote: true,
    huntingThird: false, // hub flips hunting off exactly as stream2 arrives
    remoteStream2: remote2,
    remoteStream3: null,
    extraPeerCount: 1,
  });
  assert.equal(huntingAlone.wrapFirstPartner, false);
  assert.equal(secondLands.wrapFirstPartner, true);
}

// 2 remotes (3-way): portrait column + pip you; wrap first partner; no 2×2
{
  const L = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: remote2,
    remoteStream3: null,
    extraPeerCount: 1,
    grid2x2: true,
  });
  assert.equal(L.people, 3);
  assert.equal(L.portraitColumn, true);
  assert.equal(L.wrapFirstPartner, true);
  assert.equal(L.pipYou, true);
  assert.equal(L.includeLocalTile, false);
  assert.equal(L.useGrid2x2, false);
  assert.equal(L.showGrid2x2Toggle, false);
}

// 3-way landscape: same vertical stack as portrait (not a row), pip you, no 2×2
{
  const L = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: remote2,
    extraPeerCount: 1,
    splitWide: true,
  });
  assert.equal(L.people, 3);
  assert.equal(L.portraitColumn, true);
  assert.equal(L.wrapFirstPartner, true);
  assert.equal(L.pipYou, true);
  assert.equal(L.useGrid2x2, false);
  assert.equal(L.showGrid2x2Toggle, false);
}

// 4-way landscape: still a vertical stack (not a row)
{
  const L = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: remote2,
    remoteStream3: remote3,
    extraPeerCount: 2,
    splitWide: true,
  });
  assert.equal(L.people, 4);
  assert.equal(L.portraitColumn, false);
  assert.equal(L.wrapFirstPartner, true);
  assert.equal(L.includeLocalTile, true);
  assert.equal(L.useGrid2x2, true);
}

// 4 people: 4 tiles (3 remotes + you). 2×2 toggle only with extra>=2 && stream3
{
  const stacked = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: remote2,
    remoteStream3: remote3,
    extraPeerCount: 2,
  });
  assert.equal(stacked.people, 4);
  assert.equal(stacked.includeLocalTile, true);
  assert.equal(stacked.pipYou, false);
  assert.equal(stacked.wrapFirstPartner, true);
  assert.equal(stacked.useGrid2x2, true);
  assert.equal(stacked.showGrid2x2Toggle, true);
  assert.equal(stacked.portraitColumn, false);
  assert.equal(
    pickStageChromeLayout({
      hasRemote: true,
      remoteStream2: remote2,
      remoteStream3: remote3,
      extraPeerCount: 2,
      yourRole: "party",
    }).youParty,
    true
  );

  const grid = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: remote2,
    remoteStream3: remote3,
    extraPeerCount: 2,
    grid2x2: true,
  });
  assert.equal(grid.useGrid2x2, true);
  assert.equal(grid.portraitColumn, false);
  assert.equal(grid.includeLocalTile, true);
  assert.equal(grid.pipYou, false);

  // stream3 without extra>=2: 4 tiles, no toggle (not eligible)
  const noToggle = pickStageChromeLayout({
    hasRemote: true,
    remoteStream2: remote2,
    remoteStream3: remote3,
    extraPeerCount: 1,
    grid2x2: true,
  });
  assert.equal(noToggle.includeLocalTile, true);
  assert.equal(noToggle.showGrid2x2Toggle, false);
  assert.equal(noToggle.useGrid2x2, false);
}

// lookingForThird: hunt wrap while partner live, no stream2
assert.equal(
  isLookingForThird({
    remoteStream: remote,
    remoteStream2: null,
    remoteStream3: null,
    huntingWithPartner: true,
  }),
  true
);

// lookingForThird: false ONLY when stream2/3 exists (even if still hunting)
assert.equal(
  isLookingForThird({
    remoteStream: remote,
    remoteStream2: remote2,
    huntingWithPartner: true,
    findThirdPending: true,
  }),
  false
);
assert.equal(
  isLookingForThird({
    remoteStream: remote,
    remoteStream3: remote3,
    huntingWithPartner: true,
  }),
  false
);

// extras / party_browse rematch must not drive looking (gotcha 1c)
assert.equal(
  isLookingForThird({
    remoteStream: remote,
    remoteStream2: null,
    huntingWithPartner: false,
    findThirdPending: false,
  }),
  false
);
// Friend call / Find 3rd invite in flight ≠ hunt until they accept
assert.equal(
  isLookingForThird({
    remoteStream: remote,
    remoteStream2: null,
    huntingWithPartner: false,
    findThirdPending: true,
  }),
  false
);
// 3rd listed (Matched extras) ends hunt — connecting extra tile, not looking brand
assert.equal(
  isLookingForThird({
    remoteStream: remote,
    remoteStream2: null,
    huntingWithPartner: true,
    extraPeerCount: 1,
  }),
  false
);

// no remount: hunt without a primary stream is not looking (keep 1v1 tree off)
assert.equal(
  isLookingForThird({
    remoteStream: null,
    huntingWithPartner: true,
  }),
  false
);

// canShowGrid2x2: 1v1 / 3-way never, 4 people yes
{
  assert.equal(
    canShowGrid2x2({ remoteStream3: null, extraPeerCount: 0 }),
    false
  );
  assert.equal(
    canShowGrid2x2({ remoteStream3: null, extraPeerCount: 2 }),
    true
  );
  assert.equal(
    canShowGrid2x2({ remoteStream3: remote3, extraPeerCount: 1 }),
    false
  );
  assert.equal(
    canShowGrid2x2({ remoteStream3: remote3, extraPeerCount: 2 }),
    true
  );
}

// Hunting alone with one partner (extras=0, no stream2/3) must never report
// multiRemote=true — hunt keeps the 1v1 RTCView (full partner). Looking is
// status/toast only. Split only when extras>=1 / stream2.
{
  const looking = isLookingForThird({
    remoteStream: remote,
    remoteStream2: null,
    remoteStream3: null,
    huntingWithPartner: true,
  });
  assert.equal(looking, true);
  const p = pickStageStreams({
    phase: "matched",
    localStream: local,
    remoteStream: remote,
    remoteStream2: null,
    remoteStream3: null,
    extraPeerCount: 0,
    swapViews: false,
  });
  assert.equal(p.multiRemote, false);
  assert.equal(p.remoteCount, 1);
  const L = pickStageChromeLayout({
    hasRemote: true,
    huntingThird: true,
    remoteStream2: null,
    remoteStream3: null,
    extraPeerCount: 0,
  });
  assert.equal(L.wrapFirstPartner, false); // hunt = 1v1 tree (status only)
  assert.equal(L.includeLocalTile, false);
}

// Lock source contract so this mirror cannot silently re-diverge.
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(dir, "stageStreams.ts"), "utf8");
  assert.match(
    src,
    /const waitingPeer = phase === "matched" && !hasRemote/,
    "stageStreams.ts waitingPeer must be matched && !hasRemote (audio-only is linked)"
  );
  assert.match(
    src,
    /const multiRemote = !!\(remoteStream2 \|\| remoteStream3\)/,
    "multiRemote only when remoteStream2/3 exist (not extraPeerCount)"
  );
  assert.match(
    src,
    /export function pickStageChromeLayout/,
    "stageStreams.ts must export pickStageChromeLayout"
  );
  assert.match(
    src,
    /const portraitColumn = wrapFirstPartner && !useGrid2x2;/,
    "multi tiles stack in landscape too (no splitWide row)"
  );
  assert.match(
    src,
    /export function canShowGrid2x2/,
    "stageStreams.ts must export canShowGrid2x2"
  );
  assert.match(
    src,
    /export function isLookingForThird/,
    "stageStreams.ts must export isLookingForThird"
  );
  assert.match(
    src,
    /export function shouldShowExtraRemoteTile/,
    "stageStreams.ts must export shouldShowExtraRemoteTile"
  );
  assert.match(
    src,
    /export function shouldShowExtraRemoteTile3/,
    "stageStreams.ts must export shouldShowExtraRemoteTile3"
  );
  assert.match(
    src,
    /export function shouldLockFirstRemote/,
    /splitTileFill/,
    "stageStreams.ts must export shouldLockFirstRemote"
  );
  assert.match(
    src,
    /export function extraTilePaint/,
    "extraTilePaint: advertised no-cam is cylinder"
  );
  const liveStage = fs.readFileSync(path.join(dir, "LiveStageVideo.tsx"), "utf8");
  assert.match(
    liveStage,
    /advertisedNoCam=\{\!\!extraNoCam2\}/,
    "extra tile 2 must take advertisedNoCam (laptop cylinder)"
  );
  assert.doesNotMatch(
    liveStage,
    /!privacyBlur && !tileNoCam/,
    "ExtraRemoteTile StageTileChrome must not be gated on !tileNoCam (chrome over no-cam cylinder)"
  );
  assert.match(
    liveStage,
    /function StageTileChrome\b/,
    "StageTileChrome must still exist"
  );
  assert.match(
    src,
    /if \(opts\.advertisedNoCam\) return "nocam"/,
    "extraTilePaint advertisedNoCam still nocam"
  );
  assert.match(
    liveStage,
    /const extraJoining = extraPeerCount >= 1 && !remoteStream2/,
    "extras>=1 + null stream2 is extraJoining (not leftover 1v1)"
  );
  assert.match(
    liveStage,
    /const multiRemote = !!\(remoteStream2 \|\| remoteStream3 \|\| extraJoining\)/,
    "LiveStageVideo multiRemote includes extraJoining so extras>=1 splits"
  );
  assert.match(
    liveStage,
    /const splitStage = multiRemote/,
    "splitStage must ignore huntingThird (400 hunt kept 1v1 tree)"
  );
  assert.doesNotMatch(
    liveStage,
    /splitStage = huntingThird/,
    "must not restyle 1v1 wrap on hunt"
  );
  assert.match(
    liveStage,
    /showExtraTile2 \? \(/,
    "ExtraRemoteTile must show when extras>=1 even if remoteStream2 is null"
  );
  assert.match(
    liveStage,
    /testID="live-remote-tile-1"/,
    "first partner tile keeps a stable node id (no remount on extra join)"
  );
  assert.match(
    liveStage,
    /lockFirstRemote \? remoteStream/,
    "extras>=1 first VideoView stays on remoteStream (no swap remount)"
  );
  assert.match(
    liveStage,
    /const useWideSplit = false/,
    "landscape stays a vertical stack (no row remount)"
  );
  {
    const firstVV = liveStage.indexOf('key="live-first-remote"');
    const firstSwipe = liveStage.indexOf("<SwipeSkipOverlay");
    assert.ok(
      firstVV >= 0 && firstSwipe >= 0 && firstVV < firstSwipe,
      "first VideoView (key=live-first-remote) must be a sibling of SwipeSkipOverlay"
    );
    assert.equal(
      (liveStage.match(/key="live-first-remote"/g) || []).length,
      1,
      "live-first-remote key must stay unique (never remount)"
    );
  }
  {
    const stylesSrc = fs.readFileSync(path.join(dir, "liveStyles.ts"), "utf8");
    const chrome = stylesSrc.match(
      /splitTileChrome:\s*\{[\s\S]*?splitTileVolume:/
    );
    assert.ok(chrome, "splitTileChrome block exists (names stay on split tiles)");
    const block = chrome[0];
    assert.match(block, /left:\s*4/, "split chrome left inset is tight");
    assert.match(block, /top:\s*4/, "split chrome top inset is tight");
    assert.match(
      block,
      /splitTileChromeName:\s*\{[^}]*fontSize:\s*11/,
      "split tile name chrome is compact (11)"
    );
    assert.match(
      block,
      /splitTileChromeStars:\s*\{[^}]*fontSize:\s*10/,
      "split tile stars chrome is compact (10)"
    );
    assert.match(
      block,
      /splitTileChromeLoc:\s*\{[^}]*fontSize:\s*10/,
      "split tile loc chrome is compact (10)"
    );
    assert.match(
      block,
      /splitTileChromeLocDim:\s*\{[^}]*fontSize:\s*10/,
      "split tile loc-dim chrome is compact (10)"
    );
  }
  assert.match(
    src,
    /if \(opts\.remoteStream2 \|\| opts\.remoteStream3\) return false/,
    "lookingForThird ends when stream2/3 exists"
  );
  const peers = fs.readFileSync(path.join(dir, "matchPeers.ts"), "utf8");
  assert.match(
    peers,
    /export const MAX_EXTRA_PEERS = 2/,
    "MAX_EXTRA_PEERS must stay 2 (primary + 2 extras = 4 people)"
  );
  const liveApp = fs.readFileSync(path.join(dir, "../../app/live.tsx"), "utf8");
  assert.match(
    liveApp,
    /extraPeersFromMatch\(m, peer\.peerId\)/,
    "Matched extras always go through extraPeersFromMatch"
  );
  assert.match(
    liveApp,
    /setExtraPeers\(\s*(extrasPainted|extraPeersRef\.current)/,
    "Matched extras always setExtraPeers (even before stream2)"
  );
  assert.match(
    liveApp,
    /if \(extras\.length > 0\) \{\s*setSwapViews\(false\)/,
    "Matched extras unswap so first VideoView stays on remoteStream"
  );
}

console.log("stageStreams.test.mjs: ok");
