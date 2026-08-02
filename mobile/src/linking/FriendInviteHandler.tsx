/**
 * Listens for cold-start + runtime friend invite URLs.
 * Queues code on HubProvider → auto add_friend when connected.
 */
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { useHub } from "../hub/HubProvider";
import { parseFriendInviteUrl } from "./friendInvite";

export function FriendInviteHandler() {
  const { consumeFriendInvite } = useHub();

  useEffect(() => {
    function handle(url: string | null) {
      const code = parseFriendInviteUrl(url);
      if (!code) return;
      consumeFriendInvite(code);
      try {
        router.push("/friends");
      } catch {
        /* ignore */
      }
    }

    Linking.getInitialURL()
      .then(handle)
      .catch(() => {});
    const sub = Linking.addEventListener("url", (ev) => handle(ev.url));
    return () => sub.remove();
  }, [consumeFriendInvite]);

  return null;
}
