/**
 * Hub moderation messages (genital auto-ban, hub feature/genital-ban-2026-11-04).
 *
 *   banned         → we are match-banned: { reason, secs, until (unix s), permanent, level 1|2|3 }
 *                    Sent on the ban and again on hello / spin while it lasts.
 *   partner_banned → the stranger we were watching was just banned.
 *
 * A hub without the feature never sends either message, so this is inert there.
 * Pure helpers only (no RN) so node tests can load them.
 */

export type HubBan = {
  permanent: boolean;
  level: number;
  /** Ban end, ms since epoch (0 when permanent or unknown). */
  untilMs: number;
};

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type BanCopy = {
  title: string;
  body: string;
  /** "Until: …" line, empty when permanent or the end time is unknown. */
  until: string;
  ok: string;
};

/** Normalize a hub `banned` message. Level 3 is permanent even without the flag. */
export function parseHubBan(
  msg: { permanent?: unknown; level?: unknown; until?: unknown; secs?: unknown },
  nowMs: number = Date.now()
): HubBan {
  const level = Math.max(0, Math.floor(Number(msg.level) || 0));
  const permanent = msg.permanent === true || level >= 3;
  let untilMs = 0;
  if (!permanent) {
    const until = Number(msg.until) || 0;
    const secs = Number(msg.secs) || 0;
    if (until > 0) untilMs = until * 1000;
    else if (secs > 0) untilMs = nowMs + secs * 1000;
  }
  return { permanent, level, untilMs };
}

/** Ban is still running (permanent, or the end time is in the future). */
export function isHubBanActive(ban: HubBan | null, nowMs: number = Date.now()): boolean {
  if (!ban) return false;
  if (ban.permanent) return true;
  return ban.untilMs > nowMs;
}

/** Duration phrase for the ban body ("на 24 часа" / "на 7 дней"). */
export function banDurationKey(ban: HubBan): string {
  return ban.level === 2 ? "mobile.ban.dur7d" : "mobile.ban.dur24h";
}

export function formatBanUntil(untilMs: number, locale?: string): string {
  try {
    return new Date(untilMs).toLocaleString(locale || undefined, {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(untilMs).toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Ban screen text. English fallbacks cover a missing overlay key. */
export function banCopy(ban: HubBan, t: Translate, locale?: string): BanCopy {
  const title = t("mobile.ban.title") || "You are banned";
  const ok = t("mobile.ban.ok") || "OK";
  if (ban.permanent) {
    return {
      title,
      body:
        t("mobile.ban.bodyPermanent") ||
        "You are banned permanently for showing genitals on camera again.",
      until: "",
      ok,
    };
  }
  const dur = t(banDurationKey(ban)) || (ban.level === 2 ? "for 7 days" : "for 24 hours");
  const body =
    t("mobile.ban.bodyGenitals", { dur }) ||
    `You are banned ${dur} for showing genitals on camera. This breaks Ruletka's rules.`;
  const when = ban.untilMs > 0 ? formatBanUntil(ban.untilMs, locale) : "";
  const until = when ? t("mobile.ban.until", { when }) || `Until: ${when}` : "";
  return { title, body, until, ok };
}

/** After `partner_banned`, the hub's leave status follows; keep our notice for this long. */
export const PARTNER_BANNED_NOTICE_MS = 8000;

export function partnerBannedRecently(atMs: number, nowMs: number = Date.now()): boolean {
  return atMs > 0 && nowMs - atMs >= 0 && nowMs - atMs < PARTNER_BANNED_NOTICE_MS;
}
