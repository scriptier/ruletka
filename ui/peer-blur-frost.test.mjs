/**
 * Guard: Blur them must play frost-vid (Hide path), never overlay a canvas
 * on the live WebRTC <video> (Chrome HW punch-through = sharp partner).
 * Run: node ui/peer-blur-frost.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.join(dir, "live.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "live.html"), "utf8");
const css = fs.readFileSync(path.join(dir, "live-stage.css"), "utf8");

const start = js.match(/function startPeerBlurCanvas\([^)]*\) \{[\s\S]*?\n\}/);
assert.ok(start, "startPeerBlurCanvas missing");
// Frost binding moved into getPeerFrostStream() (binds only after a real draw).
const frostStream = js.match(/function getPeerFrostStream\([^)]*\) \{[\s\S]*?\n\}/);
assert.ok(
  /bindFrostVideo/.test(start[0]) ||
    (/getPeerFrostStream\(/.test(start[0]) && frostStream && /bindFrostVideo/.test(frostStream[0])),
  "Blur them must bind frost-vid (directly or via getPeerFrostStream)"
);
assert.doesNotMatch(
  start[0],
  /mountPeerFrostPaint/,
  "must not put sample canvas over #remote"
);
assert.match(js, /function detachPeerFrostPaint/, "detach leftover canvas overlay");
assert.match(js, /function frostVidId/, "frostVidId helper");

assert.match(html, /id="remote-frost"/, "live.html has #remote-frost");
assert.match(html, /live\.js\?v=\d+/, "live.html pins live.js?v=N");
assert.match(html, /live-stage\.css\?v=\d+/, "live.html pins live-stage.css?v=N");
assert.match(js, /function wireSelfBlurTapToReveal/, "tap local tile reveals Hide");

assert.match(
  css,
  /#tile-remote\.(?:partner|peer-slot)-blurred(?::has\()? ?#remote-frost\.is-on/,
  "CSS shows frost-vid when blurred"
);
assert.match(
  css,
  /#tile-remote\.(?:partner|peer-slot)-blurred[^{]*#remote/,
  "partner-blurred targets #remote"
);
assert.match(
  css,
  /#tile-remote\.has-remote-feed\.(?:partner|peer-slot)-blurred[^{]*#remote[\s\S]{0,800}?visibility:\s*hidden/,
  "blurred #remote must not paint (HW punch-through)"
);

console.log("peer-blur-frost.test.mjs OK");
