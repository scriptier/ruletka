/**
 * Listens for cold-start + runtime friend invite URLs.
 * Queues code on HubProvider → auto add_friend when connected.
 */
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { track } from "../analytics/track";
import { useHub } from "../hub/HubProvider";
import { parseFriendInviteUrl } from "./friendInvite";

export function FriendInviteHandler() {
  const { consumeFriendInvite } = useHub();
  const landed = useRef<Set<string>>(new Set());

  useEffect(() => {
    function handle(url: string | null) {
      const code = parseFriendInviteUrl(url);
      if (!code) return;
      // One land per code per session (avoid double getInitialURL + event)
      if (!landed.current.has(code)) {
        landed.current.add(code);
        track("funnel_invite_land", { via: "deep_link" });
        track("friend_invite_deep_link", { code: code.slice(0, 8) });
      }
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
