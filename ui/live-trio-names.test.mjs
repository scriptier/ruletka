#!/usr/bin/env node
/**
 * 3-way tile names: left = first conversationalist, mid = 3rd.
 * Mirrors extraSlotDisplayName + pickExtraRemotePeer rules.
 * 1v1 (one remote) must not invent a mid name.
 */
function extraSlotDisplayName(rawName, mainName) {
  const main = String(mainName || "").trim();
  const s = String(rawName || "").trim();
  if (
    s &&
    !/^[0-9a-f]{6,12}$/i.test(s) &&
    !/^partner$/i.test(s) &&
    (!main || s.toLowerCase() !== main.toLowerCase())
  ) {
    return s.slice(0, 32);
  }
  return "Partner";
}

function pickExtraRemotePeer(people, firstId) {
  const remotes = (people || []).filter((p) => p && p.peer_id && p.peer_id !== "legacy");
  if (remotes.length < 2) return null;
  return remotes.find((p) => p.peer_id !== firstId) || null;
}

const cases = [
  [
    extraSlotDisplayName("Laptop", "Courtier") === "Laptop",
    "mid gets Laptop when left is Courtier",
  ],
  [
    extraSlotDisplayName("1bae2285", "Courtier") === "Partner",
    "hex addIds must not paint mid",
  ],
  [
    extraSlotDisplayName("Laptop", "Laptop") === "Partner",
    "stolen latch must not hide Laptop as mid (caller must pass Courtier as main)",
  ],
  [
    pickExtraRemotePeer(
      [
        { peer_id: "a", name: "Courtier" },
        { peer_id: "b", name: "Laptop" },
      ],
      "a"
    )?.name === "Laptop",
    "extra is Laptop not Courtier",
  ],
  [
    pickExtraRemotePeer([{ peer_id: "a", name: "Courtier" }], "a") === null,
    "1v1 has no extra",
  ],
];

/** Mirrors ui/live.js shouldStackSplitRemote */
function shouldStackSplitRemote(opponentCount, trioOn) {
  if (trioOn) return false;
  return Number(opponentCount) >= 3;
}

/** lastMatchMeta is the primary person — roster must read lastMatchedPeers. */
function liveDebateRosterFrom(state) {
  const ids = [];
  const add = (id) => {
    const s = String(id || "").trim();
    if (!s || ids.includes(s)) return;
    ids.push(s);
  };
  add(state.myUserId);
  add(state.primaryPartnerUserId);
  const peers = Array.isArray(state.lastMatchedPeers)
    ? state.lastMatchedPeers
    : Array.isArray(state.lastMatchMeta?.peers)
      ? state.lastMatchMeta.peers
      : [];
  for (const p of peers) add(p.user_id);
  return ids;
}

cases.push(
  [
    shouldStackSplitRemote(2, false) === false,
    "3-way (2 remotes) must not stack Party of 2",
  ],
  [
    shouldStackSplitRemote(3, false) === true,
    "4-way (3 remotes) may stack remote2",
  ],
  [
    shouldStackSplitRemote(3, true) === false,
    "trio layout never stacks",
  ],
  [
    liveDebateRosterFrom({
      myUserId: "me",
      primaryPartnerUserId: "pc",
      lastMatchMeta: { user_id: "pc", name: "Courtier" },
      lastMatchedPeers: [
        { user_id: "pc", name: "Courtier" },
        { user_id: "phone", name: "Dragonov" },
      ],
    }).join(",") === "me,pc,phone",
    "debate roster includes both party members not only lastMatchMeta",
  ]
);

let fail = 0;
for (const [ok, name] of cases) {
  if (!ok) {
    console.error(`FAIL ${name}`);
    fail += 1;
  }
}
if (fail) process.exit(1);
console.log("live-trio-names.test.mjs: ok");
