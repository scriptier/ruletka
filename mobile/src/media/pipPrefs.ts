import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka-pip-prefs-v1";

export type PipPrefs = {
  x: number;
  y: number;
  hintSeen: boolean;
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
    };
  } catch {
    return null;
  }
}

export async function savePipPrefs(p: PipPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Snap to nearest corner with padding. */
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
