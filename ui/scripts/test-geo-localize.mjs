/**
 * Regression test for hub geo (English) → RU localization on the web UI.
 * Run: node ui/scripts/test-geo-localize.mjs
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(__dirname, "..", "geoLocalize.js");

let lang = "ru";
globalThis.localStorage = { getItem: () => lang };
await import(pathToFileURL(modulePath).href);
const { RuletGeo } = globalThis;

lang = "ru";
assert.equal(RuletGeo.localizeCountry("Canada", "CA"), "Канада");
assert.equal(RuletGeo.localizeCity("Calgary"), "Калгари");
assert.equal(RuletGeo.localizeCountry("CA", "CA"), "Канада");
assert.equal(RuletGeo.localizeCity("Unknownville"), "Unknownville");

lang = "en";
assert.equal(RuletGeo.localizeCountry("Canada", "CA"), "Canada");
assert.equal(RuletGeo.localizeCity("Calgary"), "Calgary");

console.log("ui geoLocalize: all tests passed");
