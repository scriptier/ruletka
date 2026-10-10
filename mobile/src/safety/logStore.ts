import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HUB_ACCEPTS_SAFETY_LOG,
  type SafetyLogRecord,
} from "./logic";

const KEY = "ruletka.safety-log.v1";
const MAX = 20;

/** Keep the last few shadow hits on this device. Not a ban and not a report. */
export async function rememberSafetyLog(rec: SafetyLogRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const prev = raw ? (JSON.parse(raw) as SafetyLogRecord[]) : [];
    const next = [...(Array.isArray(prev) ? prev : []), rec].slice(-MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* log is best-effort */
  }
  console.log(`[safety-log] ${JSON.stringify(rec)}`);
}

/** True when a confirmed hit may also be sent as safety_log. */
export function safetyLogSentToHub(): boolean {
  return HUB_ACCEPTS_SAFETY_LOG;
}
