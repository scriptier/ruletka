/**
 * formatLocLine + peerIdsLooseMatch — flag ISO alone must not leave chrome empty;
 * hide_ip must not invent country; peer_id forms must match loosely.
 * Run: node src/identity/formatLocLine.test.mjs
 */
import assert from "node:assert/strict";

// Mirror formatLocLine core with geoLocalize (compiled-free duplicate of logic)
function normalizeFlagCode(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  return s.length === 2 ? s : "";
}
function flagEmoji(code) {
  const cc = normalizeFlagCode(code);
  if (!cc) return "";
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
  );
}

// Inline COUNTRY_RU subset (parity with geoLocalize for flag→country fallback)
const COUNTRY_RU = { CA: "Канада", US: "США", LT: "Литва", RU: "Россия" };
function localizeCountry(countryOrCode, flagCode, lang = "ru") {
  const raw = String(countryOrCode || "").trim();
  const iso = normalizeFlagCode(flagCode) || normalizeFlagCode(raw);
  if (String(lang).toLowerCase().startsWith("ru") && iso && COUNTRY_RU[iso]) {
    return COUNTRY_RU[iso];
  }
  return raw || iso;
}
function localizeCity(city, lang = "ru") {
  const raw = String(city || "").trim();
  if (!raw) return "";
  if (String(lang).toLowerCase().startsWith("ru") && raw.toLowerCase() === "calgary") {
    return "Калгари";
  }
  return raw;
}

function formatLocLine(opts) {
  if (opts.hideIp) {
    // Privacy: empty loc → chrome shows "Location hidden" (flag on name)
    return "";
  }
  const omitFlag = !!opts.omitFlag;
  const rawCountry = String(opts.country || "").trim();
  const code =
    normalizeFlagCode(opts.flag) ||
    (rawCountry.length === 2 ? normalizeFlagCode(rawCountry) : "");
  const em = flagEmoji(code);
  const lang = opts.lang || "ru";
  let country = rawCountry;
  let city = String(opts.city || "").trim();
  if (!country && code) {
    country = localizeCountry(code, code, lang) || code;
  } else if (country) {
    country = localizeCountry(country, code || opts.flag, lang) || country;
  }
  if (!country && code) country = code;
  if (city) city = localizeCity(city, lang) || city;
  const parts = [];
  if (!omitFlag) {
    if (em) parts.push(em);
    else if (code) parts.push(code);
  }
  if (country) {
    const sameAsCode =
      !!code && country.toUpperCase() === code.toUpperCase();
    if (!sameAsCode || parts.length === 0) {
      parts.push(country.slice(0, 28));
    }
  }
  if (city) parts.push(city.slice(0, 28));
  if (!parts.length) {
    if (!omitFlag) {
      if (em) return em;
      if (code) return code;
    } else if (code) {
      return code;
    }
    if (rawCountry) return rawCountry.slice(0, 28);
    if (city) return city.slice(0, 28);
  }
  return parts.join(" · ");
}

function normalizePeerIdKey(raw) {
  let s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return "";
  if (s.startsWith("fed/")) {
    const parts = s.split("/");
    if (parts.length >= 3) s = parts.slice(2).join("/") || s;
  }
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

// Flag alone → not empty (ISO or emoji + localized country)
// PartnerChrome uses this so chrome never sticks on "Looking up…" when flag ISO known.
const flagOnly = formatLocLine({ flag: "CA", lang: "ru" });
assert.ok(flagOnly.length > 0, "flag-only must not be empty");
assert.ok(
  flagOnly.includes("🇨🇦") || flagOnly.includes("CA") || flagOnly.includes("Канада"),
  `flag-only should show CA/emoji/Канада, got: ${flagOnly}`
);
assert.ok(flagOnly.includes("Канада"), `RU flag-only should localize country: ${flagOnly}`);

// Empty country + flag still beats pending (async partner_geo race)
const flagEmptyCountry = formatLocLine({
  flag: "US",
  country: "",
  city: "",
  lang: "en",
});
assert.ok(flagEmptyCountry.length > 0, "flag + empty country must not be pending");
assert.ok(
  flagEmptyCountry.includes("🇺🇸") ||
    flagEmptyCountry.includes("US") ||
    flagEmptyCountry.toLowerCase().includes("united"),
  `flag-empty-country: ${flagEmptyCountry}`
);

const full = formatLocLine({
  flag: "CA",
  country: "Canada",
  city: "Calgary",
  lang: "ru",
});
assert.ok(full.includes("Канада") || full.includes("Canada"), full);
assert.ok(full.includes("Калгари") || full.includes("Calgary"), full);

assert.equal(formatLocLine({}), "");
assert.ok(
  formatLocLine({ country: "Lithuania", city: "Vilnius", lang: "en" }).includes(
    "Lithuania"
  )
);

// EN keeps English labels
const en = formatLocLine({ flag: "CA", country: "Canada", city: "Calgary", lang: "en" });
assert.ok(en.includes("Canada"), en);
assert.ok(en.includes("Calgary"), en);

// hide_ip: never invent country from cosmetic flag — chrome shows "Location hidden"
assert.equal(
  formatLocLine({ flag: "CA", country: "Canada", city: "Calgary", hideIp: true }),
  "",
  "hide_ip must return empty loc line"
);
assert.equal(formatLocLine({ flag: "US", hideIp: true, lang: "ru" }), "");

// Stage HUD resolve (live.tsx partnerLocDisplay): hide_ip → privacy label, never
// leave empty so stage does not stick on "Looking up location…".
function resolveStageLoc(opts) {
  if (opts.hideIp) return opts.hiddenLabel || "Location hidden";
  return formatLocLine({ ...opts, hideIp: false });
}
assert.equal(
  resolveStageLoc({
    flag: "CA",
    country: "Canada",
    hideIp: true,
    hiddenLabel: "Location hidden",
  }),
  "Location hidden",
  "stage hide_ip must not be Looking up"
);
const stageFlagOnly = resolveStageLoc({ flag: "LT", lang: "ru", hideIp: false });
assert.ok(stageFlagOnly.length > 0, "stage flag-only never empty");
assert.ok(
  stageFlagOnly.includes("🇱🇹") ||
    stageFlagOnly.includes("LT") ||
    stageFlagOnly.includes("Литва"),
  `stage flag-only: ${stageFlagOnly}`
);

// peer id loose match (partner_geo vs matched)
assert.ok(
  peerIdsLooseMatch("abcdef1234567890", "abcdef1234567890"),
  "exact hex"
);
assert.ok(
  peerIdsLooseMatch("abcdef12", "abcdef1234567890deadbeef"),
  "8-char short vs full"
);
assert.ok(
  peerIdsLooseMatch("ABCDEF12-3456", "abcdef123456"),
  "case + dash strip"
);
assert.ok(
  peerIdsLooseMatch(
    "fed/sess-1/abcdef1234567890",
    "abcdef1234567890"
  ),
  "fed prefix strip"
);
assert.ok(
  !peerIdsLooseMatch("aaaaaaaa", "bbbbbbbbcccccccc"),
  "different peers must not match"
);
assert.ok(!peerIdsLooseMatch("", "abcdef12"), "empty never matches");

// Country-as-ISO when flag omitted
const countryIso = formatLocLine({ country: "CA", lang: "ru" });
assert.ok(countryIso.length > 0, "country ISO alone must not be empty");
assert.ok(
  countryIso.includes("🇨🇦") ||
    countryIso.includes("CA") ||
    countryIso.includes("Канада"),
  `country-ISO: ${countryIso}`
);

// City-only still paints
const cityOnly = formatLocLine({ city: "Vilnius", lang: "en" });
assert.ok(cityOnly.includes("Vilnius"), cityOnly);

// Top-strip second line (0.1.341): any geo signal → non-empty loc under name
const stripLoc = formatLocLine({
  flag: "CA",
  country: "Canada",
  city: "Calgary",
  lang: "ru",
});
assert.ok(stripLoc.length > 0, "top strip loc must paint when MatchPeer has geo");
assert.ok(
  stripLoc.includes("🇨🇦") || stripLoc.includes("Канада") || stripLoc.includes("Canada"),
  `stripLoc country: ${stripLoc}`
);
assert.ok(
  stripLoc.includes("Калгари") || stripLoc.includes("Calgary"),
  `stripLoc city: ${stripLoc}`
);
// No geo → empty (dock omits second line; not "Looking up…")
assert.equal(formatLocLine({ flag: "", country: "", city: "" }), "");

// ── omitFlag (2026-08-11 dual-🇨🇦 screenshot fail) ──────────────────────
// Dock + partnerFlagChip: loc must be "Canada · Calgary" without emoji.
const omitFull = formatLocLine({
  flag: "CA",
  country: "Canada",
  city: "Calgary",
  lang: "en",
  omitFlag: true,
});
assert.equal(
  omitFull,
  "Canada · Calgary",
  `omitFlag full geo must be country · city only, got: ${omitFull}`
);
assert.ok(!omitFull.includes("🇨🇦"), `omitFlag must not include emoji: ${omitFull}`);

const omitRu = formatLocLine({
  flag: "CA",
  country: "Canada",
  city: "Calgary",
  lang: "ru",
  omitFlag: true,
});
assert.ok(!omitRu.includes("🇨🇦"), `omitFlag RU no emoji: ${omitRu}`);
assert.ok(
  omitRu.includes("Канада") || omitRu.includes("Canada"),
  `omitFlag RU country: ${omitRu}`
);
assert.ok(
  omitRu.includes("Калгари") || omitRu.includes("Calgary"),
  `omitFlag RU city: ${omitRu}`
);

// Flag-only + omitFlag → localized country, never lone emoji
const omitFlagOnly = formatLocLine({ flag: "CA", lang: "en", omitFlag: true });
assert.ok(omitFlagOnly.length > 0, "omitFlag flag-only not empty");
assert.ok(
  !omitFlagOnly.includes("🇨🇦"),
  `omitFlag flag-only must not be emoji: ${omitFlagOnly}`
);
assert.ok(
  /canada|ca/i.test(omitFlagOnly),
  `omitFlag flag-only country text: ${omitFlagOnly}`
);

// Default (no omitFlag) still prefixes emoji for PartnerChrome / copy paths
const withFlag = formatLocLine({
  flag: "CA",
  country: "Canada",
  city: "Calgary",
  lang: "en",
});
assert.ok(withFlag.includes("🇨🇦"), `default keeps emoji: ${withFlag}`);

console.log("formatLocLine.test.mjs OK");
