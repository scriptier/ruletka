/**
 * Guard: admin pages keep Caddy Basic + X-Admin-Token; no Bearer; no leftover ?token=.
 * Run: node ui/admin-page.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const admin = fs.readFileSync(path.join(dir, "admin.html"), "utf8");
const connect = fs.readFileSync(path.join(dir, "admin-connect.html"), "utf8");

for (const [name, src] of [
  ["admin.html", admin],
  ["admin-connect.html", connect],
]) {
  const hdr = src.match(/function headers\(\) \{[\s\S]*?\n    \}/);
  assert.ok(hdr, name + " headers()");
  assert.doesNotMatch(
    hdr[0],
    /["']Bearer /,
    name + " headers() must not set Bearer (overwrites Caddy Basic)"
  );
  assert.match(hdr[0], /X-Admin-Token/, name + " sends X-Admin-Token");
  assert.match(src, /credentials:\s*["']same-origin["']/, name + " sends Basic cookies");
  assert.match(src, /replaceState/, name + " strips ?token= from the URL");
}

assert.match(admin, /id="grant-preview"/, "grant preview");
assert.match(admin, /class="jump-nav"/, "sticky jump nav");
assert.match(admin, /id="find-user"/, "find user");
assert.match(admin, /function findIdentity/, "in-page identity index");
assert.match(admin, /describePerson/, "ban/grant confirm uses name");
assert.match(admin, /href="\/admin-connect.html"/, "link to connect monitor");
assert.match(connect, /Token cleared — poll stopped/, "Forget stops poll");

console.log("admin-page.test.mjs OK");
