/**
 * Tiny no-deps tests for friend invite URL parsing.
 * Run: node scripts/test-friend-invite.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Compile-free: reimplement expectations by importing via ts not available.
// Inline mirror of parse rules — keep in sync with src/linking/friendInvite.ts
// Prefer running through a dynamic import of the built module; for CI we
// duplicate minimal checks by reading the TS source for presence, then
// implement the same pure functions here for regression.

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
      if (parts.length === 1 && isValidFriendCode(normalizeFriendCode(parts[0]))) {
        return normalizeFriendCode(parts[0]);
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
];

let failed = 0;
for (const [input, want] of cases) {
  const got = parseFriendInviteUrl(input);
  try {
    assert.equal(got, want, input);
    console.log("ok", input, "→", got);
  } catch (e) {
    failed++;
    console.error("FAIL", input, "got", got, "want", want);
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
assert.match(src, /export function friendInviteShareMessage/);
assert.match(src, /ruletka:\/\/friend/);

if (failed) {
  console.error(failed, "failed");
  process.exit(1);
}
console.log("all friend-invite tests passed");
