import assert from "node:assert/strict";
import fs from "node:fs";

// Mirror reduceStatusMsg / reduceLobbyInfoMsg (keep in sync with hubLobby.ts)
function isQueuePhase(phase) {
  return phase === "search" || phase === "waiting";
}

function reduceStatusMsg(m, ctx) {
  const on = Math.max(0, Number(m.online) || 0);
  let wait = Math.max(0, Number(m.waiting_peers) || 0);
  const ph = String(m.phase || "");
  let searching = ctx.searching;
  let queueAcked;
  let alone;
  if (isQueuePhase(ph)) {
    searching = true;
    queueAcked = true;
    wait = Math.max(wait, 1);
    alone = wait <= 1;
  } else if (ph === "idle" && searching) {
    queueAcked = false;
    wait = Math.max(wait, 1);
    alone = true;
  } else if (ctx.phaseRef === "search" || searching) {
    wait = Math.max(wait, 1);
    alone = wait <= 1;
  }
  return {
    searching,
    queueAcked,
    alone,
    online: Math.max(on, searching ? 1 : 0),
    waiting: wait,
  };
}

function reduceLobbyInfoMsg(m, ctx) {
  const on = Math.max(0, Number(m.online) || 0);
  let wait = Math.max(
    0,
    Number(m.waiting_peers != null ? m.waiting_peers : m.room_waiting || 0) ||
      0
  );
  let alone;
  const searching = ctx.searching || ctx.phaseRef === "search";
  if (searching) {
    wait = Math.max(wait, 1);
    alone = wait <= 1;
  }
  return {
    alone,
    online: Math.max(on, searching ? 1 : 0),
    waiting: wait,
  };
}

function pickPrimaryPeerIndex(peerIds, opts) {
  if (!peerIds.length) return 0;
  const { wasMatched, prevPrimary, prevSecondary, keepFirstOnOmit } = opts;
  if (
    wasMatched &&
    prevPrimary &&
    prevPrimary !== "legacy" &&
    peerIds.includes(prevPrimary)
  ) {
    return peerIds.indexOf(prevPrimary);
  }
  if (
    wasMatched &&
    prevSecondary &&
    prevSecondary !== "legacy" &&
    peerIds.includes(prevSecondary)
  ) {
    return peerIds.indexOf(prevSecondary);
  }
  // 3rd-join rematch: hub listed only the new extra — do not remount them as primary.
  if (
    wasMatched &&
    keepFirstOnOmit &&
    prevPrimary &&
    prevPrimary !== "legacy"
  ) {
    return -1;
  }
  return 0;
}

// status waiting alone
{
  const p = reduceStatusMsg(
    { phase: "waiting", online: 2, waiting_peers: 1 },
    { phaseRef: "idle", searching: false }
  );
  assert.equal(p.searching, true);
  assert.equal(p.queueAcked, true);
  assert.equal(p.waiting, 1);
  assert.equal(p.alone, true);
  assert.equal(p.online, 2);
}

// status waiting with 2
{
  const p = reduceStatusMsg(
    { phase: "waiting", online: 3, waiting_peers: 2 },
    { phaseRef: "search", searching: true }
  );
  assert.equal(p.alone, false);
  assert.equal(p.waiting, 2);
}

// idle while searching → keep floor
{
  const p = reduceStatusMsg(
    { phase: "idle", online: 1, waiting_peers: 0 },
    { phaseRef: "search", searching: true }
  );
  assert.equal(p.queueAcked, false);
  assert.equal(p.waiting, 1);
  assert.equal(p.alone, true);
}

// lobby_info while searching floors
{
  const p = reduceLobbyInfoMsg(
    { online: 5, waiting_peers: 0 },
    { phaseRef: "search", searching: true }
  );
  assert.equal(p.waiting, 1);
  assert.equal(p.online, 5);
}

// prefer prev secondary as primary
{
  const i = pickPrimaryPeerIndex(["a", "b", "c"], {
    wasMatched: true,
    prevPrimary: "gone",
    prevSecondary: "b",
  });
  assert.equal(i, 1);
}

// keepFirstOnOmit: fresh 1v1 (wasMatched false) still 0 even if prev omitted
{
  const i = pickPrimaryPeerIndex(["laptop"], {
    wasMatched: false,
    prevPrimary: "courtier-pc",
    keepFirstOnOmit: true,
  });
  assert.equal(i, 0);
}

// keepFirstOnOmit: wasMatched + prevPrimary omitted from list → -1
{
  const i = pickPrimaryPeerIndex(["laptop"], {
    wasMatched: true,
    prevPrimary: "courtier-pc",
    keepFirstOnOmit: true,
  });
  assert.equal(i, -1);
}

// status: malformed/negative fields never leak NaN or negative counts
{
  const p = reduceStatusMsg(
    { phase: "idle", online: "not-a-number", waiting_peers: -5 },
    { phaseRef: "idle", searching: false }
  );
  assert.equal(Number.isNaN(p.online), false);
  assert.equal(p.online, 0);
  assert.equal(p.waiting, 0);
}

// lobby_info: malformed/negative fields never leak NaN or negative counts
{
  const p = reduceLobbyInfoMsg(
    { online: NaN, waiting_peers: -2 },
    { phaseRef: "idle", searching: false }
  );
  assert.equal(Number.isNaN(p.online), false);
  assert.equal(p.online, 0);
  assert.equal(p.waiting, 0);
}

function isHubPartnerLeaveDetail(detail) {
  const d = String(detail || "");
  if (/still chatting|still with match|still connected/i.test(d)) {
    return false;
  }
  return /partner hit Next|partner disconnected|partner stopped|party moved on|partner blocked you|restricted due to reports|restricted by operator|party partner left/i.test(
    d
  );
}

{
  assert.equal(isHubPartnerLeaveDetail("partner stopped"), true);
  assert.equal(isHubPartnerLeaveDetail("partner disconnected — searching again"), true);
  assert.equal(isHubPartnerLeaveDetail("partner hit Next — searching again"), true);
  assert.equal(isHubPartnerLeaveDetail("partner left — still chatting"), false);
  assert.equal(isHubPartnerLeaveDetail("still connected"), false);
  assert.equal(isHubPartnerLeaveDetail(""), false);
  const src = fs.readFileSync(new URL("./hubLobby.ts", import.meta.url), "utf8");
  assert.ok(
    src.includes("export function isHubPartnerLeaveDetail"),
    "hubLobby.ts must export isHubPartnerLeaveDetail (PC Stop → Android Next)"
  );
  assert.ok(src.includes("partner stopped"), "must match hub Stop detail");
}

console.log("hubLobby.test.mjs ok");
