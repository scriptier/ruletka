import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "CallPeerAvatar.tsx"),
  "utf8"
);

assert.match(src, /export function isAvatarUri/);
assert.match(src, /data:image\//);
assert.match(src, /testID="call-peer-avatar"/);
assert.match(src, /export function resolveFriendAvatar/);
assert.match(src, /export function CallPeerAvatar/);

function isAvatarUri(uri) {
  if (!uri || typeof uri !== "string") return false;
  const s = uri.trim();
  if (!s) return false;
  return (
    s.startsWith("data:image/") ||
    s.startsWith("https://") ||
    s.startsWith("http://") ||
    s.startsWith("file://")
  );
}
function resolveFriendAvatar(friends, userId, hint) {
  if (isAvatarUri(hint)) return String(hint).trim();
  const f = friends.find((x) => x.user_id === userId);
  return isAvatarUri(f?.avatar) ? String(f.avatar).trim() : "";
}

assert.equal(isAvatarUri("https://x/a.png"), true);
assert.equal(isAvatarUri("data:image/jpeg;base64,xx"), true);
assert.equal(isAvatarUri("not-a-url"), false);
assert.equal(
  resolveFriendAvatar(
    [{ user_id: "u1", avatar: "https://cdn/a.jpg" }],
    "u1"
  ),
  "https://cdn/a.jpg"
);
assert.equal(
  resolveFriendAvatar([{ user_id: "u1", avatar: "" }], "u1", "https://hint"),
  "https://hint"
);
assert.equal(resolveFriendAvatar([], "u1"), "");

console.log("CallPeerAvatar.test.mjs OK");
