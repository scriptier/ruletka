/**
 * Guard: Next must not tear PCs before hub accepts (12s settle).
 * Run: node ui/next-stop-roll.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.join(dir, "live.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "live.html"), "utf8");
const hub = fs.readFileSync(
  path.join(dir, "../bridge/src/simple.rs"),
  "utf8"
);
const android = fs.readFileSync(
  path.join(dir, "../mobile/app/live.tsx"),
  "utf8"
);

assert.match(hub, /MATCH_SETTLE_SECS:\s*u64\s*=\s*12/, "hub settle 12s");
assert.match(js, /HUB_MATCH_SETTLE_MS\s*=\s*12000/, "client grace = hub 12s");
assert.match(js, /pendingNextTear/, "tear waits for hub ack");
assert.match(js, /function applyConfirmedNextTear/, "tear helper");
assert.match(js, /next refused — keep live PC/, "refuse keeps PC");

const click = js.match(/on\("btn-next", "click", \(\) => \{[\s\S]*?\n\}\);/);
assert.ok(click, "btn-next click");
assert.doesNotMatch(
  click[0],
  /closeAllPeers/,
  "click must not closeAllPeers before hub ack"
);
assert.match(click[0], /send\(nextPayload\(\)\)/, "click sends next");
assert.match(html, /live\.js\?v=756/, "pin 756");
assert.match(js, /pendingNextTear = true/, "NSFW next waits for hub");
assert.match(
  android,
  /nextGraceUntilRef\.current = Date\.now\(\) \+ 12000/,
  "android grace 12s (disk; no APK this hop)"
);

console.log("next-stop-roll.test.mjs OK");
