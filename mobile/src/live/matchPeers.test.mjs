/**
 * normalizePeer geo + stars/trust fields from hub MatchPeer.
 * Run: node src/live/matchPeers.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";

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
  const sRaw = Number(stars);
  const tRaw = Number(trust);
  const sOk = Number.isFinite(sRaw) || sRaw === Infinity;
  const tOk = Number.isFinite(tRaw) || tRaw === Infinity;
  if (sRaw === Infinity || tRaw === Infinity) return Infinity;
  const s = sOk ? Math.max(0, Math.floor(sRaw)) : 0;
  const t = tOk ? Math.max(0, Math.floor(tRaw)) : 0;
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
  if (!p || typeof p !== "object") {
    p = {};
  }
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
  const rawName = any.name || any.display_name || any.displayName || "";
  return {
    peerId,
    userId,
    isOfferer: !!(msg.is_offerer ?? p.is_offerer ?? any.isOfferer),
    name: resolvePartnerDisplayName({
      name: rawName,
      shortId:
        p.short_id ||
        any.shortId ||
        (!p.peer_id || p.peer_id === "legacy"
          ? String(msg.partner_short || "")
          : ""),
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

const MAX_EXTRA_PEERS = 2;

function sameExtraPerson(a, b) {
  if (!a || !b) return false;
  const aid = String(a.peerId || "").trim();
  const bid = String(b.peerId || "").trim();
  if (aid && bid && aid !== "legacy" && bid !== "legacy") {
    if (aid === bid || peerIdsLooseMatch(aid, bid)) return true;
  }
  const au = String(a.userId || "").trim();
  const bu = String(b.userId || "").trim();
  if (au && bu && au === bu) return true;
  const ac = String(a.friendCode || "").trim().toUpperCase();
  const bc = String(b.friendCode || "").trim().toUpperCase();
  if (ac.length >= 6 && ac === bc) return true;
  return false;
}

function extraPeersFromMatch(msg, primaryPeerId) {
  const peers = Array.isArray(msg.peers) ? msg.peers : [];
  if (!peers.length) return [];
  const primary = String(primaryPeerId || "").trim();
  const out = [];
  for (const p of peers.map((row) => normalizePeer(row, msg))) {
    if (!p.peerId || p.peerId === "legacy") continue;
    if (
      primary &&
      (p.peerId === primary || peerIdsLooseMatch(p.peerId, primary))
    ) {
      continue;
    }
    if (out.some((x) => sameExtraPerson(x, p))) continue;
    out.push(p);
    if (out.length >= MAX_EXTRA_PEERS) break;
  }
  return out;
}

function extrasAfterOmitPrimary(opts) {
  if (opts.extras.length > 0) {
    if (!opts.wasMatched || opts.keepListed3rd === false) {
      return opts.extras.slice(0, MAX_EXTRA_PEERS);
    }
    const primary = String(opts.primaryId || "").trim();
    const out = [];
    const add = (p, replace) => {
      const id = String(p?.peerId || "").trim();
      if (!id || id === "legacy") return;
      if (primary && (id === primary || peerIdsLooseMatch(id, primary))) return;
      const i = out.findIndex((x) => sameExtraPerson(x, p));
      if (i >= 0) {
        if (replace) out[i] = p;
        return;
      }
      out.push(p);
    };
    for (const p of opts.prevExtras || []) add(p, false);
    for (const p of opts.extras) add(p, true);
    return out.slice(0, MAX_EXTRA_PEERS);
  }
  if (!opts.wasMatched) return opts.extras;
  if (!opts.keepListed3rd) return opts.extras;
  const primary = String(opts.primaryId || "").trim();
  const listed = (opts.listedIds || [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const onlyPrimary =
    listed.length === 0 ||
    listed.every(
      (id) =>
        (primary && (id === primary || peerIdsLooseMatch(id, primary))) ||
        id === "legacy"
    );
  if (!onlyPrimary) return opts.extras;
  const kept = (opts.prevExtras || []).filter((p) => {
    const id = String(p?.peerId || "").trim();
    if (!id || id === "legacy") return false;
    if (primary && (id === primary || peerIdsLooseMatch(id, primary))) return false;
    return true;
  });
  if (kept.length > 0) return kept.slice(0, MAX_EXTRA_PEERS);
  const prev = String(opts.prevSecondary || "").trim();
  if (!prev || prev === "legacy") return opts.extras;
  if (primary && (prev === primary || peerIdsLooseMatch(prev, primary))) {
    return opts.extras;
  }
  return [
    {
      peerId: prev,
      userId: "",
      isOfferer: false,
      name: "",
      mode: "party_browse",
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
    },
  ];
}

function pickPrimaryPeerIndex(peerIds, opts) {
  if (!peerIds.length) return 0;
  const { wasMatched, prevPrimary, prevSecondary, keepFirstOnOmit } = opts;
  if (wasMatched && prevPrimary && prevPrimary !== "legacy") {
    const i = peerIds.findIndex(
      (id) =>
        !!id &&
        id !== "legacy" &&
        (id === prevPrimary || peerIdsLooseMatch(id, prevPrimary))
    );
    if (i >= 0) return i;
  }
  if (wasMatched && prevSecondary && prevSecondary !== "legacy") {
    const i = peerIds.findIndex(
      (id) =>
        !!id &&
        id !== "legacy" &&
        (id === prevSecondary || peerIdsLooseMatch(id, prevSecondary))
    );
    if (i >= 0 && peerIds.length >= 2) return i;
  }
  if (
    wasMatched &&
    keepFirstOnOmit &&
    prevPrimary &&
    prevPrimary !== "legacy"
  ) {
    return -1;
  }
  return 0;
}

function pickPeer(msg) {
  const peers = Array.isArray(msg.peers) ? msg.peers : [];
  if (peers.length) {
    return normalizePeer(peers[0], msg);
  }
  return {
    peerId: "legacy",
    userId: "",
    isOfferer: !!msg.is_offerer,
    name: resolvePartnerDisplayName({ shortId: msg.partner_short }),
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
  // displayPartnerStars = max(wallet, trust) — public chip
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
  // Empty/whitespace name must not inherit top-level partner_short (that's primary)
  assert.equal(emptyName.name, "Partner");
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
  // Extra peer with empty/anon name must NOT inherit top-level Matched.name
  const extraAnon = normalizePeer(
    { peer_id: "peer-extra-1", user_id: "uid-extra", name: "anon" },
    {
      type: "matched",
      is_offerer: true,
      mode: "party_browse",
      name: "Courtier",
      partner_short: "",
    }
  );
  assert.equal(extraAnon.name, "Partner");
  const extraEmpty = normalizePeer(
    { peer_id: "peer-extra-2", user_id: "uid-extra2", name: "" },
    {
      type: "matched",
      is_offerer: true,
      mode: "party_browse",
      name: "Courtier",
      partner_short: "",
    }
  );
  assert.equal(extraEmpty.name, "Partner");
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

{
  // displayPartnerStars — numeric poison inputs must never throw / go negative
  assert.equal(displayPartnerStars(NaN, 5), 5); // NaN spendable ignored, trust wins
  assert.equal(displayPartnerStars(5, NaN), 5);
  assert.equal(displayPartnerStars(NaN, NaN), 0);
  assert.equal(displayPartnerStars("7.9", "3.2"), 7); // max(wallet, trust)
  assert.equal(displayPartnerStars("not-a-number", 9), 9);
  assert.equal(displayPartnerStars(-Infinity, 5), 5);
  assert.equal(displayPartnerStars(-Infinity, -Infinity), 0);
  assert.equal(displayPartnerStars(null, undefined), 0);
}

{
  // mergePartnerStars / mergePartnerTrust — NaN/garbage prev normalizes to 0,
  // never resurrects a bogus badge on same-partner re-Matched.
  assert.equal(
    mergePartnerStars({ samePartner: true, prev: NaN, next: 5, nextKnown: false }),
    0
  );
  assert.equal(
    mergePartnerTrust({
      samePartner: true,
      prev: "garbage",
      next: 5,
      nextKnown: false,
    }),
    0
  );
  // Unknown next on new partner still resolves cleanly (falls to next=0)
  assert.equal(
    mergePartnerStars({ samePartner: false, prev: 40, next: NaN, nextKnown: false }),
    0
  );
}

{
  // Poison / adversarial display-name payloads — must never throw and must
  // resolve to a sane label (real string, friend_code, or literal "Partner").

  // Emoji-only name is a real name (not anon/hex/empty) — paints as-is.
  assert.equal(resolvePartnerDisplayName({ name: "🎉🎊" }), "🎉🎊");

  // Sentinel-like strings from broken upstream JSON are not special-cased —
  // they paint through as literal names (documents current behavior).
  assert.equal(resolvePartnerDisplayName({ name: "null" }), "null");
  assert.equal(resolvePartnerDisplayName({ name: "undefined" }), "undefined");

  // Known gap: a *real* all-digit display name 6–12 chars long collides with
  // HEX_ID_LIKE and is treated as a truncated peer id → falls to friend_code.
  // Locked in intentionally so a future regex tweak doesn't silently change
  // poison-id filtering without a test failing here.
  assert.equal(
    resolvePartnerDisplayName({ name: "123456", friendCode: "abcd" }),
    "ABCD"
  );

  // Short non-hex-length numeric id equal to shortId is still filtered via
  // the explicit id-equality check (outside the 6–12 hex length window).
  assert.equal(
    resolvePartnerDisplayName({
      name: "12345",
      shortId: "12345",
      friendCode: "wxyz",
    }),
    "WXYZ"
  );

  // Very long real name (no truncation / length cap in resolver).
  const longName = "Q".repeat(500);
  assert.equal(resolvePartnerDisplayName({ name: longName }), longName);

  // Embedded control char (e.g. NUL) is not stripped mid-string — only
  // leading/trailing whitespace + ZWSP/BOM are cleaned. Documents current
  // pass-through so a future sanitizer change is caught here.
  assert.equal(
    resolvePartnerDisplayName({ name: "Al" + String.fromCharCode(0) + "ex" }),
    "Al" + String.fromCharCode(0) + "ex"
  );

  // normalizePeer must not throw on a fully poisoned payload.
  const poisoned = normalizePeer(
    {
      peer_id: "poison01",
      name: "🎉🎊",
      friend_code: "",
      stars: "NaN",
      trust: "-Infinity",
    },
    msg
  );
  assert.equal(poisoned.name, "🎉🎊");
  assert.equal(poisoned.stars, 0);
  assert.equal(poisoned.starsKnown, false);
}

{
  // displayPartnerStars — object/array poison must coerce, never throw.
  assert.equal(displayPartnerStars({}, 5), 5); // Number({}) → NaN, trust wins
  assert.equal(displayPartnerStars([], 5), 5); // Number([]) → 0
  assert.equal(displayPartnerStars([3], 1), 3);
  assert.equal(displayPartnerStars([1, 2], 9), 9); // Number("1,2") → NaN
  assert.equal(displayPartnerStars(true, false), 1);
}

{
  // mergePartnerStars / mergePartnerTrust — object/array prev must not throw
  // and normalize to 0 rather than resurrecting a bogus badge.
  assert.equal(
    mergePartnerStars({ samePartner: true, prev: {}, next: 0, nextKnown: false }),
    0
  );
  assert.equal(
    mergePartnerStars({ samePartner: true, prev: [7], next: 0, nextKnown: false }),
    7
  );
  assert.equal(
    mergePartnerTrust({ samePartner: true, prev: [1, 2], next: 0, nextKnown: false }),
    0
  );
}

{
  // resolvePartnerDisplayName — non-string name objects coerce via String();
  // a plain object with no custom toString paints its literal stringification
  // (documents current pass-through, not treated as placeholder/anon/hex).
  assert.equal(resolvePartnerDisplayName({ name: {} }), "[object Object]");
  // Object with custom toString is indistinguishable from a real name.
  assert.equal(
    resolvePartnerDisplayName({ name: { toString: () => "Bob" } }),
    "Bob"
  );
  // Numeric name (not a string) still coerces and hex-length digits still
  // collide with HEX_ID_LIKE per the known-gap behavior above.
  assert.equal(resolvePartnerDisplayName({ name: 42 }), "42");

  // normalizePeer on a fully empty peer object must not throw and must
  // default peerId to "legacy" (never mistaken for a real id/name).
  const emptyPeer = normalizePeer({}, msg);
  assert.equal(emptyPeer.peerId, "legacy");
  assert.equal(emptyPeer.name, "ab"); // falls back to msg.partner_short
  assert.equal(emptyPeer.stars, 0);
  assert.equal(emptyPeer.starsKnown, false);
}

{
  // displayPartnerStars — positive Infinity is NOT clamped (only negative
  // values are floored at 0). Locked in as a documented known gap: a poison
  // "stars": Infinity from a broken bridge would paint "★∞" rather than a
  // sane number. If this ever gets clamped, update this assertion.
  assert.equal(displayPartnerStars(Infinity, 5), Infinity);
  assert.equal(displayPartnerStars(5, Infinity), Infinity);

  // String-form "Infinity"/"-Infinity" go through the same bare Number()
  // coercion (no readNonNegInt finiteness gate on this path), so they behave
  // identically to the numeric-literal case above — unlike readPeerStars,
  // which rejects both forms as "field not present" (see the dedicated
  // finiteness-guard block further below). Locked in to catch any future
  // attempt to route displayPartnerStars through readNonNegInt.
  assert.equal(displayPartnerStars("Infinity", 5), Infinity);
  assert.equal(displayPartnerStars("-Infinity", 5), 5);

  // Whitespace-only string is JS's Number("   ") === 0 quirk, not NaN — so
  // trust still wins over a "blank" spendable field rather than the two
  // being equally ignored.
  assert.equal(displayPartnerStars("   ", 5), 5);
  assert.equal(displayPartnerStars("   ", 0), 0);
}

{
  // readPeerGeo — object/array poison for flag/country/city must not throw.
  // String(raw) coercion means these produce garbage-but-harmless output,
  // never a crash (dock always gets a string it can render).
  const objFlag = readPeerGeo({ flag: {}, country: ["Canada"], city: [1, 2] });
  assert.equal(objFlag.flag, "OB"); // "[object Object]" → letters only → first 2
  assert.equal(objFlag.country, "Canada"); // single-element array stringifies bare
  assert.equal(objFlag.city, "1,2");

  // hide_ip as a non-empty string ("false") is still truthy poison — any
  // non-empty string coerces to hideIp=true via !!(...). Locked in so a
  // future hub bridge sending stringly-typed booleans is caught here.
  const strHideIp = readPeerGeo({ hide_ip: "false" });
  assert.equal(strHideIp.hideIp, true);
  const emptyStrHideIp = readPeerGeo({ hide_ip: "" });
  assert.equal(emptyStrHideIp.hideIp, false);
}

{
  // readPeerStars / readPeerTrust — array/object poison must never throw.
  // Array coerces via Number([...]) (single-element arrays stringify bare),
  // so it is treated as an *explicit known* value, not a skipped field —
  // a poison "stars": [] from a broken bridge would spend a badge to 0
  // rather than being ignored like undefined/null. Locked in so a future
  // readNonNegInt change doesn't silently flip known=true → known=false.
  const arrStars = readPeerStars({ stars: [] });
  assert.equal(arrStars.stars, 0);
  assert.equal(arrStars.known, true);
  const arrStars2 = readPeerStars({ stars: [12] });
  assert.equal(arrStars2.stars, 12);
  assert.equal(arrStars2.known, true);

  // Plain object poison is not numeric → Number({}) is NaN → skipped as if
  // the field were absent (never throws, never claims known).
  const objStars = readPeerStars({ stars: {} });
  assert.equal(objStars.stars, 0);
  assert.equal(objStars.known, false);
  const objTrust = readPeerTrust({ trust: {} });
  assert.equal(objTrust.trust, 0);
  assert.equal(objTrust.known, false);
}

{
  // isBetterPartnerDisplayName — poison candidate/current must never throw
  // and must resolve via the same placeholder rules as everything else.
  assert.equal(isBetterPartnerDisplayName(null, "Partner", {}), false);
  assert.equal(isBetterPartnerDisplayName(undefined, "Partner", {}), false);
  assert.equal(isBetterPartnerDisplayName({}, "Partner", {}), true); // "[object Object]" is a keepable real label
  assert.equal(isBetterPartnerDisplayName(42, "Partner", {}), true); // "42" keepable, beats default
  assert.equal(isBetterPartnerDisplayName("anon", "Alex", {}), false); // anon never beats a real name
}

{
  // extraPeersFromMatch — poison / edge peers[] must never throw and must
  // drop legacy + primary-duplicate rows while capping at MAX_EXTRA_PEERS.
  const multiMsg = { type: "matched", mode: "party_browse" };
  const poisonPeers = [
    { peer_id: "primary01", name: "Primary" },
    { peer_id: "primary01", name: "DupOfPrimary" }, // same id as primary → dropped
    { peer_id: "", name: "NoId" }, // empty peerId → dropped (falls to "legacy")
    { peer_id: "legacy", name: "LegacyRow" }, // explicit legacy → dropped
    { peer_id: "extra01", name: "🎉🎊", stars: "NaN" },
    { peer_id: "extra02", name: "" },
    { peer_id: "extra03", name: "Extra Three" }, // beyond MAX_EXTRA_PEERS (max 4 people)
    { peer_id: "extra04", name: "Overflow" },
  ];
  const extras = extraPeersFromMatch(
    { ...multiMsg, peers: poisonPeers },
    "primary01"
  );
  assert.equal(extras.length, MAX_EXTRA_PEERS);
  assert.deepEqual(
    extras.map((p) => p.peerId),
    ["extra01", "extra02"]
  );
  assert.equal(extras[0].name, "🎉🎊");
  assert.equal(extras[0].stars, 0);

  // Empty / missing peers[] → no extras, never throws.
  assert.deepEqual(extraPeersFromMatch({ ...multiMsg, peers: [] }, "p"), []);
  assert.deepEqual(extraPeersFromMatch({ ...multiMsg }, "p"), []);
  // Single peer that IS the primary (re-sent / same id) → 1 unique remote,
  // no extras (1v1 lock) — must not surface the primary as its own extra.
  assert.deepEqual(
    extraPeersFromMatch({ ...multiMsg, peers: [{ peer_id: "solo1" }] }, "solo1"),
    []
  );
}

{
  // extraPeersFromMatch — hardening for 2-screen 3-way: a 3rd-join Matched
  // delta from the hub often lists ONLY the new peer (Laptop), not the
  // already-established primary. A raw `peers.length <= 1` short-circuit
  // wrongly dropped this single-row extra entirely (trio split vanished).
  // Filtering must key off primary-id match, not row count.
  const multiMsg = { type: "matched", mode: "party_browse" };

  // 2 remotes (primary + Laptop both listed) → non-primary extra returned.
  const twoRemotes = extraPeersFromMatch(
    {
      ...multiMsg,
      peers: [
        { peer_id: "primaryABC", name: "Partner" },
        { peer_id: "laptopXYZ", name: "Laptop" },
      ],
    },
    "primaryABC"
  );
  assert.deepEqual(twoRemotes.map((p) => p.peerId), ["laptopXYZ"]);
  assert.equal(twoRemotes[0].name, "Laptop");

  // Hub 3rd-join delta: peers[] has only the NEW peer, primary omitted.
  // Must still surface Laptop as an extra (this was the actual regression).
  const deltaJoin = extraPeersFromMatch(
    { ...multiMsg, peers: [{ peer_id: "laptopXYZ", name: "Laptop" }] },
    "primaryABC"
  );
  assert.deepEqual(deltaJoin.map((p) => p.peerId), ["laptopXYZ"]);

  // Poison primary-only: 2 rows but both resolve to the same primary via
  // loose id matching → 1 unique remote → empty extras (1v1 lock).
  const poisonPrimaryOnly = extraPeersFromMatch(
    {
      ...multiMsg,
      peers: [
        { peer_id: "fed/sess/primaryABC12345678", name: "Primary" },
        { peer_id: "primaryABC12345678dead", name: "SamePersonDifferentForm" },
      ],
    },
    "fed/sess/primaryABC12345678"
  );
  assert.deepEqual(poisonPrimaryOnly, []);

  // Single row that IS the primary alone (hub re-sends same partner) →
  // still empty extras, never self-listed.
  assert.deepEqual(
    extraPeersFromMatch(
      { ...multiMsg, peers: [{ peer_id: "primaryABC" }] },
      "primaryABC"
    ),
    []
  );
}

{
  // Bidi override poison (U+202E right-to-left override, U+2066-2069 isolates)
  // is NOT stripped by cleanPartnerLabel today — only ZWSP/BOM are removed.
  // A spoofed name like "Ale‮xe.mp3" would visually reorder in the dock.
  // Locked in as a documented known gap: if a future sanitizer strips bidi
  // controls, update this assertion rather than silently losing coverage.
  const rtlName = "Ale" + "‮" + "xe";
  assert.equal(resolvePartnerDisplayName({ name: rtlName }), rtlName);
  const isolateName = "⁦Bob⁩";
  assert.equal(resolvePartnerDisplayName({ name: isolateName }), isolateName);

  // normalizePeer must not throw on a bidi-poisoned payload either.
  const bidiPeer = normalizePeer(
    { peer_id: "bidi01", name: rtlName, stars: 2 },
    msg
  );
  assert.equal(bidiPeer.name, rtlName);
  assert.equal(bidiPeer.stars, 2);
}

{
  // displayPartnerStars — extreme numeric magnitudes must never throw and
  // must stay finite/consistent for any real (non-Infinity) input.
  assert.equal(
    displayPartnerStars(Number.MAX_SAFE_INTEGER, 5),
    Number.MAX_SAFE_INTEGER
  );
  assert.equal(displayPartnerStars(1e21, 5), Math.floor(1e21));
  assert.equal(displayPartnerStars(-0, 0), 0); // negative zero normalizes to plain 0
  assert.equal(Object.is(displayPartnerStars(-0, 0), -0), false);
}

{
  // normalizePeer — a fully poisoned peer row (null / undefined / primitive,
  // not the usual malformed-but-object shape) must never throw. Hub peers[]
  // is attacker/partner-influenced JSON; one bad row must not crash the
  // whole Matched handler for every peer in the array.
  for (const poison of [null, undefined, "not-an-object", 42, true, []]) {
    const p = normalizePeer(poison, msg);
    assert.equal(p.peerId, "legacy");
    assert.equal(p.stars, 0);
    assert.equal(p.starsKnown, false);
  }

  // extraPeersFromMatch — peers[] containing null/undefined/primitive rows
  // alongside good ones must never throw; poisoned rows normalize to
  // peerId "legacy" and are dropped like any other legacy row.
  const multiMsg = { type: "matched", mode: "party_browse" };
  const mixedPeers = [
    { peer_id: "primary01", name: "Primary" },
    null,
    undefined,
    "poison-string",
    { peer_id: "extra01", name: "Extra" },
  ];
  const extras = extraPeersFromMatch(
    { ...multiMsg, peers: mixedPeers },
    "primary01"
  );
  assert.deepEqual(
    extras.map((p) => p.peerId),
    ["extra01"]
  );

  // pickPeer — a poisoned peers[0] must never throw and falls back to the
  // same "legacy"/Partner placeholder as an empty peers[] array.
  const picked = pickPeer({
    type: "matched",
    is_offerer: true,
    mode: "solo",
    peers: [null],
  });
  assert.equal(picked.peerId, "legacy");
  assert.equal(picked.name, "Partner");
}

{
  // extraPeersFromMatch / pickPeer — msg.peers itself (not just its rows) can
  // be poisoned to a non-array truthy value by a broken hub bridge. Both
  // "peers.map" (extraPeersFromMatch) and "peers.length"/"peers[0]"
  // (pickPeer) must degrade to the empty/legacy path instead of throwing.
  const multiMsg = { type: "matched", mode: "party_browse" };
  for (const poisonPeers of [
    "poison-string",
    { evil: true },
    42,
    true,
    { length: 3, 0: { peer_id: "fake" } }, // array-like object, not a real array
  ]) {
    assert.deepEqual(
      extraPeersFromMatch({ ...multiMsg, peers: poisonPeers }, "primary01"),
      []
    );
    const picked = pickPeer({
      type: "matched",
      is_offerer: true,
      mode: "solo",
      peers: poisonPeers,
    });
    assert.equal(picked.peerId, "legacy");
    assert.equal(picked.name, "Partner");
  }
}

{
  // mergePartnerTrust — object/array poison prev must not throw and must
  // normalize to 0 (parity with the mergePartnerStars object-poison case
  // above, which only exercised mergePartnerStars).
  assert.equal(
    mergePartnerTrust({ samePartner: true, prev: {}, next: 0, nextKnown: false }),
    0
  );
  assert.equal(
    mergePartnerTrust({ samePartner: true, prev: [7], next: 0, nextKnown: false }),
    7
  );
}

{
  // readPeerStars/readPeerTrust reject non-finite magnitudes (Infinity, both
  // as a number and as the literal string "Infinity") as "field not present"
  // rather than "known value" — readNonNegInt requires Number.isFinite(n).
  // This is the opposite of displayPartnerStars(Infinity, ...), which has no
  // finiteness guard and lets Infinity through untouched (see the dedicated
  // "extreme numeric magnitudes" block above). A broken bridge sending
  // MatchPeer.stars = Infinity must never latch an infinite badge.
  const infNum = readPeerStars({ stars: Infinity });
  assert.equal(infNum.known, false);
  assert.equal(infNum.stars, 0);
  const infStr = readPeerStars({ stars: "Infinity" });
  assert.equal(infStr.known, false);
  assert.equal(infStr.stars, 0);
  const infTrust = readPeerTrust({ trust: -Infinity });
  assert.equal(infTrust.known, false);
  assert.equal(infTrust.trust, 0);

  // End-to-end via normalizePeer: an Infinity stars field from a poisoned
  // MatchPeer must never latch as a known badge.
  const infPeer = normalizePeer(
    { peer_id: "inf01", name: "Inf", stars: Infinity, trust: 5 },
    msg
  );
  assert.equal(infPeer.starsKnown, false);
  assert.equal(infPeer.stars, 0);
  assert.equal(infPeer.trustKnown, true);
  assert.equal(infPeer.trust, 5);
}

{
  // cleanPartnerLabel — BOM-only / ZWSP-only strings must collapse to "",
  // same as whitespace-only, so they never masquerade as a real label.
  assert.equal(cleanPartnerLabel("﻿"), "");
  assert.equal(cleanPartnerLabel("​‌‍"), "");
  assert.equal(cleanPartnerLabel("​  ﻿"), "");
}

{
  // Astral (surrogate-pair) characters in peerId: slicing the first 8 UTF-16
  // code units can land mid-pair and produce a lone surrogate. That must
  // still be a valid, non-throwing JS string comparison — not a crash.
  const peerId = "a".repeat(7) + "\u{1F600}" + "aabbccdd";
  assert.equal(peerId.slice(0, 8), "aaaaaaa\ud83d");
  const p = normalizePeer({ peer_id: peerId, name: "Real Name" }, msg);
  assert.equal(p.name, "Real Name");
  assert.equal(p.peerId, peerId);
  // Name that happens to equal the lone-surrogate 8-char prefix is still
  // correctly treated as a placeholder id clone (rejected as "name"), not a
  // crash — extras must not inherit top-level partner_short ("ab").
  const cloneName = normalizePeer(
    { peer_id: peerId, name: "aaaaaaa\ud83d" },
    msg
  );
  assert.equal(cloneName.name, "Partner");
}

{
  // friend_code has no length cap in the resolver — a pathologically long
  // code from a broken bridge is uppercased in full, never truncated, and
  // never throws (documents current no-cap behavior).
  const longCode = "ab12".repeat(500); // 2000 chars
  assert.equal(
    resolvePartnerDisplayName({ name: "", friendCode: longCode }),
    longCode.toUpperCase()
  );
}

{
  // HEX_ID_LIKE length-boundary poison: 5 hex chars (below the 6-char floor)
  // and 13 hex chars (above the 12-char ceiling) are NOT hex-id-like, so a
  // short_id of that shape paints through as a real label instead of being
  // filtered as a truncated peer id.
  assert.equal(
    resolvePartnerDisplayName({ name: "", shortId: "abcde" }),
    "abcde"
  );
  assert.equal(
    resolvePartnerDisplayName({ name: "", shortId: "abcdef1234567" }),
    "abcdef1234567"
  );
  // 6 and 12 chars (inclusive boundary) ARE hex-id-like → filtered to Partner.
  assert.equal(resolvePartnerDisplayName({ name: "", shortId: "abcdef" }), "Partner");
  assert.equal(
    resolvePartnerDisplayName({ name: "", shortId: "abcdef123456" }),
    "Partner"
  );
}

{
  // readPeerStars — negative-valued star fields are skipped like absent
  // fields (readNonNegInt requires n >= 0), falling through to the next
  // candidate alias rather than latching a negative badge.
  const negStr = readPeerStars({ stars: "-5", star_balance: 10 });
  assert.equal(negStr.stars, 10);
  assert.equal(negStr.known, true);
  const negOnly = readPeerStars({ stars: -3 });
  assert.equal(negOnly.stars, 0);
  assert.equal(negOnly.known, false);

  // Whitespace-padded numeric strings coerce cleanly (hub JSON occasionally
  // round-trips through a bridge that adds stray padding).
  assert.equal(displayPartnerStars("  7  ", 0), 7);
  assert.equal(readPeerStars({ stars: "  9  " }).stars, 9);
  assert.equal(readPeerStars({ stars: "  9  " }).known, true);
}

{
  // resolvePartnerDisplayName — array-valued name coerces via String() same
  // as any other non-string; a multi-element array joins with commas and
  // paints through as a "real" label (documents current pass-through, no
  // array-awareness in the resolver).
  assert.equal(resolvePartnerDisplayName({ name: ["Bob", "X"] }), "Bob,X");
  // Single-element array stringifies bare, same shape as the numeric case.
  assert.equal(resolvePartnerDisplayName({ name: ["Alex"] }), "Alex");
  // Empty array stringifies to "" → falls through to friend_code/Partner.
  assert.equal(
    resolvePartnerDisplayName({ name: [], friendCode: "wxyz" }),
    "WXYZ"
  );
}

{
  // mergePartnerStars / mergePartnerTrust — nextKnown=true with a garbage
  // (NaN) next value still floors to 0 rather than being treated as
  // "unknown" and falling back to prev. known=true always wins the branch.
  assert.equal(
    mergePartnerStars({ samePartner: true, prev: 40, next: NaN, nextKnown: true }),
    0
  );
  assert.equal(
    mergePartnerTrust({ samePartner: true, prev: 40, next: NaN, nextKnown: true }),
    0
  );
}

{
  // mergePartnerStars / mergePartnerTrust — known=true with an Infinity next
  // is NOT clamped (no finiteness guard on the merge path, mirroring the
  // displayPartnerStars Infinity gap above). A broken bridge sending an
  // explicit "known" Infinity would latch an infinite badge on re-Matched.
  assert.equal(
    mergePartnerStars({ samePartner: true, prev: 40, next: Infinity, nextKnown: true }),
    Infinity
  );
  assert.equal(
    mergePartnerTrust({ samePartner: true, prev: 40, next: Infinity, nextKnown: true }),
    Infinity
  );
}

{
  // readPeerStars / readPeerTrust — boolean field values are not skipped
  // like undefined/null/""; they coerce via Number(true|false) → 1 / 0 and
  // count as a *known* explicit value. A poison "stars": false from a
  // broken bridge reads as a known empty ledger, not "field absent".
  const boolTrueStars = readPeerStars({ stars: true });
  assert.equal(boolTrueStars.stars, 1);
  assert.equal(boolTrueStars.known, true);
  const boolFalseStars = readPeerStars({ stars: false });
  assert.equal(boolFalseStars.stars, 0);
  assert.equal(boolFalseStars.known, true);
  const boolTrust = readPeerTrust({ trust: true });
  assert.equal(boolTrust.trust, 1);
  assert.equal(boolTrust.known, true);
}

{
  // resolvePartnerDisplayNameWithSource — "from" tag coverage for the
  // short_id / prev / fallback branches (only name/friend_code/default were
  // asserted above). Callers (e.g. PartnerIdentityDock) branch on `from` to
  // decide chip styling, so each source label needs its own regression.
  assert.equal(
    resolvePartnerDisplayNameWithSource({ name: "", shortId: "ab12" }).from,
    "short_id"
  );
  assert.equal(
    resolvePartnerDisplayNameWithSource({ name: "", prev: "Alice" }).from,
    "prev"
  );
  assert.equal(
    resolvePartnerDisplayNameWithSource({ name: "", fallback: "Bob" }).from,
    "fallback"
  );
}

{
  // isBetterPartnerDisplayName — poisoned `ids` values (number / array /
  // object instead of string|null|undefined) must never throw. cleanPartnerLabel
  // coerces every id via String(), so comparisons stay well-defined even when
  // a caller passes malformed peerId/userId/shortId.
  assert.equal(
    isBetterPartnerDisplayName("Alex", "Partner", {
      peerId: 12345,
      userId: ["a", "b"],
      shortId: {},
    }),
    true
  );
  assert.equal(
    isBetterPartnerDisplayName(null, "Alex", {
      peerId: {},
      userId: 0,
      shortId: [],
    }),
    false
  );
}

{
  // resolvePartnerDisplayName — literal "Partner"/"anon" through the canonical
  // matchPeers resolver (not just the dock wrapper), including mixed-case and
  // whitespace/ZWSP combined with the placeholder word, to lock the same
  // behavior in the implementation the dock test only mirrors.
  assert.equal(
    resolvePartnerDisplayName({ name: "PARTNER", shortId: "ab12" }),
    "ab12"
  );
  assert.equal(
    resolvePartnerDisplayName({ name: " Partner ​", shortId: "ab12" }),
    "ab12"
  );
  assert.equal(
    resolvePartnerDisplayName({ name: "ANON", friendCode: "kode" }),
    "KODE"
  );
}

{
  // mergePartnerStars / mergePartnerTrust — boolean poison for `next` coerces
  // via Number(true|false) same as readPeerStars/readPeerTrust; a broken
  // bridge sending a boolean must still resolve to a sane 0/1 badge, not throw.
  assert.equal(
    mergePartnerStars({ samePartner: true, prev: 40, next: true, nextKnown: true }),
    1
  );
  assert.equal(
    mergePartnerStars({ samePartner: true, prev: 40, next: false, nextKnown: true }),
    0
  );
  assert.equal(
    mergePartnerTrust({ samePartner: true, prev: 40, next: true, nextKnown: true }),
    1
  );
}

{
  // mergePartnerStars — new partner (samePartner:false) always returns `next`
  // regardless of nextKnown, including non-finite poison. Documents parity
  // with the samePartner:true + nextKnown:true Infinity pass-through above.
  assert.equal(
    mergePartnerStars({ samePartner: false, prev: 40, next: Infinity, nextKnown: false }),
    Infinity
  );
}

{
  // readNonNegInt / readPeerStars / displayPartnerStars — JS's Number()
  // silently parses "0x.." hex-string and "1e3" exponent-string poison as a
  // real numeric value (Number("0x10") === 16). Neither readNonNegInt nor
  // the bare Number() coercion in displayPartnerStars guards against this,
  // so a broken bridge sending stars as a hex/exponent string would latch a
  // surprising badge value instead of being rejected as non-numeric poison.
  // Locked in as a documented known gap.
  assert.equal(readNonNegInt("0x10"), 16);
  const hexStars = readPeerStars({ stars: "0x10" });
  assert.equal(hexStars.stars, 16);
  assert.equal(hexStars.known, true);
  assert.equal(displayPartnerStars("0x10", 5), 16);
  assert.equal(displayPartnerStars("1e2", 5), 100);
}

{
  // extraPeersFromMatch — two non-primary rows sharing the same peerId
  // collapse to one extra (Pixel 2155 Laptop×2). First listed wins.
  const multiMsg = { type: "matched", mode: "party_browse" };
  const dupExtras = extraPeersFromMatch(
    {
      ...multiMsg,
      peers: [
        { peer_id: "primary01", name: "Primary" },
        { peer_id: "dup01", name: "First" },
        { peer_id: "dup01", name: "Second" },
      ],
    },
    "primary01"
  );
  assert.deepEqual(
    dupExtras.map((p) => p.peerId),
    ["dup01"]
  );
  assert.deepEqual(
    dupExtras.map((p) => p.name),
    ["First"]
  );
}

{
  // extraPeersFromMatch — primary exclusion must use loose id matching, not
  // just exact string equality. A 3rd-join rematch can hand back the primary
  // partner's id in a different form (fed/ prefix stripped, short vs full
  // hex) — the source filter checks peerIdsLooseMatch as well as `===`; if
  // this regresses to exact-match-only, the primary would leak into extras
  // and paint a duplicate tile for the partner you're already talking to.
  const multiMsg = { type: "matched", mode: "party_browse" };
  const loosePeers = [
    { peer_id: "fed/sess/aabbccdd11223344", name: "Primary" },
    { peer_id: "aabbccdd11223344dead", name: "SamePersonDifferentForm" },
    { peer_id: "extra01", name: "RealExtra" },
  ];
  const extras = extraPeersFromMatch(
    { ...multiMsg, peers: loosePeers },
    "fed/sess/aabbccdd11223344"
  );
  assert.deepEqual(
    extras.map((p) => p.peerId),
    ["extra01"]
  );

  // Short 8-char prefix form of primary is also excluded via loose match.
  const prefixPeers = [
    { peer_id: "aabbccdd", name: "Primary" },
    { peer_id: "aabbccddeeff0011", name: "SamePersonLongForm" },
    { peer_id: "extra02", name: "RealExtra2" },
  ];
  const extras2 = extraPeersFromMatch(
    { ...multiMsg, peers: prefixPeers },
    "aabbccdd"
  );
  assert.deepEqual(
    extras2.map((p) => p.peerId),
    ["extra02"]
  );
}

{
  // pickPrimaryPeerIndex — 3rd-join rematch must keep the live first
  // conversationalist as the primary tile, not remount it as an "extra".
  const peerIds = ["p1", "p2", "p3"];

  // No prior match (fresh Matched) → always index 0.
  assert.equal(
    pickPrimaryPeerIndex(peerIds, { wasMatched: false, prevPrimary: "p2" }),
    0
  );

  // Prior primary exact match → keep that index even if hub reordered peers[].
  assert.equal(
    pickPrimaryPeerIndex(["p3", "p1", "p2"], {
      wasMatched: true,
      prevPrimary: "p2",
    }),
    2
  );

  // Prior primary in a different id form (fed/ prefix, short vs full hex) —
  // loose match must still find it so the RTCView is not remounted.
  assert.equal(
    pickPrimaryPeerIndex(["fed/sess/aabbccdd11223344", "other"], {
      wasMatched: true,
      prevPrimary: "aabbccdd11223344dead",
    }),
    0
  );

  // Prior primary no longer listed (they left) — falls back to prevSecondary.
  assert.equal(
    pickPrimaryPeerIndex(["p1", "p2"], {
      wasMatched: true,
      prevPrimary: "gone",
      prevSecondary: "p2",
    }),
    1
  );

  // Neither prevPrimary nor prevSecondary present → default to first slot.
  assert.equal(
    pickPrimaryPeerIndex(["p1", "p2"], {
      wasMatched: true,
      prevPrimary: "gone",
      prevSecondary: "also-gone",
    }),
    0
  );

  // Hunt / 3rd-join: hub lists only Laptop — keep first (do not remount).
  assert.equal(
    pickPrimaryPeerIndex(["laptop"], {
      wasMatched: true,
      prevPrimary: "courtier-pc",
      keepFirstOnOmit: true,
    }),
    -1
  );
  assert.equal(
    extraPeersFromMatch(
      { peers: [{ peer_id: "laptop", name: "Laptop", role: "stranger" }] },
      "courtier-pc"
    ).map((p) => p.peerId).join(","),
    "laptop"
  );

  // Hub re-lists only Courtier after 3rd was already extra — keep Laptop.
  assert.equal(
    extrasAfterOmitPrimary({
      extras: [],
      wasMatched: true,
      prevSecondary: "laptop",
      listedIds: ["courtier-pc"],
      primaryId: "courtier-pc",
      keepListed3rd: true,
    })
      .map((p) => p.peerId)
      .join(","),
    "laptop"
  );
  assert.equal(
    extrasAfterOmitPrimary({
      extras: [],
      wasMatched: true,
      prevSecondary: "",
      listedIds: ["courtier-pc"],
      primaryId: "courtier-pc",
    }).length,
    0
  );
  assert.equal(
    extrasAfterOmitPrimary({
      extras: [],
      wasMatched: true,
      prevSecondary: "old",
      listedIds: ["courtier-pc", "other"],
      primaryId: "courtier-pc",
    }).length,
    0
  );
  // Later 1-row Matched: restore latched extras even if prevSecondary empty.
  assert.equal(
    extrasAfterOmitPrimary({
      extras: [],
      wasMatched: true,
      prevSecondary: "",
      prevExtras: [{ peerId: "laptop", name: "Laptop" }],
      listedIds: ["courtier-pc"],
      primaryId: "courtier-pc",
      keepListed3rd: true,
    })
      .map((p) => p.peerId)
      .join(","),
    "laptop"
  );
  // 1v1 Let's go: leftover prevExtras must not invent a 3rd tile.
  assert.equal(
    extrasAfterOmitPrimary({
      extras: [],
      wasMatched: true,
      prevSecondary: "",
      prevExtras: [{ peerId: "laptop", name: "Laptop" }],
      listedIds: ["courtier-pc"],
      primaryId: "courtier-pc",
      keepListed3rd: false,
    }).length,
    0
  );
  // 4th-join delta lists only the new extra — keep live 3rd + union 4th.
  assert.equal(
    extrasAfterOmitPrimary({
      extras: [{ peerId: "friend4", name: "Four" }],
      wasMatched: true,
      prevSecondary: "laptop",
      prevExtras: [{ peerId: "laptop", name: "Laptop" }],
      listedIds: ["courtier-pc", "friend4"],
      primaryId: "courtier-pc",
      keepListed3rd: true,
    })
      .map((p) => p.peerId)
      .join(","),
    "laptop,friend4"
  );

  // Pixel 2155: same Laptop friendCode on two extra tiles → 4-way chrome.
  assert.equal(
    extraPeersFromMatch(
      {
        peers: [
          { peer_id: "pc", name: "Драконов", friend_code: "2AFEE934" },
          { peer_id: "lap-a", name: "Laptop", friend_code: "AC89EC2F" },
          { peer_id: "lap-b", name: "Laptop", friend_code: "AC89EC2F" },
        ],
      },
      "pc"
    )
      .map((p) => p.peerId)
      .join(","),
    "lap-a"
  );
  assert.equal(
    extrasAfterOmitPrimary({
      extras: [
        { peerId: "lap-b", name: "Laptop", friendCode: "AC89EC2F", userId: "u-lap" },
      ],
      wasMatched: true,
      prevSecondary: "lap-a",
      prevExtras: [
        { peerId: "lap-a", name: "Laptop", friendCode: "AC89EC2F", userId: "u-lap" },
      ],
      listedIds: ["pc", "lap-b"],
      primaryId: "pc",
      keepListed3rd: true,
    })
      .map((p) => p.peerId)
      .join(","),
    "lap-b"
  );
  assert.equal(
    extrasAfterOmitPrimary({
      extras: [
        { peerId: "friend4", name: "Four", friendCode: "DEADBEEF", userId: "u4" },
      ],
      wasMatched: true,
      prevSecondary: "laptop",
      prevExtras: [
        { peerId: "laptop", name: "Laptop", friendCode: "AC89EC2F", userId: "u-lap" },
      ],
      listedIds: ["pc", "friend4"],
      primaryId: "pc",
      keepListed3rd: true,
    })
      .map((p) => p.peerId)
      .join(","),
    "laptop,friend4"
  );
  {
    const src = fs.readFileSync(new URL("./matchPeers.ts", import.meta.url), "utf8");
    assert.ok(
      src.includes("export function sameExtraPerson"),
      "matchPeers.ts must export sameExtraPerson (2155 duplicate Laptop extra)"
    );
  }

  // "legacy" prevPrimary/prevSecondary must never be treated as a real id.
  assert.equal(
    pickPrimaryPeerIndex(["legacy", "p2"], {
      wasMatched: true,
      prevPrimary: "legacy",
      prevSecondary: "legacy",
    }),
    0
  );

  {
    const src = fs.readFileSync(new URL("./matchPeers.ts", import.meta.url), "utf8");
    assert.ok(
      src.includes("export function extrasAfterOmitPrimary"),
      "matchPeers.ts must export extrasAfterOmitPrimary (040100Z keep extra)"
    );
    assert.ok(
      src.includes("export function formatPraisedBy"),
      "matchPeers.ts must export formatPraisedBy (compact praised-by line)"
    );
    assert.ok(
      src.includes("export function readPeerGifters"),
      "matchPeers.ts must export readPeerGifters (hub trust_gifters)"
    );
  }

  // Empty peerIds → 0, never throws.
  assert.equal(
    pickPrimaryPeerIndex([], { wasMatched: true, prevPrimary: "p1" }),
    0
  );
}

console.log("matchPeers.test.mjs OK");
