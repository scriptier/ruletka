/**
 * Cosmetic flag emoji + trust tier chrome (web-aligned thresholds).
 * Flags are never inferred from IP — only peer/hub-provided codes.
 */

import { localizeCity, localizeCountry } from "../i18n/geoLocalize";

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

/**
 * Normalize hub / client peer_id for loose compare.
 * Strips `fed/{session}/` prefix, dashes, case — so hex UUID forms match.
 */
export function normalizePeerIdKey(raw: unknown): string {
  let s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return "";
  // Federated wire form: fed/{session_id}/{original_peer_id}
  if (s.startsWith("fed/")) {
    const parts = s.split("/");
    if (parts.length >= 3) {
      s = parts.slice(2).join("/") || s;
    }
  }
  // Drop non-alphanumeric so dashed UUID ≈ hex blob
  return s.replace(/[^a-z0-9]/g, "");
}

/** Exact / 8-char prefix / containment match after normalizePeerIdKey. */
export function peerIdsLooseMatch(a: unknown, b: unknown): boolean {
  const x = normalizePeerIdKey(a);
  const y = normalizePeerIdKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const n = 8;
  if (x.length >= n && y.length >= n && x.slice(0, n) === y.slice(0, n)) {
    return true;
  }
  // short_id vs full, or residual fed path still containing the other
  if (x.length >= n && y.includes(x)) return true;
  if (y.length >= n && x.includes(y)) return true;
  return false;
}

export function formatLocLine(opts: {
  flag?: string;
  country?: string;
  city?: string;
  /** App language — localize EN hub geo when UI is Russian */
  lang?: string;
  /**
   * Partner hide_ip privacy: never invent country/city from cosmetic flag.
   * Returns "" so chrome can show "Location hidden" (flag stays on name).
   */
  hideIp?: boolean;
  /**
   * When true, omit flag emoji/ISO from the line (flag is painted as a separate
   * chip on video — dual 🇨🇦 was the 2026-08-11 screenshot fail).
   */
  omitFlag?: boolean;
}): string {
  if (opts.hideIp) {
    // Privacy: cosmetic flag belongs on the name line; loc line is private.
    return "";
  }
  const omitFlag = !!opts.omitFlag;
  const rawCountry = String(opts.country || "").trim();
  // Country may itself be ISO when hub omits flag (e.g. country:"CA").
  const code =
    normalizeFlagCode(opts.flag) ||
    (rawCountry.length === 2 ? normalizeFlagCode(rawCountry) : "");
  const em = flagEmoji(code);
  const lang = opts.lang || "ru";
  let country = rawCountry;
  let city = String(opts.city || "").trim();
  // Hub may send flag ISO before country/city (async partner_geo race).
  // Prefer localized country from ISO so chrome is never empty when flag known.
  if (!country && code) {
    country = localizeCountry(code, code, lang) || code;
  } else if (country) {
    country = localizeCountry(country, code || opts.flag, lang) || country;
  }
  if (!country && code) country = code;
  if (city) {
    city = localizeCity(city, lang) || city;
  }
  const parts: string[] = [];
  if (!omitFlag) {
    if (em) parts.push(em);
    else if (code) parts.push(code);
  }
  // Screenshot layout: country then city (single line). Skip pure ISO duplicate
  // when flag/code already in parts ("🇨🇦 · CA" / "CA · CA").
  if (country) {
    const sameAsCode =
      !!code && country.toUpperCase() === code.toUpperCase();
    if (!sameAsCode || parts.length === 0) {
      parts.push(country.slice(0, 28));
    }
  }
  if (city) parts.push(city.slice(0, 28));
  // Absolute fallback: any geo signal must yield a non-empty loc line.
  // omitFlag: never return emoji — stage partnerFlagChip owns the flag visual.
  if (!parts.length) {
    if (!omitFlag) {
      if (em) return em;
      if (code) return code;
    } else if (code) {
      // Text ISO only as last resort when country localize failed entirely.
      return code;
    }
    if (rawCountry) return rawCountry.slice(0, 28);
    if (city) return city.slice(0, 28);
  }
  return parts.join(" · ");
}
