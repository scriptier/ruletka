#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * 1v1 / hunt must never open a 3rd tile.
 * Mid tile only when a 2nd *unique* remote PC exists (3rd found).
 * ice=new counts. Dual-key of the same 1v1 PC (n=1) must stay duo.
 * Mirrors ui/live.js thirdSlotShouldShowFromPeerCount.
 */
function thirdSlotShouldShowFromPeerCount(n) {
  return Number(n) >= 2;
}

const cases = [
  [0, false, "idle"],
  [1, false, "1v1"],
  [1, false, "hunt looking for 3rd (still 1 unique PC)"],
  [2, true, "3rd found (2nd PC exists, ice=new ok)"],
  [3, true, "4-way"],
];
let fail = 0;
for (const [n, want, name] of cases) {
  const got = thirdSlotShouldShowFromPeerCount(n);
  if (got !== want) {
    console.error(`FAIL ${name} n=${n} got=${got} want=${want}`);
    fail += 1;
  }
}
if (fail) process.exit(1);

/**
 * Mirrors ui/live.js routeInboundNoCamSlot / shouldRehomePrimaryNoCam.
 * Laptop no_cam must not steal #remote when extras exist.
 */
function noCamSlotIdMatch(a, b) {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  if (!x || !y || x === "legacy" || y === "legacy") return false;
  return x === y;
}

function routeInboundNoCamSlot(opts) {
  const from = String(opts?.fromUid || "").trim();
  const extras = Math.max(0, Math.floor(Number(opts?.extrasCount) || 0));
  const primary = String(opts?.primaryUid || "").trim();
  const extra0 = String(opts?.extra0Uid || "").trim();
  const extra1 = String(opts?.extra1Uid || "").trim();
  if (from && extra0 && noCamSlotIdMatch(from, extra0)) return "extra0";
  if (from && extra1 && noCamSlotIdMatch(from, extra1)) return "extra1";
  if (from && primary && noCamSlotIdMatch(from, primary)) return "primary";
  if (extras >= 1) return "extra0";
  return "primary";
}

function shouldRehomePrimaryNoCam(opts) {
  const extras = Math.max(0, Math.floor(Number(opts?.extrasCount) || 0));
  return extras >= 1 && (!!opts?.partnerNoCam || !!opts?.partnerCamHidden);
}

function extraSlotDisplayName(rawName, opts = {}) {
  const s = String(rawName || "").trim();
  const remoteLbl = String(opts.remoteLbl || "").trim();
  const main = String(opts.mainName || remoteLbl || "").trim();
  const real = !!(s && s.length >= 2 && !/^[0-9a-f]{6,}$/i.test(s) && s !== "Partner");
  if (real) {
    if (!main || s.toLowerCase() !== main.toLowerCase()) return s.slice(0, 32);
    if (remoteLbl && remoteLbl.toLowerCase() !== s.toLowerCase()) return s.slice(0, 32);
  }
  return "Partner";
}
{
  // Laptop 3rd: #remote is Courtier; extra tile must keep Dragonov, not Partner.
  const mid = extraSlotDisplayName("Dragonov", {
    mainName: "Dragonov",
    remoteLbl: "Courtier",
  });
  if (mid !== "Dragonov") {
    console.error("FAIL extra name stays Dragonov when #remote painted Courtier");
    fail += 1;
  }
}

function whichForNoCamSlot(slot) {
  if (slot === "extra1") return "remote2";
  if (slot === "extra0") return "remote-third";
  return "remote";
}

const noCamCases = [
  [
    { extrasCount: 0, fromUid: "", primaryUid: "drag" },
    "primary",
    "1v1 anonymous no_cam stays on #remote",
  ],
  [
    {
      extrasCount: 1,
      fromUid: "",
      primaryUid: "drag",
      extra0Uid: "laptop",
    },
    "extra0",
    "anonymous no_cam with extras is laptop, not Dragonov",
  ],
  [
    {
      extrasCount: 1,
      fromUid: "laptop",
      primaryUid: "drag",
      extra0Uid: "laptop",
    },
    "extra0",
    "laptop uid paints extra/third only",
  ],
  [
    {
      extrasCount: 1,
      fromUid: "drag",
      primaryUid: "drag",
      extra0Uid: "laptop",
    },
    "primary",
    "primary uid may paint #remote (setNoCamPortrait still bails on pictures)",
  ],
  [
    {
      extrasCount: 1,
      fromUid: "laptop",
      primaryUid: "",
      extra0Uid: "",
    },
    "extra0",
    "extras≥1 + empty primary/extra ids still extra (not tile 1)",
  ],
];

for (const [opts, want, name] of noCamCases) {
  const got = routeInboundNoCamSlot(opts);
  if (got !== want) {
    console.error(`FAIL ${name} got=${got} want=${want}`);
    fail += 1;
  }
  const which = whichForNoCamSlot(got);
  if (want === "extra0" && which !== "remote-third") {
    console.error(`FAIL ${name} which=${which} want=remote-third`);
    fail += 1;
  }
}

if (shouldRehomePrimaryNoCam({ extrasCount: 1, partnerNoCam: true }) !== true) {
  console.error("FAIL rehome 3rd listed + stale primary no_cam");
  fail += 1;
}
if (shouldRehomePrimaryNoCam({ extrasCount: 0, partnerNoCam: true }) !== false) {
  console.error("FAIL rehome 1v1 keeps primary no_cam");
  fail += 1;
}
if (shouldRehomePrimaryNoCam({ extrasCount: 1, partnerNoCam: false }) !== false) {
  console.error("FAIL rehome no stale flag");
  fail += 1;
}
if (
  shouldRehomePrimaryNoCam({ extrasCount: 1, partnerCamHidden: true }) !== true
) {
  console.error("FAIL rehome laptop self_hide leftover");
  fail += 1;
}

function shouldReofferFailedMeshExtra(opts) {
  const o = opts || {};
  if (!o.matched) return false;
  if (o.selfLive && (o.isFirstPartner || o.isRtc || o.tileId === "remote")) {
    return false;
  }
  const id = String(o.peerId || "").trim();
  if (!id || id === "legacy") return false;
  if (!o.listed) return false;
  if (o.alreadyTried) return false;
  if (!o.otherLive && !(Number(o.meshCount) >= 2)) return false;
  return true;
}
{
  const base = {
    matched: true,
    isFirstPartner: false,
    isRtc: false,
    tileId: "remote-third",
    peerId: "31c76917-and",
    listed: true,
    alreadyTried: false,
    otherLive: true,
    selfLive: false,
    meshCount: 2,
  };
  if (shouldReofferFailedMeshExtra(base) !== true) {
    console.error("FAIL reoffer listed extra with live other");
    fail += 1;
  }
  if (
    shouldReofferFailedMeshExtra({
      ...base,
      isFirstPartner: true,
      selfLive: true,
    }) !== false
  ) {
    console.error("FAIL reoffer must not touch live first partner");
    fail += 1;
  }
  if (
    shouldReofferFailedMeshExtra({
      ...base,
      tileId: "remote",
      selfLive: true,
    }) !== false
  ) {
    console.error("FAIL reoffer must not rebuild live #remote");
    fail += 1;
  }
  if (
    shouldReofferFailedMeshExtra({
      ...base,
      tileId: "remote",
      selfLive: false,
    }) !== true
  ) {
    console.error("FAIL reoffer must rebuild dead #remote on laptop 3rd");
    fail += 1;
  }
  if (shouldReofferFailedMeshExtra({ ...base, alreadyTried: true }) !== false) {
    console.error("FAIL reoffer once only");
    fail += 1;
  }
  if (shouldReofferFailedMeshExtra({ ...base, listed: false, meshCount: 2 }) !== false) {
    console.error("FAIL reoffer requires listed extra");
    fail += 1;
  }
  if (
    shouldReofferFailedMeshExtra({
      ...base,
      otherLive: false,
      meshCount: 2,
    }) !== true
  ) {
    console.error("FAIL reoffer allowed from remembered 1v2");
    fail += 1;
  }
}

function mergeMissingMeshPeers(listed, remembered, hasPc) {
  const out = [];
  const seen = new Set();
  const add = (p) => {
    const id = String(p?.peer_id || "").trim();
    if (!id || id === "legacy" || seen.has(id)) return;
    seen.add(id);
    out.push(p);
  };
  for (const p of listed || []) add(p);
  const rem = Array.isArray(remembered) ? remembered : [];
  if (rem.length < 2) return out;
  for (const p of rem) {
    const id = String(p?.peer_id || "").trim();
    if (!id || id === "legacy" || seen.has(id)) continue;
    if (typeof hasPc === "function" && hasPc(id)) continue;
    add(p);
  }
  return out;
}

const pcPeer = {
  peer_id: "27d2e4ab-pc",
  role: "party",
  is_offerer: false,
};
const andPeer = {
  peer_id: "31c76917-and",
  role: "party",
  is_offerer: true,
};
const mesh2 = [pcPeer, andPeer];
{
  const got = mergeMissingMeshPeers([pcPeer], mesh2, (id) =>
    id.startsWith("27d2e4ab")
  );
  if (got.length !== 2 || got[1].peer_id !== andPeer.peer_id) {
    console.error("FAIL merge 1v1 rematch re-adds Android extra");
    fail += 1;
  }
  const already = mergeMissingMeshPeers([pcPeer], mesh2, () => true);
  if (already.length !== 1) {
    console.error("FAIL merge does not re-add extra that already has a PC");
    fail += 1;
  }
  const fresh = mergeMissingMeshPeers([pcPeer], [], () => false);
  if (fresh.length !== 1) {
    console.error("FAIL merge no-ops without remembered 1v2");
    fail += 1;
  }
}

const liveSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "live.js"),
  "utf8"
);
const mustHave = [
  ["function routeInboundNoCamSlot", "must route inbound no_cam by slot"],
  ["function shouldRehomePrimaryNoCam", "must rehome stale primary no_cam"],
  ["function remoteTileHasPictures", "must bail setNoCamPortrait on pictures"],
  ["function resolveInboundNoCamWhich", "must map laptop no_cam to extra tile"],
  ["function mergeMissingMeshPeers", "must re-join omitted 1v2 extra"],
  ["function rememberMeshPeers", "must stamp last 1v2 listing"],
  ["function shouldReofferFailedMeshExtra", "must gate one-shot extra re-offer"],
  ["function reofferFailedMeshExtraOnce", "must re-offer failed listed extra"],
  ["function meshPeerHasLivePc", "must treat failed extra as missing"],
  ["function closeDeadListedMeshPcs", "must close dead extras before join"],
  ["function ensureMissingMeshPeers", "must join missing mesh extras"],
  ["function armMeshEnsureTimer", "must poll missing mesh while trio"],
  ["st === \"new\"", "ice=new extra without emit is not joined"],
  ["!meshPeerHasLivePc(p.peer_id)", "must treat missing extra as not live"],
  ["!!p.is_offerer", "joinPeers extra trusts hub per-peer is_offerer"],
  ["Never OR n>=2", "must not dual-offer laptop↔PC extras"],
  ["await pc.connect()", "joinPeers extra must connect()"],
  [
    "joinPeers extra pc peer=",
    "joinPeers must create extra PC and log offerer",
  ],
  [
    "fall through to create a fresh PC + connect",
    "dead extra ice=new must recreate + connect",
  ],
  [
    "Listed extra with no PC: always mesh",
    "listed extra without PC must mesh-join",
  ],
  ["function tileEverHadCamera", "must remember extra tile faces"],
  ["function markTileEverFrames", "must latch extra ever-frames"],
  ["function extraSlotDisplayName", "must keep extra real name vs latch"],
  ["pickExtraRemotePeer()", "mid tile name falls back to extra peer"],
  // Same srcObject must never bind two remotes (laptop two-videos).
  ["function findTileIdForStream", "must locate a stream already on a remote"],
  ["function releaseStreamFromOtherTiles", "occupancy #remote steals stream off mid"],
  ["function streamOnAnyOtherTile", "must refuse same srcObject on two remotes"],
  ["function dedupeRemoteTileStreams", "must drop duplicate remote srcObject"],
  [
    "Never clones the same MediaStream onto two tiles",
    "must not bind one stream to two remotes",
  ],
  ["function extraPartnerMeta", "must resolve 3rd tile partner actions"],
  ["function onThirdTileActivate", "must handle mid-tile click"],
  ["openPartnerMenu({ slot: \"remote-third\" })", "must open menu for 3rd click"],
];
const htmlSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "live.html"),
  "utf8"
);
if (!htmlSrc.includes('id="third-side-rail"')) {
  console.error("FAIL live.html missing #third-side-rail");
  fail += 1;
}
if (!htmlSrc.includes("btn-mute-remote-third-rail")) {
  console.error("FAIL live.html missing 3rd mute rail");
  fail += 1;
}
{
  const thirdTile = htmlSrc.match(/id="tile-third"[\s\S]*?<\/section>/);
  if (!thirdTile || !thirdTile[0].includes("btn-third-actions")) {
    console.error("FAIL live.html #tile-third missing btn-third-actions");
    fail += 1;
  } else {
    const btn = thirdTile[0].match(/<button[^>]*id="btn-third-actions"[^>]*>/);
    if (btn && !/\bhidden\b/.test(btn[0])) {
      console.error("FAIL btn-third-actions stays hidden (★ owns mid-tile)");
      fail += 1;
    }
  }
}
for (const [pat, name] of mustHave) {
  if (!liveSrc.includes(pat)) {
    console.error(`FAIL live.js ${name} (${pat})`);
    fail += 1;
  }
}
{
  // p-offer hop: listed extra without a live PC must become an offerer + connect.
  // Prefer ensureMeshExtraOfferer when p-offer landed that name; else joinPeers.
  const hasEnsureFn = liveSrc.includes("ensureMeshExtraOfferer");
  const hasJoinExtraOfferer =
    liveSrc.includes("!!p.is_offerer") &&
    liveSrc.includes("await pc.connect()");
  if (!hasEnsureFn && !hasJoinExtraOfferer) {
    console.error(
      "FAIL live.js must have ensureMeshExtraOfferer or joinPeers extra offerer connect"
    );
    fail += 1;
  }
  if (!liveSrc.includes("function syncLaptopTrioTiles")) {
    console.error("FAIL live.js must sync laptop trio one person per tile");
    fail += 1;
  }
  if (!liveSrc.includes("remount #remote skip stats")) {
    console.error("FAIL live.js must skip remount when inbound stats have frames");
    fail += 1;
  }
  if (!liveSrc.includes("multi-cam heal skip no-cam")) {
    console.error("FAIL live.js must skip multi-cam GUM on no-cam laptop");
    fail += 1;
  }
  if (!liveSrc.includes("soloVsPair")) {
    console.error("FAIL live.js laptop 3rd must offer occupancy not only extra");
    fail += 1;
  }
  if (!liveSrc.includes("function listedPeerForStream")) {
    console.error("FAIL live.js must map tile srcObject to listed peer");
    fail += 1;
  }
  if (!liveSrc.includes("function paintSoloTilesFromStreams")) {
    console.error("FAIL live.js must paint solo trio names from stream owners");
    fail += 1;
  }
  if (!liveSrc.includes("never rekey Dragonov")) {
    console.error("FAIL live.js must not rekey Dragonov PC under Courtier latch");
    fail += 1;
  }
  if (!liveSrc.includes("function clearPartnerMuteChrome")) {
    console.error("FAIL live.js must clear mute veil on Next/rematch");
    fail += 1;
  }
  if (!liveSrc.includes("NO_ACCOUNT_TIP_MIN_STARS = 25")) {
    console.error("FAIL backup-user tip waits for 25 stars");
    fail += 1;
  }
  if (!liveSrc.includes("if (myStars < NO_ACCOUNT_TIP_MIN_STARS) return;")) {
    console.error("FAIL backup-user tip must skip new users under 25 stars");
    fail += 1;
  }
  if (!liveSrc.includes("do not leave the 18+ sheet dimmed")) {
    console.error("FAIL agree step must hide the leftover 18+ card");
    fail += 1;
  }
  if (!liveSrc.includes("if (!introBlurPending) return false")) {
    console.error("FAIL intro peel must not undo user Blur them");
    fail += 1;
  }
  if (!liveSrc.includes("function showIncomingChatToast")) {
    console.error("FAIL live.js must toast inbound partner chat");
    fail += 1;
  }
  if (!liveSrc.includes('openMessages("friends")')) {
    console.error("FAIL Friends dock must open the inbox sheet");
    fail += 1;
  }
  if (!liveSrc.includes("function renderInboxPeopleChrome")) {
    console.error("FAIL inbox must host add/requests chrome");
    fail += 1;
  }
}
{
  const rtcSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "webrtc.js"),
    "utf8"
  );
  if (!rtcSrc.includes("const multiMesh = isMultiPeerFastMode(this)")) {
    console.error("FAIL webrtc.js must skip 1v1 offer lock on mesh extras");
    fail += 1;
  }
}
{
  const extraFn = liveSrc.match(
    /function extraPartnerMeta\s*\([^)]*\)\s*\{[\s\S]*?\nfunction /
  );
  if (!extraFn || !extraFn[0].includes("tile-third")) {
    console.error("FAIL extraPartnerMeta must resolve when #tile-third is shown");
    fail += 1;
  }
  const openMenu = liveSrc.match(
    /function openPartnerMenu\s*\([^)]*\)\s*\{[\s\S]*?\nfunction /
  );
  const openBody = openMenu ? openMenu[0] : "";
  const skipsClearForThird =
    /slot\s*!==\s*["']remote-third["'][\s\S]{0,220}clearStaleTrioOnPair\s*\(/.test(
      openBody
    );
  if (!skipsClearForThird) {
    console.error(
      "FAIL openPartnerMenu must skip clearStaleTrioOnPair for remote-third"
    );
    fail += 1;
  }
}
if (
  /function handleNoCamP2p\([^)]*\)\s*\{[\s\S]{0,400}setNoCamPortrait\(\s*"remote"/.test(
    liveSrc
  ) &&
  !liveSrc.includes("resolveInboundNoCamWhich")
) {
  console.error("FAIL handleNoCamP2p still paints #remote unconditionally");
  fail += 1;
}

if (fail) process.exit(1);
console.log("live-third-slot.test.mjs: ok");
