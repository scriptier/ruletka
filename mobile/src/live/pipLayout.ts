/**
 * Pure self-view PiP / split geometry (no RN imports — unit-tested in
 * pipLayout.test.mjs via Node type stripping).
 *
 * PiP snaps to one of four corners inside the stage minus the top chrome
 * (status / connect steps / partner identity) and the bottom control dock.
 */

export type PipCorner = "tl" | "tr" | "bl" | "br";
/** null = legacy default (PiP while waiting; split when matched in browser layout). */
export type StageViewPref = "pip" | "split" | null;

export const PIP_PAD = 8;
/** Finger travel (dp) before a touch counts as a drag instead of a tap. */
export const PIP_DRAG_SLOP = 8;
/** Max gap between two taps for the double-tap (swap) gesture. */
export const PIP_DOUBLE_TAP_MS = 260;

export type PipBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/**
 * Allowed top-left range for a pipW×pipH box. safeTop/safeBottom are the
 * heights of chrome overlapping the stage top/bottom. If the chrome leaves
 * no room, the bottom keeps priority over the top (controls must stay
 * tappable) and the box is clamped inside the stage.
 */
export function pipBounds(
  stageW: number,
  stageH: number,
  pipW: number,
  pipH: number,
  safeTop = 0,
  safeBottom = 0,
  pad = PIP_PAD
): PipBounds {
  const top = Math.max(0, safeTop);
  const bottom = Math.max(0, safeBottom);
  const minX = pad;
  const maxX = Math.max(minX, stageW - pipW - pad);
  let maxY = stageH - bottom - pipH - pad;
  let minY = top + pad;
  if (maxY < minY) {
    // Not enough vertical room: hug the bottom chrome, never go above the stage.
    minY = Math.max(pad, Math.min(minY, maxY));
    maxY = minY;
  }
  maxY = Math.max(pad, maxY);
  minY = Math.max(pad, Math.min(minY, maxY));
  return { minX, maxX, minY, maxY };
}

export function clampPip(
  x: number,
  y: number,
  b: PipBounds
): { x: number; y: number } {
  return {
    x: Math.min(b.maxX, Math.max(b.minX, x)),
    y: Math.min(b.maxY, Math.max(b.minY, y)),
  };
}

export function cornerToPos(
  corner: PipCorner,
  b: PipBounds
): { x: number; y: number } {
  return {
    x: corner === "tl" || corner === "bl" ? b.minX : b.maxX,
    y: corner === "tl" || corner === "tr" ? b.minY : b.maxY,
  };
}

/** Nearest corner for a box whose top-left is (x, y). */
export function nearestCorner(
  x: number,
  y: number,
  pipW: number,
  pipH: number,
  b: PipBounds
): PipCorner {
  const cx = x + pipW / 2;
  const cy = y + pipH / 2;
  const midX = (b.minX + b.maxX + pipW) / 2;
  const midY = (b.minY + b.maxY + pipH) / 2;
  const left = cx < midX;
  const topHalf = cy < midY;
  return topHalf ? (left ? "tl" : "tr") : left ? "bl" : "br";
}

/** True once the finger moved far enough that this is a drag, not a tap. */
export function isDragMove(dx: number, dy: number, slop = PIP_DRAG_SLOP) {
  return Math.abs(dx) > slop || Math.abs(dy) > slop;
}

export function parseCorner(v: unknown): PipCorner | null {
  return v === "tl" || v === "tr" || v === "bl" || v === "br" ? v : null;
}

/** Legacy prefs stored absolute x/y — map to a corner with the stage size. */
export function cornerFromLegacyXY(
  x: number,
  y: number,
  stageW: number,
  stageH: number,
  pipW: number,
  pipH: number
): PipCorner | null {
  if (!(x >= 0 && y >= 0 && stageW > 0 && stageH > 0)) return null;
  const left = x + pipW / 2 < stageW / 2;
  const top = y + pipH / 2 < stageH / 2;
  return top ? (left ? "tl" : "tr") : left ? "bl" : "br";
}

export function parseStageView(v: unknown): StageViewPref {
  return v === "pip" || v === "split" ? v : null;
}

/**
 * Should the 1v1 stage render the classic split (partner | you)?
 * - pref "split": yes (waiting, idle and matched), 1v1 only.
 * - pref "pip": never.
 * - null: legacy — browser layout splits once matched with a partner stream.
 */
export function resolveSplitView(opts: {
  pref: StageViewPref;
  browserLayout: boolean;
  phase: string;
  hasPartner: boolean;
  multiRemote: boolean;
  huntingThird: boolean;
  extraPeerCount: number;
  pipYou: boolean;
  hasSelf: boolean;
}): boolean {
  const {
    pref,
    browserLayout,
    phase,
    hasPartner,
    multiRemote,
    huntingThird,
    extraPeerCount,
    pipYou,
    hasSelf,
  } = opts;
  if (multiRemote || huntingThird || extraPeerCount >= 1 || !pipYou) {
    return false;
  }
  if (pref === "pip") return false;
  if (pref === "split") {
    if (phase === "matched") return true;
    return (phase === "search" || phase === "idle") && hasSelf;
  }
  return browserLayout && phase === "matched" && hasPartner;
}
