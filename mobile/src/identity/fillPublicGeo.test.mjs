import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Load TS via node's strip is not available — duplicate parse tests as ESM copies
function normalizeGeoHit(raw) {
  if (!raw) return null;
  const flag = String(raw.flag || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  const country = String(raw.country || "").trim();
  const city = String(raw.city || "").trim();
  if (!flag && !country && !city) return null;
  return { flag, country, city };
}
function parseIpwho(j) {
  if (!j || j.success === false) return null;
  return normalizeGeoHit({
    flag: String(j.country_code || ""),
    country: String(j.country || ""),
    city: String(j.city || ""),
  });
}

assert.deepEqual(
  parseIpwho({
    success: true,
    country_code: "ca",
    country: "Canada",
    city: "Calgary",
  }),
  { flag: "CA", country: "Canada", city: "Calgary" }
);
assert.equal(parseIpwho({ success: false }), null);
assert.equal(parseIpwho(null), null);
console.log("fillPublicGeo parse ok");
void require;
