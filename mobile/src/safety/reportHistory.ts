/**
 * Local report/block log (not hub-authoritative). For Settings transparency.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka-report-history-v1";
const MAX = 40;

export type ReportHistoryEntry = {
  id: string;
  t: number;
  user_id: string;
  name: string;
  kind: "report" | "block";
  reason?: string;
};

export async function loadReportHistory(): Promise<ReportHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ReportHistoryEntry[];
    return Array.isArray(arr) ? arr.filter((e) => e?.user_id) : [];
  } catch {
    return [];
  }
}

export async function pushReportHistory(
  partial: Omit<ReportHistoryEntry, "id" | "t"> & { t?: number }
): Promise<void> {
  try {
    const entry: ReportHistoryEntry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      t: partial.t || Date.now(),
      user_id: partial.user_id,
      name: partial.name || partial.user_id.slice(0, 8),
      kind: partial.kind,
      reason: partial.reason,
    };
    const list = await loadReportHistory();
    list.unshift(entry);
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export async function clearReportHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
