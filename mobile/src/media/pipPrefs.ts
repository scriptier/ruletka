import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseCorner,
  parseStageView,
  type PipCorner,
  type StageViewPref,
} from "../live/pipLayout";

const KEY = "ruletka-pip-prefs-v1";

export type PipPrefs = {
  /** Legacy absolute position (pre-corner builds); -1 = unset. */
  x: number;
  y: number;
  hintSeen: boolean;
  /** Snapped corner for the self-view PiP. */
  corner?: PipCorner | null;
  /** Self-view mode: small draggable PiP or classic split screen. */
  view?: StageViewPref;
};

export async function loadPipPrefs(): Promise<PipPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<PipPrefs>;
    return {
      x: typeof j.x === "number" ? j.x : -1,
      y: typeof j.y === "number" ? j.y : -1,
      hintSeen: !!j.hintSeen,
      corner: parseCorner(j.corner),
      view: parseStageView(j.view),
    };
  } catch {
    return null;
  }
}

/** Merge-write so corner / view / hint updates never clobber each other. */
export async function savePipPrefs(p: Partial<PipPrefs>): Promise<void> {
  try {
    const prev = (await loadPipPrefs()) || { x: -1, y: -1, hintSeen: false };
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...prev, ...p }));
  } catch {
    /* ignore */
  }
}

/** Snap to nearest corner with padding (kept for older callers). */
export function snapPipToCorner(
  x: number,
  y: number,
  stageW: number,
  stageH: number,
  pipW: number,
  pipH: number,
  pad = 8
): { x: number; y: number } {
  const maxX = Math.max(pad, stageW - pipW - pad);
  const maxY = Math.max(pad, stageH - pipH - pad);
  const midX = stageW / 2;
  const midY = stageH / 2;
  const nx = x + pipW / 2 < midX ? pad : maxX;
  const ny = y + pipH / 2 < midY ? pad : maxY;
  return { x: nx, y: ny };
}
