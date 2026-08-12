/**
 * Tiny no-deps tests for friend invite URL parsing.
 * Run: node scripts/test-friend-invite.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Compile-free: reimplement expectations by importing via ts not available.
// Inline mirror of parse rules — keep in sync with src/linking/friendInvite.ts

const RESERVED_APP_SEGMENTS = new Set([
  "live",
  "friends",
  "settings",
  "rules",
  "index",
  "home",
  "friend",
  "add",
  "modal",
  "plus",
  "auth",
  "onboarding",
]);

function normalizeFriendCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function isValidFriendCode(code) {
  return /^[A-Z0-9]{4,16}$/.test(normalizeFriendCode(code));
}

function isReservedAppSegment(seg) {
  const s = String(seg || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return !!s && RESERVED_APP_SEGMENTS.has(s);
}

function parseAppRouteUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s || !/^ruletka:/i.test(s)) return null;
  try {
    const normalized = s.replace(/^ruletka:\/\//i, "https://ruletka.app/");
    const u = new URL(normalized);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;
    const seg = parts[0].toLowerCase();
    if (!RESERVED_APP_SEGMENTS.has(seg)) return null;
    if (seg === "friend" || seg === "add" || seg === "modal" || seg === "plus") {
      return null;
    }
    if (seg === "index" || seg === "home") return { pathname: "/" };
    const pathname = `/${seg}`;
    const params = {};
    u.searchParams.forEach((v, k) => {
      if (v != null && v !== "") params[k] = v;
    });
    return Object.keys(params).length ? { pathname, params } : { pathname };
  } catch {
    return null;
  }
}

function parseFriendInviteUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  try {
    if (/^ruletka:/i.test(s)) {
      const normalized = s.replace(/^ruletka:\/\//i, "https://ruletka.app/");
      const u = new URL(normalized);
      const q =
        u.searchParams.get("friend") ||
        u.searchParams.get("code") ||
        u.searchParams.get("c") ||
        "";
      if (q) {
        const c = normalizeFriendCode(q);
        return isValidFriendCode(c) ? c : "";
      }
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && (parts[0] === "friend" || parts[0] === "add")) {
        const c = normalizeFriendCode(parts[1]);
        return isValidFriendCode(c) ? c : "";
      }
      if (parts.length === 1) {
        if (isReservedAppSegment(parts[0])) return "";
        const c = normalizeFriendCode(parts[0]);
        return isValidFriendCode(c) ? c : "";
      }
      return "";
    }
    const u = new URL(s);
    const q = u.searchParams.get("friend") || u.searchParams.get("code") || "";
    if (q) {
      const c = normalizeFriendCode(q);
      return isValidFriendCode(c) ? c : "";
    }
  } catch {
    if (isReservedAppSegment(s)) return "";
    const c = normalizeFriendCode(s);
    if (isValidFriendCode(c)) return c;
  }
  return "";
}

const cases = [
  ["ruletka://friend/AB12CD", "AB12CD"],
  ["ruletka://add?friend=xy99zz", "XY99ZZ"],
  ["ruletka://add?code=hello1", "HELLO1"],
  ["https://ruletka.vip/live.html?friend=CODE99&ref=friend_invite", "CODE99"],
  ["https://ruletka.me/live.html?friend=zz11", "ZZ11"],
  ["https://example.com/", ""],
  ["ruletka://friend/ab", ""], // too short
  ["AB12CD", "AB12CD"],
  // Must NOT treat app routes as friend codes (emu-smoke regression)
  ["ruletka://live", ""],
  ["ruletka://live?autostart=1", ""],
  ["ruletka://LIVE", ""],
  ["ruletka://friends", ""],
  ["ruletka://settings", ""],
  ["ruletka://rules", ""],
  // Bare real codes still work
  ["ruletka://AB12CD", "AB12CD"],
  // Explicit invite still wins even with live host path + query
  ["ruletka://live?friend=CODE99", "CODE99"],
];

let failed = 0;
for (const [input, want] of cases) {
  const got = parseFriendInviteUrl(input);
  try {
    assert.equal(got, want, input);
    console.log("ok", input, "→", got || "(empty)");
  } catch (e) {
    failed++;
    console.error("FAIL", input, "got", got, "want", want);
  }
}

const routeCases = [
  ["ruletka://live", { pathname: "/live" }],
  ["ruletka://live?autostart=1", { pathname: "/live", params: { autostart: "1" } }],
  ["ruletka://settings", { pathname: "/settings" }],
  ["ruletka://friends", { pathname: "/friends" }],
  ["ruletka://friend/AB12CD", null],
  ["ruletka://AB12CD", null],
];

for (const [input, want] of routeCases) {
  const got = parseAppRouteUrl(input);
  try {
    assert.deepEqual(got, want, input);
    console.log("ok route", input, "→", JSON.stringify(got));
  } catch (e) {
    failed++;
    console.error("FAIL route", input, "got", got, "want", want);
  }
}

// Ensure TS source still exports expected names
const require = createRequire(import.meta.url);
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "../src/linking/friendInvite.ts"),
  "utf8"
);
assert.match(src, /export function parseFriendInviteUrl/);
assert.match(src, /export function parseAppRouteUrl/);
assert.match(src, /export function friendInviteShareMessage/);
assert.match(src, /ruletka:\/\/friend/);
assert.match(src, /RESERVED_APP_SEGMENTS/);
assert.match(src, /isReservedAppSegment/);

if (failed) {
  console.error(failed, "failed");
  process.exit(1);
}
console.log("all friend-invite tests passed");
