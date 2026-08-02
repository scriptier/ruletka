/**
 * Parse friend-invite deep links (app scheme + hub web URLs).
 *
 * Supported:
 *   ruletka://friend/ABC123
 *   ruletka://add?friend=ABC123
 *   ruletka://add?code=ABC123
 *   https://ruletka.vip/live.html?friend=ABC123
 *   https://ruletka.me/live.html?friend=ABC123&ref=friend_invite
 */

const CODE_RE = /^[A-Z0-9]{4,16}$/;

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
      if (parts.length === 1 && isValidFriendCode(normalizeFriendCode(parts[0]))) {
        return normalizeFriendCode(parts[0]);
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
