/**
 * Local stranger / party match history (not friend-call rings).
 * Mirrors a lightweight web post-call memory for mobile.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka-match-history-v1";
const MAX = 30;

export type MatchHistoryEntry = {
  id: string;
  t: number;
  user_id: string;
  name: string;
  short_id?: string;
  friend_code?: string;
  mode?: string;
  stars?: number;
  trust?: number;
  flag?: string;
  /** Seconds in the call (approx). */
  duration_secs?: number;
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadMatchHistory(): Promise<MatchHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as MatchHistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((h) => h && h.user_id && h.t);
  } catch {
    return [];
  }
}

async function save(list: MatchHistoryEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export async function pushMatchHistory(
  partial: Omit<MatchHistoryEntry, "id" | "t"> & { t?: number }
): Promise<MatchHistoryEntry | null> {
  const user_id = String(partial.user_id || "").trim();
  if (!user_id) return null;
  const entry: MatchHistoryEntry = {
    id: uid(),
    t: partial.t || Date.now(),
    user_id,
    name: partial.name || "Partner",
    short_id: partial.short_id,
    friend_code: partial.friend_code,
    mode: partial.mode,
    stars: partial.stars,
    trust: partial.trust,
    flag: partial.flag,
    duration_secs: Math.max(0, Math.floor(Number(partial.duration_secs) || 0)),
  };
  const list = await loadMatchHistory();
  // Dedupe same peer within 60s
  const filtered = list.filter(
    (h) =>
      !(
        h.user_id === entry.user_id && Math.abs(h.t - entry.t) < 60_000
      )
  );
  filtered.unshift(entry);
  await save(filtered);
  return entry;
}

export async function clearMatchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Drop a single entry (after block/report or user dismiss). */
export async function removeMatchHistory(id: string): Promise<void> {
  const list = await loadMatchHistory();
  await save(list.filter((h) => h.id !== id));
}
