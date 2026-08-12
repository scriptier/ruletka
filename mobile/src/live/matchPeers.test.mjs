/**
 * normalizePeer geo + stars/trust fields from hub MatchPeer.
 * Run: node src/live/matchPeers.test.mjs
 */
import assert from "node:assert/strict";

function normFlag(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

function readNonNegInt(...candidates) {
  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw === "string" && !raw.trim()) continue;
    const n = Math.floor(Number(typeof raw === "string" ? raw.trim() : raw));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

function asObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : undefined;
}

function readPeerStars(p) {
  const any = p;
  const nested =
    asObj(any.wallet) ||
    asObj(any.public) ||
    asObj(any.ledger) ||
    asObj(any.identity);
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
    nested?.stars,
    nested?.star_balance,
    nested?.starBalance,
    nested?.balance,
    any.balance,
    any.star
  );
  return { stars: n ?? 0, known: n !== undefined };
}

function readPeerTrust(p) {
  const any = p;
  const nested =
    asObj(any.reputation) ||
    asObj(any.social) ||
    asObj(any.public) ||
    asObj(any.identity);
  const n = readNonNegInt(
    any.trust,
    any.Trust,
    any.social_health,
    any.socialHealth,
    any.trust_effective,
    any.trustEffective,
    any.public_trust,
    any.publicTrust,
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

function readPeerGeo(p) {
  const any = p;
  const nested =
    asObj(any.public_location) ||
    asObj(any.publicLocation) ||
    asObj(any.geo) ||
    asObj(any.location);
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

function displayPartnerStars(stars, trust) {
  const s = Math.max(0, Math.floor(Number(stars) || 0));
  const t = Math.max(0, Math.floor(Number(trust) || 0));
  return Math.max(s, t);
}

function mergePartnerStars(opts) {
  const prev = Math.max(0, Math.floor(Number(opts.prev) || 0));
  const next = Math.max(0, Math.floor(Number(opts.next) || 0));
  if (!opts.samePartner) return next;
  if (opts.nextKnown) return next;
  return prev;
}

function mergePartnerTrust(opts) {
  const prev = Math.max(0, Math.floor(Number(opts.prev) || 0));
  const next = Math.max(0, Math.floor(Number(opts.next) || 0));
  if (!opts.samePartner) return next;
  if (opts.nextKnown) return next;
  return prev;
}

/** Mirror of matchPeers.shouldApplyPartnerGeo + peerIdsLooseMatch. */
function normalizePeerIdKey(raw) {
  let s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!s) return "";
  s = s.replace(/^fed\//, "");
  const slash = s.lastIndexOf("/");
  if (slash >= 0) s = s.slice(slash + 1);
  return s.replace(/[^a-z0-9]/g, "");
}

function peerIdsLooseMatch(a, b) {
  const x = normalizePeerIdKey(a);
  const y = normalizePeerIdKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const n = 8;
  if (x.length >= n && y.length >= n && x.slice(0, n) === y.slice(0, n)) {
    return true;
  }
  if (x.length >= n && y.includes(x)) return true;
  if (y.length >= n && x.includes(y)) return true;
  return false;
}

function shouldApplyPartnerGeo(opts) {
  const pid = String(opts.msgPeerId || "").trim();
  const uid = String(opts.msgUserId || "").trim();
  const primary = String(opts.primaryPeerId || "").trim();
  const partnerUid = String(opts.partnerUserId || opts.lastUserId || "").trim();
  const lastPid = String(opts.lastPeerId || "").trim();
  const modeLow = String(opts.matchMode || "").toLowerCase();
  const noSecondary = !opts.hasSecondary;
  const peerCount =
    opts.peerCount != null && Number.isFinite(Number(opts.peerCount))
      ? Math.max(0, Math.floor(Number(opts.peerCount)))
      : undefined;
  const solo1v1 =
    noSecondary ||
    modeLow === "solo" ||
    modeLow === "friend" ||
    peerCount === 1 ||
    peerCount === 0;

  if (!opts.phaseMatched) {
    const preMatchKnown =
      !!primary &&
      primary !== "legacy" &&
      (!pid ||
        peerIdsLooseMatch(pid, primary) ||
        (!!lastPid && peerIdsLooseMatch(pid, lastPid)) ||
        (!!uid &&
          !!partnerUid &&
          uid.toLowerCase() === partnerUid.toLowerCase()));
    if (preMatchKnown) return { apply: true, reason: "pre_match_known" };
    return { apply: false, reason: "buffer_pre_match" };
  }

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
  if (solo1v1) return { apply: true, reason: "solo_1v1" };
  return { apply: false, reason: "skip_multi" };
}

function partnerGeoHasSignal(opts) {
  if (opts.hideIp) return true;
  return !!(
    String(opts.flag || "").trim() ||
    String(opts.country || "").trim() ||
    String(opts.city || "").trim()
  );
}

function cleanPartnerLabel(raw) {
  const s = String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!s) return "";
  if (s === "…" || s === "..." || s === "?" || s === "？") return "";
  return s;
}

const HEX_ID_LIKE = /^[0-9a-f]{6,12}$/i;

function isHexIdLike(raw) {
  const s = cleanPartnerLabel(raw);
  return !!s && HEX_ID_LIKE.test(s);
}

function isPlaceholderPartnerName(raw, ids) {
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

function isKeepablePrevPartnerLabel(raw, ids) {
  const s = cleanPartnerLabel(raw);
  if (!s) return false;
  if (/^anon$/i.test(s)) return false;
  if (/^partner$/i.test(s)) return false;
  if (s === "…" || s === "..." || s === "?" || s === "？") return false;
  const sl = s.toLowerCase();
  const peerId = cleanPartnerLabel(ids?.peerId);
  const userId = cleanPartnerLabel(ids?.userId);
  const shortId = cleanPartnerLabel(ids?.shortId);
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

/** real name → non-hex short_id → friend_code → prev → Partner (never peer hex slice) */
function resolvePartnerDisplayNameWithSource(opts) {
  const ids = {
    peerId: opts.peerId,
    userId: opts.userId,
    shortId: opts.shortId,
  };
  const name = cleanPartnerLabel(opts.name);
  if (name && !isPlaceholderPartnerName(name, ids)) {
    return { name, from: "name" };
  }
  // friend_code before short_id (partner_short junk must not beat invite code)
  const code = cleanPartnerLabel(opts.friendCode).toUpperCase();
  if (code) return { name: code, from: "friend_code" };
  const shortId = cleanPartnerLabel(opts.shortId);
  if (
    shortId &&
    !isHexIdLike(shortId) &&
    !isPlaceholderPartnerName(shortId, {
      peerId: opts.peerId,
      userId: opts.userId,
      shortId: undefined,
    })
  ) {
    return { name: shortId, from: "short_id" };
  }
  const prev = cleanPartnerLabel(opts.prev);
  if (prev && isKeepablePrevPartnerLabel(prev, ids)) {
    if (isHexIdLike(prev)) return { name: prev.toUpperCase(), from: "prev" };
    return { name: prev, from: "prev" };
  }
  const fallback = cleanPartnerLabel(opts.fallback);
  if (fallback && isKeepablePrevPartnerLabel(fallback, ids)) {
    if (isHexIdLike(fallback)) {
      return { name: fallback.toUpperCase(), from: "fallback" };
    }
    if (!isPlaceholderPartnerName(fallback, ids)) {
      return { name: fallback, from: "fallback" };
    }
  }
  return { name: "Partner", from: "default" };
}

function resolvePartnerDisplayName(opts) {
  return resolvePartnerDisplayNameWithSource(opts).name;
}

function isBetterPartnerDisplayName(candidate, current, ids) {
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

function normalizePeer(p, msg) {
  const any = p;
  const msgAny = msg || {};
  const merged = { ...msgAny, ...any };
  const { stars, known: starsKnown } = readPeerStars(merged);
  const { trust, known: trustKnown } = readPeerTrust(merged);
  const { flag, country, city, hideIp } = readPeerGeo(merged);
  const peerId = String(p.peer_id || any.peerId || "legacy");
  const userId = String(p.user_id || any.userId || "");
  const friendCode = String(p.friend_code || any.friendCode || "")
    .trim()
    .toUpperCase();
  const rawName =
    any.name || any.display_name || any.displayName || msgAny.name || "";
  return {
    peerId,
    userId,
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

const msg = { type: "matched", is_offerer: true, mode: "solo", partner_short: "ab" };

{
  const p = normalizePeer(
    {
      peer_id: "aabbccdd",
      user_id: "u1",
      name: "Bob",
      flag: "ca",
      country: "Canada",
      city: " Calgary ",
      hide_ip: false,
      stars: 3,
    },
    msg
  );
  assert.equal(p.flag, "CA");
  assert.equal(p.country, "Canada");
  assert.equal(p.city, "Calgary");
  assert.equal(p.hideIp, false);
  assert.equal(p.stars, 3);
  assert.equal(p.starsKnown, true);
}

{
  const p = normalizePeer(
    {
      peer_id: "deadbeef",
      name: "Priv",
      flag: "JP",
      country: "",
      city: "",
      hide_ip: true,
    },
    msg
  );
  assert.equal(p.flag, "JP");
  assert.equal(p.country, "");
  assert.equal(p.city, "");
  assert.equal(p.hideIp, true);
  assert.equal(p.stars, 0);
  assert.equal(p.starsKnown, false);
  assert.equal(p.trustKnown, false);
}

{
  // Empty geo at match time (async lookup) — fields present as empty strings
  const p = normalizePeer(
    { peer_id: "x", name: "?", flag: "", country: "", city: "", hide_ip: false },
    msg
  );
  assert.equal(p.flag, "");
  assert.equal(p.country, "");
  assert.equal(p.hideIp, false);
}

// --- stars / trust robustness ---
{
  // Explicit 0 is known (spend-to-zero)
  const p = normalizePeer(
    { peer_id: "z", name: "Z", stars: 0, trust: 0 },
    msg
  );
  assert.equal(p.stars, 0);
  assert.equal(p.starsKnown, true);
  assert.equal(p.trust, 0);
  assert.equal(p.trustKnown, true);
}

{
  // CamelCase / alias fields
  const p = normalizePeer(
    {
      peerId: "c1",
      userId: "u2",
      name: "Cam",
      starBalance: 12,
      socialHealth: 40,
    },
    msg
  );
  assert.equal(p.stars, 12);
  assert.equal(p.starsKnown, true);
  assert.equal(p.trust, 40);
  assert.equal(p.trustKnown, true);
}

{
  // snake_case star_balance + trust_effective
  const p = normalizePeer(
    {
      peer_id: "s1",
      name: "Snake",
      star_balance: "7",
      trust_effective: "100",
    },
    msg
  );
  assert.equal(p.stars, 7);
  assert.equal(p.trust, 100);
  assert.equal(p.starsKnown, true);
  assert.equal(p.trustKnown, true);
}

{
  // star_count / public_stars / reputation aliases
  const p1 = normalizePeer(
    { peer_id: "a1", name: "A", star_count: 22 },
    msg
  );
  assert.equal(p1.stars, 22);
  assert.equal(p1.starsKnown, true);
  const p2 = normalizePeer(
    { peer_id: "a2", name: "B", public_stars: "9", reputation: 55 },
    msg
  );
  assert.equal(p2.stars, 9);
  assert.equal(p2.trust, 55);
  assert.equal(p2.starsKnown, true);
  assert.equal(p2.trustKnown, true);
  const p3 = normalizePeer(
    { peer_id: "a3", name: "C", walletStars: 4, social_score: 80 },
    msg
  );
  assert.equal(p3.stars, 4);
  assert.equal(p3.trust, 80);
  const p4 = normalizePeer(
    { peer_id: "a4", name: "D", star: "3", publicTrust: 12 },
    msg
  );
  assert.equal(p4.stars, 3);
  assert.equal(p4.trust, 12);
  // spendable preferred over later aliases
  const p5 = normalizePeer(
    { peer_id: "a5", name: "E", stars: 1, star_count: 99, balance: 50 },
    msg
  );
  assert.equal(p5.stars, 1);
}

{
  // displayPartnerStars = max(spendable, trust)
  assert.equal(displayPartnerStars(0, 40), 40);
  assert.equal(displayPartnerStars(15, 0), 15);
  assert.equal(displayPartnerStars(5, 100), 100);
  assert.equal(displayPartnerStars(0, 0), 0);
  assert.equal(displayPartnerStars(undefined, 7), 7);
  assert.equal(displayPartnerStars(-3, -1), 0);
}

{
  // samePartner thrash: unknown next must not wipe known badge
  assert.equal(
    mergePartnerStars({
      samePartner: true,
      prev: 15,
      next: 0,
      nextKnown: false,
    }),
    15
  );
  // Explicit 0 still applies
  assert.equal(
    mergePartnerStars({
      samePartner: true,
      prev: 15,
      next: 0,
      nextKnown: true,
    }),
    0
  );
  // New partner always takes next
  assert.equal(
    mergePartnerStars({
      samePartner: false,
      prev: 15,
      next: 0,
      nextKnown: false,
    }),
    0
  );
  // Known non-zero updates
  assert.equal(
    mergePartnerStars({
      samePartner: true,
      prev: 15,
      next: 9,
      nextKnown: true,
    }),
    9
  );
}

{
  assert.equal(
    mergePartnerTrust({
      samePartner: true,
      prev: 80,
      next: 0,
      nextKnown: false,
    }),
    80
  );
  assert.equal(
    mergePartnerTrust({
      samePartner: true,
      prev: 80,
      next: 0,
      nextKnown: true,
    }),
    0
  );
}

{
  // readNonNegInt edge cases
  assert.equal(readNonNegInt(undefined, null, "", 5), 5);
  assert.equal(readNonNegInt("3.9"), 3);
  assert.equal(readNonNegInt(-1, 2), 2);
  assert.equal(readNonNegInt(undefined), undefined);
  assert.equal(readNonNegInt(0), 0);
}

{
  // Flag-only match (geo pending) — chrome uses formatLocLine; peer keeps ISO
  const p = normalizePeer(
    {
      peer_id: "geo-race",
      name: "Geo",
      flag: "lt",
      country: "",
      city: "",
      hide_ip: false,
      stars: 40,
      trust: 12,
    },
    msg
  );
  assert.equal(p.flag, "LT");
  assert.equal(p.country, "");
  assert.equal(p.hideIp, false);
  assert.equal(p.stars, 40);
  assert.equal(p.starsKnown, true);
  assert.equal(p.trust, 12);
  assert.equal(p.trustKnown, true);
}

{
  // camelCase / alias geo fields (bridge rename safety)
  const p = normalizePeer(
    {
      peerId: "aliasgeo1",
      name: "Alias",
      Flag: "de",
      Country: "Germany",
      City: " Berlin ",
      hideIp: false,
    },
    msg
  );
  assert.equal(p.flag, "DE");
  assert.equal(p.country, "Germany");
  assert.equal(p.city, "Berlin");
  assert.equal(p.hideIp, false);
  assert.equal(p.peerId, "aliasgeo1");
}

{
  // hide_ip cosmetic flag only — country/city empty, flag kept for name line
  const p = normalizePeer(
    {
      peer_id: "hide1",
      name: "Ghost",
      flag: "br",
      country: "should-not-matter",
      city: "x",
      hide_ip: true,
    },
    msg
  );
  // normalizePeer passes through raw fields; public_location is hub-side.
  // Client still receives hide_ip + cosmetic flag from hub MatchPeer.
  assert.equal(p.flag, "BR");
  assert.equal(p.hideIp, true);
}

{
  // Empty / whitespace / ellipsis name → non-hex short_id / friend_code / Partner
  assert.equal(
    resolvePartnerDisplayName({ name: "  ", shortId: "ab12" }),
    "ab12"
  );
  // Hex peer id slice is NOT painted — no friend_code → Partner
  assert.equal(
    resolvePartnerDisplayName({ name: "…", peerId: "deadbeef99" }),
    "Partner"
  );
  assert.equal(
    resolvePartnerDisplayName({ name: "", friendCode: "xyzw" }),
    "XYZW"
  );
  assert.equal(resolvePartnerDisplayName({}), "Partner");
  assert.equal(
    resolvePartnerDisplayName({ name: "", prev: "Alice" }),
    "Alice"
  );
  // Hex name (web hello myShortId) never wins over friend_code / prev real
  assert.equal(
    resolvePartnerDisplayName({
      name: "3dc02a71",
      shortId: "3dc02a71",
      peerId: "3dc02a71aabbccdd",
      friendCode: "a1b2c3d4",
    }),
    "A1B2C3D4"
  );
  assert.equal(
    resolvePartnerDisplayName({
      name: "3dc02a71",
      shortId: "3dc02a71",
      peerId: "3dc02a71aabbccdd",
      prev: "Драконов",
    }),
    "Драконов"
  );
  assert.equal(
    resolvePartnerDisplayName({ name: "Драконов", shortId: "3dc02a71" }),
    "Драконов"
  );
  assert.equal(
    resolvePartnerDisplayName({ name: "anon", friendCode: "kode" }),
    "KODE"
  );
  // Hex short_id alone → Partner (not painted)
  assert.equal(
    resolvePartnerDisplayName({ name: "", shortId: "3dc02a71" }),
    "Partner"
  );
  // prev that is itself hex is skipped
  assert.equal(
    resolvePartnerDisplayName({
      name: "",
      prev: "deadbeef",
      friendCode: "zz99",
    }),
    "ZZ99"
  );
  const emptyName = normalizePeer(
    {
      peer_id: "aabbccddeeff",
      name: "   ",
      stars: 7,
    },
    msg
  );
  // partner_short from msg is "ab" (2 chars, not hex-id-like) — ok as short label
  assert.equal(emptyName.name, "ab");
  assert.equal(emptyName.stars, 7);
  const noShort = normalizePeer(
    {
      peer_id: "ffeeddccbbaa",
      name: "",
      friend_code: "kode",
    },
    { type: "matched", is_offerer: true, mode: "solo", partner_short: "" }
  );
  assert.equal(noShort.name, "KODE");
  // Hub emitted hex as name + short_id (web getDisplayName→myShortId) → friend_code
  const hexName = normalizePeer(
    {
      peer_id: "3dc02a71aabbccdd",
      short_id: "3dc02a71",
      user_id: "user-drakonov",
      name: "3dc02a71",
      friend_code: "f1e2d3c4",
      stars: 0,
      trust: 0,
    },
    { type: "matched", is_offerer: true, mode: "solo", partner_short: "3dc02a71" }
  );
  assert.equal(hexName.name, "F1E2D3C4");
  assert.equal(hexName.stars, 0);
  assert.equal(hexName.starsKnown, true); // explicit 0 from hub = known empty ledger
  // Real name always wins
  const real = normalizePeer(
    {
      peer_id: "3dc02a71aabbccdd",
      short_id: "3dc02a71",
      name: "Драконов",
      friend_code: "f1e2d3c4",
    },
    { type: "matched", is_offerer: true, mode: "solo", partner_short: "3dc02a71" }
  );
  assert.equal(real.name, "Драконов");
  // prev friend_code paint kept when hub omits code on re-Matched
  assert.equal(
    resolvePartnerDisplayName({
      name: "",
      peerId: "3dc02a71aabb",
      prev: "F1E2D3C4",
    }),
    "F1E2D3C4"
  );
  assert.equal(
    resolvePartnerDisplayNameWithSource({
      name: "Драконов",
      friendCode: "f1e2d3c4",
    }).from,
    "name"
  );
  assert.equal(
    resolvePartnerDisplayNameWithSource({
      name: "",
      friendCode: "f1e2d3c4",
    }).from,
    "friend_code"
  );
  assert.equal(
    resolvePartnerDisplayNameWithSource({ name: "" }).from,
    "default"
  );
  // DC upgrade: real name beats Partner / friend_code
  assert.equal(
    isBetterPartnerDisplayName("Драконов", "Partner", {}),
    true
  );
  assert.equal(
    isBetterPartnerDisplayName("Драконов", "F1E2D3C4", {
      peerId: "3dc02a71aabb",
    }),
    true
  );
  assert.equal(
    isBetterPartnerDisplayName("F1E2D3C4", "Драконов", {
      peerId: "3dc02a71aabb",
    }),
    false
  );
  assert.equal(
    isBetterPartnerDisplayName("3dc02a71", "Partner", {
      peerId: "3dc02a71aabb",
    }),
    false
  );
}

{
  // Nested public_location + social_health aliases (wire rename safety)
  const nested = normalizePeer(
    {
      peer_id: "nested1",
      name: "Драконов",
      public_location: {
        flag: "lt",
        country: "Lithuania",
        city: "Vilnius",
        hide_ip: false,
      },
      social_health: 40,
      wallet: { stars: 7 },
    },
    msg
  );
  assert.equal(nested.flag, "LT");
  assert.equal(nested.country, "Lithuania");
  assert.equal(nested.city, "Vilnius");
  assert.equal(nested.hideIp, false);
  assert.equal(nested.stars, 7);
  assert.equal(nested.starsKnown, true);
  assert.equal(nested.trust, 40);
  assert.equal(nested.trustKnown, true);
  assert.equal(displayPartnerStars(nested.stars, nested.trust), 40);
}

{
  // Hub MatchPeer shape for «Драконов» web peer — stars 0 trust 0 is valid empty ledger
  const p = normalizePeer(
    {
      peer_id: "3dc02a71aabb",
      name: "Драконов",
      stars: 0,
      trust: 0,
      flag: "CA",
      country: "Canada",
      city: "Calgary",
      hide_ip: false,
    },
    msg
  );
  assert.equal(p.stars, 0);
  assert.equal(p.starsKnown, true);
  assert.equal(p.trust, 0);
  assert.equal(p.trustKnown, true);
  assert.equal(displayPartnerStars(p.stars, p.trust), 0);
  assert.equal(p.flag, "CA");
  assert.equal(p.country, "Canada");
  assert.equal(p.city, "Calgary");
}

{
  // merge: same partner unknown next keeps prior non-zero (thrash re-Matched)
  assert.equal(
    mergePartnerStars({
      samePartner: true,
      prev: 40,
      next: 0,
      nextKnown: false,
    }),
    40
  );
  assert.equal(
    mergePartnerTrust({
      samePartner: true,
      prev: 12,
      next: 0,
      nextKnown: false,
    }),
    12
  );
  // Explicit hub 0 (serde always sends stars) → real empty ledger
  assert.equal(
    mergePartnerStars({
      samePartner: true,
      prev: 40,
      next: 0,
      nextKnown: true,
    }),
    0
  );
}

{
  // 0.1.341 mid-match: self gift bar ★42 ≠ partner badge.
  // Partner stars=0 trust=0 known → display 0 (empty ledger, not a wipe bug).
  // Partner stars=0 trust=42 → display 42 (max). Geo on MatchPeer must survive normalize.
  const emptyLedger = normalizePeer(
    {
      peer_id: "pcpeer01",
      name: "Man",
      friend_code: "a4b9c0d1",
      stars: 0,
      trust: 0,
      flag: "",
      country: "",
      city: "",
      hide_ip: false,
    },
    msg
  );
  assert.equal(emptyLedger.stars, 0);
  assert.equal(emptyLedger.starsKnown, true);
  assert.equal(emptyLedger.trust, 0);
  assert.equal(emptyLedger.trustKnown, true);
  assert.equal(displayPartnerStars(emptyLedger.stars, emptyLedger.trust), 0);
  assert.equal(emptyLedger.flag, "");
  assert.equal(emptyLedger.country, "");

  const trustOnly = normalizePeer(
    {
      peer_id: "pcpeer02",
      name: "Trusted",
      stars: 0,
      trust: 42,
      flag: "CA",
      country: "Canada",
      city: "Calgary",
    },
    msg
  );
  assert.equal(displayPartnerStars(trustOnly.stars, trustOnly.trust), 42);
  assert.equal(trustOnly.flag, "CA");
  assert.equal(trustOnly.country, "Canada");
  assert.equal(trustOnly.city, "Calgary");

  // Nested public_location must not leave top strip empty when flat fields blank
  const nestedGeo = normalizePeer(
    {
      peer_id: "pcpeer03",
      name: "Nested",
      stars: 5,
      trust: 0,
      public_location: { flag: "lt", country: "Lithuania", city: "Vilnius" },
    },
    msg
  );
  assert.equal(nestedGeo.flag, "LT");
  assert.equal(nestedGeo.country, "Lithuania");
  assert.equal(nestedGeo.city, "Vilnius");
  assert.equal(displayPartnerStars(nestedGeo.stars, nestedGeo.trust), 5);
}

{
  // partner_identity DC shape — readPeer* used by live.tsx onDataMessage
  const dc = {
    type: "partner_identity",
    name: "Драконов",
    friend_code: "a1b2c3d4",
    stars: 12,
    trust: 40,
    flag: "ca",
    country: "Canada",
    city: "Calgary",
    hide_ip: false,
  };
  const s = readPeerStars(dc);
  const t = readPeerTrust(dc);
  const g = readPeerGeo(dc);
  assert.equal(s.stars, 12);
  assert.equal(s.known, true);
  assert.equal(t.trust, 40);
  assert.equal(t.known, true);
  assert.equal(g.flag, "CA");
  assert.equal(g.country, "Canada");
  assert.equal(g.city, "Calgary");
  assert.equal(g.hideIp, false);
  assert.equal(displayPartnerStars(s.stars, t.trust), 40);
  // Omitted stars must not claim known=0 (do not wipe prior badge)
  const bare = readPeerStars({ type: "partner_identity", name: "X" });
  assert.equal(bare.known, false);
  assert.equal(bare.stars, 0);
}

{
  // Never paint Partner when friend_code exists (hub name empty/poison)
  const p = normalizePeer(
    {
      peer_id: "3dc02a71aabb",
      name: "",
      friend_code: "f1e2d3c4",
      stars: 0,
      trust: 0,
    },
    msg
  );
  assert.equal(p.name, "F1E2D3C4");
  assert.notEqual(p.name, "Partner");
  // display_name alias
  const p2 = normalizePeer(
    {
      peer_id: "aabb0011",
      display_name: "Драконов",
      friend_code: "abcd1234",
    },
    msg
  );
  assert.equal(p2.name, "Драконов");
}

{
  // partner_geo apply: solo 1v1 never skips even when pid forms differ
  const base = {
    phaseMatched: true,
    msgPeerId: "fed/sess/abcdef1234567890",
    msgUserId: "user-aaaa",
    primaryPeerId: "abcdef1234567890dead",
    partnerUserId: "user-bbbb",
    hasSecondary: false,
    matchMode: "solo",
    peerCount: 1,
  };
  // loose match on 8-char prefix after fed/ strip
  let d = shouldApplyPartnerGeo(base);
  assert.equal(d.apply, true, "loose primary must apply");
  assert.ok(
    d.reason === "loose_primary" || d.reason === "solo_1v1",
    `reason=${d.reason}`
  );

  // Different pid form, still solo 1v1 → apply
  d = shouldApplyPartnerGeo({
    ...base,
    msgPeerId: "zzzzzzzz99999999",
    primaryPeerId: "aaaaaaaa11111111",
    partnerUserId: "user-bbbb",
    msgUserId: "other-uid",
  });
  assert.equal(d.apply, true, "solo 1v1 must apply even on id mismatch");
  assert.equal(d.reason, "solo_1v1");

  // Primary empty → apply
  d = shouldApplyPartnerGeo({
    ...base,
    primaryPeerId: "",
    msgPeerId: "abcdef12",
  });
  assert.equal(d.apply, true);
  assert.equal(d.reason, "primary_empty");

  // uid match
  d = shouldApplyPartnerGeo({
    phaseMatched: true,
    msgPeerId: "zzzzzzzz99999999",
    primaryPeerId: "aaaaaaaa11111111",
    msgUserId: "USER-AAAA",
    partnerUserId: "user-aaaa",
    hasSecondary: true,
    matchMode: "party_browse",
    peerCount: 2,
  });
  assert.equal(d.apply, true);
  assert.equal(d.reason, "uid_match");

  // Multi + different peer → skip
  d = shouldApplyPartnerGeo({
    phaseMatched: true,
    msgPeerId: "bbbbbbbb22222222",
    primaryPeerId: "aaaaaaaa11111111",
    msgUserId: "u2",
    partnerUserId: "u1",
    hasSecondary: true,
    matchMode: "party_browse",
    peerCount: 2,
  });
  assert.equal(d.apply, false);
  assert.equal(d.reason, "skip_multi");

  // Pre-match unknown → buffer
  d = shouldApplyPartnerGeo({
    phaseMatched: false,
    msgPeerId: "abcdef12",
    primaryPeerId: "",
    hasSecondary: false,
    matchMode: "solo",
  });
  assert.equal(d.apply, false);
  assert.equal(d.reason, "buffer_pre_match");

  // Flag CA alone is a geo signal (dock second line)
  assert.equal(partnerGeoHasSignal({ flag: "CA" }), true);
  assert.equal(partnerGeoHasSignal({ country: "Canada", city: "Calgary" }), true);
  assert.equal(partnerGeoHasSignal({ hideIp: true }), true);
  assert.equal(partnerGeoHasSignal({}), false);

  // DC stars>0 must win over hub empty-ledger 0 when known
  assert.equal(
    mergePartnerStars({
      samePartner: true,
      prev: 0,
      next: 12,
      nextKnown: true,
    }),
    12
  );
  // Explicit DC 0 still applies (known empty)
  assert.equal(
    mergePartnerStars({
      samePartner: true,
      prev: 12,
      next: 0,
      nextKnown: true,
    }),
    0
  );
  // Omitted stars never wipe hub badge
  assert.equal(
    mergePartnerStars({
      samePartner: true,
      prev: 12,
      next: 0,
      nextKnown: false,
    }),
    12
  );
}

console.log("matchPeers.test.mjs OK");
