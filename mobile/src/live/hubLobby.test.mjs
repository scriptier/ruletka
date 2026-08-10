import assert from "node:assert/strict";

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
  const { wasMatched, prevPrimary, prevSecondary } = opts;
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

console.log("hubLobby.test.mjs ok");
