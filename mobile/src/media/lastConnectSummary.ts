/**
 * Persist a summary of the most recent match's connect stopwatch
 * (offer / answer / ice / first-frame ms) so Settings can show it
 * for post-call review without re-matching.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka.last-connect-summary.v1";

export type LastConnectSummary = {
  at: number;
  offerMs: number | null;
  answerMs: number | null;
  iceMs: number | null;
  firstFrameMs: number | null;
};

export async function saveLastConnectSummary(
  s: Omit<LastConnectSummary, "at">
): Promise<void> {
  try {
    const row: LastConnectSummary = { at: Date.now(), ...s };
    await AsyncStorage.setItem(KEY, JSON.stringify(row));
  } catch {
    /* ignore — best-effort UI stat only */
  }
}

export async function loadLastConnectSummary(): Promise<LastConnectSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as LastConnectSummary;
    if (!j || typeof j !== "object") return null;
    return j;
  } catch {
    return null;
  }
}

/** "—" when unknown, "123ms" under 1s, else "1.2s". */
export function formatConnectMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
