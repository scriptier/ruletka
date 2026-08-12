/**
 * Normalize hub matched payload → primary / extra peer picks for Live UI.
 */
import { peerIdsLooseMatch } from "../identity/flagTrust";
import type { MatchPeer, ServerMatched } from "../hub/types";

export type PeerPick = {
  peerId: string;
  userId: string;
  isOfferer: boolean;
  name: string;
  mode: string;
  friendCode: string;
  /** Spendable ★ balance (badge number). 0 when unknown/missing. */
  stars: number;
  /** Public reputation (tier chrome). 0 when unknown/missing. */
  trust: number;
  /**
   * Hub sent an explicit stars field (incl. 0). When false, same-partner
   * re-Matched must not wipe a known non-zero badge with placeholder 0.
   */
  starsKnown: boolean;
  /** Hub sent an explicit trust field (incl. 0). */
  trustKnown: boolean;
  role: string;
  flag: string;
  country: string;
  city: string;
  /** Partner chose hide-IP privacy (partners only see cosmetic flag). */
  hideIp: boolean;
};

function normFlag(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

/**
 * First present non-negative integer among candidates.
 * `undefined` / `null` / `""` / blank strings skip; explicit `0` is valid.
 * Tolerates string numbers with surrounding whitespace (" 12 ").
 */
export function readNonNegInt(...candidates: unknown[]): number | undefined {
  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw === "string" && !raw.trim()) continue;
    const n = Math.floor(Number(typeof raw === "string" ? raw.trim() : raw));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

/**
 * Read spendable ★ from MatchPeer / partner_identity DC (snake_case + aliases).
 * Also used on P2P partner_identity payloads when hub MatchPeer is weak/old.
 */
export function readPeerStars(p: MatchPeer | Record<string, unknown>): {
  stars: number;
  known: boolean;
} {
  const any = p as MatchPeer & Record<string, unknown>;
  // Nested wallet/public blobs some bridges have used.
  const asObj = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : undefined;
  const nested =
    asObj(any.wallet) ||
    asObj(any.public) ||
    asObj(any.ledger) ||
    asObj(any.identity) ||
    undefined;
  // Hub MatchPeer.stars (serde u64); tolerate older/alt bridges & camelCase.
  // DC partner_identity may send stars/star_balance. Explicit 0 → known=true
  // (spend-to-zero). Omitted → known=false (do not wipe prior badge).
  const n = readNonNegInt(
    any.stars,
    any.Stars,
    any.star_balance,
    any.starBalance,
    any.star_count,
    any.starCount,
    any.public_stars,
    any.publicStars,
    any.wallet_stars,
    any.walletStars,
    any.spendable_stars,
    any.spendableStars,
    any.spendable,
    // Prefer named star fields over bare `balance` (could be unrelated).
    nested?.stars,
    nested?.star_balance,
    nested?.starBalance,
    nested?.balance,
    any.balance,
    any.star
  );
  return { stars: n ?? 0, known: n !== undefined };
}

/**
 * Read public trust / social health from MatchPeer or partner_identity DC.
 */
export function readPeerTrust(p: MatchPeer | Record<string, unknown>): {
  trust: number;
  known: boolean;
} {
  const any = p as MatchPeer & Record<string, unknown>;
  // Nested reputation blobs (wire rename safety). Skip plain numbers.
  const asObj = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : undefined;
  const nested =
    asObj(any.reputation) ||
    asObj(any.social) ||
    asObj(any.public) ||
    asObj(any.identity) ||
    undefined;
  // Hub MatchPeer.trust = social_health_for (praise − soft bars stigma).
  // DC partner_identity may send trust/social_health. Explicit 0 → known=true.
  // Omitted → known=false (same-partner keep).
  const n = readNonNegInt(
    any.trust,
    any.Trust,
    any.social_health,
    any.socialHealth,
    any.trust_effective,
    any.trustEffective,
    any.public_trust,
    any.publicTrust,
    // Plain number reputation only — skip if object (handled via nested).
    typeof any.reputation === "number" || typeof any.reputation === "string"
      ? any.reputation
      : undefined,
    any.social_score,
    any.socialScore,
    nested?.trust,
    nested?.social_health,
    nested?.socialHealth,
    nested?.score,
    any.score
  );
  return { trust: n ?? 0, known: n !== undefined };
}

/**
 * Pull flag/country/city from flat MatchPeer or nested public_location / geo.
 * Hub currently flattens via public_location → MatchPeer fields; nested is
 * defensive so a wire rename never leaves Android chrome empty while web paints.
 */
export function readPeerGeo(p: MatchPeer | Record<string, unknown>): {
  flag: string;
  country: string;
  city: string;
  hideIp: boolean;
} {
  const any = p as MatchPeer & Record<string, unknown>;
  const asObj = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : undefined;
  const nested =
    asObj(any.public_location) ||
    asObj(any.publicLocation) ||
    asObj(any.geo) ||
    asObj(any.location) ||
    undefined;
  const flag = normFlag(
    any.flag ??
      any.Flag ??
      any.flagCode ??
      any.flag_code ??
      nested?.flag ??
      nested?.Flag ??
      nested?.code ??
      nested?.country_code ??
      nested?.countryCode
  );
  const country = String(
    any.country ??
      any.Country ??
      any.country_name ??
      any.countryName ??
      nested?.country ??
      nested?.Country ??
      nested?.country_name ??
      nested?.countryName ??
      ""
  ).trim();
  const city = String(
    any.city ?? any.City ?? nested?.city ?? nested?.City ?? ""
  ).trim();
  const hideIp = !!(
    any.hide_ip ??
    any.hideIp ??
    nested?.hide_ip ??
    nested?.hideIp
  );
  return { flag, country, city, hideIp };
}

/**
 * Decide whether hub `partner_geo` should paint the primary partner chrome.
 *
 * Solo 1v1 MUST never skip: when primary is empty/legacy, ids loose-match,
 * user_id matches, or there is only one remote partner (no multi secondary),
 * always apply — even if peer_id forms differ (fed/ vs hex, short vs full).
 *
 * Multi-party only skips when ids clearly point at a different peer.
 */
export type PartnerGeoApplyDecision = {
  apply: boolean;
  /**
   * Why: primary_empty | primary_legacy | loose_primary | loose_last |
   * uid_match | solo_1v1 | pre_match_known | buffer_pre_match | skip_multi
   */
  reason: string;
};

export function shouldApplyPartnerGeo(opts: {
  phaseMatched: boolean;
  msgPeerId?: string | null;
  msgUserId?: string | null;
  primaryPeerId?: string | null;
  partnerUserId?: string | null;
  lastPeerId?: string | null;
  lastUserId?: string | null;
  /** True when a multi secondary peer is currently latched. */
  hasSecondary?: boolean;
  matchMode?: string | null;
  /** peers[] length on the latest Matched (1 ⇒ pure 1v1). */
  peerCount?: number;
}): PartnerGeoApplyDecision {
  const pid = String(opts.msgPeerId || "").trim();
  const uid = String(opts.msgUserId || "").trim();
  const primary = String(opts.primaryPeerId || "").trim();
  const partnerUid = String(
    opts.partnerUserId || opts.lastUserId || ""
  ).trim();
  const lastPid = String(opts.lastPeerId || "").trim();
  const modeLow = String(opts.matchMode || "").toLowerCase();
  const noSecondary = !opts.hasSecondary;
  const peerCount =
    opts.peerCount != null && Number.isFinite(Number(opts.peerCount))
      ? Math.max(0, Math.floor(Number(opts.peerCount)))
      : undefined;
  // Pure 1v1: no multi secondary, solo/friend mode, or single peer in Matched.
  const solo1v1 =
    noSecondary ||
    modeLow === "solo" ||
    modeLow === "friend" ||
    peerCount === 1 ||
    peerCount === 0;

  if (!opts.phaseMatched) {
    // Pre-match: only apply when we already know this peer (early kick).
    const preMatchKnown =
      !!primary &&
      primary !== "legacy" &&
      (!pid ||
        peerIdsLooseMatch(pid, primary) ||
        (!!lastPid && peerIdsLooseMatch(pid, lastPid)) ||
        (!!uid &&
          !!partnerUid &&
          uid.toLowerCase() === partnerUid.toLowerCase()));
    if (preMatchKnown) {
      return { apply: true, reason: "pre_match_known" };
    }
    return { apply: false, reason: "buffer_pre_match" };
  }

  // Matched path — never skip solo 1v1.
  if (!pid || !primary || primary === "legacy") {
    return {
      apply: true,
      reason: !primary || primary === "legacy" ? "primary_empty" : "msg_empty",
    };
  }
  if (peerIdsLooseMatch(pid, primary)) {
    return { apply: true, reason: "loose_primary" };
  }
  if (lastPid && peerIdsLooseMatch(pid, lastPid)) {
    return { apply: true, reason: "loose_last" };
  }
  if (uid && partnerUid && uid.toLowerCase() === partnerUid.toLowerCase()) {
    return { apply: true, reason: "uid_match" };
  }
  if (solo1v1) {
    // Single remote partner: always apply regardless of pid form races.
    return { apply: true, reason: "solo_1v1" };
  }
  return { apply: false, reason: "skip_multi" };
}

/** True when any geo field is present (dock second line must paint). */
export function partnerGeoHasSignal(opts: {
  flag?: string | null;
  country?: string | null;
  city?: string | null;
  hideIp?: boolean | null;
}): boolean {
  if (opts.hideIp) return true;
  return !!(
    String(opts.flag || "").trim() ||
    String(opts.country || "").trim() ||
    String(opts.city || "").trim()
  );
}

/**
 * Visible partner ★ chip: max(spendable, trust).
 * Spendable alone can be 0 while hub trust/social_health is real reputation.
 *
 * ★0 diagnosis (0.1.341 screenshot mid-match):
 * - starsKnown=true + trustKnown=true + both 0 → **correct empty ledger**
 *   (hub MatchPeer always serializes stars/trust as serde u64; stranger with
 *   no gifts shows ★0). Self gift bar ★N is *your* spendable balance, not partner.
 * - starsKnown=false (field omitted / legacy peers[]) → do not treat as known 0;
 *   mergePartnerStars keeps prior non-zero on same-partner re-Matched.
 * - If either stars or trust >0, dock MUST show max (never paint 0 over real).
 */
export function displayPartnerStars(stars: number, trust: number): number {
  const s = Math.max(0, Math.floor(Number(stars) || 0));
  const t = Math.max(0, Math.floor(Number(trust) || 0));
  return Math.max(s, t);
}

/**
 * Same-partner re-Matched: keep previous badge when hub omitted the field.
 * New partner / explicit 0 (spend-to-zero / no ledger) still apply when
 * nextKnown=true — never wipe a known value with unknown 0.
 */
export function mergePartnerStars(opts: {
  samePartner: boolean;
  prev: number;
  next: number;
  nextKnown: boolean;
}): number {
  const prev = Math.max(0, Math.floor(Number(opts.prev) || 0));
  const next = Math.max(0, Math.floor(Number(opts.next) || 0));
  if (!opts.samePartner) return next;
  if (opts.nextKnown) return next; // explicit 0 stays 0 (ledger empty / spent)
  return prev;
}

export function mergePartnerTrust(opts: {
  samePartner: boolean;
  prev: number;
  next: number;
  nextKnown: boolean;
}): number {
  const prev = Math.max(0, Math.floor(Number(opts.prev) || 0));
  const next = Math.max(0, Math.floor(Number(opts.next) || 0));
  if (!opts.samePartner) return next;
  if (opts.nextKnown) return next;
  return prev;
}

/**
 * Strip ZWSP / BOM and trim. Glyph placeholders (ellipsis / lone "?") → "".
 * Does not strip hex peer ids — use isPlaceholderPartnerName for that.
 */
export function cleanPartnerLabel(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!s) return "";
  if (s === "…" || s === "..." || s === "?" || s === "？") return "";
  return s;
}

/** 6–12 hex chars — typical peer/user short id paint, never a real display name. */
const HEX_ID_LIKE = /^[0-9a-f]{6,12}$/i;

export function isHexIdLike(raw: unknown): boolean {
  const s = cleanPartnerLabel(raw);
  return !!s && HEX_ID_LIKE.test(s);
}

/**
 * Placeholder (not a real display name): empty, anon, ellipsis glyphs,
 * literal "Partner", hex-id-like (6–12 hex), or equal to peer/user/short id
 * prefixes when those ids are provided in opts.
 */
export function isPlaceholderPartnerName(
  raw: unknown,
  ids?: {
    peerId?: string | null;
    userId?: string | null;
    shortId?: string | null;
  }
): boolean {
  const s = cleanPartnerLabel(raw);
  if (!s) return true;
  if (/^anon$/i.test(s)) return true;
  if (/^partner$/i.test(s)) return true;
  if (HEX_ID_LIKE.test(s)) return true;

  const peerId = cleanPartnerLabel(ids?.peerId);
  const userId = cleanPartnerLabel(ids?.userId);
  const shortId = cleanPartnerLabel(ids?.shortId);
  const sl = s.toLowerCase();
  if (shortId && sl === shortId.toLowerCase()) return true;
  if (peerId && peerId.toLowerCase() !== "legacy") {
    const p8 = peerId.slice(0, 8).toLowerCase();
    if (sl === p8 || sl === peerId.toLowerCase()) return true;
  }
  if (userId) {
    const u8 = userId.slice(0, 8).toLowerCase();
    if (sl === u8 || sl === userId.toLowerCase()) return true;
  }
  return false;
}

export type PartnerNameSource =
  | "name"
  | "short_id"
  | "friend_code"
  | "prev"
  | "fallback"
  | "default";

/**
 * Keep prior dock paint on re-Matched when hub omits name.
 * Rejects anon / Partner / ellipsis / peer-id clones, but allows
 * friend_code-shaped hex (we may have latched code as the label).
 */
function isKeepablePrevPartnerLabel(
  raw: unknown,
  ids?: {
    peerId?: string | null;
    userId?: string | null;
    shortId?: string | null;
  }
): boolean {
  const s = cleanPartnerLabel(raw);
  if (!s) return false;
  if (/^anon$/i.test(s)) return false;
  if (/^partner$/i.test(s)) return false;
  if (s === "…" || s === "..." || s === "?" || s === "？") return false;
  const sl = s.toLowerCase();
  const peerId = cleanPartnerLabel(ids?.peerId);
  const userId = cleanPartnerLabel(ids?.userId);
  const shortId = cleanPartnerLabel(ids?.shortId);
  // shortId here is often peer prefix — reject exact match only
  if (shortId && sl === shortId.toLowerCase() && isHexIdLike(shortId)) {
    return false;
  }
  if (peerId && peerId.toLowerCase() !== "legacy") {
    const p8 = peerId.slice(0, 8).toLowerCase();
    if (sl === p8 || sl === peerId.toLowerCase()) return false;
  }
  if (userId) {
    const u8 = userId.slice(0, 8).toLowerCase();
    if (sl === u8 || sl === userId.toLowerCase()) return false;
  }
  return true;
}

/**
 * Partner label for chrome / stage HUD. Never paints 8-char hex peer id
 * when a real name / friend_code / prior real name exists.
 *
 * Order: real name → non-placeholder short_id (not hex-id-like) →
 * friend_code → prev real/code paint → fallback → "Partner".
 * friend_code always beats literal "Partner" (incl. 8-hex codes by design).
 */
export function resolvePartnerDisplayNameWithSource(opts: {
  name?: string | null;
  shortId?: string | null;
  friendCode?: string | null;
  peerId?: string | null;
  userId?: string | null;
  /** Keep prior label on same-partner re-Matched when hub omits name. */
  prev?: string | null;
  fallback?: string;
}): { name: string; from: PartnerNameSource } {
  const ids = {
    peerId: opts.peerId,
    userId: opts.userId,
    shortId: opts.shortId,
  };
  const name = cleanPartnerLabel(opts.name);
  if (name && !isPlaceholderPartnerName(name, ids)) {
    return { name, from: "name" };
  }

  // friend_code before short_id — hub partner_short is often a junk 2-char slice
  // that must not beat a real 8-char invite code (test + production thrash).
  const code = cleanPartnerLabel(opts.friendCode).toUpperCase();
  if (code) return { name: code, from: "friend_code" };

  // short_id only when it is a real label (not hex peer prefix / id clone)
  const shortId = cleanPartnerLabel(opts.shortId);
  if (
    shortId &&
    !isHexIdLike(shortId) &&
    !isPlaceholderPartnerName(shortId, {
      peerId: opts.peerId,
      userId: opts.userId,
      // do not self-match shortId against itself
      shortId: undefined,
    })
  ) {
    return { name: shortId, from: "short_id" };
  }

  // Prior dock paint (real name or latched friend_code) — not peer hex clone.
  const prev = cleanPartnerLabel(opts.prev);
  if (prev && isKeepablePrevPartnerLabel(prev, ids)) {
    // Normalize friend_code-shaped prev to uppercase for stable chrome
    if (isHexIdLike(prev)) return { name: prev.toUpperCase(), from: "prev" };
    return { name: prev, from: "prev" };
  }

  const fallback = cleanPartnerLabel(opts.fallback);
  if (fallback && isKeepablePrevPartnerLabel(fallback, ids)) {
    if (isHexIdLike(fallback)) {
      return { name: fallback.toUpperCase(), from: "fallback" };
    }
    // Non-hex fallback that is not Partner/anon
    if (!isPlaceholderPartnerName(fallback, ids)) {
      return { name: fallback, from: "fallback" };
    }
  }

  return { name: "Partner", from: "default" };
}

export function resolvePartnerDisplayName(opts: {
  name?: string | null;
  shortId?: string | null;
  friendCode?: string | null;
  peerId?: string | null;
  userId?: string | null;
  /** Keep prior label on same-partner re-Matched when hub omits name. */
  prev?: string | null;
  fallback?: string;
}): string {
  return resolvePartnerDisplayNameWithSource(opts).name;
}

/**
 * True when candidate is a better dock label than current.
 * Real names beat friend_code paint; anything keepable beats "Partner"/empty.
 */
export function isBetterPartnerDisplayName(
  candidate: unknown,
  current: unknown,
  ids?: {
    peerId?: string | null;
    userId?: string | null;
    shortId?: string | null;
  }
): boolean {
  const next = cleanPartnerLabel(candidate);
  if (!next || !isKeepablePrevPartnerLabel(next, ids)) return false;

  const cur = cleanPartnerLabel(current);
  const curKeep = cur && isKeepablePrevPartnerLabel(cur, ids);
  if (!curKeep) return true;
  if (next === cur) return false;

  const nextReal = !isHexIdLike(next);
  const curReal = !isHexIdLike(cur);
  if (nextReal && !curReal) return true;
  if (!nextReal && curReal) return false;
  return false;
}

export function normalizePeer(p: MatchPeer, msg: ServerMatched): PeerPick {
  // Hub MatchPeer uses snake_case; tolerate camelCase from older bridges.
  // Also merge any top-level Matched fields when peer row omitted them (weak hub).
  const any = p as MatchPeer & {
    hideIp?: boolean;
    friendCode?: string;
    peerId?: string;
    userId?: string;
    shortId?: string;
    isOfferer?: boolean;
    display_name?: string;
    displayName?: string;
  };
  const msgAny = msg as ServerMatched & Record<string, unknown>;
  // Merge peer + top-level matched so stars/trust/geo survive sparse peers[] rows.
  const merged: Record<string, unknown> = { ...msgAny, ...any };
  const { stars, known: starsKnown } = readPeerStars(merged);
  const { trust, known: trustKnown } = readPeerTrust(merged);
  const { flag, country, city, hideIp } = readPeerGeo(merged);
  const peerId = String(p.peer_id || any.peerId || "legacy");
  const userId = String(p.user_id || any.userId || "");
  const friendCode = String(p.friend_code || any.friendCode || "")
    .trim()
    .toUpperCase();
  // Real display name aliases (never short_id hex). friend_code beats "Partner".
  const rawName =
    any.name || any.display_name || any.displayName || msgAny.name || "";
  return {
    peerId,
    userId,
    // Top-level Matched.is_offerer = "I am offerer" (authoritative).
    // peers[].is_offerer currently mirrors the same flag from hub match_peer.
    isOfferer: !!(msg.is_offerer ?? p.is_offerer ?? any.isOfferer),
    name: resolvePartnerDisplayName({
      name: rawName,
      shortId: p.short_id || any.shortId || msg.partner_short,
      friendCode,
      peerId,
      userId,
    }),
    mode: String(msg.mode || "solo"),
    friendCode,
    stars,
    trust,
    starsKnown,
    trustKnown,
    role: String(p.role || "stranger"),
    flag,
    country,
    city,
    hideIp,
  };
}

export function pickPeer(msg: ServerMatched): PeerPick {
  const peers = (msg.peers || []) as MatchPeer[];
  if (peers.length) {
    return normalizePeer(peers[0], msg);
  }
  // Legacy matched without peers[] — stars/trust unknown (do not claim 0 known).
  return {
    peerId: "legacy",
    userId: "",
    isOfferer: !!msg.is_offerer,
    name: resolvePartnerDisplayName({
      shortId: msg.partner_short,
    }),
    mode: String(msg.mode || "solo"),
    friendCode: "",
    stars: 0,
    trust: 0,
    starsKnown: false,
    trustKnown: false,
    role: "stranger",
    flag: "",
    country: "",
    city: "",
    hideIp: false,
  };
}

/** Extra peers after the primary (multi / party). */
export function extraPeersFromMatch(
  msg: ServerMatched,
  primaryPeerId: string
): PeerPick[] {
  const peers = (msg.peers || []) as MatchPeer[];
  if (peers.length <= 1) return [];
  return peers
    .map((p) => normalizePeer(p, msg))
    .filter((p) => p.peerId !== primaryPeerId && p.peerId !== "legacy");
}
