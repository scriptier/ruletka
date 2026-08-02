/**
 * Optional Expo push registration.
 * Full delivery needs: expo-notifications + EAS project credentials + hub ROULETTE_PUSH_WEBHOOK_URL
 * (or a real FCM/APNs path). Without the native module this no-ops cleanly.
 */
import { Platform } from "react-native";
import type { HubClient } from "../hub/HubClient";

export type PushRegisterResult =
  | { ok: true; token: string; platform: string }
  | { ok: false; reason: string };

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

  try {
    // Optional dependency — not required for v1 store path
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications");
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") {
      return { ok: false, reason: "permission_denied" };
    }
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = String(tokenData?.data || "");
    if (!token) return { ok: false, reason: "no_token" };
    const platform = Platform.OS === "ios" ? "ios" : "android";
    hub.registerPush(token, platform, false);
    return { ok: true, token, platform };
  } catch {
    return {
      ok: false,
      reason:
        "expo-notifications not linked — install after EAS project (see docs/APP_LINKS.md)",
    };
  }
}
