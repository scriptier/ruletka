#!/usr/bin/env node
/**
 * Extra ice=new must connect. First 1v1 PC must never be recreated.
 * Mirrors ui/live.js joinPeers reuse gate (648).
 */
function shouldRecreateExtra(opts) {
  const {
    live,
    iceOk,
    iceSt,
    closed,
    firstKeep,
    offerOnWire,
  } = opts;
  const neverStarted = (iceSt === "new" || iceSt === "") && !offerOnWire;
  return (
    !live &&
    !iceOk &&
    !firstKeep &&
    (closed || neverStarted || iceSt === "failed" || iceSt === "disconnected")
  );
}

const cases = [
  [
    shouldRecreateExtra({
      live: false,
      iceOk: false,
      iceSt: "new",
      closed: false,
      firstKeep: false,
      offerOnWire: false,
    }),
    true,
    "extra ice=new no offer → recreate+connect",
  ],
  [
    shouldRecreateExtra({
      live: false,
      iceOk: false,
      iceSt: "new",
      closed: false,
      firstKeep: true,
      offerOnWire: false,
    }),
    false,
    "1v1 / first partner ice=new → keep (do not tear)",
  ],
  [
    shouldRecreateExtra({
      live: false,
      iceOk: false,
      iceSt: "new",
      closed: false,
      firstKeep: false,
      offerOnWire: true,
    }),
    false,
    "extra offer already on wire → do not recreate",
  ],
  [
    shouldRecreateExtra({
      live: true,
      iceOk: false,
      iceSt: "disconnected",
      closed: false,
      firstKeep: false,
      offerOnWire: false,
    }),
    false,
    "live A/V leftover extra → do not drop",
  ],
  [
    shouldRecreateExtra({
      live: false,
      iceOk: true,
      iceSt: "connected",
      closed: false,
      firstKeep: false,
      offerOnWire: true,
    }),
    false,
    "connected extra → keep",
  ],
];

let fail = 0;
for (const [got, want, name] of cases) {
  if (got !== want) {
    console.error(`FAIL ${name} got=${got} want=${want}`);
    fail += 1;
  }
}
function extraPcShouldOffer(opts) {
  // Hub per-peer is_offerer only at t=0. n>=2 must not force both web extras.
  return !!opts.peerIsOfferer;
}

function extraPcShouldLateOffer(opts) {
  if (opts.peerIsOfferer) return false;
  if (opts.iceOk || opts.hasRemote) return false;
  if (opts.occupancy && opts.iceOk) return false;
  if (opts.yourRole !== "solo" || opts.nPeers < 2) return false;
  return !!opts.lateOk;
}

const offerCases = [
  [
    extraPcShouldOffer({ peerIsOfferer: true, nPeers: 2, role: "solo" }),
    true,
    "hub offerer extra still offers",
  ],
  [
    extraPcShouldOffer({ peerIsOfferer: false, nPeers: 2, role: "solo" }),
    false,
    "hub answerer extra must not offer (laptop↔PC glare)",
  ],
  [
    extraPcShouldOffer({ peerIsOfferer: false, nPeers: 2, role: "party" }),
    false,
    "party extra without hub offerer stays answerer",
  ],
  [
    extraPcShouldLateOffer({
      peerIsOfferer: false,
      yourRole: "solo",
      nPeers: 2,
      lateOk: true,
      iceOk: false,
      hasRemote: false,
    }),
    true,
    "solo late-offers stuck web extra after 0.7s",
  ],
  [
    extraPcShouldLateOffer({
      peerIsOfferer: false,
      yourRole: "solo",
      nPeers: 2,
      lateOk: true,
      iceOk: false,
      hasRemote: true,
    }),
    false,
    "solo does not late-offer if answer already on wire",
  ],
  [
    extraPcShouldLateOffer({
      peerIsOfferer: false,
      yourRole: "solo",
      nPeers: 2,
      lateOk: true,
      iceOk: false,
      hasRemote: false,
      occupancy: true,
    }),
    true,
    "empty occupancy may late-offer (Android on left)",
  ],
  [
    extraPcShouldLateOffer({
      peerIsOfferer: false,
      yourRole: "solo",
      nPeers: 2,
      lateOk: true,
      iceOk: true,
      hasRemote: false,
      occupancy: true,
    }),
    false,
    "live occupancy still not late-offered",
  ],
  [
    extraPcShouldLateOffer({
      peerIsOfferer: false,
      yourRole: "solo",
      nPeers: 2,
      lateOk: true,
      iceOk: false,
      hasRemote: false,
      occupancy: false,
      hubFirst: true,
    }),
    true,
    "hub-first PC extra may still late-offer",
  ],
];
for (const [got, want, name] of offerCases) {
  if (got !== want) {
    console.error(`FAIL ${name} got=${got} want=${want}`);
    fail += 1;
  }
}

function extraStaleCheckingMayLateOffer(opts) {
  if (opts.liveAv) return false;
  if (opts.ice === "checking" && opts.ageMs > 5000) return true;
  if (opts.ice === "checking" && opts.ageMs < 5000) return false;
  return true;
}
if (
  extraStaleCheckingMayLateOffer({ ice: "checking", ageMs: 2000, liveAv: false }) !==
    false ||
  extraStaleCheckingMayLateOffer({ ice: "checking", ageMs: 90000, liveAv: false }) !==
    true ||
  extraStaleCheckingMayLateOffer({ ice: "checking", ageMs: 90000, liveAv: true }) !==
    false
) {
  console.error("FAIL stale checking extra (no AV) must late-offer");
  fail += 1;
}

function extraOffererRetryOk(n) {
  return n < 2;
}
if (extraOffererRetryOk(0) !== true || extraOffererRetryOk(1) !== true) {
  console.error("FAIL extra offerer 2nd kick must be allowed");
  fail += 1;
} else if (extraOffererRetryOk(2) !== false) {
  console.error("FAIL extra offerer cap is 2");
  fail += 1;
}

import { readFileSync } from "node:fs";
const liveJs = readFileSync(new URL("./live.js", import.meta.url), "utf8");
if (liveJs.includes("await new Promise((r) => setTimeout(r, 240))")) {
  console.error("FAIL kickSolo must not block first offer 240ms");
  fail += 1;
}
if (!liveJs.includes("if (!stream && local?.srcObject) stream = local.srcObject")) {
  console.error("FAIL kickSolo must bind #local preview for first offer");
  fail += 1;
}
if (!liveJs.includes("function debateHoldsPartnerListen")) {
  console.error("FAIL debate your-turn must mute partner listen");
  fail += 1;
}
if (!liveJs.includes("debateHoldsPartnerListen()")) {
  console.error("FAIL debate listen mute must apply to every remote tile");
  fail += 1;
}
if (!liveJs.includes('if (n >= 2) {\n      ceiling = "low"')) {
  console.error("FAIL 3-way must cap every outbound link at low");
  fail += 1;
}

if (fail) process.exit(1);
console.log("live-extra-ice.test.mjs: ok");
