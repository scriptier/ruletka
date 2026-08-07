/**
 * On-device partner snapshots for Friends → History.
 * Never uploaded — files under documentDirectory/match-thumbs/.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

const INDEX_KEY = "ruletka-match-thumbs-index-v1";
const MAX = 48;

function thumbsDir(): string {
  const base = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";
  return `${base}match-thumbs/`;
}

function thumbPath(userId: string): string {
  const safe = String(userId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 48);
  return `${thumbsDir()}${safe}.jpg`;
}

async function ensureDir(): Promise<void> {
  const dir = thumbsDir();
  if (!dir) return;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {
    /* ignore */
  }
}

async function loadIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function saveIndex(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

/** Absolute file:// URI if a thumb exists for this user. */
export async function getMatchThumbUri(
  userId: string
): Promise<string | null> {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  try {
    const path = thumbPath(uid);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return path;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Save a stage capture as the partner history thumb (on device only).
 * @param userId partner user_id
 * @param sourceUri tmpfile:// from view-shot
 */
export async function saveMatchThumbFromUri(
  userId: string,
  sourceUri: string
): Promise<string | null> {
  const uid = String(userId || "").trim();
  if (!uid || !sourceUri) return null;
  try {
    await ensureDir();
    const dest = thumbPath(uid);
    // Copy/overwrite into permanent on-device location
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    let idx = await loadIndex();
    idx = [uid, ...idx.filter((x) => x !== uid)];
    // Evict oldest files beyond MAX
    while (idx.length > MAX) {
      const drop = idx.pop();
      if (drop) {
        try {
          await FileSystem.deleteAsync(thumbPath(drop), { idempotent: true });
        } catch {
          /* ignore */
        }
      }
    }
    await saveIndex(idx);
    return dest;
  } catch {
    return null;
  }
}

export async function clearMatchThumbs(): Promise<void> {
  try {
    const dir = thumbsDir();
    if (dir) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
  try {
    await AsyncStorage.removeItem(INDEX_KEY);
  } catch {
    /* ignore */
  }
}

/** Load thumbs for a list of user ids (map for UI). */
export async function loadMatchThumbsMap(
  userIds: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (id) => {
      const uri = await getMatchThumbUri(id);
      if (uri) out[id] = uri;
    })
  );
  return out;
}
