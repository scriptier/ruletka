/**
 * Show a one-shot "What's new" card after the app version changes.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const KEY = "ruletka-whats-new-seen-v1";

/** Bullet keys for i18n (mobile.whatsNew.b1 …). */
export const WHATS_NEW_BULLETS = [
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
] as const;

export function currentAppVersion(): string {
  const ver =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    "0";
  const code =
    Constants.expoConfig?.android?.versionCode ||
    Constants.nativeBuildVersion ||
    "";
  return code ? `${ver}+${code}` : String(ver);
}

export async function shouldShowWhatsNew(): Promise<boolean> {
  try {
    const seen = (await AsyncStorage.getItem(KEY)) || "";
    const cur = currentAppVersion();
    return !!cur && seen !== cur;
  } catch {
    return false;
  }
}

export async function markWhatsNewSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, currentAppVersion());
  } catch {
    /* ignore */
  }
}
