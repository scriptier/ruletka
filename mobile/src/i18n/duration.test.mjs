/**
 * Run: node src/i18n/duration.test.mjs
 */
import assert from "node:assert/strict";
import { formatAgoSeconds, formatDurationSeconds } from "./duration.js";

const units = {
  sec: (n) => `${n} с`,
  min: (n) => `${n} мин`,
  hour: (n) => `${n} ч`,
  day: (n) => `${n} д`,
  minSec: (m, s) => `${m} мин ${s} с`,
};

assert.equal(formatAgoSeconds(4, units), "4 с");
assert.equal(formatAgoSeconds(12 * 60, units), "12 мин");
assert.equal(formatAgoSeconds(2 * 3600, units), "2 ч");
assert.equal(formatAgoSeconds(3 * 86400, units), "3 д");
assert.equal(formatDurationSeconds(0, units), "");
assert.equal(formatDurationSeconds(4, units), "4 с");
assert.equal(formatDurationSeconds(12 * 60, units), "12 мин");
assert.equal(formatDurationSeconds(90, units), "1 мин 30 с");

console.log("duration.test.mjs OK");
