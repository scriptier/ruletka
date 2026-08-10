/**
 * Cosmetic flag emoji + trust tier chrome (web-aligned thresholds).
 * Flags are never inferred from IP — only peer/hub-provided codes.
 */

export const TRUST_TRUSTED = 100;
export const TRUST_SENIOR = 250;

export type TrustTier = "new" | "known" | "trusted" | "senior";

export function normalizeFlagCode(raw: unknown): string {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  if (s.length !== 2) return "";
  return s;
}

/** Regional indicator pair emoji for ISO 3166-1 alpha-2 (and EU/UN/AQ/XK). */
export function flagEmoji(code: unknown): string {
  const cc = normalizeFlagCode(code);
  if (!cc) return "";
  try {
    return String.fromCodePoint(
      ...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
    );
  } catch {
    return "";
  }
}

export function trustTier(trust: number): TrustTier {
  const n = Math.max(0, Math.floor(Number(trust) || 0));
  if (n >= TRUST_SENIOR) return "senior";
  if (n >= TRUST_TRUSTED) return "trusted";
  if (n > 0) return "known";
  return "new";
}

/** i18n key for tier chip label. */
export function trustTierI18nKey(trust: number): string {
  const t = trustTier(trust);
  if (t === "senior") return "mobile.live.tierSenior";
  if (t === "trusted") return "mobile.live.tierTrusted";
  if (t === "known") return "mobile.live.tierKnown";
  return "mobile.live.tierNew";
}

export function formatLocLine(opts: {
  flag?: string;
  country?: string;
  city?: string;
  /** App language — localize EN hub geo when UI is Russian */
  lang?: string;
}): string {
  const em = flagEmoji(opts.flag);
  const lang = opts.lang || "ru";
  // Lazy import avoided — callers pass already-localized strings preferred.
  // When raw EN from hub is passed, translate here.
  let country = String(opts.country || "").trim();
  let city = String(opts.city || "").trim();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geo = require("../i18n/geoLocalize") as {
      localizeCountry: (c: string, f?: string, l?: string) => string;
      localizeCity: (c: string, l?: string) => string;
    };
    // Web parity: if hub sent flag ISO but empty country (race / hide path),
    // still show a country label so chrome is not "Location unknown".
    if (!country && normalizeFlagCode(opts.flag)) {
      country = geo.localizeCountry(opts.flag || "", opts.flag, lang);
    } else if (country) {
      country = geo.localizeCountry(country, opts.flag, lang);
    }
    if (city) {
      city = geo.localizeCity(city, lang);
    }
  } catch {
    /* optional */
  }
  const parts: string[] = [];
  if (em) parts.push(em);
  else if (normalizeFlagCode(opts.flag)) {
    parts.push(normalizeFlagCode(opts.flag));
  }
  // Screenshot layout: country then city (vertical on web; single line here)
  if (country) parts.push(country.slice(0, 28));
  if (city) parts.push(city.slice(0, 28));
  return parts.join(" · ");
}
