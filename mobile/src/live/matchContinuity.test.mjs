import assert from "node:assert/strict";

function normalizePeerIdKey(raw) {
  let s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("fed/")) {
    const parts = s.split("/");
    if (parts.length >= 3) s = parts.slice(2).join("/") || s;
  }
  return s.replace(/[^a-z0-9]/g, "");
}

function peerIdsLooseMatch(a, b) {
  const x = normalizePeerIdKey(a);
  const y = normalizePeerIdKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const n = 8;
  if (x.length >= n && y.length >= n && x.slice(0, n) === y.slice(0, n)) {
    return true;
  }
  if (x.length >= n && y.includes(x)) return true;
  if (y.length >= n && x.includes(y)) return true;
  return false;
}

function idMatch(a, b) {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  if (!x || !y || x === "legacy" || y === "legacy") return false;
  return x === y || peerIdsLooseMatch(x, y);
}

function listedHas(prev, listed) {
  if (!listed || !listed.length) return false;
  return listed.some((id) => idMatch(prev, id));
}

function computeMatchContinuity(opts) {
  const {
    wasMatched,
    prevPrimary,
    prevSecondary,
    primaryPeerId,
    secondaryPeerId,
    hasMedia2,
    listedPeerIds,
  } = opts;
  const prevStillListed =
    listedHas(prevPrimary, listedPeerIds) || idMatch(prevPrimary, primaryPeerId);
  const keepPrimary =
    wasMatched &&
    !!prevPrimary &&
    prevPrimary !== "legacy" &&
    prevStillListed;
  const secondId = secondaryPeerId || "";
  const keepSecondary =
    wasMatched &&
    !!prevSecondary &&
    !!secondId &&
    prevSecondary !== "legacy" &&
    secondId !== "legacy" &&
    idMatch(prevSecondary, secondId);
  const promoteSecondary =
    wasMatched &&
    !keepPrimary &&
    !!prevSecondary &&
    prevSecondary !== "legacy" &&
    idMatch(primaryPeerId, prevSecondary) &&
    hasMedia2;
  return { keepPrimary, keepSecondary, promoteSecondary };
}

function shouldSoftRematch(opts) {
  return opts.keepPrimary || opts.promoteSecondary || opts.extrasCount > 0;
}

function shouldSkipPrimaryStartCall(opts) {
  if (opts.extraHangupKeep) return true;
  if (!opts.keepPrimary) return false;
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  if (extras > 0) return true;
  if (opts.partyBrowse || opts.hunting) return true;
  return !!opts.hasLiveRemote;
}

function shouldKeepTrioOnCallEnded(opts) {
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  if (extras >= 1) return true;
  const sec = String(opts.secondaryPeerId || "").trim();
  const ter = String(opts.tertiaryPeerId || "").trim();
  if (sec && sec !== "legacy") return true;
  if (ter && ter !== "legacy") return true;
  return false;
}

function shouldNavigateToLive(pathname) {
  const p = String(pathname || "").replace(/\/+$/, "") || "/";
  return p !== "/live";
}

function pickPrimaryPeerIndex(peerIds, opts) {
  if (!peerIds.length) return 0;
  const { wasMatched, prevPrimary, prevSecondary, keepFirstOnOmit } = opts;
  if (wasMatched && prevPrimary && prevPrimary !== "legacy") {
    const i = peerIds.findIndex(
      (id) =>
        !!id &&
        id !== "legacy" &&
        (id === prevPrimary || peerIdsLooseMatch(id, prevPrimary))
    );
    if (i >= 0) return i;
  }
  if (wasMatched && prevSecondary && prevSecondary !== "legacy") {
    const i = peerIds.findIndex(
      (id) =>
        !!id &&
        id !== "legacy" &&
        (id === prevSecondary || peerIdsLooseMatch(id, prevSecondary))
    );
    if (i >= 0 && peerIds.length >= 2) return i;
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

// Fresh match
{
  const c = computeMatchContinuity({
    wasMatched: false,
    prevPrimary: "",
    prevSecondary: "",
    primaryPeerId: "a",
    secondaryPeerId: null,
    hasMedia2: false,
  });
  assert.equal(c.keepPrimary, false);
  assert.equal(c.promoteSecondary, false);
}

// Keep same primary
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "a",
    secondaryPeerId: "b",
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, true);
  assert.equal(c.keepSecondary, true);
  assert.equal(c.promoteSecondary, false);
}

// Extra (secondary) peer drops: primary continuity is independent of
// secondary state, so keepPrimary must stay true even though the extra
// is gone (no secondaryPeerId, no media2).
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "a",
    secondaryPeerId: null,
    hasMedia2: false,
  });
  assert.equal(c.keepPrimary, true);
  assert.equal(c.keepSecondary, false);
  assert.equal(c.promoteSecondary, false);
}

// Extra drops but keepPrimary still true → shouldSoftRematch stays true
assert.equal(
  shouldSoftRematch({ keepPrimary: true, promoteSecondary: false, extrasCount: 0 }),
  true,
);

// Promote secondary to primary
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "b",
    secondaryPeerId: null,
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, false);
  assert.equal(c.promoteSecondary, true);
}

// No promote without media2
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "b",
    secondaryPeerId: null,
    hasMedia2: false,
  });
  assert.equal(c.promoteSecondary, false);
}

// "legacy" prevPrimary is a sentinel, never kept even if it equals primaryPeerId
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "legacy",
    prevSecondary: "b",
    primaryPeerId: "legacy",
    secondaryPeerId: "b",
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, false);
}

// "legacy" secondaryPeerId is never kept even if it equals prevSecondary
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "legacy",
    primaryPeerId: "a",
    secondaryPeerId: "legacy",
    hasMedia2: true,
  });
  assert.equal(c.keepSecondary, false);
}

// "legacy" prevSecondary blocks promotion even if primaryPeerId matches it
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "legacy",
    primaryPeerId: "legacy",
    secondaryPeerId: null,
    hasMedia2: true,
  });
  assert.equal(c.promoteSecondary, false);
}

// Already keeping primary: never also promote secondary
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "a",
    primaryPeerId: "a",
    secondaryPeerId: null,
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, true);
  assert.equal(c.promoteSecondary, false);
}

// undefined secondaryPeerId (vs. null) is treated the same as missing
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "a",
    secondaryPeerId: undefined,
    hasMedia2: false,
  });
  assert.equal(c.keepSecondary, false);
}

// wasMatched false: no continuity at all, even with matching ids
{
  const c = computeMatchContinuity({
    wasMatched: false,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "a",
    secondaryPeerId: "b",
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, false);
  assert.equal(c.keepSecondary, false);
  assert.equal(c.promoteSecondary, false);
}

// shouldSoftRematch: true when keeping primary
assert.equal(
  shouldSoftRematch({ keepPrimary: true, promoteSecondary: false, extrasCount: 0 }),
  true,
);

// shouldSoftRematch: true when promoting secondary
assert.equal(
  shouldSoftRematch({ keepPrimary: false, promoteSecondary: true, extrasCount: 0 }),
  true,
);

// shouldSoftRematch: true when there are extras, even without continuity
assert.equal(
  shouldSoftRematch({ keepPrimary: false, promoteSecondary: false, extrasCount: 1 }),
  true,
);

// shouldSoftRematch: false when nothing carries over
assert.equal(
  shouldSoftRematch({ keepPrimary: false, promoteSecondary: false, extrasCount: 0 }),
  false,
);

function isPartyKeepOnSkip(yourRole) {
  return String(yourRole || "").trim().toLowerCase() === "party";
}
assert.equal(isPartyKeepOnSkip("party"), true);
assert.equal(isPartyKeepOnSkip("PARTY"), true);
assert.equal(isPartyKeepOnSkip("solo"), false);
assert.equal(isPartyKeepOnSkip("party_browse"), false);
assert.equal(isPartyKeepOnSkip(""), false);
assert.equal(isPartyKeepOnSkip(null), false);

function shouldClearRemoteUi(opts) {
  if (opts.keepPrimary) return false;
  const samePeer = !!opts.samePeer;
  const hadPrev = !!opts.hadPrevPrimary;
  const pic = !!opts.leftoverHasPicture;
  if (opts.leftoverLive && samePeer) return false;
  if (opts.videoSeen && samePeer) return false;
  if (opts.leftoverLive && pic && !hadPrev) return false;
  return true;
}

// keepPrimary always keeps the tile
assert.equal(
  shouldClearRemoteUi({
    keepPrimary: true,
    leftoverLive: false,
    videoSeen: false,
  }),
  false,
);

// First match race: keep only if leftover has pictures
assert.equal(
  shouldClearRemoteUi({
    keepPrimary: false,
    leftoverLive: true,
    videoSeen: true,
    samePeer: false,
    hadPrevPrimary: false,
    leftoverHasPicture: true,
  }),
  false,
);

// First match dummy/audio leftover must clear (386 navy)
assert.equal(
  shouldClearRemoteUi({
    keepPrimary: false,
    leftoverLive: true,
    videoSeen: true,
    samePeer: false,
    hadPrevPrimary: false,
    leftoverHasPicture: false,
  }),
  true,
);

// Same partner rematch with leftover
assert.equal(
  shouldClearRemoteUi({
    keepPrimary: false,
    leftoverLive: true,
    videoSeen: true,
    samePeer: true,
    hadPrevPrimary: true,
  }),
  false,
);

// New partner: leftover of previous person must clear
assert.equal(
  shouldClearRemoteUi({
    keepPrimary: false,
    leftoverLive: true,
    videoSeen: true,
    samePeer: false,
    hadPrevPrimary: true,
  }),
  true,
);

// Fresh match, nothing painted yet
assert.equal(
  shouldClearRemoteUi({
    keepPrimary: false,
    leftoverLive: false,
    videoSeen: false,
    samePeer: false,
    hadPrevPrimary: false,
  }),
  true,
);

// 3rd join: prevPrimary still listed (peers reordered, laptop first)
{
  const listed = ["laptop", "pc1"];
  const pi = pickPrimaryPeerIndex(listed, {
    wasMatched: true,
    prevPrimary: "pc1",
    prevSecondary: "",
  });
  assert.equal(pi, 1);
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "pc1",
    prevSecondary: "",
    primaryPeerId: listed[pi],
    secondaryPeerId: "laptop",
    hasMedia2: false,
    listedPeerIds: listed,
  });
  assert.equal(c.keepPrimary, true);
  assert.equal(c.promoteSecondary, false);
  assert.equal(
    shouldSkipPrimaryStartCall({
      keepPrimary: c.keepPrimary,
      extrasCount: 1,
      partyBrowse: true,
      hasLiveRemote: false,
    }),
    true
  );
}

// 3rd join: listedPeerIds keeps even if pick missed (laptop as primaryPeerId)
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "pc1",
    prevSecondary: "",
    primaryPeerId: "laptop",
    secondaryPeerId: "pc1",
    hasMedia2: false,
    listedPeerIds: ["laptop", "pc1"],
  });
  assert.equal(c.keepPrimary, true);
  assert.equal(c.promoteSecondary, false);
}

// 3rd join: loose fed/ vs hex — keep first partner, bind 3rd as extra
{
  const listed = ["deadbeefcafebabe", "laptop99"];
  const prev = "fed/sess/deadbeefcafebabe";
  const pi = pickPrimaryPeerIndex(listed, {
    wasMatched: true,
    prevPrimary: prev,
    prevSecondary: "",
  });
  assert.equal(pi, 0);
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: prev,
    prevSecondary: "",
    primaryPeerId: listed[pi],
    secondaryPeerId: "laptop99",
    hasMedia2: false,
    listedPeerIds: listed,
  });
  assert.equal(c.keepPrimary, true);
}

// party_browse hunt (no extras yet): skip primary remount
assert.equal(
  shouldSkipPrimaryStartCall({
    keepPrimary: true,
    extrasCount: 0,
    partyBrowse: true,
    hasLiveRemote: false,
  }),
  true
);

// 1v1 keep with live media: skip remount
assert.equal(
  shouldSkipPrimaryStartCall({
    keepPrimary: true,
    extrasCount: 0,
    hasLiveRemote: true,
  }),
  true
);

// 1v1 keep without live media and not hunt: do not skip (rebuild ok)
assert.equal(
  shouldSkipPrimaryStartCall({
    keepPrimary: true,
    extrasCount: 0,
    hasLiveRemote: false,
  }),
  false
);

// keepPrimary false: never skip (new match)
assert.equal(
  shouldSkipPrimaryStartCall({
    keepPrimary: false,
    extrasCount: 1,
    partyBrowse: true,
    hasLiveRemote: true,
  }),
  false
);

// extra hangup: skip remount even without keep flag
assert.equal(
  shouldSkipPrimaryStartCall({
    keepPrimary: false,
    extrasCount: 0,
    extraHangupKeep: true,
    hasLiveRemote: false,
  }),
  true
);

// 3-way call_ended must keep; 1v1 must not
assert.equal(
  shouldKeepTrioOnCallEnded({ extrasCount: 1, secondaryPeerId: "laptop" }),
  true
);
assert.equal(
  shouldKeepTrioOnCallEnded({ extrasCount: 0, secondaryPeerId: "laptop" }),
  true
);
assert.equal(
  shouldKeepTrioOnCallEnded({ extrasCount: 0, secondaryPeerId: "" }),
  false
);
assert.equal(
  shouldKeepTrioOnCallEnded({ extrasCount: 0, secondaryPeerId: "legacy" }),
  false
);
assert.equal(shouldNavigateToLive("/live"), false);
assert.equal(shouldNavigateToLive("/live/"), false);
assert.equal(shouldNavigateToLive("/friends"), true);
assert.equal(shouldNavigateToLive(""), true);

function routeInboundNoCamSlot(opts) {
  const from = String(opts.fromUid || "").trim();
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  const primary = String(opts.primaryUid || "").trim();
  const extra0 = String(opts.extra0Uid || "").trim();
  const extra1 = String(opts.extra1Uid || "").trim();
  const match = (a, b) => !!a && !!b && a === b;
  if (from && extra0 && match(from, extra0)) return "extra0";
  if (from && extra1 && match(from, extra1)) return "extra1";
  if (from && primary && match(from, primary)) return "primary";
  if (extras >= 1) return "extra0";
  return "primary";
}
assert.equal(
  routeInboundNoCamSlot({ extrasCount: 0, fromUid: "", primaryUid: "drag" }),
  "primary"
);
assert.equal(
  routeInboundNoCamSlot({
    extrasCount: 1,
    fromUid: "",
    primaryUid: "drag",
    extra0Uid: "laptop",
  }),
  "extra0",
  "anonymous no_cam with extras is laptop, not Dragonov"
);
assert.equal(
  routeInboundNoCamSlot({
    extrasCount: 1,
    fromUid: "laptop",
    primaryUid: "drag",
    extra0Uid: "laptop",
  }),
  "extra0"
);
assert.equal(
  routeInboundNoCamSlot({
    extrasCount: 1,
    fromUid: "drag",
    primaryUid: "drag",
    extra0Uid: "laptop",
  }),
  "primary"
);

function shouldRehomePrimaryNoCam(opts) {
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  return extras >= 1 && (!!opts.partnerNoCam || !!opts.partnerCamHidden);
}

function shouldIgnorePrimaryNoCam(opts) {
  if (!opts.on) return false;
  const slot = String(opts.slot || "").trim();
  if (slot !== "primary") return false;
  if (!opts.primaryHasPictures) return false;
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  if (extras >= 1) return true;
  return !opts.fromIsPrimary;
}
assert.equal(
  shouldRehomePrimaryNoCam({ extrasCount: 1, partnerNoCam: true }),
  true,
  "3rd listed + stale primary no_cam → move to extra"
);
assert.equal(
  shouldRehomePrimaryNoCam({ extrasCount: 0, partnerNoCam: true }),
  false
);
assert.equal(
  shouldRehomePrimaryNoCam({ extrasCount: 1, partnerNoCam: false }),
  false
);
assert.equal(
  shouldRehomePrimaryNoCam({ extrasCount: 1, partnerCamHidden: true }),
  true,
  "laptop self_hide leftover must rehome off first tile"
);
assert.equal(
  routeInboundNoCamSlot({
    extrasCount: 1,
    fromUid: "laptop",
    primaryUid: "",
    extra0Uid: "",
  }),
  "extra0",
  "extras≥1 + empty primary/extra ids still extra (not tile 1)"
);

// 201649Z: extras + pictures — laptop no_cam is extra only; never cover PC.
{
  const slot = routeInboundNoCamSlot({
    extrasCount: 1,
    fromUid: "laptop",
    primaryUid: "drag",
    extra0Uid: "laptop",
  });
  assert.equal(slot, "extra0", "extras>=1 + from=extra + pictures → extra0");
  assert.equal(
    shouldIgnorePrimaryNoCam({
      on: true,
      slot,
      primaryHasPictures: true,
      fromIsPrimary: false,
      extrasCount: 1,
    }),
    false,
    "extra slot still accepts laptop no_cam"
  );
}
{
  const slot = routeInboundNoCamSlot({
    extrasCount: 1,
    fromUid: "",
    primaryUid: "drag",
    extra0Uid: "laptop",
  });
  assert.equal(slot, "extra0", "extras>=1 + empty from + pictures → extra0");
  assert.equal(
    shouldIgnorePrimaryNoCam({
      on: true,
      slot,
      primaryHasPictures: true,
      fromIsPrimary: false,
      extrasCount: 1,
    }),
    false
  );
}
{
  const slot = routeInboundNoCamSlot({
    extrasCount: 1,
    fromUid: "drag",
    primaryUid: "drag",
    extra0Uid: "laptop",
  });
  assert.equal(slot, "primary");
  assert.equal(
    shouldIgnorePrimaryNoCam({
      on: true,
      slot,
      primaryHasPictures: true,
      fromIsPrimary: true,
      extrasCount: 1,
    }),
    true,
    "extras>=1 + from=primary + pictures → ignore (do not cover)"
  );
}
{
  const slot = routeInboundNoCamSlot({
    extrasCount: 0,
    fromUid: "laptop",
    primaryUid: "laptop",
  });
  assert.equal(slot, "primary", "1v1 laptop no_cam still primary");
  assert.equal(
    shouldIgnorePrimaryNoCam({
      on: true,
      slot,
      primaryHasPictures: false,
      fromIsPrimary: true,
      extrasCount: 0,
    }),
    false,
    "1v1 extras=0 + from=primary + no pictures → primary allowed"
  );
}
assert.equal(
  shouldIgnorePrimaryNoCam({
    on: true,
    slot: "primary",
    primaryHasPictures: true,
    fromIsPrimary: false,
    extrasCount: 0,
  }),
  true,
  "stray no_cam must not cover a painted 1v1 primary"
);
assert.equal(
  shouldIgnorePrimaryNoCam({
    on: false,
    slot: "primary",
    primaryHasPictures: true,
    fromIsPrimary: true,
    extrasCount: 1,
  }),
  false,
  "clearing no_cam is never ignored"
);

// pickPrimary: prev gone, prefer prevSecondary
assert.equal(
  pickPrimaryPeerIndex(["a", "b", "c"], {
    wasMatched: true,
    prevPrimary: "gone",
    prevSecondary: "b",
  }),
  1
);

// pickPrimary: fresh match stays index 0
assert.equal(
  pickPrimaryPeerIndex(["laptop", "pc1"], {
    wasMatched: false,
    prevPrimary: "pc1",
    prevSecondary: "",
  }),
  0
);

// keepFirstOnOmit: fresh 1v1 (wasMatched false) still 0 even if prev omitted
assert.equal(
  pickPrimaryPeerIndex(["laptop"], {
    wasMatched: false,
    prevPrimary: "courtier-pc",
    keepFirstOnOmit: true,
  }),
  0
);

// keepFirstOnOmit: wasMatched + prevPrimary omitted from list → -1
assert.equal(
  pickPrimaryPeerIndex(["laptop"], {
    wasMatched: true,
    prevPrimary: "courtier-pc",
    keepFirstOnOmit: true,
  }),
  -1
);

function slotSet(id) {
  const s = String(id || "").trim();
  if (!s || s === "legacy") return "";
  return s;
}

function routeInboundSignalTarget(opts) {
  const from = String(opts.from || "").trim();
  const primary = slotSet(opts.primaryId);
  const secondary = slotSet(opts.secondaryId);
  const tertiary = slotSet(opts.tertiaryId);
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  const listedRemotes = (opts.listedPeerIds || []).filter((id) => {
    const s = String(id || "").trim();
    return !!s && s !== "legacy";
  }).length;
  if (!from || from === "legacy") return "primary";
  if (primary && idMatch(from, primary)) return "primary";
  if (secondary && idMatch(from, secondary)) return "secondary";
  if (tertiary && idMatch(from, tertiary)) return "tertiary";
  const slotsFull = !!(primary && secondary && tertiary);
  if (slotsFull && extras >= 3) return "drop";
  if (
    primary &&
    secondary &&
    (extras >= 2 || listedRemotes >= 3 || !!tertiary)
  ) {
    return "tertiary";
  }
  if (primary) return "secondary";
  const multiListed = extras >= 1 || listedRemotes >= 2;
  if (multiListed) return "secondary";
  return "primary";
}

function latchThirdJoinerPeerIds(opts) {
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  if (extras < 1) return null;
  const keep = slotSet(opts.keepPeerId);
  const extra = slotSet(opts.extraPeerId);
  const curP = slotSet(opts.currentPrimary);
  const curS = slotSet(opts.currentSecondary);
  let primaryId = keep;
  if (curP && (idMatch(curP, keep) || (extra && idMatch(curP, extra)))) {
    primaryId = curP;
  }
  if (!primaryId) primaryId = curP;
  let secondaryId = "";
  if (curS && !idMatch(curS, primaryId)) {
    secondaryId = curS;
  } else if (extra && !idMatch(extra, primaryId)) {
    secondaryId = extra;
  } else if (keep && !idMatch(keep, primaryId)) {
    secondaryId = keep;
  }
  return { primaryId, secondaryId };
}

// Cold 3rd: first from= while primary empty → media1
assert.equal(
  routeInboundSignalTarget({
    from: "iphone",
    primaryId: "",
    secondaryId: "",
    tertiaryId: "",
    extrasCount: 0,
    listedPeerIds: [],
    phaseMatched: false,
  }),
  "primary"
);

// Cold 3rd: second from= while primary latched → media2 (never media1)
assert.equal(
  routeInboundSignalTarget({
    from: "pc",
    primaryId: "iphone",
    secondaryId: "",
    tertiaryId: "",
    extrasCount: 0,
    listedPeerIds: [],
    phaseMatched: false,
  }),
  "secondary"
);

// Two from= ids: primary match stays media1; other id is media2
{
  const a = routeInboundSignalTarget({
    from: "iphone",
    primaryId: "iphone",
    secondaryId: "",
    tertiaryId: "",
  });
  const b = routeInboundSignalTarget({
    from: "pc",
    primaryId: "iphone",
    secondaryId: "",
    tertiaryId: "",
  });
  assert.equal(a, "primary");
  assert.equal(b, "secondary");
}

// extrasCount>=1 and from is not primary → secondary even if secondaryId empty
assert.equal(
  routeInboundSignalTarget({
    from: "pc",
    primaryId: "iphone",
    secondaryId: "",
    tertiaryId: "",
    extrasCount: 1,
    listedPeerIds: ["iphone", "pc"],
    phaseMatched: true,
  }),
  "secondary"
);

// listedPeerIds has 2+ remotes and from is not primary → secondary
assert.equal(
  routeInboundSignalTarget({
    from: "pc",
    primaryId: "",
    secondaryId: "",
    tertiaryId: "",
    extrasCount: 0,
    listedPeerIds: ["iphone", "pc"],
    phaseMatched: true,
  }),
  "secondary"
);

// Loose fed/ vs hex still hits primary
assert.equal(
  routeInboundSignalTarget({
    from: "deadbeefcafebabe",
    primaryId: "fed/sess/deadbeefcafebabe",
    secondaryId: "laptop99",
    tertiaryId: "",
  }),
  "primary"
);

// Explicit secondary / tertiary slots
assert.equal(
  routeInboundSignalTarget({
    from: "pc",
    primaryId: "iphone",
    secondaryId: "pc",
    tertiaryId: "",
  }),
  "secondary"
);
assert.equal(
  routeInboundSignalTarget({
    from: "laptop",
    primaryId: "iphone",
    secondaryId: "pc",
    tertiaryId: "laptop",
  }),
  "tertiary"
);

// 4-way: primary+secondary latched, unknown from= → tertiary (not steal extra0)
assert.equal(
  routeInboundSignalTarget({
    from: "friend4",
    primaryId: "iphone",
    secondaryId: "pc",
    tertiaryId: "",
    extrasCount: 2,
    listedPeerIds: ["iphone", "pc", "friend4"],
    phaseMatched: true,
  }),
  "tertiary"
);

// 3-way unknown from= still secondary (not tertiary)
assert.equal(
  routeInboundSignalTarget({
    from: "pc",
    primaryId: "iphone",
    secondaryId: "",
    tertiaryId: "",
    extrasCount: 1,
    listedPeerIds: ["iphone", "pc"],
    phaseMatched: true,
  }),
  "secondary"
);

// Empty from= stays on primary (legacy 1v1)
assert.equal(
  routeInboundSignalTarget({
    from: "",
    primaryId: "iphone",
    secondaryId: "pc",
    tertiaryId: "",
    extrasCount: 1,
  }),
  "primary"
);

// 3rd-joiner latch: extras listed → peer[0] keep + extras[0] before startCall
{
  const latched = latchThirdJoinerPeerIds({
    extrasCount: 1,
    keepPeerId: "iphone",
    extraPeerId: "pc",
    currentPrimary: "",
    currentSecondary: "",
  });
  assert.ok(latched);
  assert.equal(latched.primaryId, "iphone");
  assert.equal(latched.secondaryId, "pc");
}

// No extras → no latch (1v1)
assert.equal(
  latchThirdJoinerPeerIds({
    extrasCount: 0,
    keepPeerId: "iphone",
    extraPeerId: "",
  }),
  null
);

// Inbound first offer already latched extras[0] — keep it, other listed is secondary
{
  const latched = latchThirdJoinerPeerIds({
    extrasCount: 1,
    keepPeerId: "iphone",
    extraPeerId: "pc",
    currentPrimary: "pc",
    currentSecondary: "",
  });
  assert.equal(latched.primaryId, "pc");
  assert.equal(latched.secondaryId, "iphone");
}

function shouldResetStuckExtraPc(opts) {
  if (!opts.secondary) return false;
  if (opts.gotRemoteVideo) return false;
  const ice = String(opts.ice || "").toLowerCase();
  return ice === "new" || ice === "failed" || ice === "";
}
{
  assert.equal(
    shouldResetStuckExtraPc({
      secondary: true,
      ice: "new",
      gotRemoteVideo: false,
    }),
    true,
    "stuck extra ice=new must reset"
  );
  assert.equal(
    shouldResetStuckExtraPc({
      secondary: true,
      ice: "failed",
      gotRemoteVideo: false,
    }),
    true,
    "stuck extra ice=failed must reset"
  );
  assert.equal(
    shouldResetStuckExtraPc({
      secondary: false,
      ice: "new",
      gotRemoteVideo: false,
    }),
    false,
    "must not reset primary"
  );
  assert.equal(
    shouldResetStuckExtraPc({
      secondary: true,
      ice: "connected",
      gotRemoteVideo: false,
    }),
    false,
    "must not reset live extra ICE"
  );
  assert.equal(
    shouldResetStuckExtraPc({
      secondary: true,
      ice: "new",
      gotRemoteVideo: true,
    }),
    false,
    "must not reset extra that already painted"
  );
  assert.equal(
    shouldResetStuckExtraPc({
      secondary: true,
      ice: "",
      gotRemoteVideo: false,
    }),
    true,
    "stuck extra ice='' (no state yet) may reset"
  );
  assert.equal(
    shouldResetStuckExtraPc({
      secondary: true,
      ice: "checking",
      gotRemoteVideo: false,
    }),
    false,
    "must not reset extra mid-ICE"
  );
  assert.equal(
    shouldResetStuckExtraPc({
      secondary: true,
      ice: "disconnected",
      gotRemoteVideo: false,
    }),
    false,
    "must not reset extra ice=disconnected"
  );
}

// Lock source contract so this mirror cannot silently re-diverge.
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(dir, "matchContinuity.ts"), "utf8");
  assert.match(
    src,
    /listedPeerIds/,
    "computeMatchContinuity must keep primary when prevPrimary still listed"
  );
  assert.match(
    src,
    /export function shouldSkipPrimaryStartCall/,
    "must export shouldSkipPrimaryStartCall (no remount on extras/hunt)"
  );
  assert.match(
    src,
    /export function routeInboundSignalTarget/,
    "must export routeInboundSignalTarget (dual-offer never steals media1)"
  );
  assert.match(
    src,
    /export function latchThirdJoinerPeerIds/,
    "must export latchThirdJoinerPeerIds (3rd-joiner latch before startCall)"
  );
  assert.match(
    src,
    /export function shouldResetStuckExtraPc/,
    "must export shouldResetStuckExtraPc (laptop 3rd leftover extra)"
  );
  assert.match(
    src,
    /ice === "new" \|\| ice === "failed"/,
    "shouldResetStuckExtraPc must keep ice=new/failed"
  );
  assert.equal(
    /ice === "checking"|ice === "disconnected"|ice === "completed"/.test(src),
    false,
    "shouldResetStuckExtraPc must not reset live/mid ICE (ice='' only extra)"
  );
  assert.match(
    src,
    /export function shouldKeepTrioOnCallEnded/,
    "must export shouldKeepTrioOnCallEnded (no idle-tear 3-way)"
  );
  assert.match(
    src,
    /export function shouldNavigateToLive/,
    "must export shouldNavigateToLive (no remount on find-3rd Matched)"
  );
  assert.match(
    src,
    /export function routeInboundNoCamSlot/,
    "must export routeInboundNoCamSlot (laptop no_cam ≠ Dragonov)"
  );
  assert.match(
    src,
    /export function shouldRehomePrimaryNoCam/,
    "must export shouldRehomePrimaryNoCam (060444Z move stale flag)"
  );
  assert.match(
    src,
    /export function shouldIgnorePrimaryNoCam/,
    "must export shouldIgnorePrimaryNoCam (never cover painted primary)"
  );
  const liveApp = fs.readFileSync(
    path.join(dir, "../../app/live.tsx"),
    "utf8"
  );
  assert.match(
    liveApp,
    /rehome_nocam primary→extra0/,
    "Matched extras must rehome stale partnerNoCam onto Laptop tile"
  );
  assert.match(
    liveApp,
    /ignore_nocam_has_pictures/,
    "applyNoCamFromPeer must ignore primary cover when pictures exist"
  );
  assert.match(
    liveApp,
    /shouldIgnorePrimaryNoCam/,
    "live.tsx must consult shouldIgnorePrimaryNoCam before setPartnerNoCam"
  );
  assert.match(
    liveApp,
    /function applyHideFromPeer/,
    "self_hide must use applyHideFromPeer (not first-tile only)"
  );
  const layout = fs.readFileSync(path.join(dir, "../../app/_layout.tsx"), "utf8");
  assert.match(
    layout,
    /if \(!shouldNavigateToLive\(pathRef\.current\)\) return/,
    "MatchLiveNavigator must skip replace when already on /live"
  );
  assert.match(
    layout,
    /goLiveIfNeeded/,
    "find-3rd Let's go must not push /live when already there"
  );
  const peers = fs.readFileSync(path.join(dir, "matchPeers.ts"), "utf8");
  assert.match(
    peers,
    /export function pickPrimaryPeerIndex/,
    "matchPeers must export loose pickPrimaryPeerIndex"
  );
  assert.match(
    peers,
    /peerIdsLooseMatch/,
    "pickPrimaryPeerIndex must loose-match prevPrimary"
  );
  assert.match(
    peers,
    /keepFirstOnOmit/,
    "pickPrimaryPeerIndex must keep first on omit (3rd-join rematch)"
  );
  const live = fs.readFileSync(path.join(dir, "../../app/live.tsx"), "utf8");
  assert.match(
    live,
    /routeInboundSignalTarget/,
    "live.tsx must route inbound SDP via routeInboundSignalTarget"
  );
  assert.match(
    live,
    /latchThirdJoinerPeerIds/,
    "live.tsx must latch both remotes on 3rd-joiner Matched"
  );
  const mediaSession = fs.readFileSync(
    path.join(dir, "../media/MediaSession.ts"),
    "utf8"
  );
  assert.match(
    mediaSession,
    /shouldResetStuckExtraPc/,
    "MediaSession extra leftover must consult shouldResetStuckExtraPc"
  );
  assert.match(
    mediaSession,
    /resetStuckExtraPc/,
    "MediaSession must keep resetStuckExtraPc (ice=new extra accepts new offer)"
  );
  const latchAt = live.indexOf("latchThirdJoinerPeerIds");
  const startCallAt = live.indexOf("startCall EARLY");
  assert.ok(
    latchAt > 0 && startCallAt > latchAt,
    "3rd-joiner latch must run before startCall EARLY"
  );
  const foreignPrimary = /signalTarget === "primary"[\s\S]{0,400}extrasCount/;
  assert.equal(
    foreignPrimary.test(live),
    false,
    "live.tsx must not apply extras-listed foreign offer to media1"
  );
}

{
  function extraPartnerActionTarget(opts) {
    const slot = String(opts?.slot || "primary");
    const ident = (p) => ({
      userId: String(p?.userId || "").trim(),
      peerId: String(p?.peerId || "").trim(),
      friendCode: String(p?.friendCode || "").trim(),
      name: String(p?.name || "").trim(),
    });
    if (slot === "primary") return { slot: "primary", ...ident(opts?.primary) };
    const i = slot === "extra1" ? 1 : slot === "extra0" ? 0 : -1;
    if (i < 0) return null;
    const e = (opts?.extras || [])[i];
    if (!e) return null;
    return { slot, ...ident(e) };
  }
  const primary = extraPartnerActionTarget({
    slot: "primary",
    primary: { userId: "u1", peerId: "p1", name: "Ann" },
  });
  assert.equal(primary?.userId, "u1");
  assert.equal(primary?.peerId, "p1");
  assert.equal(primary?.name, "Ann");
  const extras = [
    { userId: "u2", peerId: "p2", name: "Bob" },
    { userId: "u3", peerId: "p3", name: "Cara" },
  ];
  assert.equal(
    extraPartnerActionTarget({ extras, slot: "extra0" })?.name,
    "Bob"
  );
  assert.equal(
    extraPartnerActionTarget({ extras: extras.slice(0, 1), slot: "extra1" }),
    null
  );
  assert.equal(
    extraPartnerActionTarget({ extras, slot: "extra1" })?.userId,
    "u3"
  );
  assert.equal(extraPartnerActionTarget({ extras, slot: "nope" }), null);
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(dir, "matchContinuity.ts"), "utf8");
  assert.match(
    src,
    /export function extraPartnerActionTarget/,
    "must export extraPartnerActionTarget"
  );
}

console.log("matchContinuity.test.mjs ok");
