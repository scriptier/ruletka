/**
 * One-shot after first friend Accept: offer OS call alerts.
 * Mirrors web Week-3 “Enable alerts” path without spamming.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking, Platform } from "react-native";
import type { HubClient } from "../hub/HubClient";
import { loadMatchPrefs, saveMatchPrefs } from "../prefs/store";
import { maybeOfferBatteryUnrestricted } from "./batteryOptIn";
import { tryRegisterPush, pushModuleAvailable } from "./register";

const SEEN_KEY = "ruletka-notif-optin-seen-v1";

export async function hasSeenNotifOptIn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === "1";
  } catch {
    return true;
  }
}

export async function markNotifOptInSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

async function openAppNotificationSettings(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      // Opens app details; user can open Notifications + Battery from there
      await Linking.openSettings();
      return;
    }
    await Linking.openSettings();
  } catch {
    /* ignore */
  }
}

/**
 * If OS permission not granted and we haven't asked, show opt-in.
 * Safe no-op when module missing / already granted / already seen.
 */
export async function maybeOfferNotifOptIn(opts: {
  hub: HubClient;
  title: string;
  body: string;
  enableLabel: string;
  laterLabel: string;
  /** After successful OS grant + register. */
  onEnabled?: () => void;
  onLater?: () => void;
  /** Permission denied — show battery/settings tip. */
  deniedTitle?: string;
  deniedBody?: string;
  openSettingsLabel?: string;
  /** Android: after alerts enabled, offer unrestricted battery. */
  batteryTitle?: string;
  batteryBody?: string;
  batteryEnableLabel?: string;
}): Promise<void> {
  if (await hasSeenNotifOptIn()) return;
  if (!pushModuleAvailable()) {
    await markNotifOptInSeen();
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications") as {
      getPermissionsAsync: () => Promise<{ status: string }>;
    };
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status === "granted") {
      await markNotifOptInSeen();
      const prefs = await loadMatchPrefs();
      if (prefs.notifyFriendCalls) {
        void tryRegisterPush(opts.hub, true);
      }
      return;
    }
  } catch {
    await markNotifOptInSeen();
    return;
  }

  await markNotifOptInSeen();

  Alert.alert(opts.title, opts.body, [
    {
      text: opts.laterLabel,
      style: "cancel",
      onPress: () => opts.onLater?.(),
    },
    {
      text: opts.enableLabel,
      onPress: () => {
        void (async () => {
          const prefs = await loadMatchPrefs();
          const next = { ...prefs, notifyFriendCalls: true };
          await saveMatchPrefs(next);
          const r = await tryRegisterPush(opts.hub, true);
          if (r.ok) {
            opts.onEnabled?.();
            // OEM killers drop rings — offer unrestricted battery once
            if (Platform.OS === "android" && opts.batteryTitle) {
              void maybeOfferBatteryUnrestricted({
                title: opts.batteryTitle,
                body:
                  opts.batteryBody ||
                  "Allow unrestricted battery so friend calls can ring when the app is closed.",
                enableLabel: opts.batteryEnableLabel || "Allow",
                laterLabel: opts.laterLabel,
              });
            }
            return;
          }
          // Denied or no token — guide to system Settings + battery tip
          const dTitle = opts.deniedTitle || opts.title;
          const dBody =
            opts.deniedBody ||
            "Allow notifications in system Settings. On Android, exclude the app from battery optimization so rings arrive.";
          Alert.alert(dTitle, dBody, [
            { text: opts.laterLabel, style: "cancel", onPress: () => opts.onLater?.() },
            {
              text: opts.openSettingsLabel || "Open settings",
              onPress: () => void openAppNotificationSettings(),
            },
          ]);
        })();
      },
    },
  ]);
}
