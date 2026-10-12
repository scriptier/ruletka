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

/** show = upgrade from a version we already recorded. mark = fresh install. */
export type WhatsNewDecision = "show" | "mark" | "hide";

/**
 * Empty seen key is a fresh install: record the current version and show nothing.
 * A card appears only when a previous version was stored and it differs.
 */
export function decideWhatsNew(seen: string, current: string): WhatsNewDecision {
  const prev = String(seen || "").trim();
  const cur = String(current || "").trim();
  if (!cur) return "hide";
  if (!prev) return "mark";
  if (prev !== cur) return "show";
  return "hide";
}

/** Never paint the card over the age gate, or on the session that first records a version. */
export function shouldPaintWhatsNew(
  rulesAccepted: boolean,
  decision: WhatsNewDecision
): boolean {
  return !!rulesAccepted && decision === "show";
}

export async function shouldShowWhatsNew(): Promise<boolean> {
  try {
    const seen = (await AsyncStorage.getItem(KEY)) || "";
    const cur = currentAppVersion();
    const decision = decideWhatsNew(seen, cur);
    if (decision === "mark") {
      await AsyncStorage.setItem(KEY, cur);
      return false;
    }
    return decision === "show";
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
