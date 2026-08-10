/**
 * Expo push registration for offline friend-call rings.
 * Hub stores token; offline call_friend fires ROULETTE_PUSH_WEBHOOK_URL.
 *
 * Safe if native module fails to init — never crashes Hermes.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { HubClient } from "../hub/HubClient";

export type PushRegisterResult =
  | { ok: true; token: string; platform: string }
  | { ok: false; reason: string };

type NotifMod = {
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (opts?: object) => Promise<{ data: string }>;
  setNotificationChannelAsync?: (
    id: string,
    opts: object
  ) => Promise<unknown>;
  setNotificationHandler?: (h: object) => void;
  AndroidImportance?: { MAX: number; HIGH: number };
};

function loadNotifications(): NotifMod | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-notifications") as NotifMod | null;
    if (mod && typeof (mod as NotifMod).getExpoPushTokenAsync === "function") {
      return mod;
    }
  } catch {
    /* not linked */
  }
  return null;
}

export function pushModuleAvailable(): boolean {
  return !!loadNotifications();
}

export async function tryRegisterPush(
  hub: HubClient,
  enabled: boolean
): Promise<PushRegisterResult> {
  if (!enabled) {
    try {
      hub.registerPush("", "expo", true);
    } catch {
      /* ignore */
    }
    return { ok: false, reason: "disabled" };
  }

  const Notifications = loadNotifications();
  if (!Notifications) {
    return { ok: false, reason: "no_module" };
  }

  try {
    // Show alerts while foregrounded (friend call may arrive as push)
    try {
      Notifications.setNotificationHandler?.({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch {
      /* ignore */
    }

    let perm = await Notifications.getPermissionsAsync();
    if (perm.status !== "granted") {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (perm.status !== "granted") {
      return { ok: false, reason: "permission_denied" };
    }

    if (
      Platform.OS === "android" &&
      Notifications.setNotificationChannelAsync &&
      Notifications.AndroidImportance
    ) {
      try {
        await Notifications.setNotificationChannelAsync("friend-calls", {
          name: "Friend calls",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 400, 200, 400],
          sound: "default",
          enableVibrate: true,
          showBadge: true,
        });
      } catch {
        /* optional */
      }
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (
        Constants as {
          easConfig?: { projectId?: string };
        }
      ).easConfig?.projectId;

    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId: String(projectId) } : undefined
    );
    const token = String(tokenResult?.data || "").trim();
    if (!token) return { ok: false, reason: "no_token" };

    hub.registerPush(token, "expo", false);
    return { ok: true, token, platform: "expo" };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message.slice(0, 80) : "register_failed",
    };
  }
}
