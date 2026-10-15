#!/usr/bin/env node
/**
 * Debate hub chat fallback: compact body ≤500 chars, parse round-trip.
 */
const DEBATE_HUB_PREFIX = "__debate:";

function encodeDebateHubBody(obj) {
  if (!obj || typeof obj !== "object") return "";
  const slim = {};
  const keys = [
    "type",
    "invite_id",
    "host_id",
    "speakers",
    "turn_ms",
    "topic",
    "user_id",
  ];
  for (const k of keys) {
    const v = obj[k];
    if (v == null || v === "") continue;
    slim[k] = v;
  }
  const pack = () => DEBATE_HUB_PREFIX + JSON.stringify(slim);
  let s = pack();
  if (s.length > 480 && slim.topic) {
    delete slim.topic;
    s = pack();
  }
  if (s.length > 480 && slim.speakers) {
    delete slim.speakers;
    s = pack();
  }
  return s.length <= 500 ? s : "";
}

function parseDebateHubBody(body) {
  const raw = String(body || "");
  const prefixes = ["\x01debate:", "__debate:", "debate:"];
  let json = "";
  for (const p of prefixes) {
    if (raw.startsWith(p)) {
      json = raw.slice(p.length);
      break;
    }
  }
  if (!json) return null;
  const obj = JSON.parse(json);
  if (!String(obj.type || "").startsWith("debate_")) return null;
  return obj;
}

const invite = encodeDebateHubBody({
  type: "debate_invite",
  invite_id: "d-test-1",
  turn_ms: 30000,
  topic: "hello",
  from_name: "Laptop",
  user_id: "abc",
  speakers: ["a", "b", "c"],
});
const parsed = parseDebateHubBody(invite);
const longTopic = encodeDebateHubBody({
  type: "debate_invite",
  invite_id: "d-test-2",
  topic: "x".repeat(600),
  speakers: ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc"],
});

const leak = parseDebateHubBody(
  'debate:{"type":"debate_start","invite_id":"d-msz50fil-ee8ed1","turn_ms":30000}'
);
const cases = [
  [invite.startsWith("__debate:"), "ascii prefix"],
  [invite.length <= 500, "invite fits hub cap"],
  [parsed?.type === "debate_invite", "parse type"],
  [parsed?.invite_id === "d-test-1", "parse id"],
  [parseDebateHubBody("hi") === null, "plain chat ignored"],
  [leak?.type === "debate_start", "stripped SOH debate: still parses"],
  [longTopic === "" || longTopic.length <= 500, "long topic trimmed or dropped"],
];

let fail = 0;
for (const [ok, name] of cases) {
  if (!ok) {
    console.error(`FAIL ${name}`);
    fail += 1;
  }
}
if (fail) process.exit(1);
console.log("debate-hub.test.mjs: ok");
