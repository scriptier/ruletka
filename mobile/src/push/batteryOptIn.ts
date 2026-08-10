/**
 * Android: after call alerts are enabled, offer "unrestricted battery"
 * so OEM killers don't drop background rings.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking, Platform } from "react-native";
import Constants from "expo-constants";

const SEEN_KEY = "ruletka-battery-optin-seen-v1";

function packageName(): string {
  return (
    Constants.expoConfig?.android?.package ||
    "me.ruletka.app"
  );
}

export async function hasSeenBatteryOptIn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === "1";
  } catch {
    return true;
  }
}

export async function markBatteryOptInSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Open Android battery-unrestricted / app settings (Settings screen CTA). */
export async function openBatterySettings(): Promise<boolean> {
  if (Platform.OS !== "android") {
    try {
      await Linking.openSettings();
      return true;
    } catch {
      return false;
    }
  }
  const pkg = packageName();
  // Prefer IntentLauncher when present (expo optional)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IntentLauncher = require("expo-intent-launcher");
    const start =
      IntentLauncher.startActivityAsync ||
      IntentLauncher.default?.startActivityAsync;
    if (typeof start === "function") {
      await start("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", {
        data: `package:${pkg}`,
      });
      return true;
    }
  } catch {
    /* not installed */
  }
  // Fallback: app settings (user finds Battery manually)
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

async function openBatteryRequest(): Promise<boolean> {
  return openBatterySettings();
}

/**
 * One-shot after successful notification enable on Android.
 */
export async function maybeOfferBatteryUnrestricted(opts: {
  title: string;
  body: string;
  enableLabel: string;
  laterLabel: string;
  onOpened?: () => void;
}): Promise<void> {
  if (Platform.OS !== "android") return;
  if (await hasSeenBatteryOptIn()) return;
  await markBatteryOptInSeen();

  Alert.alert(opts.title, opts.body, [
    {
      text: opts.laterLabel,
      style: "cancel",
    },
    {
      text: opts.enableLabel,
      onPress: () => {
        void openBatteryRequest().then((ok) => {
          if (ok) opts.onOpened?.();
        });
      },
    },
  ]);
}
