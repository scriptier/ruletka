/**
 * Unit tests for ordered relay-only ICE retry ladder helpers in webrtc.js.
 * Run: nice node --test ui/*.test.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "webrtc.js"), "utf8");

function extractFn(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing function ${name}`);
  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
  }
  throw new Error(`unclosed function ${name}`);
}

const RELAY_RETRY_RUNGS = ["all_relays", "turns_443", "turn_udp"];
const fnSrc =
  'const RELAY_RETRY_RUNGS = ["all_relays", "turns_443", "turn_udp"];\n' +
  extractFn("classifyIcePathLabel") +
  "\n" +
  extractFn("filterIceServersForRung") +
  "\n" +
  extractFn("nextRelayRetryRung") +
  "\n";

const {
  classifyIcePathLabel,
  filterIceServersForRung,
  nextRelayRetryRung,
} = new Function(
  `${fnSrc}; return { classifyIcePathLabel, filterIceServersForRung, nextRelayRetryRung };`
)();

const sample = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "turns:ruletka.vip:443?transport=tcp", username: "u", credential: "c" },
  { urls: "turns:ruletka.vip:5349?transport=tcp", username: "u", credential: "c" },
  { urls: "turn:ruletka.vip:3478", username: "u", credential: "c" },
  { urls: "turn:ruletka.vip:443?transport=udp", username: "u", credential: "c" },
  { urls: "turn:ruletka.vip:3478?transport=tcp", username: "u", credential: "c" },
];

test("rung order is fixed", () => {
  assert.deepEqual(RELAY_RETRY_RUNGS, ["all_relays", "turns_443", "turn_udp"]);
  assert.equal(nextRelayRetryRung(null), "all_relays");
  assert.equal(nextRelayRetryRung("all_relays"), "turns_443");
  assert.equal(nextRelayRetryRung("turns_443"), "turn_udp");
  assert.equal(nextRelayRetryRung("turn_udp"), null);
});

test("all_relays drops stun keeps turn+turns", () => {
  const out = filterIceServersForRung(sample, "all_relays");
  assert.equal(out.length, 5);
  assert.ok(out.every((s) => /turn/i.test(String(s.urls))));
});

test("turns_443 keeps only turns on 443", () => {
  const out = filterIceServersForRung(sample, "turns_443");
  assert.equal(out.length, 1);
  assert.match(String(out[0].urls), /turns:ruletka\.vip:443/);
});

test("turn_udp keeps udp 3478 and udp 443", () => {
  const out = filterIceServersForRung(sample, "turn_udp");
  const urls = out.map((s) => String(s.urls));
  assert.ok(urls.some((u) => u.includes(":3478") && !u.includes("tcp")));
  assert.ok(urls.some((u) => u.includes(":443") && u.includes("udp")));
  assert.ok(!urls.some((u) => u.startsWith("turns:")));
  assert.ok(!urls.some((u) => u.includes("transport=tcp")));
});

test("classifyIcePathLabel", () => {
  assert.equal(classifyIcePathLabel("host", "udp", ""), "host");
  assert.equal(classifyIcePathLabel("relay", "udp", "turn:x:3478"), "relay_udp");
  assert.equal(
    classifyIcePathLabel("relay", "tcp", "turn:x:3478?transport=tcp"),
    "relay_tcp"
  );
  assert.equal(
    classifyIcePathLabel("relay", "udp", "turns:x:443?transport=tcp"),
    "relay_tls"
  );
});

test("source exports ladder helpers on window", () => {
  assert.match(src, /window\.filterIceServersForRung/);
  assert.match(src, /window\.nextRelayRetryRung/);
  assert.match(src, /window\.getIcePathDetail/);
  assert.match(src, /RELAY_LADDER_BUDGET_MS/);
});
