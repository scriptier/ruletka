/**
 * Partner identity display — spec-lock for the loc-line / name-placeholder
 * fix (Pixel smoke: infinite "Looking up location..." + top chrome painting
 * literal "Partner" instead of the dock's short-id fallback).
 * Self-contained mirror (same convention as formatLocLine.test.mjs) so this
 * lock holds even before PartnerIdentityDock.tsx / hide_ip-aware
 * formatLocLine land on this branch.
 * Run: node src/live/partnerIdentityDisplay.test.mjs
 */
import assert from "node:assert/strict";

// -- Name resolution: literal "Partner" / empty is a placeholder, never a
// real display name — short-id (or other fallback) must win instead. -----
function cleanName(raw) {
  return String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function resolvePartnerName(name, nameFallback) {
  const rawName = cleanName(name);
  const empty =
    !rawName ||
    rawName === "…" ||
    rawName === "..." ||
    rawName === "?" ||
    rawName === "？" ||
    /^partner$/i.test(rawName);
  const fallback = cleanName(nameFallback);
  return !empty ? rawName : fallback || "Partner";
}

// -- Loc resolution: empty geo must resolve to "" (no pending line), and
// hide_ip must always show a stable privacy label — never blank/pending. --
function normalizeFlagCode(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  return s.length === 2 ? s : "";
}
function formatLocLine(opts) {
  if (opts.hideIp) return "";
  const code = normalizeFlagCode(opts.flag);
  let country = String(opts.country || "").trim();
  let city = String(opts.city || "").trim();
  if (!country && code) country = code;
  const parts = [];
  if (code) parts.push(code);
  if (country && country !== code) parts.push(country.slice(0, 28));
  if (city) parts.push(city.slice(0, 28));
  return parts.join(" · ");
}
function resolvePartnerLoc(opts) {
  const hideIp = !!opts.hideIp;
  const locRaw = hideIp
    ? ""
    : formatLocLine({
        flag: opts.flag,
        country: opts.country,
        city: opts.city,
        hideIp: false,
      });
  const locPrivate = opts.locPrivateLabel || "Location hidden";
  const locLine = hideIp ? locPrivate : locRaw;
  const locDim = hideIp || !locRaw;
  const showLoc = !!locLine;
  return { locLine, locDim, showLoc };
}

// -- Name: literal "Partner" hub placeholder is not a real display name --
assert.equal(
  resolvePartnerName("Partner", "ab12cd34"),
  "ab12cd34",
  "literal Partner placeholder must fall back to short-id"
);
assert.equal(
  resolvePartnerName("partner", "ab12cd34"),
  "ab12cd34",
  "placeholder match must be case-insensitive"
);

// -- Name: empty / whitespace-only / zero-width-only name -> short-id ----
assert.equal(resolvePartnerName("", "ab12cd34"), "ab12cd34");
assert.equal(resolvePartnerName("   ", "ab12cd34"), "ab12cd34");
assert.equal(
  resolvePartnerName("\u200B\u200C", "ab12cd34"),
  "ab12cd34",
  "zero-width-only name must be treated as empty"
);
assert.equal(resolvePartnerName("…", "ab12cd34"), "ab12cd34");
assert.equal(resolvePartnerName("...", "ab12cd34"), "ab12cd34");

// -- Name: no fallback available -> last-resort "Partner" literal --------
assert.equal(resolvePartnerName("", ""), "Partner");
assert.equal(resolvePartnerName("Partner", ""), "Partner");

// -- Name: a real name is never overridden by the short-id fallback ------
assert.equal(resolvePartnerName("Alex", "ab12cd34"), "Alex");
assert.equal(
  resolvePartnerName("  Алекс  ", "ab12cd34"),
  "Алекс",
  "real names are trimmed, not replaced"
);

// -- Loc: empty geo (no flag/country/city, no hide_ip) -> no pending line -
const emptyGeo = resolvePartnerLoc({});
assert.equal(emptyGeo.locLine, "", "empty geo must resolve to empty, not pending");
assert.equal(emptyGeo.showLoc, false, "dock must not show a line for empty geo");

// -- Loc: flag-only still produces a non-empty, visible line -------------
const flagOnly = resolvePartnerLoc({ flag: "CA" });
assert.ok(flagOnly.locLine.length > 0, "flag-only must not be empty");
assert.equal(flagOnly.showLoc, true);

// -- Loc: hide_ip always shows the privacy label, never blank/pending ----
const hidden = resolvePartnerLoc({ flag: "CA", country: "Canada", hideIp: true });
assert.equal(hidden.locLine, "Location hidden");
assert.equal(hidden.showLoc, true);
assert.equal(hidden.locDim, true);

console.log("partnerIdentityDisplay.test.mjs OK");
