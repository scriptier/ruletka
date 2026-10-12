/**
 * Ask the launcher to pin a home-screen shortcut (Android 8+).
 * The system always shows a confirmation dialog — silent pin is not allowed.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

const KEY = "ruletka.home_pin_asked.v1";
/** Process starts, not screen focuses. The pin dialog waits until the second one. */
const OPEN_KEY = "ruletka.app_open_count.v1";

let openNoted: Promise<number> | null = null;

/** Count this process once. Safe to call from boot and from home. */
export function noteAppOpen(): Promise<number> {
  if (openNoted) return openNoted;
  openNoted = (async () => {
    try {
      const raw = await AsyncStorage.getItem(OPEN_KEY);
      const n = (Number(raw) || 0) + 1;
      await AsyncStorage.setItem(OPEN_KEY, String(n));
      return n;
    } catch {
      return 1;
    }
  })();
  return openNoted;
}

type ShortcutsNative = {
  requestPinHomeShortcut?: (
    shortLabel: string,
    longLabel: string
  ) => Promise<boolean>;
  isPinSupported?: () => Promise<boolean>;
};

function native(): ShortcutsNative | null {
  try {
    const m = NativeModules.RuletkaShortcuts as ShortcutsNative | undefined;
    return m || null;
  } catch {
    return null;
  }
}

export async function wasHomePinAsked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markHomePinAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * The system pin dialog is never silent. Skip it on the first app open
 * so age, camera, and Start are not interrupted. Settings can still force it.
 */
export async function requestHomePinAfterFirstOpen(opts?: {
  shortLabel?: string;
  longLabel?: string;
}): Promise<{ asked: boolean; supported: boolean; ok: boolean }> {
  const n = await noteAppOpen();
  if (n < 2) return { asked: false, supported: false, ok: false };
  return requestHomePinOnce(opts);
}

/**
 * One-shot: request pin if supported and we haven't asked yet.
 * @returns true if the system accepted the pin request (user may still cancel dialog)
 */
export async function requestHomePinOnce(opts?: {
  shortLabel?: string;
  longLabel?: string;
  force?: boolean;
}): Promise<{ asked: boolean; supported: boolean; ok: boolean }> {
  if (Platform.OS !== "android") {
    return { asked: false, supported: false, ok: false };
  }
  if (!opts?.force && (await wasHomePinAsked())) {
    return { asked: false, supported: true, ok: false };
  }

  const m = native();
  if (!m?.requestPinHomeShortcut) {
    // Module missing (prebuild without patch) — still mark asked so we don't loop
    await markHomePinAsked();
    return { asked: true, supported: false, ok: false };
  }

  let supported = true;
  try {
    if (m.isPinSupported) supported = !!(await m.isPinSupported());
  } catch {
    supported = false;
  }
  if (!supported) {
    await markHomePinAsked();
    return { asked: true, supported: false, ok: false };
  }

  try {
    const ok = await m.requestPinHomeShortcut(
      opts?.shortLabel || "Ruletka.me",
      opts?.longLabel || "Ruletka.me — video chat"
    );
    await markHomePinAsked();
    return { asked: true, supported: true, ok: !!ok };
  } catch {
    await markHomePinAsked();
    return { asked: true, supported: true, ok: false };
  }
}
