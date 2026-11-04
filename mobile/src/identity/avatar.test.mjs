import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "avatar.ts"),
  "utf8"
);

assert.match(src, /export const MAX_AVATAR_CHARS\s*=\s*48000/);
assert.match(src, /export function isValidAvatarDataUrl/);

// avatar.ts imports expo-image-manipulator (RN-only), so it can't be
// required directly under plain node — mirror the pure contract instead.
const MAX_AVATAR_CHARS = 48000;

function isValidAvatarDataUrl(s) {
  if (!s || typeof s !== "string") return false;
  if (s.length > MAX_AVATAR_CHARS) return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s);
}

const smallB64 = "A".repeat(40000);

assert.equal(isValidAvatarDataUrl(`data:image/jpeg;base64,${smallB64}`), true);
assert.equal(isValidAvatarDataUrl(`data:image/png;base64,${smallB64}`), true);
assert.equal(isValidAvatarDataUrl(`data:image/webp;base64,${smallB64}`), true);
assert.equal(isValidAvatarDataUrl(""), false);
assert.equal(isValidAvatarDataUrl("not-a-data-url"), false);
assert.equal(isValidAvatarDataUrl("data:text/plain;base64,AAAA"), false);
assert.equal(
  isValidAvatarDataUrl(`data:image/jpeg;base64,${"A".repeat(60000)}`),
  false
);
assert.equal(isValidAvatarDataUrl(null), false);
assert.equal(isValidAvatarDataUrl(undefined), false);

console.log("avatar.test.mjs OK");
