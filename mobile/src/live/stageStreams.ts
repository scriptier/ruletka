/**
 * Pure helpers: which stream goes main vs PiP vs multi-tile layout.
 * Kept free of React so Live stage layout can be unit-tested.
 *
 * WORKING baseline (when Play↔PC loaded fast + both cams):
 * - If remoteStream exists → partner on main, local in PiP
 *   (do NOT wait for video-track-ready — audio-first left a black stage)
 * - Audio-only remote (laptop no-cam) is NOT waitingPeer
 * - Matched with no remote yet → empty main + local PiP
 * - Idle/search → local full stage
 * - Multi: up to 3 remote tiles ordered by focus (you + 3 remotes = 4-way)
 *   pickStageStreams.multiRemote is stream2/3 only. LiveStageVideo still
 *   splits when extraPeerCount>=1 even if remoteStream2 is null (wrap first
 *   RTCView + connecting extra tile — do not stay 1v1 leftover).
 */
import type { MediaStreamLike } from "../media/MediaSession";
import type { LivePhase } from "./phase";

/** Max remote partners painted on stage (you + 3 = 4-way). */
export const MAX_REMOTE_TILES = 3;

export type StageStreamPick = {
  multiRemote: boolean;
  hasRemote: boolean;
  remoteHasVideo: boolean;
  /** Live audio on the primary remote (no-cam laptop still counts as linked). */
  remoteHasAudio: boolean;
  /**
   * Matched but no remote stream object at all — show connecting, keep self in PiP.
   * Audio-only (laptop no-cam) is NOT waiting: the link is already live.
   */
  waitingPeer: boolean;
  mainStream: MediaStreamLike | null;
  pipStream: MediaStreamLike | null;
  mainMirror: boolean;
  pipMirror: boolean;
  /** How many remote streams are present (0–3). */
  remoteCount: number;
};

export function pickStageStreams(opts: {
  phase: LivePhase | string;
  localStream: MediaStreamLike | null;
  remoteStream: MediaStreamLike | null;
  remoteStream2: MediaStreamLike | null;
  /** Optional third remote (4-way). */
  remoteStream3?: MediaStreamLike | null;
  extraPeerCount: number;
  swapViews: boolean;
}): StageStreamPick {
  const {
    phase,
    localStream,
    remoteStream,
    remoteStream2,
    remoteStream3 = null,
    extraPeerCount,
    swapViews,
  } = opts;
  // True multi = 2nd/3rd STREAM objects only. extraPeerCount / hunt ≠ multi.
  const multiRemote = !!(remoteStream2 || remoteStream3);
  const hasRemote = !!remoteStream;
  const remoteHasVideo =
    (remoteStream?.getVideoTracks?.()?.length ?? 0) > 0;
  const remoteHasAudio =
    (remoteStream?.getAudioTracks?.()?.length ?? 0) > 0;
  // Waiting only when matched with no remote stream at all.
  // Audio-only laptop (mic, no cam) is a finished link — not "Linking…".
  const waitingPeer = phase === "matched" && !hasRemote;

  let remoteCount = 0;
  if (remoteStream) remoteCount += 1;
  if (remoteStream2) remoteCount += 1;
  if (remoteStream3) remoteCount += 1;
  // Hub said multi even before second stream lands
  if (extraPeerCount > 0) {
    remoteCount = Math.max(
      remoteCount,
      Math.min(MAX_REMOTE_TILES, 1 + Math.floor(Number(extraPeerCount) || 0))
    );
  }
  remoteCount = Math.min(MAX_REMOTE_TILES, remoteCount);

  // CRITICAL: any remoteStream → partner main (even audio-first).
  // Waiting for video tracks left main empty = solid black while audio played.
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

export type MultiTile = {
  stream: MediaStreamLike | null;
  epoch: number;
  mirror: boolean;
  name: string;
  placeholder: boolean;
  isExtra: boolean;
  /** True when this tile is the focused (primary) remote in multi layout. */
  focused?: boolean;
  /** Original remote index 0..2 (primary, second, third). */
  remoteIndex?: number;
};

export type MultiRemoteInput = {
  stream: MediaStreamLike | null;
  epoch: number;
  name: string;
  mirror?: boolean;
};

/**
 * Order up to 3 remote tiles by focus (focused first, then stable order).
 * focusIndex: 0 = primary partner, 1 = second, 2 = third.
 */
export function pickMultiRemoteTiles(opts: {
  focusIndex?: number;
  remotes: MultiRemoteInput[];
}): MultiTile[] {
  const remotes = (opts.remotes || []).slice(0, MAX_REMOTE_TILES);
  if (!remotes.length) return [];
  const n = remotes.length;
  const focus = Math.max(
    0,
    Math.min(n - 1, Math.floor(Number(opts.focusIndex) || 0))
  );
  // Focused first, then remaining in original index order (stable).
  const order: number[] = [focus];
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

/** Order multi-remote tiles by focus (tap to put peer on top half). */
export function pickMultiTiles(opts: {
  focusExtra: boolean;
  mainStream: MediaStreamLike | null;
  remoteStream2: MediaStreamLike | null;
  /** Optional third remote for 4-way layout helpers. */
  remoteStream3?: MediaStreamLike | null;
  remoteEpoch: number;
  remoteEpoch2: number;
  remoteEpoch3?: number;
  swapViews: boolean;
  mainMirror: boolean;
  partnerName: string;
  secondName: string;
  thirdName?: string;
}): { tileA: MultiTile; tileB: MultiTile; tileC?: MultiTile; tiles: MultiTile[] } {
  const {
    focusExtra,
    mainStream,
    remoteStream2,
    remoteStream3 = null,
    remoteEpoch,
    remoteEpoch2,
    remoteEpoch3 = 0,
    swapViews,
    mainMirror,
    partnerName,
    secondName,
    thirdName = "",
  } = opts;

  const remotes: MultiRemoteInput[] = [
    {
      stream: mainStream,
      epoch: swapViews ? 0 : remoteEpoch,
      name: partnerName || "…",
      mirror: mainMirror,
    },
    {
      stream: remoteStream2,
      epoch: remoteEpoch2,
      name: secondName || "…",
      mirror: false,
    },
  ];
  // Include third slot when stream exists or a name was provided (hub 4-way).
  if (remoteStream3 || thirdName) {
    remotes.push({
      stream: remoteStream3,
      epoch: remoteEpoch3,
      name: thirdName || "…",
      mirror: false,
    });
  }

  // focusExtra true → focus second remote (index 1). No third-focus in this API.
  const focusIndex = focusExtra ? 1 : 0;
  const tiles = pickMultiRemoteTiles({ focusIndex, remotes });
  const tileA = tiles[0] || {
    stream: null,
    epoch: 0,
    mirror: false,
    name: "…",
    placeholder: true,
    isExtra: false,
    focused: true,
    remoteIndex: 0,
  };
  const tileB = tiles[1] || {
    stream: null,
    epoch: 0,
    mirror: false,
    name: "…",
    placeholder: true,
    isExtra: true,
    focused: false,
    remoteIndex: 1,
  };
  const tileC = tiles[2];
  return { tileA, tileB, tileC, tiles };
}

/**
 * 2×2 chrome only when 4 people are actually on stage:
 * third remote stream + extraPeerCount >= 2. Never 1v1 or 3-way.
 */
export function canShowGrid2x2(opts: {
  remoteStream3?: unknown;
  extraPeerCount?: number;
}): boolean {
  return !!(
    opts.remoteStream3 &&
    Math.floor(Number(opts.extraPeerCount) || 0) >= 2
  );
}

export type StageChromeLayout = {
  /** People including you when remotes exist (1 idle / 2 / 3 / 4). */
  people: number;
  /** Column split (top/bottom) in portrait and landscape. False only when 2×2. */
  portraitColumn: boolean;
  /** 4-way: local is a stage tile, not PiP. */
  includeLocalTile: boolean;
  /** 1v1 / hunt / 3-way: small PiP is you. False when you are a 4th tile. */
  pipYou: boolean;
  /** Apply 2×2 wrap (eligible + requested). */
  useGrid2x2: boolean;
  /** Paint 2×2 toggle. Never in 1v1 or 3-way. */
  showGrid2x2Toggle: boolean;
  /** Wrap the 1v1 partner VideoView — do not remount it. */
  wrapFirstPartner: boolean;
};

/**
 * Extra remote tile (connecting or live) when hub listed extras or stream2 bound.
 * Stream2 may still be null — show the placeholder so 3-way is not 1v1.
 */
export function shouldShowExtraRemoteTile(opts: {
  extraPeerCount?: number;
  remoteStream2?: unknown;
}): boolean {
  if (opts.remoteStream2) return true;
  return Math.max(0, Math.floor(Number(opts.extraPeerCount) || 0)) >= 1;
}

/** 4-way extra (3rd remote): extras>=2 even before stream3 binds. */
export function shouldShowExtraRemoteTile3(opts: {
  extraPeerCount?: number;
  remoteStream3?: unknown;
}): boolean {
  if (opts.remoteStream3) return true;
  return Math.max(0, Math.floor(Number(opts.extraPeerCount) || 0)) >= 2;
}

/**
 * extras>=1 / stream2/3: keep first VideoView bound to remoteStream.
 * Swap or epoch flip on that bind remounts Android SurfaceView (black tile).
 */
/** Extra tile: advertised no-cam or audio-only → cylinder, not "Almost there". */
export function extraTilePaint(opts: {
  hasStream?: boolean;
  hasVideo?: boolean;
  hasAudio?: boolean;
  advertisedNoCam?: boolean;
}): "nocam" | "connecting" | "video" {
  if (opts.advertisedNoCam) return "nocam";
  if (opts.hasStream && !opts.hasVideo && opts.hasAudio) return "nocam";
  if (!opts.hasStream) return "connecting";
  return "video";
}

export function shouldLockFirstRemote(opts: {
  extraPeerCount?: number;
  remoteStream2?: unknown;
  remoteStream3?: unknown;
}): boolean {
  if (opts.remoteStream3) return true;
  return shouldShowExtraRemoteTile({
    extraPeerCount: opts.extraPeerCount,
    remoteStream2: opts.remoteStream2,
  });
}

/**
 * Hunt strip only while looking and the 3rd/4th stream has not bound.
 * extras>=1 ends hunt (connecting extra tile, not looking brand).
 * party_browse rematch must not remount the 1v1 RTCView.
 */
export function isLookingForThird(opts: {
  remoteStream?: unknown;
  remoteStream2?: unknown;
  remoteStream3?: unknown;
  huntingWithPartner?: boolean;
  /** Invite in flight — not hunt. Hunt starts after they accept Find 3rd. */
  findThirdPending?: boolean;
  extraPeerCount?: number;
}): boolean {
  if (opts.remoteStream2 || opts.remoteStream3) return false;
  // 3rd listed (Matched extras) → not hunt; show connecting extra tile.
  if (Math.max(0, Math.floor(Number(opts.extraPeerCount) || 0)) >= 1) {
    return false;
  }
  void opts.findThirdPending;
  // Friend/stranger 1v1 stays 1v1 until Find 3rd is accepted (huntingWithPartner).
  return !!opts.remoteStream && !!opts.huntingWithPartner;
}

/**
 * Android stage chrome: 2 remotes → column + pip you; 4 people → 4 tiles
 * (optional 2×2). extras>=1 wraps first partner + extra tile even if
 * stream2 is still null. Hunt (looking, extra=0) must NOT wrap —
 * same 1v1 remoteFill tree (400 hunt SurfaceView tear).
 */
export function pickStageChromeLayout(opts: {
  hasRemote?: boolean;
  remoteStream2?: unknown;
  remoteStream3?: unknown;
  extraPeerCount?: number;
  grid2x2?: boolean;
  splitWide?: boolean;
  huntingThird?: boolean;
}): StageChromeLayout {
  const has2 = !!opts.remoteStream2;
  const has3 = !!opts.remoteStream3;
  const extra = Math.max(0, Math.floor(Number(opts.extraPeerCount) || 0));
  let remoteCount = 0;
  if (opts.hasRemote) remoteCount += 1;
  if (has2) remoteCount += 1;
  if (has3) remoteCount += 1;
  // Hub listed extras before stream2/3 lands — count connecting tiles.
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
  const useGrid2x2 = showGrid2x2Toggle && !!opts.grid2x2;
  const wrapFirstPartner = has2 || has3 || extra >= 1;
  const includeLocalTile = has3 || extra >= 2;
  const pipYou = !includeLocalTile;
  // Portrait and landscape: stack tiles (column). Landscape used to flip to a
  // row (`splitWide`) — user wants the same vertical stack when flipped.
  // Optional 2×2 is the only non-column 4-way. Hunt does not wrap.
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
  };
}
