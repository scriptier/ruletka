/**
 * Local labels for blocked users (hub only stores user_ids).
 * Merged with server `friends.blocked` list on each friends snapshot.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka-blocked-labels-v1";

export type BlockedEntry = {
  user_id: string;
  name: string;
  /** When we blocked them locally (ms). */
  t: number;
};

async function loadMap(): Promise<Record<string, BlockedEntry>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const arr = JSON.parse(raw) as BlockedEntry[];
    if (!Array.isArray(arr)) return {};
    const out: Record<string, BlockedEntry> = {};
    for (const e of arr) {
      if (e?.user_id) out[e.user_id] = e;
    }
    return out;
  } catch {
    return {};
  }
}

async function saveMap(map: Record<string, BlockedEntry>): Promise<void> {
  try {
    const arr = Object.values(map)
      .sort((a, b) => b.t - a.t)
      .slice(0, 200);
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export async function rememberBlock(
  user_id: string,
  name?: string
): Promise<void> {
  const uid = String(user_id || "").trim();
  if (!uid) return;
  const map = await loadMap();
  map[uid] = {
    user_id: uid,
    name: String(name || "").trim() || map[uid]?.name || uid.slice(0, 8),
    t: Date.now(),
  };
  await saveMap(map);
}

export async function forgetBlock(user_id: string): Promise<void> {
  const uid = String(user_id || "").trim();
  if (!uid) return;
  const map = await loadMap();
  delete map[uid];
  await saveMap(map);
}

/** Merge hub blocked ids with local name cache. */
export async function resolveBlockedList(
  hubIds: string[]
): Promise<BlockedEntry[]> {
  const map = await loadMap();
  const ids = Array.from(
    new Set([...(hubIds || []), ...Object.keys(map)].filter(Boolean))
  );
  // Prefer hub list as source of truth when provided
  const active = hubIds?.length
    ? hubIds.filter(Boolean)
    : ids;
  return active.map((user_id) => ({
    user_id,
    name: map[user_id]?.name || user_id.slice(0, 8),
    t: map[user_id]?.t || 0,
  }));
}
