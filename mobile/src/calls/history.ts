/**
 * Local friend-call history (missed / no-answer / declined).
 * Mirrors web localStorage history — not hub-authoritative.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka-call-history-v1";
const READ_KEY = "ruletka-missed-calls-read-v1";
const MAX = 40;

export type CallHistoryKind = "missed" | "no_answer" | "declined" | "busy";

export type CallHistoryEntry = {
  id: string;
  kind: CallHistoryKind;
  t: number;
  user_id: string;
  name: string;
  short_id?: string;
  friend_code?: string;
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadCallHistory(): Promise<CallHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CallHistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((h) => h && h.user_id && h.t);
  } catch {
    return [];
  }
}

async function save(list: CallHistoryEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export async function pushCallHistory(
  partial: Omit<CallHistoryEntry, "id" | "t"> & { t?: number }
): Promise<CallHistoryEntry> {
  const entry: CallHistoryEntry = {
    id: uid(),
    t: partial.t || Date.now(),
    kind: partial.kind,
    user_id: partial.user_id,
    name: partial.name || "Friend",
    short_id: partial.short_id,
    friend_code: partial.friend_code,
  };
  const list = await loadCallHistory();
  // Dedupe same peer+kind within 20s
  const filtered = list.filter(
    (h) =>
      !(
        h.user_id === entry.user_id &&
        h.kind === entry.kind &&
        Math.abs(h.t - entry.t) < 20_000
      )
  );
  filtered.unshift(entry);
  await save(filtered);
  return entry;
}

export async function clearCallHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function markMissedCallsRead(): Promise<void> {
  try {
    await AsyncStorage.setItem(READ_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export async function countUnreadMissed(): Promise<number> {
  try {
    const since = Number((await AsyncStorage.getItem(READ_KEY)) || 0) || 0;
    const list = await loadCallHistory();
    return list.filter((h) => h.kind === "missed" && h.t > since).length;
  } catch {
    return 0;
  }
}

export function kindLabel(kind: CallHistoryKind): string {
  switch (kind) {
    case "missed":
      return "Missed call";
    case "no_answer":
      return "No answer";
    case "declined":
      return "Declined";
    case "busy":
      return "Busy";
    default:
      return kind;
  }
}

/** Map hub call_ended reason → history kind for the local role. */
export function historyKindFromReason(
  reason: string,
  role: "callee" | "caller"
): CallHistoryKind | null {
  const r = (reason || "").toLowerCase();
  if (role === "callee") {
    if (
      r.includes("expir") ||
      r.includes("timeout") ||
      r.includes("no answer") ||
      r === "cancelled" ||
      r.includes("cancel")
    ) {
      // Caller hung up / ring expired while we were ringing → missed
      return "missed";
    }
    return null;
  }
  // caller
  if (r.includes("declin")) return "declined";
  if (r.includes("busy")) return "busy";
  if (
    r.includes("expir") ||
    r.includes("timeout") ||
    r.includes("no answer")
  ) {
    return "no_answer";
  }
  return null;
}
