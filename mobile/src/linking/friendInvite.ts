/**
 * Parse friend-invite deep links (app scheme + hub web URLs).
 *
 * Supported:
 *   ruletka://friend/ABC123
 *   ruletka://add?friend=ABC123
 *   ruletka://add?code=ABC123
 *   ruletka://ABC123          (bare code — not a reserved route name)
 *   https://ruletka.vip/live.html?friend=ABC123
 *   https://ruletka.me/live.html?friend=ABC123&ref=friend_invite
 *
 * NOT friend invites (must not steal navigation):
 *   ruletka://live
 *   ruletka://live?autostart=1
 *   ruletka://friends
 *   ruletka://settings
 *   ruletka://rules
 *
 * Regression (emu-smoke): path segment "live"/"friends"/"settings" matched
 * CODE_RE (4–16 A–Z0–9) → FriendInviteHandler pushed /friends.
 */

const CODE_RE = /^[A-Z0-9]{4,16}$/;

/**
 * expo-router screen names + path prefixes that must never be treated as a
 * bare friend code when used as the only path segment of ruletka://…
 */
const RESERVED_APP_SEGMENTS = new Set([
  "live",
  "friends",
  "settings",
  "rules",
  "index",
  "home",
  "friend",
  "add",
  // future / defensive
  "modal",
  "plus",
  "auth",
  "onboarding",
]);

export function normalizeFriendCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

export function isValidFriendCode(code: string): boolean {
  return CODE_RE.test(normalizeFriendCode(code));
}

/** True if path segment is an app route, not a friend code. */
export function isReservedAppSegment(seg: string): boolean {
  const s = String(seg || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return !!s && RESERVED_APP_SEGMENTS.has(s);
}

/**
 * Known app routes for ruletka:// scheme (expo-router paths).
 * Returns pathname + optional query params, or null if not a screen route.
 */
export function parseAppRouteUrl(
  url: string | null | undefined
): { pathname: string; params?: Record<string, string> } | null {
  if (!url) return null;
  const s = String(url).trim();
  if (!s || !/^ruletka:/i.test(s)) return null;
  try {
    const normalized = s.replace(/^ruletka:\/\//i, "https://ruletka.app/");
    const u = new URL(normalized);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;
    const seg = parts[0].toLowerCase();
    if (!RESERVED_APP_SEGMENTS.has(seg)) return null;
    // "friend" / "add" alone are invite prefixes, not screens
    if (seg === "friend" || seg === "add" || seg === "modal" || seg === "plus") {
      return null;
    }
    if (seg === "index" || seg === "home") {
      return { pathname: "/" };
    }
    const pathname = `/${seg}`;
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      if (v != null && v !== "") params[k] = v;
    });
    return Object.keys(params).length ? { pathname, params } : { pathname };
  } catch {
    return null;
  }
}

/** Extract friend code from any supported URL / path. */
export function parseFriendInviteUrl(url: string | null | undefined): string {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";

  try {
    // Custom scheme: ruletka://friend/CODE or ruletka://add?...
    if (/^ruletka:/i.test(s)) {
      const normalized = s.replace(/^ruletka:\/\//i, "https://ruletka.app/");
      const u = new URL(normalized);
      const q =
        u.searchParams.get("friend") ||
        u.searchParams.get("code") ||
        u.searchParams.get("c") ||
        "";
      if (q) {
        const c = normalizeFriendCode(q);
        return isValidFriendCode(c) ? c : "";
      }
      // path /friend/CODE or /add/CODE
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && (parts[0] === "friend" || parts[0] === "add")) {
        const c = normalizeFriendCode(parts[1]);
        return isValidFriendCode(c) ? c : "";
      }
      // Bare ruletka://CODE — but never steal app routes (live/friends/settings/…)
      if (parts.length === 1) {
        if (isReservedAppSegment(parts[0])) return "";
        const c = normalizeFriendCode(parts[0]);
        return isValidFriendCode(c) ? c : "";
      }
      return "";
    }

    const u = new URL(s);
    const q =
      u.searchParams.get("friend") ||
      u.searchParams.get("code") ||
      "";
    if (q) {
      const c = normalizeFriendCode(q);
      return isValidFriendCode(c) ? c : "";
    }
  } catch {
    // bare code?
    if (isReservedAppSegment(s)) return "";
    const c = normalizeFriendCode(s);
    if (isValidFriendCode(c)) return c;
  }
  return "";
}

/** App-scheme invite for Share / QR (opens app when installed). */
export function appFriendInviteUrl(code: string): string {
  const c = normalizeFriendCode(code);
  return `ruletka://friend/${c}`;
}

/** Web invite (works in browser; app may claim via universal links later). */
export function webFriendInviteUrl(hubBase: string, code: string): string {
  const base = hubBase.replace(/\/$/, "");
  const c = normalizeFriendCode(code);
  return `${base}/live.html?friend=${encodeURIComponent(c)}&ref=friend_invite`;
}

export function friendInviteShareMessage(
  hubBase: string,
  code: string,
  brand = "ruletka"
): { message: string; title: string; url: string } {
  const c = normalizeFriendCode(code);
  const web = webFriendInviteUrl(hubBase, c);
  const app = appFriendInviteUrl(c);
  return {
    title: `${brand} · code ${c}`,
    url: web,
    message: `Add me on ${brand} · code ${c}\n${web}\n\nApp: ${app}`,
  };
}
