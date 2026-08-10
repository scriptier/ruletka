/**
 * Regression test for hub geo (English) → RU localization on mobile.
 * Transpiles src/i18n/geoLocalize.ts on the fly (no ts-node dep) so the
 * test exercises the real implementation, not a mirror.
 * Run: node scripts/test-geo-localize.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, "..", "src", "i18n", "geoLocalize.ts");
const src = fs.readFileSync(srcPath, "utf8");
const { outputText } = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
  },
});

const mod = { exports: {} };
new Function("exports", "module", "require", outputText)(
  mod.exports,
  mod,
  require
);
const { localizeCountry, localizeCity } = mod.exports;

assert.equal(localizeCountry("Canada", "CA", "ru"), "Канада");
assert.equal(localizeCity("Calgary", "ru"), "Калгари");
assert.equal(localizeCountry("CA", "CA", "ru"), "Канада");
assert.equal(localizeCity("Unknownville", "ru"), "Unknownville");

assert.equal(localizeCountry("Canada", "CA", "en"), "Canada");
assert.equal(localizeCity("Calgary", "en"), "Calgary");

// Expanded map (035)
assert.equal(localizeCity("Chelyabinsk", "ru"), "Челябинск");
assert.equal(localizeCity("Krakow", "ru"), "Краков");
assert.equal(localizeCity("Buenos Aires", "ru"), "Буэнос-Айрес");
assert.equal(localizeCity("Vilnius", "ru"), "Вильнюс");
assert.equal(localizeCity("San Diego", "ru"), "Сан-Диего");

console.log("mobile geoLocalize: all tests passed");
