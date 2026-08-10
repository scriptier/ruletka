/**
 * Persist last match connect stopwatch for Settings (post-call review).
 * Written from Live when MediaSession reports CONNECT / first frame.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka-last-connect-stats-v1";

export type LastConnectStats = {
  at: number;
  offerMs: number | null;
  answerMs: number | null;
  iceMs: number | null;
  firstFrameMs: number | null;
  summary: string;
};

export function formatConnectStats(s: LastConnectStats | null): string {
  if (!s || !s.summary) return "";
  return s.summary;
}

export async function saveLastConnectStats(
  partial: Omit<LastConnectStats, "at"> & { at?: number }
): Promise<void> {
  try {
    const row: LastConnectStats = {
      at: partial.at || Date.now(),
      offerMs: partial.offerMs ?? null,
      answerMs: partial.answerMs ?? null,
      iceMs: partial.iceMs ?? null,
      firstFrameMs: partial.firstFrameMs ?? null,
      summary: partial.summary || "",
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

export async function loadLastConnectStats(): Promise<LastConnectStats | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as LastConnectStats;
    if (!j || typeof j !== "object") return null;
    return j;
  } catch {
    return null;
  }
}
