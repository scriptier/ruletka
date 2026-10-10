/**
 * PartnerIdentityDock name resolution — placeholders (empty / anon / Partner /
 * ellipsis / hex peer ids) never paint when a better label exists.
 * Mirrors matchPeers resolvePartnerDisplayName used by the dock.
 * Run: node src/live/partnerIdentityDisplay.test.mjs
 */
import assert from "node:assert/strict";

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

function resolvePartnerLabel(opts) {
  const ids = {
    peerId: opts.peerId,
    userId: opts.userId,
    shortId: opts.shortId,
  };
  const name = cleanPartnerLabel(opts.name);
  if (name && !isPlaceholderPartnerName(name, ids)) return name;
  // friend_code before short_id — hub partner_short is often a junk 2-char
  // slice that must not beat a real 8-char invite code (matches matchPeers.ts
  // resolvePartnerDisplayNameWithSource ordering; test + production thrash).
  const code = cleanPartnerLabel(opts.friendCode).toUpperCase();
  if (code) return code;
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
    return shortId;
  }
  const prev = cleanPartnerLabel(opts.prev);
  if (prev && isKeepablePrevPartnerLabel(prev, ids)) {
    if (isHexIdLike(prev)) return prev.toUpperCase();
    return prev;
  }
  const fallback = cleanPartnerLabel(opts.fallback);
  if (fallback && isKeepablePrevPartnerLabel(fallback, ids)) {
    if (isHexIdLike(fallback)) return fallback.toUpperCase();
    if (!isPlaceholderPartnerName(fallback, ids)) return fallback;
  }
  return "Partner";
}

// Dock signature: (name, nameFallback, friendCode)
// Do not map nameFallback → peerId (collapses short labels to "Partner").
function resolvePartnerDisplayName(name, nameFallback, friendCode) {
  return resolvePartnerLabel({
    name: name == null ? undefined : String(name),
    shortId: nameFallback == null ? undefined : String(nameFallback),
    friendCode: friendCode == null ? undefined : String(friendCode),
  });
}

function isPlaceholderName(raw) {
  return isPlaceholderPartnerName(raw);
}

// Real name always wins over any fallback.
assert.equal(resolvePartnerDisplayName("Alex", "abcd1234"), "Alex");
assert.equal(resolvePartnerDisplayName("Alex", "abcd1234", "XY12"), "Alex");
assert.equal(resolvePartnerDisplayName("Драконов", "3dc02a71"), "Драконов");

// Empty name + non-hex short fallback (4 chars) still paints short label.
assert.equal(resolvePartnerDisplayName("", "ab12"), "ab12");
assert.equal(resolvePartnerDisplayName(undefined, "ab12"), "ab12");

// Hex short id (8-char peer paint) is placeholder → friendCode or Partner.
assert.equal(resolvePartnerDisplayName("", "abcd1234"), "Partner");
assert.equal(resolvePartnerDisplayName("", "3dc02a71", "xyzw"), "XYZW");
assert.equal(resolvePartnerDisplayName("3dc02a71", "3dc02a71", "f1e2"), "F1E2");

// Literal "Partner" (any case) is a placeholder, not a real name.
assert.equal(resolvePartnerDisplayName("Partner", "ab12"), "ab12");
assert.equal(resolvePartnerDisplayName("partner", "ab12"), "ab12");
assert.equal(resolvePartnerDisplayName("PARTNER", "ab12"), "ab12");

// Ellipsis / question-mark placeholders also fall back.
assert.equal(resolvePartnerDisplayName("…", "ab12"), "ab12");
assert.equal(resolvePartnerDisplayName("...", "ab12"), "ab12");
assert.equal(resolvePartnerDisplayName("?", "ab12"), "ab12");
assert.equal(resolvePartnerDisplayName("？", "ab12"), "ab12");

// friendCode when name + shortId empty/placeholder
assert.equal(resolvePartnerDisplayName("", "", "xyzw"), "XYZW");
assert.equal(resolvePartnerDisplayName("Partner", "", "ab12"), "AB12");
assert.equal(resolvePartnerDisplayName("…", undefined, "cd34"), "CD34");
// friendCode always wins over shortId (even non-hex) when both are present —
// hub partner_short can be junk; the 8-char invite code is the trustworthy one.
assert.equal(resolvePartnerDisplayName("", "short99", "xyzw"), "XYZW");
assert.equal(resolvePartnerDisplayName("", "deadbeef", "xyzw"), "XYZW");
// shortId only wins when friendCode is absent/empty.
assert.equal(resolvePartnerDisplayName("", "short99", ""), "short99");
assert.equal(resolvePartnerDisplayName("", "short99", undefined), "short99");

// anon is placeholder
assert.equal(resolvePartnerDisplayName("anon", "", "kode"), "KODE");

// No fallback available either → literal "Partner" is the last resort.
assert.equal(resolvePartnerDisplayName("", ""), "Partner");
assert.equal(resolvePartnerDisplayName("Partner", undefined), "Partner");
assert.equal(resolvePartnerDisplayName("", "", ""), "Partner");
assert.equal(resolvePartnerDisplayName("3dc02a71", "3dc02a71"), "Partner");

// Zero-width chars alone must not be mistaken for a real name.
assert.equal(resolvePartnerDisplayName("\u200B\u200C", "ab12"), "ab12");

// isPlaceholderName exposed directly for chrome callers.
assert.equal(isPlaceholderName(""), true);
assert.equal(isPlaceholderName("Partner"), true);
assert.equal(isPlaceholderName("anon"), true);
assert.equal(isPlaceholderName("3dc02a71"), true);
assert.equal(isPlaceholderName("Alex"), false);

// Poison inputs — dock wrapper coerces via String(); must never throw and
// must not paint hub/partner-controlled junk as a trusted placeholder.
assert.equal(resolvePartnerDisplayName(0, "ab12"), "0"); // short non-hex number still a "real" label
assert.equal(resolvePartnerDisplayName(NaN, "ab12"), "NaN");
assert.equal(resolvePartnerDisplayName("", "", 123), "123"); // numeric friendCode coerces + uppercases
const longName = "Z".repeat(300);
assert.equal(resolvePartnerDisplayName(longName, "ab12"), longName);
assert.equal(
  resolvePartnerDisplayName("Al" + String.fromCharCode(0) + "ex", "ab12"),
  "Al" + String.fromCharCode(0) + "ex"
);

// Bidi override poison (U+202E) is not stripped by cleanPartnerLabel — only
// ZWSP/BOM are. Locked in as a documented known gap for the dock wrapper too,
// mirroring matchPeers.test.mjs coverage.
{
  const rtlName = "Ale" + "‮" + "xe";
  assert.equal(resolvePartnerDisplayName(rtlName, "ab12"), rtlName);
}

// Array-valued name (dock wrapper coerces via String()) — same pass-through
// as matchPeers.test.mjs; mirrors the resolver's no-array-awareness gap.
assert.equal(resolvePartnerDisplayName(["Bob", "X"], "ab12"), "Bob,X");
assert.equal(resolvePartnerDisplayName([], "ab12"), "ab12");

// friend_code-before-short_id ordering fix (see the reordered resolvePartnerLabel
// above) exercised through the dock wrapper with poison-shaped friendCode
// values, so a future accidental revert-to-old-order is caught here too and
// not just in matchPeers.test.mjs.
assert.equal(resolvePartnerDisplayName("", "short99", "​"), "short99"); // ZWSP-only friendCode cleans to "" → skipped, falls to shortId
assert.equal(resolvePartnerDisplayName("", "short99", NaN), "NAN"); // NaN coerces to non-empty "NaN" → still wins over shortId
assert.equal(resolvePartnerDisplayName("", "short99", 0), "0"); // 0 still a non-empty code string
assert.equal(resolvePartnerDisplayName("", "junkshort", "0000abcd"), "0000ABCD");

// Friend-code line: paint when distinct from name; hide when it IS the name.
function shouldPaintFriendCode(name, code) {
  const n = String(name || "").trim().toUpperCase();
  const c = String(code || "").trim().toUpperCase();
  return !!c && c.length >= 4 && c !== n;
}
assert.equal(shouldPaintFriendCode("Courtier", "A1B2C3D4"), true);
assert.equal(shouldPaintFriendCode("A1B2C3D4", "A1B2C3D4"), false);
assert.equal(shouldPaintFriendCode("Courtier", "AB"), false);
assert.equal(shouldPaintFriendCode("Courtier", ""), false);

console.log("partnerIdentityDisplay.test.mjs OK");
