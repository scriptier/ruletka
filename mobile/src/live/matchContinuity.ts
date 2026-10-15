import { peerIdsLooseMatch } from "../identity/flagTrust";

/**
 * Pure flags for multi-peer match continuity (keep PC / promote secondary).
 */

export type MatchContinuity = {
  keepPrimary: boolean;
  keepSecondary: boolean;
  promoteSecondary: boolean;
};

function idMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  if (!x || !y || x === "legacy" || y === "legacy") return false;
  return x === y || peerIdsLooseMatch(x, y);
}

function listedHas(
  prev: string,
  listed: Array<string | null | undefined> | undefined
): boolean {
  if (!listed || !listed.length) return false;
  return listed.some((id) => idMatch(prev, id));
}

/**
 * After re-match, decide whether to keep existing PeerConnections.
 * promoteSecondary: primary left, previous secondary is new primary peer.
 *
 * 3rd join: if prevPrimary is still listed (any peers[] slot, exact or
 * loose id form), keepPrimary — do not remount the first RTCView.
 */
export function computeMatchContinuity(opts: {
  wasMatched: boolean;
  prevPrimary: string;
  prevSecondary: string;
  primaryPeerId: string;
  secondaryPeerId: string | null | undefined;
  hasMedia2: boolean;
  /** Current Matched peer ids. prevPrimary still listed → keepPrimary. */
  listedPeerIds?: Array<string | null | undefined>;
}): MatchContinuity {
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

  // Primary left, secondary still live → promote media2 PC to primary
  const promoteSecondary =
    wasMatched &&
    !keepPrimary &&
    !!prevSecondary &&
    prevSecondary !== "legacy" &&
    idMatch(primaryPeerId, prevSecondary) &&
    hasMedia2;

  return { keepPrimary, keepSecondary, promoteSecondary };
}

/**
 * Never remount the first partner startCall when a 3rd is joining or
 * we are in party_browse hunt. extras / hunt do not require live media.
 */
export function shouldSkipPrimaryStartCall(opts: {
  keepPrimary: boolean;
  extrasCount: number;
  partyBrowse?: boolean;
  hunting?: boolean;
  extraHangupKeep?: boolean;
  hasLiveRemote?: boolean;
}): boolean {
  if (opts.extraHangupKeep) return true;
  if (!opts.keepPrimary) return false;
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  if (extras > 0) return true;
  if (opts.partyBrowse || opts.hunting) return true;
  return !!opts.hasLiveRemote;
}

/**
 * 3-way skip contract: only the original pair (hub your_role=party)
 * keeps the teammate and hunts the next 3rd. The 3rd (your_role=solo)
 * Nexts alone. Do not treat matchMode=party_browse as "I am the pair".
 */
export function isPartyKeepOnSkip(yourRole: string | null | undefined): boolean {
  return String(yourRole || "").trim().toLowerCase() === "party";
}

/**
 * Don't push/replace /live when already there. MatchLiveNavigator used
 * to router.replace on every Matched — find-3rd Let's go remounted Live,
 * cleanup media.close() froze Courtier and sent the phone to solo search
 * (401 054049Z Looking 128s / first in line).
 */
export function shouldNavigateToLive(
  pathname: string | null | undefined
): boolean {
  const p = String(pathname || "").replace(/\/+$/, "") || "/";
  return p !== "/live";
}

/**
 * no_cam / hide from a 3rd must not cover the first conversationalist.
 * 055528Z: Laptop no_cam set partnerNoCam → Dragonov cylinder + Laptop
 * "Almost there…". Empty from= while extras≥1 is the extra (laptop).
 */
export function routeInboundNoCamSlot(opts: {
  fromUid?: string | null;
  primaryUid?: string | null;
  extra0Uid?: string | null;
  extra1Uid?: string | null;
  extrasCount?: number;
}): "primary" | "extra0" | "extra1" {
  const from = String(opts.fromUid || "").trim();
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  const primary = String(opts.primaryUid || "").trim();
  const extra0 = String(opts.extra0Uid || "").trim();
  const extra1 = String(opts.extra1Uid || "").trim();
  if (from && extra0 && idMatch(from, extra0)) return "extra0";
  if (from && extra1 && idMatch(from, extra1)) return "extra1";
  if (from && primary && idMatch(from, primary)) return "primary";
  // 3rd listed: only keep primary if from= is definitely the first person.
  if (extras >= 1) return "extra0";
  return "primary";
}

/**
 * Inbound no_cam must never cover a primary tile that already decoded
 * pictures (201649Z PC cam then NoCamPortrait). Laptop / extra advertise
 * is extra-only. from=primary + pictures is poison — that peer has a cam.
 * 1v1 extras=0 + no pictures still allows primary no_cam (laptop 1v1).
 */
export function shouldIgnorePrimaryNoCam(opts: {
  on?: boolean;
  slot?: string | null;
  primaryHasPictures?: boolean;
  fromIsPrimary?: boolean;
  extrasCount?: number;
}): boolean {
  if (!opts.on) return false;
  const slot = String(opts.slot || "").trim();
  if (slot !== "primary") return false;
  if (!opts.primaryHasPictures) return false;
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  // extras≥1 + pictures: never cover (laptop/3rd or poison from=primary)
  if (extras >= 1) return true;
  // 1v1: stray advertise is not the first person
  return !opts.fromIsPrimary;
}

/**
 * Laptop no_cam often arrives before extrasCount≥1 and sticks on the
 * first tile (060444Z Dragonov cylinder). Once a 3rd is listed, move
 * that stale flag onto the extra tile. First 1v1 face had a camera.
 */
export function shouldRehomePrimaryNoCam(opts: {
  extrasCount?: number;
  partnerNoCam?: boolean;
  partnerCamHidden?: boolean;
}): boolean {
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  return extras >= 1 && (!!opts.partnerNoCam || !!opts.partnerCamHidden);
}

/**
 * call_ended during a listed 3-way must not idle-tear the first link.
 * That froze Courtier on PC and left the phone on Start (030415Z / 040927Z).
 * 1v1 (no extra / no secondary) still tears as today.
 */
export function shouldKeepTrioOnCallEnded(opts: {
  extrasCount?: number;
  secondaryPeerId?: string;
  tertiaryPeerId?: string;
}): boolean {
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  if (extras >= 1) return true;
  const sec = String(opts.secondaryPeerId || "").trim();
  const ter = String(opts.tertiaryPeerId || "").trim();
  if (sec && sec !== "legacy") return true;
  if (ter && ter !== "legacy") return true;
  return false;
}

/** Soft re-match (party join / find-3rd) keeps primary PC when continuity says so. */
export function shouldSoftRematch(opts: {
  keepPrimary: boolean;
  promoteSecondary: boolean;
  extrasCount: number;
}): boolean {
  return opts.keepPrimary || opts.promoteSecondary || opts.extrasCount > 0;
}

/**
 * First paint wins for THIS partner. Do not unmount a live remote just
 * because a later Matched has keepPrimary=false (video → Linking → black).
 *
 * New partner: leftover of the previous person MUST clear.
 * First match (no prev primary) with leftover already painting: keep.
 */
export function shouldClearRemoteUi(opts: {
  keepPrimary: boolean;
  leftoverLive: boolean;
  videoSeen: boolean;
  samePeer?: boolean;
  hadPrevPrimary?: boolean;
  leftoverHasPicture?: boolean;
}): boolean {
  if (opts.keepPrimary) return false;
  const samePeer = !!opts.samePeer;
  const hadPrev = !!opts.hadPrevPrimary;
  const pic = !!opts.leftoverHasPicture;
  if (opts.leftoverLive && samePeer) return false;
  if (opts.videoSeen && samePeer) return false;
  // First match: keep only if leftover is actually painting pictures.
  // Dummy/audio leftover + stale videoSeen was 386 navy (no first paint).
  if (opts.leftoverLive && pic && !hadPrev) return false;
  return true;
}

export type InboundSignalTarget = "primary" | "secondary" | "tertiary" | "drop";

function slotSet(id: string | null | undefined): string {
  const s = String(id || "").trim();
  if (!s || s === "legacy") return "";
  return s;
}

/**
 * Route inbound SDP / ICE to a media slot. Cold 3rd join: a second from=
 * must never steal media1 once primary is latched (or extras are listed).
 */
export function routeInboundSignalTarget(opts: {
  from: string | null | undefined;
  primaryId: string | null | undefined;
  secondaryId: string | null | undefined;
  tertiaryId: string | null | undefined;
  extrasCount?: number;
  listedPeerIds?: Array<string | null | undefined>;
  phaseMatched?: boolean;
}): InboundSignalTarget {
  const from = String(opts.from || "").trim();
  const primary = slotSet(opts.primaryId);
  const secondary = slotSet(opts.secondaryId);
  const tertiary = slotSet(opts.tertiaryId);
  const extras = Math.max(0, Math.floor(Number(opts.extrasCount) || 0));
  const listedRemotes = (opts.listedPeerIds || []).filter((id) => {
    const s = String(id || "").trim();
    return !!s && s !== "legacy";
  }).length;

  // Legacy 1v1 SDP without from= stays on media1.
  if (!from || from === "legacy") return "primary";

  if (primary && idMatch(from, primary)) return "primary";
  if (secondary && idMatch(from, secondary)) return "secondary";
  if (tertiary && idMatch(from, tertiary)) return "tertiary";

  const slotsFull = !!(primary && secondary && tertiary);
  if (slotsFull && extras >= 3) return "drop";

  // 4-way: primary+secondary latched, unknown from= is the 4th → media3.
  // 3-way (extras<2, no tertiary) still lands on media2.
  if (
    primary &&
    secondary &&
    (extras >= 2 || listedRemotes >= 3 || !!tertiary)
  ) {
    return "tertiary";
  }

  // Primary already latched to someone else → media2 (never tear media1).
  if (primary) return "secondary";

  // Matched extras / 2+ listed remotes: foreign from= is the 3rd, not media1.
  const multiListed = extras >= 1 || listedRemotes >= 2;
  if (multiListed) return "secondary";

  return "primary";
}

/**
 * Android-as-3rd Matched: latch keep-peer + extras[0] before startCall /
 * queued SDP. Preserve inbound SDP latch when it already names a listed peer.
 */
export function latchThirdJoinerPeerIds(opts: {
  extrasCount: number;
  keepPeerId: string;
  extraPeerId?: string | null;
  currentPrimary?: string | null;
  currentSecondary?: string | null;
}): { primaryId: string; secondaryId: string } | null {
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

/**
 * Extra (media2/3) leftover ice=new/failed after a prior 3rd offer must not
 * count as answered. Laptop 660: Android extra ice=new bind_v=0 rejected the
 * new offer (`offer_reject_answered`). Reset only the stuck extra — never
 * primary / live ICE.
 */
export function shouldResetStuckExtraPc(opts: {
  secondary?: boolean;
  ice?: string | null;
  gotRemoteVideo?: boolean;
}): boolean {
  if (!opts.secondary) return false;
  if (opts.gotRemoteVideo) return false;
  const ice = String(opts.ice || "").toLowerCase();
  return ice === "new" || ice === "failed" || ice === "";
}

export type PartnerActionSlot = "primary" | "extra0" | "extra1";

export type PartnerActionIdentity = {
  userId?: string | null;
  peerId?: string | null;
  friendCode?: string | null;
  name?: string | null;
};

export type PartnerActionTarget = {
  slot: PartnerActionSlot;
  userId: string;
  peerId: string;
  friendCode: string;
  name: string;
};

function identOf(
  p?: PartnerActionIdentity | null
): Omit<PartnerActionTarget, "slot"> {
  return {
    userId: String(p?.userId || "").trim(),
    peerId: String(p?.peerId || "").trim(),
    friendCode: String(p?.friendCode || "").trim(),
    name: String(p?.name || "").trim(),
  };
}

/** Pick the conversationalist the action sheet should target. extra1 missing → null. */
export function extraPartnerActionTarget(opts: {
  extras?: Array<PartnerActionIdentity | null | undefined> | null;
  slot: PartnerActionSlot | string;
  primary?: PartnerActionIdentity | null;
}): PartnerActionTarget | null {
  const slot = String(opts?.slot || "primary");
  if (slot === "primary") {
    return { slot: "primary", ...identOf(opts?.primary) };
  }
  const i = slot === "extra1" ? 1 : slot === "extra0" ? 0 : -1;
  if (i < 0) return null;
  const extras = opts?.extras || [];
  const e = extras[i];
  if (!e) return null;
  return { slot, ...identOf(e) };
}
