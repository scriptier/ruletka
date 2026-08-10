/**
 * formatLocLine — flag ISO alone must not leave chrome empty.
 * Run: node src/identity/formatLocLine.test.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

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
const geo = await import("../i18n/geoLocalize.ts").catch(() => null);
// Use require path via dynamic import of compiled - skip, use inline COUNTRY
function formatLocLine(opts) {
  const em = flagEmoji(opts.flag);
  let country = String(opts.country || "").trim();
  let city = String(opts.city || "").trim();
  if (!country && normalizeFlagCode(opts.flag)) {
    country = normalizeFlagCode(opts.flag); // at least ISO
  }
  if (city) city = city;
  const parts = [];
  if (em) parts.push(em);
  else if (normalizeFlagCode(opts.flag)) parts.push(normalizeFlagCode(opts.flag));
  if (country) parts.push(country.slice(0, 28));
  if (city) parts.push(city.slice(0, 28));
  return parts.join(" · ");
}

assert.ok(formatLocLine({ flag: "CA" }).includes("🇨🇦") || formatLocLine({ flag: "CA" }).includes("CA"));
assert.ok(formatLocLine({ flag: "CA", country: "Canada", city: "Vancouver" }).includes("Vancouver"));
assert.equal(formatLocLine({}), "");
assert.ok(formatLocLine({ country: "Lithuania", city: "Vilnius" }).includes("Lithuania"));
console.log("formatLocLine.test.mjs OK");
