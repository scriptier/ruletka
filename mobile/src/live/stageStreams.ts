/**
 * Pure helpers: which stream goes main vs PiP vs multi-tile layout.
 * Kept free of React so Live stage layout can be unit-tested.
 *
 * WORKING baseline (when Play↔PC loaded fast + both cams):
 * - If remoteStream exists → partner on main, local in PiP
 *   (do NOT wait for video-track-ready — audio-first left a black stage)
 * - Matched with no remote yet → empty main + local PiP
 * - Idle/search → local full stage
 */
import type { MediaStreamLike } from "../media/MediaSession";
import type { LivePhase } from "./phase";

export type StageStreamPick = {
  multiRemote: boolean;
  hasRemote: boolean;
  remoteHasVideo: boolean;
  /** Matched but no remote media yet — show connecting, keep self in PiP. */
  waitingPeer: boolean;
  mainStream: MediaStreamLike | null;
  pipStream: MediaStreamLike | null;
  mainMirror: boolean;
  pipMirror: boolean;
};

export function pickStageStreams(opts: {
  phase: LivePhase | string;
  localStream: MediaStreamLike | null;
  remoteStream: MediaStreamLike | null;
  remoteStream2: MediaStreamLike | null;
  extraPeerCount: number;
  swapViews: boolean;
}): StageStreamPick {
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
  // Matched but no remote media yet: don't full-screen local cam
  const waitingPeer =
    phase === "matched" && (!hasRemote || !remoteHasVideo);

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
    waitingPeer,
    mainStream,
    pipStream,
    mainMirror,
    pipMirror,
  };
}

export type MultiTile = {
  stream: MediaStreamLike | null;
  epoch: number;
  mirror: boolean;
  name: string;
  placeholder: boolean;
  isExtra: boolean;
};

/** Order multi-remote tiles by focus (tap to put peer on top half). */
export function pickMultiTiles(opts: {
  focusExtra: boolean;
  mainStream: MediaStreamLike | null;
  remoteStream2: MediaStreamLike | null;
  remoteEpoch: number;
  remoteEpoch2: number;
  swapViews: boolean;
  mainMirror: boolean;
  partnerName: string;
  secondName: string;
}): { tileA: MultiTile; tileB: MultiTile } {
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
  const tileA: MultiTile = {
    stream: focusExtra ? remoteStream2 : mainStream,
    epoch: focusExtra ? remoteEpoch2 : swapViews ? 0 : remoteEpoch,
    mirror: focusExtra ? false : mainMirror,
    name: focusExtra ? secondName : partnerName || "…",
    placeholder: focusExtra ? !remoteStream2 : !mainStream,
    isExtra: focusExtra,
  };
  const tileB: MultiTile = {
    stream: focusExtra ? mainStream : remoteStream2,
    epoch: focusExtra ? (swapViews ? 0 : remoteEpoch) : remoteEpoch2,
    mirror: focusExtra ? mainMirror : false,
    name: focusExtra ? partnerName || "…" : secondName,
    placeholder: focusExtra ? !mainStream : !remoteStream2,
    isExtra: !focusExtra,
  };
  return { tileA, tileB };
}
