/**
 * Cold-start + runtime deep links:
 * - Friend invites → queue add_friend + open Friends
 * - App routes (live / settings / friends / rules) → navigate (do not treat
 *   path as friend code — LIVE/FRIENDS/SETTINGS match CODE_RE)
 */
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { track } from "../analytics/track";
import { useHub } from "../hub/HubProvider";
import { parseAppRouteUrl, parseFriendInviteUrl } from "./friendInvite";

function goRoute(pathname: string, params?: Record<string, string>) {
  const attempt = () => {
    try {
      if (params && Object.keys(params).length) {
        router.replace({
          pathname: pathname as "/live",
          params,
        });
      } else {
        router.replace(pathname as "/live");
      }
      return true;
    } catch {
      try {
        if (params && Object.keys(params).length) {
          router.push({
            pathname: pathname as "/live",
            params,
          });
        } else {
          router.push(pathname as "/live");
        }
        return true;
      } catch {
        return false;
      }
    }
  };
  if (attempt()) return;
  // Cold start: Stack may not be ready on first tick
  setTimeout(() => {
    if (attempt()) return;
    setTimeout(attempt, 400);
  }, 100);
}

export function FriendInviteHandler() {
  const { consumeFriendInvite } = useHub();
  /** Invite codes already tracked this session (analytics once). */
  const trackedCodes = useRef<Set<string>>(new Set());
  /** Dedupe identical URL from getInitialURL + url event (same cold start). */
  const lastUrlAt = useRef<{ url: string; t: number } | null>(null);

  useEffect(() => {
    function handle(url: string | null) {
      if (!url) return;
      const now = Date.now();
      const prev = lastUrlAt.current;
      if (prev && prev.url === url && now - prev.t < 1500) {
        return;
      }
      lastUrlAt.current = { url, t: now };

      // 1) Friend invite always wins (query ?friend= / ruletka://friend/CODE)
      const code = parseFriendInviteUrl(url);
      if (code) {
        if (!trackedCodes.current.has(code)) {
          trackedCodes.current.add(code);
          track("funnel_invite_land", { via: "deep_link" });
          track("friend_invite_deep_link", { code: code.slice(0, 8) });
        }
        consumeFriendInvite(code);
        try {
          router.push("/friends");
        } catch {
          /* ignore */
        }
        return;
      }

      // 2) Known app screens — force navigation for warm start / stolen stack
      //    (expo-router usually does this; explicit replace keeps /live reliable)
      const route = parseAppRouteUrl(url);
      if (!route) return;
      goRoute(route.pathname, route.params);
    }

    Linking.getInitialURL()
      .then(handle)
      .catch(() => {});
    const sub = Linking.addEventListener("url", (ev) => handle(ev.url));
    return () => sub.remove();
  }, [consumeFriendInvite]);

  return null;
}
