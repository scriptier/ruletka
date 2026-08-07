/**
 * Local OS notifications for friend-call rings while the app is backgrounded
 * (WS still connected) — complements remote Expo push for offline callees.
 */
import { AppState, Platform } from "react-native";

const CHANNEL = "friend-calls";
const NOTIF_ID = "ruletka-friend-call-ring";

type NotifMod = {
  setNotificationChannelAsync?: (id: string, opts: object) => Promise<unknown>;
  scheduleNotificationAsync?: (req: object) => Promise<string>;
  dismissNotificationAsync?: (id: string) => Promise<void>;
  cancelScheduledNotificationAsync?: (id: string) => Promise<void>;
  AndroidImportance?: { MAX: number; HIGH: number };
  AndroidNotificationPriority?: { MAX: string; HIGH: string };
};

function loadNotifications(): NotifMod | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-notifications") as NotifMod | null;
    if (mod && typeof mod.scheduleNotificationAsync === "function") {
      return mod;
    }
  } catch {
    /* not linked */
  }
  return null;
}

export function isAppInForeground(): boolean {
  return AppState.currentState === "active";
}

async function ensureChannel(Notifications: NotifMod): Promise<void> {
  if (
    Platform.OS !== "android" ||
    !Notifications.setNotificationChannelAsync ||
    !Notifications.AndroidImportance
  ) {
    return;
  }
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Friend calls",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      sound: "default",
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: 1,
    });
  } catch {
    /* optional */
  }
}

export type LocalCallAlertOpts = {
  fromUserId: string;
  fromName: string;
  join?: boolean;
  body?: string;
};

/** Present (or replace) a high-priority local ring notification. */
export async function presentLocalCallAlert(
  opts: LocalCallAlertOpts
): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications?.scheduleNotificationAsync) return;

  const name = String(opts.fromName || "Friend").slice(0, 40);
  const title = opts.join ? "Join their call?" : "Incoming friend call";
  const body =
    opts.body ||
    (opts.join
      ? `${name} invited you to join`
      : `${name} is calling — tap to open`);

  try {
    await ensureChannel(Notifications);
    // Replace prior ring for same session
    try {
      await Notifications.dismissNotificationAsync?.(NOTIF_ID);
    } catch {
      /* ignore */
    }
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID,
      content: {
        title,
        body,
        sound: "default",
        priority:
          Notifications.AndroidNotificationPriority?.MAX || "max",
        data: {
          kind: "friend_call_ring",
          type: "friend_call_ring",
          call: true,
          from_user_id: opts.fromUserId,
          from_name: name,
          join: !!opts.join,
        },
        ...(Platform.OS === "android"
          ? { channelId: CHANNEL, sticky: true }
          : {}),
      },
      trigger: null, // immediate
    });
  } catch {
    /* ignore — vibe/in-app UI still work */
  }
}

/** Clear sticky local ring when answered / declined / timed out. */
export async function dismissLocalCallAlert(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.dismissNotificationAsync?.(NOTIF_ID);
  } catch {
    /* ignore */
  }
  try {
    await Notifications.cancelScheduledNotificationAsync?.(NOTIF_ID);
  } catch {
    /* ignore */
  }
}
