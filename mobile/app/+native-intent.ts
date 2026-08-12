/**
 * Rewrite system deep-link URLs before expo-router resolves them.
 *
 * Android delivers `ruletka://live` as host=live path="" — map to `/live`.
 * Friend invites must NOT return a raw scheme URL (that yields Unmatched Route);
 * land on `/friends` and let FriendInviteHandler parse the original URL for code.
 */

const RESERVED = new Set([
  "live",
  "friends",
  "settings",
  "rules",
  "index",
  "home",
]);

function qs(u: URL): string {
  return u.search || "";
}

export function redirectSystemPath({
  path,
  initial: _initial,
}: {
  path: string;
  initial: boolean;
}): string {
  const raw = String(path || "").trim();
  if (!raw) return raw;

  // Already a clean app path
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    // Ignore bogus absolute-ish leftovers
    if (raw.startsWith("/ruletka:") || raw.startsWith("/me.ruletka")) {
      return "/";
    }
    return raw;
  }

  // Full scheme URL
  if (/^ruletka:/i.test(raw) || /^me\.ruletka\.app:/i.test(raw)) {
    try {
      const normalized = raw
        .replace(/^ruletka:\/\//i, "https://ruletka.app/")
        .replace(/^me\.ruletka\.app:\/\//i, "https://ruletka.app/");
      const u = new URL(normalized);
      const parts = u.pathname.split("/").filter(Boolean);
      const host = (u.hostname || "").toLowerCase();
      const qFriend =
        u.searchParams.get("friend") ||
        u.searchParams.get("code") ||
        u.searchParams.get("c") ||
        "";

      // Explicit invite query on any path → friends (handler also consumes)
      if (qFriend) return "/friends";

      // ruletka://friend/CODE or ruletka://add/...
      if (host === "friend" || host === "add") return "/friends";
      if (parts[0] === "friend" || parts[0] === "add") return "/friends";

      // ruletka://live or ruletka://live?autostart=1 (host = route)
      if (host && RESERVED.has(host) && parts.length === 0) {
        if (host === "index" || host === "home") return `/${qs(u)}`.replace(/^\//, "/") || "/";
        return `/${host}${qs(u)}`;
      }

      // ruletka:///live (path-based)
      if (parts.length === 1 && RESERVED.has(parts[0].toLowerCase())) {
        const seg = parts[0].toLowerCase();
        if (seg === "index" || seg === "home") return `/${qs(u)}` === "/" ? "/" : `/${qs(u)}`;
        return `/${seg}${qs(u)}`;
      }

      // Bare ruletka://AB12CD (host looks like friend code)
      if (
        host &&
        parts.length === 0 &&
        /^[a-z0-9]{4,16}$/i.test(host) &&
        !RESERVED.has(host)
      ) {
        return "/friends";
      }

      // Unknown scheme URL — stay home (never pass raw scheme to router)
      return "/";
    } catch {
      return "/";
    }
  }

  // Path without leading slash: "live" / "live?autostart=1" / "friend/CODE"
  const friendPath = raw.match(/^(friend|add)(\/|\?|$)/i);
  if (friendPath) return "/friends";

  const m = raw.match(/^([A-Za-z0-9_-]+)(\?.*)?$/);
  if (m) {
    const seg = m[1].toLowerCase();
    const q = m[2] || "";
    if (RESERVED.has(seg)) {
      if (seg === "index" || seg === "home") return `/${q}`.replace(/^\/\?/, "/?") || "/";
      return `/${seg}${q}`;
    }
    // bare code segment
    if (/^[a-z0-9]{4,16}$/i.test(seg)) return "/friends";
  }

  // Never feed opaque scheme strings into the router
  if (/:\/\//.test(raw)) return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}
