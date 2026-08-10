/**
 * Handle Expo notification taps (offline friend call alerts, DMs, etc.).
 */
import { router } from "expo-router";
import { setPendingCallFromPush } from "./pendingCall";

type Sub = { remove: () => void };

type NotifData = Record<string, unknown> | undefined;

function openFromData(data: NotifData) {
  const kind = String(
    data?.kind || data?.type || data?.action || data?.event || ""
  ).toLowerCase();
  const userId = String(
    data?.from_user_id ||
      data?.user_id ||
      data?.peer_user_id ||
      data?.with_user_id ||
      ""
  ).trim();
  const fromName = String(
    data?.from_name || data?.name || data?.caller_name || "Friend"
  ).slice(0, 40);
  const join = !!(data?.join || data?.is_join);

  try {
    // Friend call ring → Live (MediaSession) so answer path has camera ready
    if (
      kind.includes("call") ||
      kind.includes("ring") ||
      data?.call ||
      data?.incoming_call
    ) {
      if (userId) {
        setPendingCallFromPush({
          fromUserId: userId,
          fromName,
          join,
        });
      }
      try {
        router.push("/live");
      } catch {
        try {
          router.replace("/live");
        } catch {
          /* ignore */
        }
      }
      return;
    }
    // Friend DM → Friends (HubProvider can open chat via pending if we set it)
    if (
      kind.includes("chat") ||
      kind.includes("dm") ||
      kind.includes("message") ||
      kind.includes("friend_chat")
    ) {
      if (userId) {
        // Query param consumed by Friends if present
        router.push({
          pathname: "/friends",
          params: { openChat: userId },
        } as never);
      } else {
        router.push("/friends");
      }
      return;
    }
    // Safety / report / system → Settings
    if (
      kind.includes("safety") ||
      kind.includes("report") ||
      kind.includes("policy")
    ) {
      router.push("/settings");
      return;
    }
    // Default: Friends (most push kinds today are social)
    router.push("/friends");
  } catch {
    /* ignore */
  }
}

export function attachPushResponseListener(): () => void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications") as {
      addNotificationResponseReceivedListener?: (
        cb: (r: {
          notification: {
            request: { content: { data?: Record<string, unknown> } };
          };
        }) => void
      ) => Sub;
      getLastNotificationResponseAsync?: () => Promise<{
        notification: {
          request: { content: { data?: Record<string, unknown> } };
        };
      } | null>;
      addNotificationReceivedListener?: (
        cb: (n: {
          request: { content: { data?: Record<string, unknown> } };
        }) => void
      ) => Sub;
    };
    if (!Notifications?.addNotificationResponseReceivedListener) {
      return () => {};
    }

    const sub = Notifications.addNotificationResponseReceivedListener(
      (resp) => {
        openFromData(resp?.notification?.request?.content?.data);
      }
    );

    // Foreground receipt of remote push while WS might lag: stash peer id
    let recvSub: Sub | null = null;
    if (Notifications.addNotificationReceivedListener) {
      recvSub = Notifications.addNotificationReceivedListener((n) => {
        const data = n?.request?.content?.data;
        if (!data) return;
        const kind = String(
          data.kind || data.type || data.action || ""
        ).toLowerCase();
        if (
          kind.includes("call") ||
          kind.includes("ring") ||
          data.call ||
          data.incoming_call
        ) {
          const userId = String(
            data.from_user_id || data.user_id || ""
          ).trim();
          if (userId) {
            setPendingCallFromPush({
              fromUserId: userId,
              fromName: String(data.from_name || data.name || "Friend"),
              join: !!data.join,
            });
          }
        }
      });
    }

    // Cold start from killed state
    void Notifications.getLastNotificationResponseAsync?.()
      .then((last) => {
        if (last) openFromData(last.notification?.request?.content?.data);
      })
      .catch(() => {});

    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
      try {
        recvSub?.remove();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => {};
  }
}
