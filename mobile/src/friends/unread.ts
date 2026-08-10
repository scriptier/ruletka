/**
 * Local unread friend-DM counts (hub is not authoritative for read state).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka-dm-unread-v1";

export type UnreadMap = Record<string, number>;

export async function loadUnreadMap(): Promise<UnreadMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as UnreadMap;
    if (!obj || typeof obj !== "object") return {};
    const out: UnreadMap = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = Math.floor(Number(v) || 0);
      if (k && n > 0) out[k] = Math.min(n, 99);
    }
    return out;
  } catch {
    return {};
  }
}

async function save(map: UnreadMap): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function bumpUnread(userId: string, by = 1): Promise<UnreadMap> {
  const id = String(userId || "").trim();
  if (!id) return loadUnreadMap();
  const map = await loadUnreadMap();
  map[id] = Math.min(99, (map[id] || 0) + Math.max(1, by));
  await save(map);
  return map;
}

export async function markDmRead(userId: string): Promise<UnreadMap> {
  const id = String(userId || "").trim();
  if (!id) return loadUnreadMap();
  const map = await loadUnreadMap();
  if (map[id]) {
    delete map[id];
    await save(map);
  }
  return map;
}

export function totalUnread(map: UnreadMap): number {
  let n = 0;
  for (const v of Object.values(map)) n += Math.max(0, Number(v) || 0);
  return n;
}
