import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import Constants from "expo-constants";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { track } from "../src/analytics/track";
import {
  loadMatchHistory,
  pushMatchHistory,
  type MatchHistoryEntry,
} from "../src/calls/matchHistory";
import type { BlurStrangersMode } from "../src/prefs/store";
import { formatPartnerSummary } from "../src/identity/PartnerChrome";
import {
  formatLocLine,
  peerIdsLooseMatch,
} from "../src/identity/flagTrust";
import { fillPublicGeo } from "../src/identity/fillPublicGeo";
import { hubBase, isFriendsOnly } from "../src/config";
import {
  hapticDebateTurn,
  hapticDebateUrgent,
  hapticLight,
  hapticMatch,
  hapticMedium,
} from "../src/feedback/haptics";
import { useHub } from "../src/hub/HubProvider";
import { TapPressable } from "../src/ui/TapPressable";
import type { MatchPeer, ServerMatched, ServerMsg } from "../src/hub/types";
import { useI18n, useT } from "../src/i18n";
import { friendInviteShareMessage } from "../src/linking/friendInvite";
import {
  LiveBottomBar,
  LiveChatOverlay,
  LiveConnectSteps,
  LiveConnPill,
  LiveDebateChrome,
  DebateIncomingOverlay,
  StarGiftPopup,
  LiveMoreSheet,
  PartnerIdentityDock,
  LiveQueueHints,
  LiveSearchLabel,
  LiveStageVideo,
  LiveStatusBanners,
  QUEUE_CONFIRM_DELAYS_MS,
  SPIN_KEEPALIVE_MS,
  computeMatchContinuity,
  shouldClearRemoteUi,
  isPartyKeepOnSkip,
  elapsedSince,
  formatCallTimer,
  liveStyles as styles,
  displayPartnerStars,
  isBetterPartnerDisplayName,
  isHexIdLike,
  isPlaceholderPartnerName,
  MAX_EXTRA_PEERS,
  extraPartnerActionTarget,
  extraPeersFromMatch,
  mergePartnerStars,
  mergePartnerTrust,
  normalizePeer,
  partnerGeoHasSignal,
  pickPeer,
  readPeerGeo,
  readPeerStars,
  readPeerTrust,
  resolvePartnerDisplayName,
  resolvePartnerDisplayNameWithSource,
  reduceLobbyInfoMsg,
  reduceStatusMsg,
  isHubPartnerLeaveDetail,
  shouldApplyPartnerGeo,
  starNeedMinutes,
  starProgress as starProgressOf,
  useBackgroundMediaPause,
  useSearchPulse,
  type LivePhase,
  type PeerPick,
} from "../src/live";
import {
  pickPrimaryPeerIndex,
  peerStillListed,
  extrasAfterOmitPrimary,
} from "../src/live/matchPeers";
import {
  shouldSkipPrimaryStartCall,
  shouldKeepTrioOnCallEnded,
  routeInboundSignalTarget,
  routeInboundNoCamSlot,
  shouldIgnorePrimaryNoCam,
  shouldRehomePrimaryNoCam,
  latchThirdJoinerPeerIds,
} from "../src/live/matchContinuity";
import { isLookingForThird } from "../src/live/stageStreams";
import {
  DebateSession,
  debateRoundNumber,
  encodeDebateHubBody,
  formatDebateTimer,
  idleDebateSnapshot,
  parseDebateHubBody,
  type DebateSnapshot,
} from "../src/media/debate";
import {
  computeConnSlow,
  computeShowConnRetry,
  computeShowHardRetry,
  connLabelKey,
} from "../src/media/connectUi";
import { runConnectRetry } from "../src/media/connectRetry";
import { useLinkQuality } from "../src/media/linkQuality";
import { MediaSession, type MediaStreamLike } from "../src/media/MediaSession";
import {
  RECONNECT_FLAP_MS,
  remainingSecs,
  shouldStartReconnect,
  startReconnect,
  tickReconnect,
  type ReconnectSnap,
} from "../src/media/partnerReconnect";
import { loadPipPrefs } from "../src/media/pipPrefs";
import { useAutoConnectRetry } from "../src/media/useAutoConnectRetry";
import { useNetworkMediaPolicy } from "../src/media/useNetworkMediaPolicy";
import {
  clearMediaPermissionCache,
  ensureMediaPermissions,
  hasMediaPermissions,
} from "../src/permissions/media";
import {
  loadMatchPrefs,
  saveMatchPrefs,
  type LiveLayoutMode,
} from "../src/prefs/store";
import { rememberBlock } from "../src/safety/blocks";
import { pushReportHistory } from "../src/safety/reportHistory";
import {
  ReportSheet,
  type ReportReason,
} from "../src/safety/ReportSheet";
import { GiftFxOverlay, giftFxHoldMs } from "../src/stars/GiftFxOverlay";
import { GIFTS } from "../src/stars/gifts";
import { setAudioSession } from "../src/feedback/audioSession";
import {
  enterCallAudio,
  leaveCallAudio,
  playGiftChime,
  playStarGiftClick,
  playDebateBell,
  playDebateTickTock,
  playDebatePress,
  playMatchChime,
  preloadUiSounds,
} from "../src/feedback/sounds";
import * as Clipboard from "expo-clipboard";
import { useApp } from "./_layout";

/**
 * Stranger chats shorter than this auto-requeue (Next) when the partner leaves.
 * Explicit Stop still ends search. Friend calls never auto-search.
 */
/** Partner skip / leave (stranger) → always keep searching. No duration gate. */

/**
 * Non-ended track counts as live. Do not require readyState==="live"
 * (Android often stays muted until first frame) and never videoWidth
 * (laptop no-cam is a finished link).
 */
function trackLooksLive(t: { readyState?: string } | null | undefined): boolean {
  return !!t && t.readyState !== "ended";
}

function hasLiveRemoteAudio(stream: MediaStreamLike | null | undefined): boolean {
  return (stream?.getAudioTracks?.() || []).some((t) =>
    trackLooksLive(t as { readyState?: string })
  );
}

function hasLiveRemoteVideoTrack(
  stream: MediaStreamLike | null | undefined
): boolean {
  return (stream?.getVideoTracks?.() || []).some((t) =>
    trackLooksLive(t as { readyState?: string })
  );
}

function hasLiveRemoteMedia(stream: MediaStreamLike | null | undefined): boolean {
  return hasLiveRemoteAudio(stream) || hasLiveRemoteVideoTrack(stream);
}

/**
 * True only when a remote video track is actually sending pictures.
 * Laptop no-cam still adds a sendrecv video transceiver (empty slot) —
 * RN exposes that as a muted track. Treating it as a camera wiped
 * partnerNoCam and sat on "Linking cameras…".
 */
function remoteVideoHasPicture(
  stream: MediaStreamLike | null | undefined
): boolean {
  return (stream?.getVideoTracks?.() || []).some((t) => {
    const tr = t as {
      readyState?: string;
      muted?: boolean;
      enabled?: boolean;
    } | null;
    if (!tr || tr.readyState === "ended") return false;
    // Laptop no-cam dummy sendrecv/recvonly: RN exposes a muted (often
    // enabled=false) empty video track. Treating that as a camera wiped
    // partnerNoCam and sat on "Linking cameras…".
    if (tr.muted === true) return false;
    if (tr.enabled === false) return false;
    return true;
  });
}

/**
 * 6–12 hex / partner_short who-sub is never a painted conversationalist name.
 * Friend-code hex is still a hex string — dock code field can keep it; name cannot.
 */
function paintSafePartnerName(
  raw: unknown,
  fallback: string,
  ids?: {
    peerId?: string | null;
    userId?: string | null;
    shortId?: string | null;
  }
): string {
  const s = String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!s || isHexIdLike(s) || isPlaceholderPartnerName(s, ids || {})) {
    return fallback || "Partner";
  }
  return s;
}

/**
 * Deep links (push / ruletka://live) can land here before 18+ rules.
 * HubProvider only mounts after rules — never call useHub until then.
 */
export default function LiveScreen() {
  const { rulesOk } = useApp();
  if (!rulesOk) return <Redirect href="/rules" />;
  return <LiveBody />;
}

function LiveBody() {
  const t = useT();
  const { lang } = useI18n();
  const insets = useSafeAreaInsets();
  const friendsOnly = isFriendsOnly();
  const {
    hub,
    userId,
    displayName,
    friendCode,
    stars,
    trust,
    trustEffective,
    addMessageListener,
    connected,
    lastError,
    clearLastError,
    friends,
    showToast,
    offerRatePrompt,
    setLiveBusy,
    setLiveRemoteCount,
    reconnectHub,
    outboundCall,
    findThirdIncoming,
    clearFindThirdIncoming,
  } = useHub();
  const starsRef = useRef(stars);
  const trustRef = useRef(trust);
  const trustEffectiveRef = useRef(trustEffective);
  const friendsRef = useRef(friends);
  starsRef.current = stars;
  trustRef.current = trust;
  trustEffectiveRef.current = trustEffective;
  friendsRef.current = friends;
  const mediaRef = useRef<MediaSession | null>(null);
  /** Second PC for multi-peer (party / 1v2) — shares primary local stream. */
  const media2Ref = useRef<MediaSession | null>(null);
  /** Third PC for 4-way (you + 3 remotes) — shares primary via adoptLocalStream (no 2nd GUM). */
  const media3Ref = useRef<MediaSession | null>(null);
  /**
   * Hub matched.force_relay for this call. Latched on matched; re-applied on
   * offer + startCall so pure-relay PC matches web (do not clear mid-match).
   */
  const forceRelayHubRef = useRef(false);
  const debateRef = useRef<DebateSession | null>(null);
  const stageRef = useRef<View>(null);
  const remotePeerId = useRef<string>("");
  const secondaryPeerId = useRef<string>("");
  /** 4-way tertiary remote peer id (extras[1]). */
  const tertiaryPeerId = useRef<string>("");
  /** Matched extras count — signal router must not wait for React extraPeers. */
  const extrasCountRef = useRef(0);
  /** Sync extras for omit-primary keep (state is a tick late). */
  const extraPeersRef = useRef<PeerPick[]>([]);
  /** Latest Matched peer ids (primary + extras) for inbound offer routing. */
  const listedPeerIdsRef = useRef<string[]>([]);
  /** Extra bye arrived before rematch — skip primary startCall on next Matched. */
  const extraDroppedKeepRef = useRef(false);
  /** Extra report/block drops that extra only — keep primary PC. */
  const dropExtraKeepPrimaryRef = useRef<
    ((slot: "2" | "3" | "all", why: string) => void) | null
  >(null);
  const partnerUserId = useRef<string>("");
  const partnerFriendCode = useRef<string>("");
  const partnerNameRef = useRef<string>("");
  /** Source of current dock name (hub/name/friend_code/prev/dc/…) for logs. */
  const partnerNameFromRef = useRef<string>("");
  /**
   * Real display names by hub user_id — survives hangup / rematch so dock
   * keeps «Драконов» when hub briefly sends empty name again.
   */
  const lastGoodNameByUidRef = useRef<Record<string, string>>({});
  const lastGoodStarsByUidRef = useRef<Record<string, number>>({});
  const lastGoodGeoByUidRef = useRef<
    Record<string, { flag: string; country: string; city: string }>
  >({});
  /** Last known partner ids for report/block (survives thrash rematch empty uid). */
  const lastPartnerIdsRef = useRef<{
    userId: string;
    peerId: string;
    friendCode: string;
    shortId: string;
  }>({ userId: "", peerId: "", friendCode: "", shortId: "" });
  /**
   * partner_geo that arrived before matched finished (or id-mismatch skip).
   * Applied on matched when peer ids/user_id line up.
   */
  const pendingPartnerGeoRef = useRef<{
    peer_id: string;
    user_id: string;
    flag: string;
    country: string;
    city: string;
    hide_ip: boolean | null;
  } | null>(null);
  /** Live partner geo/hide for identity-poll stop condition (refs avoid stale UI). */
  const partnerFlagRef = useRef("");
  const partnerCountryRef = useRef("");
  const partnerCityRef = useRef("");
  const partnerHideIpRef = useRef(false);
  /**
   * True once partner_identity DC delivered an explicit stars field (incl. 0).
   * Identity poll waits for this so web ★>0 cannot stay unpainted.
   */
  const identityStarsKnownRef = useRef(false);
  /** Hub MatchPeer starsKnown for this partner — do not wipe with unknown 0. */
  const hubStarsKnownRef = useRef(false);
  /** Self geo for partner_identity announce (parity with web). */
  const selfGeoRef = useRef<{ flag: string; country: string; city: string }>({
    flag: "",
    country: "",
    city: "",
  });
  const selfHideIpRef = useRef(false);
  const selfCosmeticFlagRef = useRef("");
  const identityPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const identityPollStartedAtRef = useRef(0);
  const phaseRef = useRef<LivePhase>("idle");
  const searchingRef = useRef(false);
  /** Hub confirmed us in the stranger queue (status phase=waiting). */
  const queueAckedRef = useRef(false);
  const matchModeRef = useRef("");
  const reportShotB64 = useRef<string | null>(null);
  const iceHasTurnRef = useRef(false);
  /** Role for this match — needed for hard PC recreate on Retry. */
  const isOffererRef = useRef(false);
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);
  const debateMicLockedRef = useRef(false);
  /** Privacy: cam was auto-disabled while app backgrounded mid-call. */
  const bgPausedCamRef = useRef(false);
  /** Privacy: mic was auto-muted while app backgrounded mid-call. */
  const bgPausedMicRef = useRef(false);
  const userIdRef = useRef(userId);
  const displayNameRef = useRef(displayName);
  userIdRef.current = userId;
  displayNameRef.current = displayName;

  const [phase, setPhase] = useState<LivePhase>("idle");
  const [log, setLog] = useState<string[]>([]);
  // Debug log hidden in store builds — long-press meta to reveal
  const [showLog, setShowLog] = useState(!!__DEV__);
  const [logUnlocked, setLogUnlocked] = useState(!!__DEV__);
  const [online, setOnline] = useState(0);
  const [waiting, setWaiting] = useState(0);
  /** Hub acked queue membership (status phase waiting) — drives "In queue" vs "Joining…". */
  const [queueAcked, setQueueAcked] = useState(false);
  const [partner, setPartner] = useState("");
  const [partnerStars, setPartnerStars] = useState(0);
  const [partnerTrust, setPartnerTrust] = useState(0);
  const [partnerFlag, setPartnerFlag] = useState("");
  const [partnerCountry, setPartnerCountry] = useState("");
  const [partnerCity, setPartnerCity] = useState("");
  const [partnerHideIp, setPartnerHideIp] = useState(false);
  /** Partner dock photo (data URL / https / file). Empty → letter fallback. */
  const [partnerAvatar, setPartnerAvatar] = useState("");
  const partnerAvatarRef = useRef("");
  partnerAvatarRef.current = partnerAvatar;
  // Keep geo/hide refs in lockstep with state (identity poll + logs).
  partnerFlagRef.current = partnerFlag;
  partnerCountryRef.current = partnerCountry;
  partnerCityRef.current = partnerCity;
  partnerHideIpRef.current = partnerHideIp;
  /** Local mute of remote audio (you stop hearing them). */
  const [partnerMuted, setPartnerMuted] = useState(false);
  const partnerMutedRef = useRef(false);
  /** Partner muted our audio on their device — show same mute veil on self. */
  const [theyMutedMe, setTheyMutedMe] = useState(false);
  const theyMutedMeRef = useRef(false);
  theyMutedMeRef.current = theyMutedMe;
  /** Mount-time hub/DC handlers call through this ref. */
  const applyTheyMutedMeRef = useRef<(muted: boolean, why: string) => void>(
    () => {}
  );
  /** Inbound gift_fx (P2P / hub signal) — paint self or partner tile. */
  const applyInboundGiftFxRef = useRef<
    (msg: Record<string, unknown>, why: string) => void
  >(() => {});
  const [findThirdPending, setFindThirdPending] = useState(false);
  /**
   * Find-3rd / browse-together hunt while still in media with first partner.
   * Distinct from pure queue search — stage must split (partner + looking).
   */
  const [huntingWithPartner, setHuntingWithPartner] = useState(false);
  const huntingWithPartnerRef = useRef(false);
  huntingWithPartnerRef.current = huntingWithPartner;
  /** Hub Matched.your_role — party = original pair; solo = the 3rd. */
  const [yourRole, setYourRole] = useState("solo");
  const yourRoleRef = useRef("solo");
  yourRoleRef.current = yourRole;
  /** Extra match peers (beyond primary) for multi-tile UI. */
  const [extraPeers, setExtraPeers] = useState<PeerPick[]>([]);
  /** Per-extra remote mute (tile volume). LiveStageVideo has no onTileVolume yet. */
  const extraMuted2Ref = useRef(false);
  const extraMuted3Ref = useRef(false);
  const [extraMuted2, setExtraMuted2] = useState(false);
  const [extraMuted3, setExtraMuted3] = useState(false);
  useEffect(() => {
    if (extraPeers.length < 1) {
      extraMuted2Ref.current = false;
      setExtraMuted2(false);
    }
    if (extraPeers.length < 2) {
      extraMuted3Ref.current = false;
      setExtraMuted3(false);
    }
  }, [extraPeers.length]);
  /** When multi: show secondary peer in the top tile (tap to swap focus). */
  const [focusExtra, setFocusExtra] = useState(false);
  const [dataSaverOn, setDataSaverOn] = useState(false);
  /** Swipe partner video → Next (default ON, MatchPrefs.swipeSkip). */
  const [swipeSkipOn, setSwipeSkipOn] = useState(true);
  /** One-shot swipe coach toast (AsyncStorage key below). */
  const swipeCoachShownRef = useRef(false);
  /** native = bottom call bar; browser = full-bleed dock over video */
  const [liveLayout, setLiveLayout] = useState<LiveLayoutMode>("native");
  const isBrowserLayout = liveLayout === "browser";
  /**
   * Stranger safety veil over partner video (friends never start veiled).
   * Modes: off | intro (brief frost) | hold (until Show video).
   */
  const [remoteBlurred, setRemoteBlurred] = useState(false);
  const remoteBlurredRef = useRef(false);
  remoteBlurredRef.current = remoteBlurred;
  /** More sheet — declared early so togglePartnerBlur can close it without TDZ. */
  const [moreOpen, setMoreOpen] = useState(false);
  /** Which face the More / report sheet targets. Bottom ⋯ is always primary. */
  const [actionSlot, setActionSlot] = useState<
    "primary" | "extra0" | "extra1"
  >("primary");
  const actionSlotRef = useRef<"primary" | "extra0" | "extra1">("primary");
  actionSlotRef.current = actionSlot;
  /**
   * Partner hid their camera (web setSelfBlur / mobile camOff via self_hide DC).
   * Stage shows NoCamPortrait — never pure black OLED frames. Not privacy blur.
   */
  const [partnerCamHidden, setPartnerCamHidden] = useState(false);
  const partnerCamHiddenRef = useRef(false);
  partnerCamHiddenRef.current = partnerCamHidden;
  /** Laptop advertised zero video tracks. Not Hide, not "frames not yet". */
  const [partnerNoCam, setPartnerNoCam] = useState(false);
  const partnerNoCamRef = useRef(false);
  partnerNoCamRef.current = partnerNoCam;
  const [extraNoCam2, setExtraNoCam2] = useState(false);
  const [extraNoCam3, setExtraNoCam3] = useState(false);
  /** @deprecated use blurModeRef — kept for any leftover true checks */
  const blurStrangersRef = useRef(true);
  // Until AsyncStorage returns, do not assume off forever — match path uses
  // intro as optimistic default; prefs_load applies real mode (incl. off).
  const blurModeRef = useRef<BlurStrangersMode>("intro");
  // Must stay defined — 0.1.388 crashed Live (`blurMode` missing).
  const [blurMode, setBlurMode] = useState<BlurStrangersMode>("intro");
  void blurMode;
  const blurPrefsReadyRef = useRef(false);
  /** True when veil was applied by match/prefs auto — not eye toggle. */
  const blurAutoAppliedRef = useRef(false);
  /**
   * This stranger match wants intro/hold auto-veil until applied + settled
   * (or user peels). Survives keepPrimary rematch / stream-before-Matched
   * races so remote_stream can re-call applyMatchBlurVeil.
   */
  const blurWantAutoRef = useRef(false);
  /**
   * Bumped on each new primary match (!keepPrimary). Peel records the gen so
   * keepPrimary bootstrap does not re-veil after intro_auto / eye / prefs_off.
   */
  const matchBlurGenRef = useRef(0);
  const blurPeelGenRef = useRef(-1);
  const introUnblurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  /** Intro veil: brief soft cover after partner frames, then auto-reveal. */
  const INTRO_UNBLUR_MS = 2800;
  /** Re-poll interval while waiting for inbound frames (no infinite loop). */
  const INTRO_FRAME_POLL_MS = 400;
  /** Max re-arms after first delay (3 × 1.2s → ~6.4s; wall clock caps ~8s). */
  const INTRO_FRAME_REARM_MAX = 3;
  /** Wall-clock max from schedule start; peel if still no frames. */
  const INTRO_UNBLUR_MAX_WAIT_MS = 8000;
  /** Log without depending on `push` (declared later in this component). */
  const blurLog = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 50));
  }, []);

  const clearIntroUnblurTimer = useCallback(() => {
    if (introUnblurTimerRef.current) {
      clearTimeout(introUnblurTimerRef.current);
      introUnblurTimerRef.current = null;
    }
  }, []);

  /**
   * Drop privacy veil. RTCView stays mounted. Do NOT remount / re-emit the
   * remote stream when pictures already painted — intro_auto + forceRepaint
   * was "blur 2–3s → Linking → black" (shots 20260814T091900Z).
   */
  const revealPartnerVideo = useCallback(
    (why: string) => {
      clearIntroUnblurTimer();
      setRemoteBlurred(false);
      remoteBlurredRef.current = false;
      blurAutoAppliedRef.current = false;
      // Stop stream-ready re-apply after any peel (intro_auto, toggle, prefs_off)
      blurWantAutoRef.current = false;
      blurPeelGenRef.current = matchBlurGenRef.current;
      blurLog(`blur off (${why})`);
      console.log(`[blur] hide why=${why}`);
      // Intro peel: drop SoftBlur overlay only. RTCView stayed mounted
      // underneath. forceRepaintRemote remounts the stream and was
      // blur → navy (391). Do not arm Linking.
      if (why.startsWith("intro_")) {
        return;
      }
      const alreadyPainting = !!mediaRef.current?.hasInboundVideoFrames?.();
      if (alreadyPainting) {
        return;
      }
      try {
        mediaRef.current?.forceRepaintRemote?.(why);
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          if (!mediaRef.current?.hasInboundVideoFrames?.()) {
            mediaRef.current?.forceRepaintRemote?.(`${why}_kick`);
          }
        } catch {
          /* ignore */
        }
      }, 500);
    },
    [clearIntroUnblurTimer, blurLog]
  );

  /**
   * Schedule intro auto-reveal only after partner video is actually painting.
   * A3: never loop forever on missing frames — max ~3 re-arms (1.2s) after
   * first 2.8s, or wall-clock ~8s from this schedule call, then peel.
   */
  const scheduleIntroUnblur = useCallback(() => {
    if (blurModeRef.current !== "intro") return;
    if (!remoteBlurredRef.current) return;
    clearIntroUnblurTimer();
    const t0 = Date.now();
    let rearmCount = 0;
    const tick = (delay: number) => {
      introUnblurTimerRef.current = setTimeout(() => {
        introUnblurTimerRef.current = null;
        if (phaseRef.current !== "matched") return;
        if (!remoteBlurredRef.current) return;
        if (blurModeRef.current !== "intro") return;
        // Do not peel onto a black stage. videoSeenRef is not frames.
        const frames = !!mediaRef.current?.hasInboundVideoFrames?.();
        if (!frames) {
          const waited = Date.now() - t0;
          const hitRearmCap = rearmCount >= INTRO_FRAME_REARM_MAX;
          const hitWall = waited >= INTRO_UNBLUR_MAX_WAIT_MS;
          if (hitRearmCap || hitWall) {
            blurLog(
              `blur intro max wait rearm=${rearmCount} waited=${waited}ms`
            );
            console.log(
              `[blur] intro max wait peel why=intro_timeout rearm=${rearmCount} waited=${waited}ms`
            );
            revealPartnerVideo("intro_timeout");
            return;
          }
          rearmCount += 1;
          blurLog(`blur intro wait frames rearm=${rearmCount}`);
          tick(INTRO_FRAME_POLL_MS);
          return;
        }
        revealPartnerVideo("intro_auto");
      }, delay);
    };
    // Hop A: peel as soon as inbound frames exist. Do not sit 2.8s on a live face.
    // No frames yet: poll (not a 2.8s dead wait). Hold mode never uses this timer.
    const already = !!mediaRef.current?.hasInboundVideoFrames?.();
    tick(already ? 0 : 200);
  }, [clearIntroUnblurTimer, revealPartnerVideo, blurLog]);

  /**
   * Auto privacy veil for stranger matches (prefs intro/hold).
   * Friends never auto-veil; eye toggle still works for everyone mid-call.
   * Call sites: match, remote_stream (belt), prefs_load, settings_focus.
   */
  const applyMatchBlurVeil = useCallback(
    (why: string, opts?: { isFriend?: boolean }) => {
      if (phaseRef.current !== "matched") return;
      const isFriend =
        !!opts?.isFriend || matchModeRef.current === "friend";
      if (isFriend) {
        blurWantAutoRef.current = false;
        return;
      }
      const mode = blurModeRef.current || "intro";
      if (mode !== "hold" && mode !== "intro") {
        blurWantAutoRef.current = false;
        return;
      }
      // Mark want so a later remote_stream can re-apply if this paint was lost
      blurWantAutoRef.current = true;
      if (remoteBlurredRef.current) {
        // Already veiled: intro re-arms timer; hold cancels auto-reveal
        if (mode === "intro") scheduleIntroUnblur();
        else clearIntroUnblurTimer();
        blurAutoAppliedRef.current = true;
        return;
      }
      clearIntroUnblurTimer();
      setRemoteBlurred(true);
      remoteBlurredRef.current = true;
      blurAutoAppliedRef.current = true;
      blurLog(`blur on (${why}) mode=${mode}`);
      console.log(`[blur] show why=${why} mode=${mode}`);
      if (mode === "intro") scheduleIntroUnblur();
    },
    [clearIntroUnblurTimer, scheduleIntroUnblur, blurLog]
  );
  const applyMatchBlurVeilRef = useRef(applyMatchBlurVeil);
  applyMatchBlurVeilRef.current = applyMatchBlurVeil;

  /** Eye / more-sheet: toggle privacy veil (strangers + friends). */
  const togglePartnerBlur = useCallback(() => {
    hapticLight();
    // Close more sheet so eye path is immediate on stage SoftBlur
    setMoreOpen(false);
    if (remoteBlurredRef.current) {
      revealPartnerVideo("toggle_unblur");
      showToastRef.current(
        t("mobile.live.partnerVideoOn") || "Partner video shown"
      );
      return;
    }
    // Only mid-match (or matched ui) — never veil idle/search stage
    if (phaseRef.current !== "matched") {
      console.log("[blur] toggle ignored phase=" + phaseRef.current);
      return;
    }
    clearIntroUnblurTimer();
    setRemoteBlurred(true);
    remoteBlurredRef.current = true;
    // Manual eye — do not auto-clear when prefs later say off
    blurAutoAppliedRef.current = false;
    blurLog("blur on (toggle)");
    console.log("[blur] show why=toggle");
    showToastRef.current(
      t("mobile.live.reblurToast") ||
        "Privacy veil — tap Show video when ready"
    );
  }, [clearIntroUnblurTimer, revealPartnerVideo, blurLog, t]);
  const [matchMode, setMatchModeState] = useState("");
  const setMatchMode = useCallback((m: string) => {
    matchModeRef.current = m;
    setMatchModeState(m);
  }, []);
  const [conn, setConn] = useState("");
  const connRef = useRef("");
  const iceStateRef = useRef("");
  const [reconnectSnap, setReconnectSnap] = useState<ReconnectSnap>(null);
  const reconnectSnapRef = useRef<ReconnectSnap>(null);
  const hadConnectedThisMatchRef = useRef(false);
  const iceDownSinceRef = useRef(0);
  const reconnectFlapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const nextActionRef = useRef<() => void>(() => {});
  const tryStartPartnerReconnectRef = useRef<(why: string) => void>(() => {});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStreamLike | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStreamLike | null>(
    null
  );
  const [remoteStream2, setRemoteStream2] = useState<MediaStreamLike | null>(
    null
  );
  const [remoteStream3, setRemoteStream3] = useState<MediaStreamLike | null>(
    null
  );
  const [remoteEpoch, setRemoteEpoch] = useState(0);
  const [remoteEpoch2, setRemoteEpoch2] = useState(0);
  const [remoteEpoch3, setRemoteEpoch3] = useState(0);
  /** Stable stream URL — skip epoch remount when onRemoteStream re-fires same stream. */
  const remoteStreamUrlRef = useRef("");
  const remoteStream2UrlRef = useRef("");
  const remoteStream3UrlRef = useRef("");
  const [webrtcOk, setWebrtcOk] = useState(false);
  const [mediaBlocked, setMediaBlocked] = useState(false);
  const [giftFlash, setGiftFlash] = useState<string | null>(null);
  /** Active gift effect id for stage chrome (bars, confetti, …). */
  const [giftEffect, setGiftEffect] = useState<string | null>(null);
  /** Bars on partner tile (conversationalist) — SurfaceView-safe path. */
  const [partnerFx, setPartnerFx] = useState<string | null>(null);
  /** Bars on self cam when someone barred you. */
  const [selfFx, setSelfFx] = useState<string | null>(null);
  const partnerFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const giftFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraFx0TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraFx1TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [extraGiftFx0, setExtraGiftFx0] = useState<string | null>(null);
  const [extraGiftFx1, setExtraGiftFx1] = useState<string | null>(null);
  const [friendAdded, setFriendAdded] = useState(false);
  const [partnerCode, setPartnerCode] = useState("");
  const [chat, setChat] = useState<{ from: string; body: string }[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const chatScrollRef = useRef<ScrollView>(null);
  const actionLockRef = useRef(0);
  /** please_stay gift: block Next until this timestamp (ms). */
  const stayUntilRef = useRef(0);
  /** Block accidental Next for a short window after match. */
  const nextGraceUntilRef = useRef(0);
  /** Fire once when remote video first binds. */
  const remoteVideoSeenRef = useRef(false);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [stayRemSecs, setStayRemSecs] = useState(0);
  /** Live chat max chars (P2P + hub). */
  const CHAT_MAX = 280;
  const starReadyNotifiedRef = useRef(false);
  const [lastMatchHint, setLastMatchHint] = useState<MatchHistoryEntry | null>(
    null
  );
  const [alone, setAlone] = useState(false);
  const [rateMinSecs, setRateMinSecs] = useState(15 * 60);
  const [matchStartedAt, setMatchStartedAt] = useState(0);
  const [searchArmed, setSearchArmed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCapturing, setReportCapturing] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportShotUri, setReportShotUri] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [debate, setDebate] = useState<DebateSnapshot>(() => idleDebateSnapshot());
  const [debateComposeOpen, setDebateComposeOpen] = useState(false);
  const [debateTopicDraft, setDebateTopicDraft] = useState("");
  const [debateTurnSecs, setDebateTurnSecs] = useState(30);
  const [starGiftPop, setStarGiftPop] = useState<{
    title: string;
    sub: string;
  } | null>(null);
  const starGiftPopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dcOpen, setDcOpen] = useState(false);
  const [statusFlash, setStatusFlash] = useState<string | null>(null);
  const [connSince, setConnSince] = useState(0);
  const [retryBusy, setRetryBusy] = useState(false);
  const [awaitingRemoteVideo, setAwaitingRemoteVideo] = useState(false);
  /** Adaptive outbound quality label (high|mid|low|min). */
  const [qualityTier, setQualityTier] = useState("");
  const [swapViews, setSwapViews] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 320, h: 480 });
  // Follow physical rotate (app.json default + manifest fullUser).
  // LiveStageVideo also listens; keep parent stageW/H in sync so chrome reflows.
  useEffect(() => {
    const apply = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      setStageSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    const win = Dimensions.get("window");
    apply(win.width, win.height);
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      apply(window.width, window.height);
    });
    return () => {
      sub?.remove?.();
    };
  }, []);
  const [pipHint, setPipHint] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);
  const [earpiece, setEarpiece] = useState(false);
  const lastDebateSpeakerRef = useRef("");
  const lastDebateUrgentRef = useRef(false);
  const lastDebateActiveRef = useRef(false);
  const lastDebateTickTockRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const matchStartedAtRef = useRef(0);
  const rateMinSecsRef = useRef(15 * 60);
  const ratedThisMatchRef = useRef(false);
  const showToastRef = useRef(showToast);
  const offerRateRef = useRef(offerRatePrompt);
  showToastRef.current = showToast;
  offerRateRef.current = offerRatePrompt;
  // t for hooks that only read via ref (bg media, debate mount effect)
  const tRef = useRef(t);
  tRef.current = t;

  const push = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 50));
  }, []);

  function clearPartnerReconnectArm() {
    iceDownSinceRef.current = 0;
    if (reconnectFlapTimerRef.current) {
      clearTimeout(reconnectFlapTimerRef.current);
      reconnectFlapTimerRef.current = null;
    }
  }

  function markPartnerConnectedThisMatch() {
    hadConnectedThisMatchRef.current = true;
    clearPartnerReconnectArm();
  }

  /** Stranger 1v1 only. Hunt / party_browse / extras keep the partner (web canPartnerReconnectWait). */
  function canAndroidPartnerReconnectWait() {
    if (phaseRef.current !== "matched") return false;
    if (matchModeRef.current === "friend") return false;
    if (matchModeRef.current === "party_browse") return false;
    if (friendsOnly) return false;
    if (extrasCountRef.current > 0) return false;
    if (huntingWithPartnerRef.current) return false;
    if (!hadConnectedThisMatchRef.current) return false;
    return true;
  }

  function tryStartPartnerReconnect(why: string) {
    if (reconnectSnapRef.current) return;
    if (!canAndroidPartnerReconnectWait()) return;
    const now = Date.now();
    if (!iceDownSinceRef.current) iceDownSinceRef.current = now;
    const arm = () => {
      reconnectFlapTimerRef.current = null;
      if (reconnectSnapRef.current) return;
      if (!canAndroidPartnerReconnectWait()) return;
      const t1 = Date.now();
      if (!shouldStartReconnect(iceDownSinceRef.current, t1)) return;
      const snap = startReconnect(t1);
      reconnectSnapRef.current = snap;
      setReconnectSnap(snap);
      push(`reconnect start chance=${snap.chance} ${why}`);
    };
    if (shouldStartReconnect(iceDownSinceRef.current, now)) {
      arm();
      return;
    }
    if (reconnectFlapTimerRef.current) return;
    const wait = RECONNECT_FLAP_MS - (now - iceDownSinceRef.current);
    reconnectFlapTimerRef.current = setTimeout(arm, Math.max(0, wait));
  }
  tryStartPartnerReconnectRef.current = tryStartPartnerReconnect;

  const flashStatus = useCallback((line: string) => {
    setStatusFlash(line);
    push(line);
  }, [push]);

  useEffect(() => {
    if (!statusFlash) return;
    const t = setTimeout(() => setStatusFlash(null), 3200);
    return () => clearTimeout(t);
  }, [statusFlash]);

  // Keep phase/partner name in refs for debate callbacks.
  // Do not clobber a better DC-upgraded ref with stale "Partner" state mid-batch.
  // Never wipe a real name when React state briefly goes "" (hangup race / rematch).
  phaseRef.current = phase;
  connRef.current = conn;
  {
    const ids = {
      peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId || "",
      userId: partnerUserId.current || lastPartnerIdsRef.current.userId || "",
      shortId: lastPartnerIdsRef.current.shortId || "",
    };
    if (!partner) {
      // Mid-match empty state must not erase "Драконов" before next paint
      if (phaseRef.current !== "matched") {
        /* hangup path clears via lastName cache — keep ref until new partner */
      }
    } else if (
      !partnerNameRef.current ||
      partner === partnerNameRef.current ||
      isBetterPartnerDisplayName(partner, partnerNameRef.current, ids)
    ) {
      partnerNameRef.current = partner;
    }
    // else: keep superior ref (e.g. DC name while setPartner still flushing)
  }

  /** Upgrade dock name when hub omitted it but DC/chat carries a real label. */
  const applyPartnerNameFrom = useCallback(
    (raw: unknown, source: string) => {
      const ids = {
        peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId || "",
        userId: partnerUserId.current || lastPartnerIdsRef.current.userId || "",
        shortId: lastPartnerIdsRef.current.shortId || "",
      };
      const cur = partnerNameRef.current || partner || "";
      const next = String(raw ?? "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim()
        .slice(0, 32);
      if (!next) return false;
      // Never latch 6–12 hex / partner_short / anon as the dock name.
      if (isHexIdLike(next) || isPlaceholderPartnerName(next, ids)) return false;
      if (!isBetterPartnerDisplayName(next, cur, ids)) return false;
      partnerNameRef.current = next;
      partnerNameFromRef.current = source;
      setPartner(next);
      const uid = String(
        partnerUserId.current || lastPartnerIdsRef.current.userId || ""
      )
        .trim()
        .toLowerCase();
      if (uid && !isPlaceholderPartnerName(next, ids)) {
        lastGoodNameByUidRef.current[uid] = next;
      }
      console.log(`[match] name=${next} from=${source}`);
      push(`partner_name from=${source} name=${next}`);
      return true;
    },
    [partner, push]
  );
  const applyPartnerNameFromRef = useRef(applyPartnerNameFrom);
  applyPartnerNameFromRef.current = applyPartnerNameFrom;

  /** Announce our display name + stars/trust/geo (+ optional name_req) over P2P DC. */
  const sendPartnerIdentityP2p = useCallback(
    (opts?: { request?: boolean }) => {
      const media = mediaRef.current;
      if (!media?.isDataChannelOpen?.()) return false;
      const myName = String(displayNameRef.current || "").trim().slice(0, 32);
      // Never announce hex/anon poison as our name
      const safeName =
        myName &&
        !isPlaceholderPartnerName(myName, {
          peerId: "",
          userId: userIdRef.current || "",
        })
          ? myName
          : "";
      // Self ledger from hub hello — 0 is valid empty; peer paints max(stars,trust).
      const starsN = Math.max(0, Math.floor(Number(starsRef.current) || 0));
      const trustN = Math.max(
        0,
        Math.floor(
          Number(trustEffectiveRef.current || trustRef.current || 0) || 0
        )
      );
      // Public geo for partner chrome (parity with web). hide_ip → cosmetic flag only.
      const hideIp = !!selfHideIpRef.current;
      const self = selfGeoRef.current;
      const prefFlag = String(selfCosmeticFlagRef.current || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2);
      const geoFlag = String(self.flag || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2);
      const flagRaw = hideIp ? prefFlag || geoFlag : geoFlag || prefFlag;
      const country = hideIp
        ? ""
        : String(self.country || "").trim().slice(0, 48);
      const city = hideIp ? "" : String(self.city || "").trim().slice(0, 48);
      const payload: Record<string, unknown> = {
        v: 1,
        type: "partner_identity",
        user_id: userIdRef.current || "",
        name: safeName,
        friend_code: String(friendCode || "").trim().toUpperCase(),
        stars: starsN,
        trust: trustN,
        flag: flagRaw || "",
        country,
        city,
        hide_ip: !!hideIp,
        ts: Date.now(),
      };
      let ok = false;
      try {
        ok = !!media.sendDataMessage(payload);
      } catch {
        ok = false;
      }
      try {
        console.log(
          `[match] identity→ name=${safeName || "-"} ★${starsN} trust=${trustN} flag=${flagRaw || "-"} country=${country || "-"} city=${city || "-"} hide=${hideIp ? 1 : 0} ok=${ok ? 1 : 0} req=${opts?.request ? 1 : 0}`
        );
      } catch {
        /* ignore */
      }
      if (opts?.request) {
        try {
          media.sendDataMessage({
            v: 1,
            type: "name_req",
            user_id: userIdRef.current || "",
            ts: Date.now(),
          });
        } catch {
          /* ignore */
        }
      }
      return ok;
    },
    [friendCode]
  );
  const sendPartnerIdentityP2pRef = useRef(sendPartnerIdentityP2p);
  sendPartnerIdentityP2pRef.current = sendPartnerIdentityP2p;

  const clearIdentityPoll = useCallback(() => {
    if (identityPollTimerRef.current) {
      clearInterval(identityPollTimerRef.current);
      identityPollTimerRef.current = null;
    }
    identityPollStartedAtRef.current = 0;
  }, []);

  /**
   * After match + DC open: re-request partner_identity every 2s for up to 12s
   * until (loc non-empty OR hide) AND identity★ received at least once.
   */
  const startIdentityPoll = useCallback(() => {
    clearIdentityPoll();
    if (phaseRef.current !== "matched") return;
    const media = mediaRef.current;
    if (!media?.isDataChannelOpen?.()) return;
    identityPollStartedAtRef.current = Date.now();
    const tick = () => {
      if (phaseRef.current !== "matched") {
        clearIdentityPoll();
        return;
      }
      if (!mediaRef.current?.isDataChannelOpen?.()) {
        // DC dropped — keep timer; onDataChannel reopen restarts poll.
        return;
      }
      const locOk =
        partnerHideIpRef.current ||
        partnerGeoHasSignal({
          flag: partnerFlagRef.current,
          country: partnerCountryRef.current,
          city: partnerCityRef.current,
        });
      // Spec: wait for at least one DC partner_identity with explicit ★
      // (incl. 0). Hub MatchPeer alone does not stop the poll — web may
      // still send stars>0 that must paint over empty-ledger hub 0.
      const starsOk = identityStarsKnownRef.current;
      if (locOk && starsOk) {
        console.log(
          `[match] identity-poll done loc=1 id★=1 hub★=${hubStarsKnownRef.current ? 1 : 0}`
        );
        clearIdentityPoll();
        return;
      }
      const elapsed = Date.now() - identityPollStartedAtRef.current;
      if (elapsed >= 12000) {
        console.log(
          `[match] identity-poll timeout loc=${locOk ? 1 : 0} id★=${starsOk ? 1 : 0} hub★=${hubStarsKnownRef.current ? 1 : 0} ms=${elapsed}`
        );
        clearIdentityPoll();
        return;
      }
      try {
        sendPartnerIdentityP2pRef.current({ request: true });
      } catch {
        /* ignore */
      }
      console.log(
        `[match] identity-poll req loc=${locOk ? 1 : 0} id★=${starsOk ? 1 : 0} ms=${elapsed}`
      );
    };
    // Immediate request, then every 2s until done/timeout.
    tick();
    identityPollTimerRef.current = setInterval(tick, 2000);
  }, [clearIdentityPoll]);
  const startIdentityPollRef = useRef(startIdentityPoll);
  startIdentityPollRef.current = startIdentityPoll;
  const clearIdentityPollRef = useRef(clearIdentityPoll);
  clearIdentityPollRef.current = clearIdentityPoll;
  micOnRef.current = micOn;
  camOnRef.current = camOn;
  partnerMutedRef.current = partnerMuted;

  useBackgroundMediaPause({
    phaseRef,
    camOnRef,
    micOnRef,
    debateMicLockedRef,
    bgPausedCamRef,
    bgPausedMicRef,
    mediaRef,
    media2Ref,
    showToast: (msg) => showToastRef.current(msg),
    resumedMessage: () => tRef.current("mobile.live.mediaResumed"),
    onResumeRepaint: () => {
      // Epoch bump remounts RTCView after Android SurfaceView black-on-return
      setRemoteEpoch((n) => n + 1);
      setRemoteEpoch2((n) => n + 1);
    },
  });

  // Friends: Invite while matched; hide Invite when already 3 remotes (you+3).
  useEffect(() => {
    const matched = phase === "matched";
    setLiveBusy(matched);
    setLiveRemoteCount(matched ? 1 + extraPeers.length : 0);
    return () => {
      setLiveBusy(false);
      setLiveRemoteCount(0);
    };
  }, [phase, extraPeers.length, setLiveBusy, setLiveRemoteCount]);

  // Mid-chat ★ unlock progress tick + please_stay countdown
  useEffect(() => {
    if (phase !== "matched" || !matchStartedAt) return;
    const t = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (stayUntilRef.current > now) {
        setStayRemSecs(Math.ceil((stayUntilRef.current - now) / 1000));
      } else if (stayUntilRef.current > 0) {
        stayUntilRef.current = 0;
        setStayRemSecs(0);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, matchStartedAt]);

  useEffect(() => {
    if (uiPhase === "search" || uiPhase === "matched") {
      setSearchArmed(false);
    }
  }, [uiPhase]);

  // One-shot toast when ★ gift unlock becomes ready
  useEffect(() => {
    if (phase !== "matched" || !matchStartedAt) {
      starReadyNotifiedRef.current = false;
      return;
    }
    const elapsed = (nowTick - matchStartedAt) / 1000;
    const ready = rateMinSecs > 0 && elapsed >= rateMinSecs;
    if (ready && !starReadyNotifiedRef.current) {
      starReadyNotifiedRef.current = true;
      showToastRef.current(t("mobile.live.starReadyToast"));
      hapticMatch();
    }
  }, [phase, matchStartedAt, nowTick, rateMinSecs, t]);

  const { searchDots, searchSecs } = useSearchPulse(phase);

  // Keep hub/push/listener stable via refs so we never tear down MediaSession
  // (camera open/close) when Hub context re-renders.
  const hubRefLive = useRef(hub);
  const pushRef = useRef(push);
  const addMsgRef = useRef(addMessageListener);
  hubRefLive.current = hub;
  pushRef.current = push;
  addMsgRef.current = addMessageListener;

  // flash for debate — refreshed via ref so mount-only media effect stays stable
  const flashRef = useRef(flashStatus);
  flashRef.current = flashStatus;

  const resolveDebateStatus = useCallback((key: string) => {
    const snap = debateRef.current?.snapshot();
    const name = partnerNameRef.current || "Partner";
    const secs = Math.round((snap?.turnMs || 30_000) / 1000);
    const r = debateRoundNumber(snap?.turnIndex || 0);
    const tt = tRef.current;
    switch (key) {
      case "debate.inviteSent":
        return tt(key, { n: name });
      case "debate.incomingStatus":
        return tt(key, { n: name });
      case "debate.yourTurnRound":
        return tt(key, { n: r, s: secs });
      case "debate.theirTurnRound":
        return tt(key, { n: r });
      default:
        return tt(key);
    }
  }, []);

  useEffect(() => {
    setWebrtcOk(MediaSession.webrtcAvailable());
    const media = new MediaSession();
    mediaRef.current = media;
    const media2 = new MediaSession();
    media2Ref.current = media2;
    const media3 = new MediaSession();
    media3Ref.current = media3;
    const log = (line: string) => pushRef.current(line);

    const applyMicDesired = () => {
      if (debateMicLockedRef.current) {
        media.setMicEnabled(false);
        media2.setMicEnabled(false);
        media3.setMicEnabled(false);
      } else {
        media.setMicEnabled(micOnRef.current);
        media2.setMicEnabled(micOnRef.current);
        media3.setMicEnabled(micOnRef.current);
      }
    };

    const debate = new DebateSession({
      send: (msg) => {
        let ok = false;
        try {
          if (media.sendDataMessage(msg)) ok = true;
        } catch {
          /* ignore */
        }
        try {
          if (media2.sendDataMessage(msg)) ok = true;
        } catch {
          /* ignore */
        }
        try {
          if (media3.sendDataMessage(msg)) ok = true;
        } catch {
          /* ignore */
        }
        // Hub chat fans out to every room peer (laptop 3rd often has no extra DC).
        try {
          const body = encodeDebateHubBody(msg);
          if (body) {
            hubRefLive.current?.chat?.(body);
            ok = true;
          }
        } catch {
          /* ignore */
        }
        return ok;
      },
      myUserId: () => userIdRef.current || "",
      myName: () => displayNameRef.current || "anon",
      partnerUserId: () => partnerUserId.current || "",
      partnerName: () => partnerNameRef.current || "Partner",
      isMatched: () => phaseRef.current === "matched",
      isDcOpen: () =>
        media.isDataChannelOpen() ||
        media2.isDataChannelOpen() ||
        media3.isDataChannelOpen() ||
        phaseRef.current === "matched",
      roomUserIds: () => {
        const ids: string[] = [];
        const add = (id?: string) => {
          const s = String(id || "").trim();
          if (s && !ids.includes(s)) ids.push(s);
        };
        add(userIdRef.current || "");
        add(partnerUserId.current || "");
        add(secondaryPeerId.current || "");
        for (const extra of extraPeersRef.current || []) {
          add(extra?.userId);
          add(extra?.peerId);
        }
        return ids;
      },
      onStatus: (key) => {
        flashRef.current(resolveDebateStatus(key));
      },
      onMicLock: (lockedMute) => {
        debateMicLockedRef.current = lockedMute;
        applyMicDesired();
      },
      onChange: (snap) => {
        if (snap.active && !lastDebateActiveRef.current) {
          void playDebateBell();
        }
        lastDebateActiveRef.current = !!snap.active;
        // Haptics on speaker change; tick-tock last 10s for speaker only
        if (snap.active) {
          if (
            snap.speakerId &&
            snap.speakerId !== lastDebateSpeakerRef.current
          ) {
            if (lastDebateSpeakerRef.current) {
              hapticDebateTurn();
              void playDebatePress();
            }
            lastDebateSpeakerRef.current = snap.speakerId;
            lastDebateUrgentRef.current = false;
            lastDebateTickTockRef.current = false;
          }
          const iSpeak =
            !!snap.speakerId &&
            !!userIdRef.current &&
            snap.speakerId.toLowerCase() ===
              String(userIdRef.current).toLowerCase();
          try {
            const hold = !!snap.active && iSpeak;
            const applyListen = (
              sess: MediaSession | null,
              userMuted: boolean
            ) => {
              const wantHear = !userMuted && !hold;
              sess?.setRemoteAudioEnabled(wantHear);
              sess
                ?.getRemoteStream?.()
                ?.getAudioTracks?.()
                .forEach((tr) => {
                  tr.enabled = wantHear;
                });
            };
            applyListen(mediaRef.current, partnerMutedRef.current);
            applyListen(media2Ref.current, extraMuted2Ref.current);
            applyListen(media3Ref.current, extraMuted3Ref.current);
          } catch {
            /* ignore */
          }
          const last10 = snap.remMs > 0 && snap.remMs <= 10000;
          if (last10 && iSpeak && !lastDebateTickTockRef.current) {
            lastDebateTickTockRef.current = true;
            void playDebateTickTock();
          }
          if (!last10) lastDebateTickTockRef.current = false;
          const urgent = snap.remMs > 0 && snap.remMs <= 5000;
          if (urgent && !lastDebateUrgentRef.current) {
            lastDebateUrgentRef.current = true;
            hapticDebateUrgent();
          }
          if (!urgent) lastDebateUrgentRef.current = false;
        } else {
          lastDebateSpeakerRef.current = "";
          lastDebateUrgentRef.current = false;
          lastDebateTickTockRef.current = false;
          try {
            const restore = (sess: MediaSession | null, userMuted: boolean) => {
              sess?.setRemoteAudioEnabled(!userMuted);
              sess
                ?.getRemoteStream?.()
                ?.getAudioTracks?.()
                .forEach((tr) => {
                  tr.enabled = !userMuted;
                });
            };
            restore(mediaRef.current, partnerMutedRef.current);
            restore(media2Ref.current, extraMuted2Ref.current);
            restore(media3Ref.current, extraMuted3Ref.current);
          } catch {
            /* ignore */
          }
        }
        setDebate(snap);
      },
      track: (name, props) =>
        track(name, (props || {}) as Record<string, string | number | boolean>),
    });
    debateRef.current = debate;

    media.setHandlers({
      onLocalStream: (s) => {
        setLocalStream(s);
        setMediaBlocked(false);
        // 3-way extras keep clones of this preview — re-adopt after primary GUM.
        try {
          if (s) media2Ref.current?.adoptLocalStream?.(s);
        } catch {
          /* ignore */
        }
        try {
          if (s) media3Ref.current?.adoptLocalStream?.(s);
        } catch {
          /* ignore */
        }
      },
      onRemoteStream: (s) => {
        // Only remount RTCView when MediaStream URL changes — every ontrack
        // used to bump epoch and flash the partner stage while linking.
        if (!s) return;
        let urlChanged = true;
        try {
          const nextUrl = s?.toURL?.() || "";
          const prevUrl = remoteStreamUrlRef.current;
          if (prevUrl && nextUrl && prevUrl === nextUrl) urlChanged = false;
          if (nextUrl) remoteStreamUrlRef.current = nextUrl;
        } catch {
          urlChanged = true;
        }
        setRemoteStream(s);
        if (urlChanged) setRemoteEpoch((n) => n + 1);
        const vt = s?.getVideoTracks?.()?.length ?? 0;
        const at = s?.getAudioTracks?.()?.length ?? 0;
        // Live remote media must never leave the user on idle Start controls
        if (
          (vt > 0 || at > 0) &&
          phaseRef.current !== "matched" &&
          phaseRef.current !== "search"
        ) {
          setPhase("matched");
          phaseRef.current = "matched";
          searchingRef.current = false;
          log("phase→matched (remote media arrived while idle)");
        }
        // Any remote media (even audio-first) → leave "connecting" UI.
        // Blur modes:
        //  - intro: keep frosted veil ~2.5s after video ready, then auto-reveal
        //  - hold: stay covered until user taps Show video
        //  - off: never veiled
        // Never leave a solid black wall forever — that looked like "no camera".
        if (hasLiveRemoteMedia(s)) {
          // Any live audio OR video ends Linking. Do not cover a live PC cam
          // with a no-cam cylinder on audio-first (075019Z black tile).
          // partnerCamHidden / partnerNoCam stay TRUE only from advertised
          // no_cam / self_hide / cam_hide DC — never first audio-only stream.
          setAwaitingRemoteVideo(false);
          setConn("connected");
          setConnSince(0);
          if (remoteVideoHasPicture(s)) {
            // Real pictures: clear hide/no-cam overlays (dummy muted stays).
            setPartnerCamHidden(false);
            partnerCamHiddenRef.current = false;
            if (
              shouldRehomePrimaryNoCam({
                extrasCount: extrasCountRef.current,
                partnerNoCam: partnerNoCamRef.current,
                partnerCamHidden: partnerCamHiddenRef.current,
              })
            ) {
              setExtraNoCam2(true);
              log("rehome_nocam pictures→extra0");
            }
            setPartnerNoCam(false);
            partnerNoCamRef.current = false;
          }
          if (remoteVideoHasPicture(s) && !remoteVideoSeenRef.current) {
            remoteVideoSeenRef.current = true;
            setRemoteVideoReady(true);
            hapticMatch();
          }
          // Belt: ensure intro|hold auto-veil when partner media lands.
          // BM1 forensics: prefs intro but no [blur] show mid-match — Matched
          // path can miss (keepPrimary / thrash); stream ready re-applies once.
          // blurWantAutoRef is armed by Matched/prefs and cleared on any peel
          // so we never re-veil after intro_auto / eye / prefs_off.
          if (
            (vt > 0 || at > 0) &&
            phaseRef.current === "matched" &&
            blurWantAutoRef.current &&
            !remoteBlurredRef.current
          ) {
            applyMatchBlurVeilRef.current("remote_stream");
          } else if (remoteBlurredRef.current && vt > 0) {
            if (blurModeRef.current === "intro") {
              scheduleIntroUnblur();
            }
            // hold: wait for tap; off: shouldn't be blurred
          } else if (
            remoteBlurredRef.current &&
            vt === 0 &&
            at > 0 &&
            blurModeRef.current === "intro"
          ) {
            // Audio-only still: soft timer so we don't stay black forever
            setTimeout(() => {
              if (
                remoteBlurredRef.current &&
                phaseRef.current === "matched" &&
                blurModeRef.current === "intro" &&
                !(mediaRef.current?.getRemoteStream()?.getVideoTracks?.()
                  ?.length)
              ) {
                scheduleIntroUnblur();
              }
            }, 1800);
          }
        }
        // Re-apply local partner-mute if user already toggled it
        try {
          s.getAudioTracks?.().forEach((tr) => {
            tr.enabled = !partnerMutedRef.current;
          });
        } catch {
          /* ignore */
        }
        log(`remote stream tracks a=${at} v=${vt}`);
      },
      onSignal: (kind, payload) => {
        try {
          // Always use current primary peer id (after promote, refs may swap)
          const to = remotePeerId.current;
          hubRefLive.current.signal(
            kind,
            payload,
            to && to !== "legacy" ? to : ""
          );
        } catch (e) {
          log(`signal send fail ${e}`);
        }
      },
      onConnectionState: (s) => {
        // Soft labels for UI (raw still in debug log)
        const liveVt =
          media.getRemoteStream()?.getVideoTracks?.()?.length ?? 0;
        const liveAt =
          media.getRemoteStream()?.getAudioTracks?.()?.length ?? 0;
        // Never flip UI back to "Linking…" if video OR audio already exists
        // (no-cam partner is a finished link).
        if ((liveVt > 0 || liveAt > 0) && !s.startsWith("quality_tier")) {
          if (
            s === "connected" ||
            s.startsWith("remote_video_ok") ||
            s.startsWith("remote_tracks") ||
            s === "checking" ||
            s === "connecting" ||
            s.startsWith("ice_restart") ||
            s === "ice_stuck_retry" ||
            s.startsWith("no_remote_video")
          ) {
            setAwaitingRemoteVideo(false);
            setConn("connected");
            setConnSince(0);
            if (s.startsWith("remote_video_ok")) {
              const tm = /t=(\d+)ms/.exec(s);
              const ms = tm ? Number(tm[1]) : media.connectElapsedMs();
              track("video_ok", {
                ms: ms >= 0 ? ms : 0,
                turn: iceHasTurnRef.current ? 1 : 0,
              });
              track("connect_video_ms", {
                ms: ms >= 0 ? ms : 0,
                turn: iceHasTurnRef.current ? 1 : 0,
                quality: media.getQualityTier(),
              });
            }
            if (s === "datachannel_open") setDcOpen(true);
            log(
              `pc ${s} turn=${iceHasTurnRef.current ? "yes" : "no"} peer=${remotePeerId.current || "-"} (video live — keep connected UI)`
            );
            return;
          }
        }
        if (
          s === "connecting" ||
          s === "pc_ready_turn" ||
          s === "pc_ready_stun_only" ||
          s === "ice_stuck_retry" ||
          s.startsWith("ice_restart")
        ) {
          setConn((prev) => {
            if (prev !== "connecting" && prev !== "checking") {
              setConnSince(Date.now());
            }
            return "connecting";
          });
        } else if (s === "connected") {
          setConn("connected");
          setConnSince(0);
          markPartnerConnectedThisMatch();
          // Don't re-arm Linking if we already painted this match.
          setAwaitingRemoteVideo(
            liveVt === 0 &&
              liveAt === 0 &&
              !remoteVideoSeenRef.current
          );
        } else if (s.startsWith("remote_video_ok")) {
          setAwaitingRemoteVideo(false);
          setConn("connected");
          setConnSince(0);
          // timing string may include t=123ms
          const tm = /t=(\d+)ms/.exec(s);
          const ms = tm ? Number(tm[1]) : media.connectElapsedMs();
          track("video_ok", {
            ms: ms >= 0 ? ms : 0,
            turn: iceHasTurnRef.current ? 1 : 0,
          });
          track("connect_video_ms", {
            ms: ms >= 0 ? ms : 0,
            turn: iceHasTurnRef.current ? 1 : 0,
            quality: media.getQualityTier(),
          });
        } else if (s.startsWith("quality_tier ")) {
          const qt = s.replace(/^quality_tier\s+/, "").split(/\s/)[0] || "";
          if (qt) setQualityTier(qt);
          track("quality_tier", { tier: qt });
        } else if (s.startsWith("timing ")) {
          // Connect speed pipeline: timing offer_sent_ms=N / answer_applied / first_frame
          try {
            const msM = /\+(\d+)ms/.exec(s);
            const ms = msM ? Number(msM[1]) : -1;
            if (s.includes("offer_sent") || s.includes("offer_applied")) {
              track("connect_offer_ms", {
                ms: ms >= 0 ? ms : 0,
                turn: iceHasTurnRef.current ? 1 : 0,
              });
            } else if (s.includes("answer_sent") || s.includes("answer_applied")) {
              track("connect_answer_ms", {
                ms: ms >= 0 ? ms : 0,
                turn: iceHasTurnRef.current ? 1 : 0,
              });
            } else if (s.includes("first_frame")) {
              track("connect_first_frame_ms", {
                ms: ms >= 0 ? ms : 0,
                turn: iceHasTurnRef.current ? 1 : 0,
              });
            }
          } catch {
            /* ignore */
          }
        } else if (s.startsWith("CONNECT ")) {
          // Product users must not see connect stopwatch toast; Settings
          // "Last connect" + logcat remain for agents/verify.
          log(s);
          try {
            const t = mediaRef.current?.getLastConnectTiming?.();
            if (t) {
              void import("../src/media/lastConnectStats").then((m) =>
                m.saveLastConnectStats({
                  offerMs: t.offerMs,
                  answerMs: t.answerMs,
                  iceMs: t.iceMs,
                  firstFrameMs: t.firstFrameMs,
                  summary: t.summary || s.replace(/^CONNECT\s+/, ""),
                })
              );
            }
          } catch {
            /* ignore */
          }
        } else if (s.startsWith("startCall_reuse_warm") || s.startsWith("force_relay_rewarm") || s.startsWith("startCall_policy_rebuild")) {
          track("connect_warm_reuse", {
            reuse: s.startsWith("startCall_reuse_warm") ? 1 : 0,
            rewarm: s.startsWith("force_relay_rewarm") ? 1 : 0,
            rebuild: s.startsWith("startCall_policy_rebuild") ? 1 : 0,
          });
        } else if (s.startsWith("remote_tracks")) {
          // Audio-only so far — still a finished link (laptop no-cam).
          if (liveVt > 0 || liveAt > 0) setAwaitingRemoteVideo(false);
        } else if (s.startsWith("no_remote_video_retry")) {
          if (
            liveVt === 0 &&
            liveAt === 0 &&
            !remoteVideoSeenRef.current
          ) {
            setAwaitingRemoteVideo(true);
            setConn("connecting");
            setConnSince((t0) => t0 || Date.now());
          }
        } else if (s === "failed" || s === "disconnected" || s === "closed") {
          setConn(s);
          if (s === "failed" || s === "disconnected") {
            setConnSince((t0) => t0 || Date.now());
            // Do not closeCall during reconnect wait — ICE may recover.
            tryStartPartnerReconnectRef.current(`pc ${s}`);
          }
        } else if (s === "connected" || s === "completed") {
          markPartnerConnectedThisMatch();
        } else if (s === "datachannel_open") {
          setDcOpen(true);
        } else if (s === "checking" || s === "new") {
          setConn("connecting");
          setConnSince((t0) => t0 || Date.now());
        } else {
          setConn(s);
        }
        log(
          `pc ${s} turn=${iceHasTurnRef.current ? "yes" : "no"} peer=${remotePeerId.current || "-"}`
        );
      },
      onIceConnectionState: (s) => {
        iceStateRef.current = s;
        log(
          `ice ${s} turn=${iceHasTurnRef.current ? "yes" : "no"}`
        );
        if (s === "connected" || s === "completed") {
          markPartnerConnectedThisMatch();
        } else if (s === "failed" || s === "disconnected") {
          log(
            `path hint: if phone↔browser stuck, need TURN (has_turn=${iceHasTurnRef.current})`
          );
          // Do not closeCall during reconnect wait — ICE may recover.
          tryStartPartnerReconnectRef.current(`ice ${s}`);
        }
      },
      onDataChannel: (open) => {
        setDcOpen(open);
        log(`datachannel ${open ? "open" : "closed"}`);
        // Re-announce mute state when DC opens (muted before channel ready)
        if (open) {
          // Always announce our real display name + geo/★ (hub MatchPeer may
          // be empty/poison). Then poll partner_identity every 2s ≤12s until
          // loc+identity★ settled (or timeout).
          try {
            // Always request partner identity (name/★/geo). Poll continues
            // every 2s ≤12s until loc+identity★ settle.
            sendPartnerIdentityP2pRef.current({ request: true });
          } catch {
            /* ignore */
          }
          try {
            if (phaseRef.current === "matched") {
              startIdentityPollRef.current();
            }
          } catch {
            /* ignore */
          }
          try {
            debateRef.current?.sendSnapshot?.();
          } catch {
            /* ignore */
          }
          try {
            const payload = {
              v: 1,
              type: "partner_mute",
              muted: !!partnerMutedRef.current,
              user_id: userIdRef.current || "",
              name: displayNameRef.current || "anon",
              ts: Date.now(),
            };
            media.sendDataMessage(payload);
            try {
              // Broadcast to session (empty to=) — same as togglePartnerMute
              hubRefLive.current.signal(
                "partner_mute",
                JSON.stringify(payload),
                ""
              );
            } catch {
              /* hub optional */
            }
          } catch {
            /* ignore */
          }
          // Re-announce local Hide so web can show partner-hide UI
          try {
            if (!camOnRef.current) {
              const hidePayload = {
                v: 1,
                type: "self_hide",
                on: true,
                user_id: userIdRef.current || "",
                name: displayNameRef.current || "anon",
                ts: Date.now(),
              };
              media.sendDataMessage(hidePayload);
              try {
                hubRefLive.current.signal(
                  "self_hide",
                  JSON.stringify(hidePayload),
                  ""
                );
              } catch {
                /* hub optional */
              }
            }
          } catch {
            /* ignore */
          }
        }
      },
      onDataMessage: (msg) => {
        try {
          const typ = String(msg.type || "");
          if (typ.startsWith("debate_")) {
            log(`debate ← ${typ}`);
            debate.handleMessage(msg);
            return;
          }
          if (typ === "typing" || typ === "typing_stop") {
            setPeerTyping(typ === "typing");
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            if (typ === "typing") {
              typingTimerRef.current = setTimeout(
                () => setPeerTyping(false),
                3500
              );
            }
            // Typing often carries a real display name
            if (msg.name) applyPartnerNameFromRef.current(msg.name, "dc_typing");
            return;
          }
          if (typ === "partner_identity" || typ === "identity") {
            const fromUid = String(msg.user_id || msg.from || "").trim();
            if (
              fromUid &&
              userIdRef.current &&
              fromUid === userIdRef.current
            ) {
              return;
            }
            if (fromUid) notePartnerUserId(fromUid, "partner_identity");
            const fc = String(msg.friend_code || msg.friendCode || "")
              .trim()
              .toUpperCase();
            if (fc && !partnerFriendCode.current) {
              partnerFriendCode.current = fc;
              setPartnerCode(fc);
              lastPartnerIdsRef.current = {
                ...lastPartnerIdsRef.current,
                friendCode: fc,
              };
            }
            // Name: real display name beats friend_code paint; never stick on Partner.
            // Poison/empty name falls through to friend_code (never leave dock on Partner).
            {
              let named = false;
              if (msg.name) {
                named = !!applyPartnerNameFromRef.current(msg.name, "dc");
              }
              if (!named && fc) {
                applyPartnerNameFromRef.current(fc, "dc_code");
              }
            }
            // Stars / trust from peer DC (old hub may omit MatchPeer fields).
            // Explicit 0 is known (empty ledger / spend-to-zero) — still apply.
            // stars>0 from web MUST paint (merge nextKnown=true).
            const anyMsg = msg as Record<string, unknown>;
            const { stars: s, known: sKnown } = readPeerStars(anyMsg);
            const { trust: tr, known: tKnown } = readPeerTrust(anyMsg);
            if (sKnown) {
              identityStarsKnownRef.current = true;
              setPartnerStars((prev) =>
                mergePartnerStars({
                  samePartner: true,
                  prev,
                  next: s,
                  nextKnown: true,
                })
              );
            }
            if (tKnown) {
              setPartnerTrust((prev) =>
                mergePartnerTrust({
                  samePartner: true,
                  prev,
                  next: tr,
                  nextKnown: true,
                })
              );
            }
            // Geo from peer DC when hub partner_geo / MatchPeer geo empty
            const geo = readPeerGeo(anyMsg);
            const hasGeoField =
              !!geo.flag ||
              !!geo.country ||
              !!geo.city ||
              anyMsg.hide_ip != null ||
              anyMsg.hideIp != null;
            if (hasGeoField) {
              if (geo.hideIp) {
                setPartnerHideIp(true);
                setPartnerCountry("");
                setPartnerCity("");
                if (geo.flag) setPartnerFlag(geo.flag);
              } else {
                if (geo.flag) setPartnerFlag(geo.flag);
                if (geo.country) setPartnerCountry(geo.country);
                if (geo.city) setPartnerCity(geo.city);
                // Real geo ⇒ public (clear hide when peer sent country/city/flag)
                if (geo.flag || geo.country || geo.city) {
                  setPartnerHideIp(false);
                }
              }
            }
            const av = String(anyMsg.avatar || anyMsg.Avatar || "").trim();
            if (av) {
              partnerAvatarRef.current = av;
              setPartnerAvatar(av);
            }
            const paintName =
              String(msg.name || "").trim() ||
              fc ||
              partnerNameRef.current ||
              "-";
            console.log(
              `[match] identity← name=${paintName} from=dc ★${sKnown ? s : "?"} trust=${tKnown ? tr : "?"} flag=${geo.flag || "-"} country=${geo.country || "-"} city=${geo.city || "-"} hide=${geo.hideIp ? 1 : 0} code=${fc || partnerFriendCode.current || "-"}`
            );
            log(
              `[match] identity← name=${paintName} ★${sKnown ? s : "?"} trust=${tKnown ? tr : "?"} loc=${geo.flag || "-"}/${geo.country || "-"}/${geo.city || "-"}`
            );
            return;
          }
          if (typ === "name_req") {
            // Peer wants our display name — reply with identity announce
            try {
              sendPartnerIdentityP2pRef.current({ request: false });
            } catch {
              /* ignore */
            }
            return;
          }
          if (typ === "partner_mute" || typ === "partnerMute") {
            const fromUid = String(msg.user_id || msg.from || "").trim();
            if (
              fromUid &&
              userIdRef.current &&
              fromUid === userIdRef.current
            ) {
              return;
            }
            if (fromUid) notePartnerUserId(fromUid, "partner_mute");
            if (msg.name) applyPartnerNameFromRef.current(msg.name, "dc_mute");
            const mutedVal = msg.muted;
            const on =
              mutedVal === true ||
              mutedVal === 1 ||
              mutedVal === "1" ||
              mutedVal === "true";
            applyTheyMutedMeRef.current(on, "p2p_dc");
            return;
          }
          // Gift FX over P2P — PC↔Android when hub star_effect user_id thrash
          if (typ === "gift_fx" || typ === "star_gift_fx") {
            try {
              applyInboundGiftFxRef.current(
                msg as Record<string, unknown>,
                "p2p_dc"
              );
            } catch (e) {
              log(`gift_fx dc ${e}`);
            }
            return;
          }
          if (typ === "no_cam") {
            const fromUid = String(msg.user_id || msg.from || "").trim();
            if (
              fromUid &&
              userIdRef.current &&
              fromUid === userIdRef.current
            ) {
              return;
            }
            const onVal = msg.on ?? msg.hidden;
            const on =
              onVal === true ||
              onVal === 1 ||
              onVal === "1" ||
              onVal === "true";
            applyNoCamFromPeer(on, fromUid, "p2p_dc");
            return;
          }
          if (typ === "self_hide" || typ === "cam_hide") {
            const fromUid = String(msg.user_id || msg.from || "").trim();
            if (
              fromUid &&
              userIdRef.current &&
              fromUid === userIdRef.current
            ) {
              return;
            }
            if (fromUid) notePartnerUserId(fromUid, "self_hide");
            if (msg.name) applyPartnerNameFromRef.current(msg.name, "dc_hide");
            const onVal = msg.on ?? msg.hidden ?? msg.muted;
            const on =
              onVal === true ||
              onVal === 1 ||
              onVal === "1" ||
              onVal === "true";
            applyHideFromPeer(on, fromUid, "p2p_dc");
            return;
          }
          if (typ === "chat" || typ === "friend_chat") {
            const body = String(msg.body || "").trim().slice(0, 280);
            if (!body) return;
            const fromUid = String(msg.user_id || "").trim();
            if (fromUid) notePartnerUserId(fromUid, "chat");
            if (msg.name) applyPartnerNameFromRef.current(msg.name, "dc_chat");
            const from =
              String(msg.name || msg.user_id || "peer").slice(0, 24) || "peer";
            setChat((c) => [...c, { from, body }].slice(-30));
            setPeerTyping(false);
            hapticLight();
          }
        } catch (e) {
          log(`data msg ${e}`);
        }
      },
      onQualityTier: (tier) => {
        setQualityTier(tier);
      },
      onError: (e) => {
        log(`media ${e.message}`);
        const msg = String(e.message || e).toLowerCase();
        if (
          msg.includes("permission") ||
          msg.includes("notallowed") ||
          msg.includes("denied") ||
          msg.includes("could not start") ||
          msg.includes("getusermedia")
        ) {
          setMediaBlocked(true);
        }
      },
    });

    // Secondary PC: video/audio only (debate/chat stay on primary)
    const applyRemote2 = (s: MediaStreamLike | null, why = "onRemoteStream") => {
      // Always bind — including audio-only (laptop no-cam). Never wait for videoWidth.
      setRemoteStream2(s);
      if (s) {
        huntingWithPartnerRef.current = false;
        setHuntingWithPartner(false);
        setFindThirdPending(false);
      }
      const vt = s?.getVideoTracks?.()?.length ?? 0;
      const at = s?.getAudioTracks?.()?.length ?? 0;
      log(`remote2 bind why=${why} tracks a=${at} v=${vt}`);
    };
    media2.setHandlers({
      onDataChannel: (open) => {
        if (open) {
          try {
            debateRef.current?.sendSnapshot?.();
          } catch {
            /* ignore */
          }
        }
      },
      onDataMessage: (msg) => {
        try {
          const typ = String(msg.type || "");
          if (typ.startsWith("debate_")) {
            log(`debate2 ← ${typ}`);
            debate.handleMessage(msg);
          }
          if (typ === "gift_fx" || typ === "star_gift_fx") {
            applyInboundGiftFxRef.current(msg as Record<string, unknown>, "p2p_dc2");
          }
        } catch {
          /* ignore */
        }
      },
      onRemoteStream: (s) => {
        if (!s) return;
        let urlChanged = true;
        try {
          const nextUrl = s?.toURL?.() || "";
          const prevUrl = remoteStream2UrlRef.current;
          if (prevUrl && nextUrl && prevUrl === nextUrl) urlChanged = false;
          if (nextUrl) remoteStream2UrlRef.current = nextUrl;
        } catch {
          urlChanged = true;
        }
        applyRemote2(s, "onRemoteStream");
        if (urlChanged) setRemoteEpoch2((n) => n + 1);
        try {
          s.getAudioTracks?.().forEach((tr) => {
            tr.enabled =
              !partnerMutedRef.current && !extraMuted2Ref.current;
          });
        } catch {
          /* ignore */
        }
      },
      onSignal: (kind, payload) => {
        try {
          const to = secondaryPeerId.current;
          if (!to || to === "legacy") return;
          hubRefLive.current.signal(kind, payload, to);
        } catch (e) {
          log(`signal2 send fail ${e}`);
        }
      },
      onConnectionState: (s) => {
        log(`pc2 ${s} peer=${secondaryPeerId.current || "-"}`);
        // Join/ICE may land audio-only before ontrack re-fire — bind anyway.
        if (
          secondaryPeerId.current &&
          secondaryPeerId.current !== "legacy" &&
          (s === "connected" ||
            s.startsWith("remote_tracks") ||
            s.startsWith("remote_video_ok"))
        ) {
          const existing = media2.getRemoteStream?.() || null;
          if (existing) applyRemote2(existing, `pc2_${s}`);
        }
      },
      onIceConnectionState: (s) => {
        log(`ice2 ${s}`);
      },
      onError: (e) => {
        log(`media2 ${e.message}`);
      },
    });


    // Tertiary PC (4-way): same adoptLocalStream path as media2 — never second GUM.
    const applyRemote3 = (s: MediaStreamLike | null, why = "onRemoteStream") => {
      setRemoteStream3(s);
      if (s) {
        huntingWithPartnerRef.current = false;
        setHuntingWithPartner(false);
        setFindThirdPending(false);
      }
      const vt = s?.getVideoTracks?.()?.length ?? 0;
      const at = s?.getAudioTracks?.()?.length ?? 0;
      log(`remote3 bind why=${why} tracks a=${at} v=${vt}`);
    };
    media3.setHandlers({
      onDataChannel: (open) => {
        if (open) {
          try {
            debateRef.current?.sendSnapshot?.();
          } catch {
            /* ignore */
          }
        }
      },
      onDataMessage: (msg) => {
        try {
          const typ = String(msg.type || "");
          if (typ.startsWith("debate_")) {
            log(`debate3 ← ${typ}`);
            debate.handleMessage(msg);
          }
          if (typ === "gift_fx" || typ === "star_gift_fx") {
            applyInboundGiftFxRef.current(msg as Record<string, unknown>, "p2p_dc3");
          }
        } catch {
          /* ignore */
        }
      },
      onRemoteStream: (s) => {
        if (!s) return;
        let urlChanged = true;
        try {
          const nextUrl = s?.toURL?.() || "";
          const prevUrl = remoteStream3UrlRef.current;
          if (prevUrl && nextUrl && prevUrl === nextUrl) urlChanged = false;
          if (nextUrl) remoteStream3UrlRef.current = nextUrl;
        } catch {
          urlChanged = true;
        }
        applyRemote3(s, "onRemoteStream");
        if (urlChanged) setRemoteEpoch3((n) => n + 1);
        try {
          s.getAudioTracks?.().forEach((tr) => {
            tr.enabled =
              !partnerMutedRef.current && !extraMuted3Ref.current;
          });
        } catch {
          /* ignore */
        }
      },
      onSignal: (kind, payload) => {
        try {
          const to = tertiaryPeerId.current;
          if (!to || to === "legacy") return;
          hubRefLive.current.signal(kind, payload, to);
        } catch (e) {
          log(`signal3 send fail ${e}`);
        }
      },
      onConnectionState: (s) => {
        log(`pc3 ${s} peer=${tertiaryPeerId.current || "-"}`);
        if (
          tertiaryPeerId.current &&
          tertiaryPeerId.current !== "legacy" &&
          (s === "connected" ||
            s.startsWith("remote_tracks") ||
            s.startsWith("remote_video_ok"))
        ) {
          const existing = media3.getRemoteStream?.() || null;
          if (existing) applyRemote3(existing, `pc3_${s}`);
        }
      },
      onIceConnectionState: (s) => {
        log(`ice3 ${s}`);
      },
      onError: (e) => {
        log(`media3 ${e.message}`);
      },
    });

    // Extra hangup / bye: close only media2/media3. Never remount primary,
    // never re-arm Linking if that remote still has audio/video.
    const dropExtraKeepPrimary = (slot: "2" | "3" | "all", why: string) => {
      const drop2 = slot === "2" || slot === "all";
      const drop3 = slot === "3" || slot === "all";
      const id2 = drop2 ? secondaryPeerId.current : "";
      const id3 = drop3 ? tertiaryPeerId.current : "";
      try {
        if (drop2) {
          (media2Ref.current || media2).closeCall({
            keepLocal: true,
            sendBye: false,
          });
          setRemoteStream2(null);
          secondaryPeerId.current = "";
          extraMuted2Ref.current = false;
          setExtraMuted2(false);
        }
        if (drop3) {
          (media3Ref.current || media3).closeCall({
            keepLocal: true,
            sendBye: false,
          });
          setRemoteStream3(null);
          tertiaryPeerId.current = "";
          extraMuted3Ref.current = false;
          setExtraMuted3(false);
        }
      } catch {
        /* ignore */
      }
      setExtraPeers((prev) => {
        const next =
          slot === "all"
            ? []
            : prev.filter((p) => p.peerId !== id2 && p.peerId !== id3);
        extraPeersRef.current = next;
        return next;
      });
      extrasCountRef.current =
        (secondaryPeerId.current ? 1 : 0) + (tertiaryPeerId.current ? 1 : 0);
      listedPeerIdsRef.current = listedPeerIdsRef.current.filter((id) => {
        if (id2 && (id === id2 || peerIdsLooseMatch(id, id2))) return false;
        if (id3 && (id === id3 || peerIdsLooseMatch(id, id3))) return false;
        return true;
      });
      if (!secondaryPeerId.current && !tertiaryPeerId.current) {
        setFocusExtra(false);
        huntingWithPartnerRef.current = false;
        setHuntingWithPartner(false);
        setFindThirdPending(false);
      }
      const kept =
        (mediaRef.current || media).getRemoteStream?.() || null;
      if (kept) setRemoteStream(kept);
      if (hasLiveRemoteMedia(kept)) {
        setAwaitingRemoteVideo(false);
        setConn("connected");
        setConnSince(0);
      }
      setPhase("matched");
      phaseRef.current = "matched";
      extraDroppedKeepRef.current = true;
      log(
        `extra hangup keep primary slot=${slot} why=${why} live=${hasLiveRemoteMedia(kept) ? 1 : 0}`
      );
    };
    dropExtraKeepPrimaryRef.current = dropExtraKeepPrimary;

    loadMatchPrefs().then((prefs) => {
      selfHideIpRef.current = !!prefs.hideIp;
      selfCosmeticFlagRef.current = String(prefs.flag || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2);
      media.setHideIp(prefs.hideIp);
      media.setDataSaver(!!prefs.dataSaver);
      media.setNoiseReduction(prefs.noiseReduction !== false);
      media2.setHideIp(prefs.hideIp);
      media2.setDataSaver(!!prefs.dataSaver);
      media2.setNoiseReduction(prefs.noiseReduction !== false);
      media3.setHideIp(prefs.hideIp);
      media3.setDataSaver(!!prefs.dataSaver);
      media3.setNoiseReduction(prefs.noiseReduction !== false);
      setDataSaverOn(!!prefs.dataSaver);
      setSwipeSkipOn(prefs.swipeSkip !== false);
      setLiveLayout(
        prefs.liveLayout === "browser" ? "browser" : "native"
      );
      const raw = prefs.blurStrangersMode;
      const mode: BlurStrangersMode =
        raw === "off" || raw === "intro" || raw === "hold" ? raw : "intro";
      blurModeRef.current = mode;
      setBlurMode(mode);
      blurStrangersRef.current = mode !== "off";
      blurPrefsReadyRef.current = true;
      log(`blur prefs mode=${mode}`);
      console.log(`[blur] prefs_load mode=${mode}`);
      // Prefs arrived after match (race): apply intro/hold, or drop optimistic intro if off
      if (phaseRef.current === "matched") {
        if (mode === "hold" || mode === "intro") {
          blurWantAutoRef.current = matchModeRef.current !== "friend";
          applyMatchBlurVeil("prefs_load");
        } else if (blurAutoAppliedRef.current && remoteBlurredRef.current) {
          // User chose off — peel optimistic auto-veil only (not eye-toggle)
          revealPartnerVideo("prefs_off");
        } else {
          blurWantAutoRef.current = false;
        }
      }
    });
    loadPipPrefs().then((p) => {
      if (p?.hintSeen) setPipHint(false);
    });
    void preloadUiSounds();

    // Load TURN ASAP — phone↔browser almost always needs relay through hub
    const loadIce = () =>
      hubRefLive.current
        .fetchIceConfig()
        .then((cfg) => {
          media.setIceConfig(cfg);
          media2.setIceConfig(cfg);
          media3.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          log(
            `ICE has_turn=${cfg.has_turn} servers=${(cfg.ice_servers || []).length}`
          );
        })
        .catch((e) => log(`config fail ${e}`));
    loadIce();
    // Refresh credentials periodically (ephemeral TURN ~6h; also heals first failure)
    const iceRefresh = setInterval(loadIce, 30 * 60 * 1000);

    // Cam/mic: silent when already granted — never re-show system dialogs
    void (async () => {
      try {
        const already = await hasMediaPermissions();
        const perm = already
          ? { allGranted: true, camera: true, mic: true, bluetooth: true }
          : await ensureMediaPermissions();
        if (!perm.allGranted) {
          log(`media perms cam=${perm.camera} mic=${perm.mic}`);
          setMediaBlocked(true);
          return;
        }
        const s = await media.ensureLocalStream();
        if (s) {
          log("local preview ready");
          setMediaBlocked(false);
        } else {
          setMediaBlocked(true);
        }
      } catch (e) {
        log(`local preview ${e}`);
        setMediaBlocked(true);
      }
    })();

    const unsub = addMsgRef.current((msg: ServerMsg) => {
      switch (msg.type) {
        case "hello_ok": {
          const m = msg as {
            rate_min_secs?: number;
            early_rates_left?: number;
            country?: string;
            city?: string;
            flag?: string;
            hide_ip?: boolean;
            hideIp?: boolean;
          };
          if (m.rate_min_secs != null) {
            const secs = Math.max(60, Math.floor(Number(m.rate_min_secs) || 900));
            setRateMinSecs(secs);
            rateMinSecsRef.current = secs;
          }
          // Latch self geo for partner_identity P2P (web parity).
          if (m.flag != null || m.country != null || m.city != null) {
            selfGeoRef.current = {
              flag: String(m.flag || "")
                .trim()
                .toUpperCase()
                .replace(/[^A-Z]/g, "")
                .slice(0, 2),
              country: String(m.country || "").trim(),
              city: String(m.city || "").trim(),
            };
          }
          if (m.hide_ip != null || m.hideIp != null) {
            selfHideIpRef.current = !!(m.hide_ip ?? m.hideIp);
          }
          if (
            !selfGeoRef.current.country &&
            !selfGeoRef.current.city &&
            !selfGeoRef.current.flag
          ) {
            void fillPublicGeo().then((g) => {
              if (!g) return;
              if (selfGeoRef.current.country || selfGeoRef.current.city) return;
              selfGeoRef.current = g;
              if (phaseRef.current === "matched") {
                sendPartnerIdentityP2pRef.current({ request: false });
              }
            });
          }
          break;
        }
        case "partner_geo": {
          // Late hub geo after match — refresh partner chrome (was stuck empty).
          // Solo 1v1: ALWAYS apply when primary empty OR loose-match OR single
          // remote partner — never leave flag=CA unused (see shouldApplyPartnerGeo).
          const g = msg as {
            peer_id?: string;
            peerId?: string;
            user_id?: string;
            userId?: string;
            country?: string;
            city?: string;
            flag?: string;
            hide_ip?: boolean;
            hideIp?: boolean;
          };
          const pid = String(g.peer_id || g.peerId || "").trim();
          const primary = String(remotePeerId.current || "").trim();
          const uid = String(g.user_id || g.userId || "").trim();
          const lastPid = String(lastPartnerIdsRef.current.peerId || "").trim();
          const lastUid = String(lastPartnerIdsRef.current.userId || "").trim();
          const partnerUid = String(
            partnerUserId.current || lastUid || ""
          ).trim();
          const phaseMatched = phaseRef.current === "matched";
          const decision = shouldApplyPartnerGeo({
            phaseMatched,
            msgPeerId: pid,
            msgUserId: uid,
            primaryPeerId: primary,
            partnerUserId: partnerUid,
            lastPeerId: lastPid,
            lastUserId: lastUid,
            hasSecondary: !!String(secondaryPeerId.current || "").trim(),
            matchMode: matchModeRef.current,
          });
          const nextFlag =
            g.flag != null
              ? String(g.flag || "")
                  .trim()
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
                  .slice(0, 2)
              : "";
          const nextCountry =
            g.country != null ? String(g.country || "").trim() : "";
          const nextCity = g.city != null ? String(g.city || "").trim() : "";
          const hideRaw = g.hide_ip ?? g.hideIp;
          const nextHide = hideRaw != null ? !!hideRaw : null;
          const buf = {
            peer_id: pid,
            user_id: uid,
            flag: nextFlag,
            country: nextCountry,
            city: nextCity,
            hide_ip: nextHide,
          };
          if (!decision.apply) {
            // Buffer for matched-merge (pre-match) or multi promote.
            pendingPartnerGeoRef.current = buf;
            console.log(
              `[geo] partner_geo skip reason=${decision.reason} pid=${pid.slice(0, 8) || "-"} primary=${primary.slice(0, 8) || "-"} secondary=${String(secondaryPeerId.current || "").slice(0, 8) || "-"} mode=${matchModeRef.current || "-"} flag=${nextFlag || "-"} country=${nextCountry || "-"} city=${nextCity || "-"}`
            );
            log(
              `partner_geo skip reason=${decision.reason} pid=${pid.slice(0, 8) || "-"} primary=${primary.slice(0, 8) || "-"}`
            );
            break;
          }
          if (nextHide === true) {
            // Privacy: cosmetic flag only — clear real geo; keep flag on name line.
            setPartnerHideIp(true);
            setPartnerCountry("");
            setPartnerCity("");
            if (g.flag != null) setPartnerFlag(nextFlag);
          } else {
            if (nextHide === false) setPartnerHideIp(false);
            // Real country/city/flag from hub implies public geo even if hide omitted.
            if (nextCountry || nextCity || nextFlag) setPartnerHideIp(false);
            // Never clobber known geo with empty hub fields (async partial / noise).
            // Flag-only still applies so formatLocLine expands country from ISO.
            // Empty strings from hub are fine — later PartnerGeo fills them.
            if (nextFlag) setPartnerFlag(nextFlag);
            if (nextCountry) setPartnerCountry(nextCountry);
            if (nextCity) setPartnerCity(nextCity);
          }
          pendingPartnerGeoRef.current = null;
          console.log(
            `[geo] partner_geo apply reason=${decision.reason} flag=${nextFlag || "-"} country=${nextCountry || "-"} city=${nextCity || "-"} hide=${nextHide === true ? 1 : 0} pid=${pid.slice(0, 8) || "-"} uid=${uid.slice(0, 8) || "-"}`
          );
          console.log(
            `[match] geo-late flag=${nextFlag || "-"} country=${nextCountry || "-"} city=${nextCity || "-"} hide=${nextHide === true ? 1 : 0} willPaintLoc=${nextHide === true ? "hidden" : nextFlag || nextCountry || nextCity ? 1 : 0}`
          );
          log(
            `partner_geo apply reason=${decision.reason} flag=${nextFlag || "-"} country=${nextCountry || "-"} city=${nextCity || "-"} hide=${nextHide === true ? 1 : 0}`
          );
          break;
        }
        case "geo": {
          // Self IP→geo finished (for partner_identity announce).
          const g = msg as { country?: string; city?: string; flag?: string };
          selfGeoRef.current = {
            flag: String(g.flag || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z]/g, "")
              .slice(0, 2),
            country: String(g.country || "").trim(),
            city: String(g.city || "").trim(),
          };
          if (!selfGeoRef.current.country && !selfGeoRef.current.city) {
            void fillPublicGeo().then((hit) => {
              if (!hit) return;
              if (selfGeoRef.current.country || selfGeoRef.current.city) return;
              selfGeoRef.current = hit;
              if (phaseRef.current === "matched") {
                sendPartnerIdentityP2pRef.current({ request: false });
              }
            });
          }
          break;
        }
        case "status": {
          const m = msg as {
            phase?: string;
            online?: number;
            waiting_peers?: number;
            detail?: string;
          };
          const detailRaw = String(m.detail || "");
          const hubPhase = String(m.phase || "");
          // Partner left: only tear down on EXPLICIT leave details.
          // Never kill a live call on bare phase=idle/waiting (that regressed
          // phone↔browser connect in 0.1.86 — status noise mid-call).
          const stillChatting =
            /still chatting|still with match|still connected/i.test(detailRaw);
          const leaveDetail = isHubPartnerLeaveDetail(detailRaw);
          const huntAgain =
            /looking for a 3rd again|next together/i.test(detailRaw);
          const partnerLeft =
            phaseRef.current === "matched" &&
            !stillChatting &&
            leaveDetail &&
            (hubPhase === "idle" ||
              hubPhase === "waiting" ||
              hubPhase === "matched");
          // Pair (your_role=party): 3rd left or we skipped them — keep teammate.
          if (
            isPartyKeepOnSkip(yourRoleRef.current) &&
            phaseRef.current === "matched" &&
            !stillChatting &&
            (partnerLeft || huntAgain)
          ) {
            try {
              media2.closeCall({ keepLocal: true, sendBye: false });
              media3.closeCall({ keepLocal: true, sendBye: false });
            } catch {
              /* ignore */
            }
            setRemoteStream2(null);
            setRemoteStream3(null);
            // 3rd already listed: do not collapse split to 1v1 on hunt-again noise.
            if (extrasCountRef.current < 1) {
            extraPeersRef.current = [];
            setExtraPeers([]);
            }
            setExtraNoCam2(false);
            setExtraNoCam3(false);
            setFocusExtra(false);
            setHuntingWithPartner(true);
            setFindThirdPending(false);
            secondaryPeerId.current = "";
            tertiaryPeerId.current = "";
            extrasCountRef.current = 0;
            listedPeerIdsRef.current = remotePeerId.current
              ? [remotePeerId.current]
              : [];
            setPhase("matched");
            phaseRef.current = "matched";
            searchingRef.current = false;
            log(
              `status keep party hunt hub=${hubPhase} detail=${detailRaw.slice(0, 48)}`
            );
          } else if (partnerLeft) {
            const leftName = partnerNameRef.current || "Partner";
            // Chat length for auto-next (read before we zero the clock)
            const startedAt = matchStartedAtRef.current;
            const chatSecs = startedAt
              ? Math.floor((Date.now() - startedAt) / 1000)
              : 0;
            // Hub may already requeue; we also auto-search after short stranger chats
            const hubRequeue =
              hubPhase === "waiting" ||
              /searching again/i.test(detailRaw);
            const shortCallAutoNext =
              matchModeRef.current !== "friend" && !isFriendsOnly();
            // Hub already requeues the leaver; only auto-spin the abandoned side
            // when it was a real short chat (not a 0s thrash bounce).
            const requeue = hubRequeue || shortCallAutoNext;
            forceRelayHubRef.current = false;
            try {
              media2.closeCall({ keepLocal: true, sendBye: false });
              media3.closeCall({ keepLocal: true, sendBye: false });
              media.closeCall({ keepLocal: true, sendBye: false });
            } catch {
              /* ignore */
            }
            setRemoteStream(null);
            setRemoteStream2(null);
            setRemoteStream3(null);
            extraPeersRef.current = [];
            setExtraPeers([]);
            extraMuted2Ref.current = false;
            extraMuted3Ref.current = false;
            setExtraMuted2(false);
            setExtraMuted3(false);
            setPartner("");
            setPartnerCode("");
            setPartnerStars(0);
            setPartnerTrust(0);
            setPartnerFlag("");
            setPartnerCountry("");
            setPartnerCity("");
            setPartnerHideIp(false);
            partnerAvatarRef.current = "";
            setPartnerAvatar("");
            pendingPartnerGeoRef.current = null;
            clearIdentityPollRef.current();
            identityStarsKnownRef.current = false;
            hubStarsKnownRef.current = false;
            setPartnerCamHidden(false);
            partnerCamHiddenRef.current = false;
            setPartnerNoCam(false);
            partnerNoCamRef.current = false;
            setExtraNoCam2(false);
            setExtraNoCam3(false);
            setTheyMutedMe(false);
            setRemoteBlurred(false);
            remoteBlurredRef.current = false;
            blurAutoAppliedRef.current = false;
            blurWantAutoRef.current = false;
            clearIntroUnblurTimer();
            setAwaitingRemoteVideo(false);
            setMoreOpen(false);
            // End find-3rd hunt UI (partner left mid-hunt or any match)
            setFindThirdPending(false);
            setHuntingWithPartner(false);
            remotePeerId.current = "";
            secondaryPeerId.current = "";
            tertiaryPeerId.current = "";
            extrasCountRef.current = 0;
            listedPeerIdsRef.current = [];
            partnerUserId.current = "";
            partnerFriendCode.current = "";
            matchStartedAtRef.current = 0;
            setMatchStartedAt(0);
            setMatchMode("");
            matchModeRef.current = "";
            void leaveCallAudio();
            if (!requeue) {
              searchingRef.current = false;
              queueAckedRef.current = false;
              setQueueAcked(false);
              setPhase("idle");
              phaseRef.current = "idle";
              showToastRef.current(
                tRef.current("mobile.live.partnerLeft", { name: leftName })
              );
            } else {
              searchingRef.current = true;
              queueAckedRef.current = hubPhase === "waiting";
              setQueueAcked(hubPhase === "waiting");
              setPhase("search");
              phaseRef.current = "search";
              setAlone(true);
              setWaiting((w) => Math.max(w, 1));
              showToastRef.current(
                tRef.current("mobile.live.autoNextSkip", { name: leftName }) ||
                  tRef.current("mobile.live.autoNextShort", {
                    name: leftName,
                  })
              );
              try {
                hubRefLive.current.spin();
              } catch {
                /* ignore */
              }
              if (shortCallAutoNext) {
                track("auto_next_short_call", {
                  dur: chatSecs,
                  via: "status_partner_left",
                });
              }
            }
            log(
              `status end-match hub=${hubPhase} requeue=${requeue ? 1 : 0} short=${shortCallAutoNext ? 1 : 0} secs=${chatSecs}`
            );
          }
          const patch = reduceStatusMsg(m, {
            phaseRef: phaseRef.current,
            searching: searchingRef.current,
          });
          // Never demote matched → search from lobby status ticks
          if (patch.phase === "search" && phaseRef.current !== "matched") {
            setPhase("search");
            phaseRef.current = "search";
          }
          if (patch.searching != null) searchingRef.current = patch.searching;
          if (patch.queueAcked != null) {
            queueAckedRef.current = patch.queueAcked;
            setQueueAcked(patch.queueAcked);
          }
          if (patch.trackQueueAck) {
            track("queue_ack", patch.trackQueueAck);
          }
          if (patch.alone != null) setAlone(patch.alone);
          setOnline(patch.online);
          setWaiting(patch.waiting);
          if (patch.log) log(patch.log);
          break;
        }
        case "lobby_info": {
          const m = msg as {
            online?: number;
            waiting_peers?: number;
            room_waiting?: number;
          };
          const patch = reduceLobbyInfoMsg(m, {
            phaseRef: phaseRef.current,
            searching: searchingRef.current,
          });
          if (patch.alone != null) setAlone(patch.alone);
          setOnline(patch.online);
          setWaiting(patch.waiting);
          if (patch.log) log(patch.log);
          break;
        }
        case "matched": {
          const m = msg as ServerMatched & {
            forceRelay?: boolean | number | string;
          };
          // FIRST: latch hub force_relay before any startCall / offer handling.
          // Web pure-relay only works when phone also arms forceRelayOnce.
          // Read force_relay from top-level + camelCase (defensive).
          const hubFrRaw =
            (m as { force_relay?: unknown }).force_relay ??
            (m as { forceRelay?: unknown }).forceRelay;
          const hubForceRelay =
            hubFrRaw === true ||
            hubFrRaw === 1 ||
            hubFrRaw === "1" ||
            hubFrRaw === "true";
          // Only arm sticky on true; do not clear mid-match on a false re-Matched
          // while media is live (partner re-announce). Hangup/Next clear the ref.
          if (hubForceRelay) {
            forceRelayHubRef.current = true;
          } else if (phaseRef.current !== "matched") {
            forceRelayHubRef.current = false;
          }
          try {
            const m1 = mediaRef.current || media;
            const m2 = media2Ref.current || media2;
            const m3 = media3Ref.current || media3;
            if (hubForceRelay) {
              m1.setForceRelay?.(true);
              m2.setForceRelay?.(true);
              m3.setForceRelay?.(true);
            } else if (phaseRef.current !== "matched") {
              m1.setForceRelay?.(false);
              m2.setForceRelay?.(false);
              m3.setForceRelay?.(false);
            }
            const once =
              typeof (m1 as { isForceRelay?: () => boolean }).isForceRelay ===
              "function"
                ? (m1 as { isForceRelay: () => boolean }).isForceRelay()
                  ? 1
                  : 0
                : -1;
            log(
              `force_relay_hub=${hubForceRelay ? 1 : 0} forceRelayOnce=${once} raw=${String(hubFrRaw)} (pre-startCall)`
            );
          } catch {
            /* ignore */
          }
          const rawPeers = (m.peers || []) as MatchPeer[];
          let allPeers = rawPeers.length
            ? rawPeers.map((p) => normalizePeer(p, m))
            : [pickPeer(m)];
          const wasMatched = phaseRef.current === "matched";
          const prevPrimary = remotePeerId.current;
          const prevSecondary = secondaryPeerId.current;
          // Keep continuity: if prior primary still listed, prefer them as tile 0
          const keepFirstOnOmit =
            huntingWithPartnerRef.current ||
            matchModeRef.current === "party_browse" ||
            String(m.mode || "") === "party_browse" ||
            !!prevSecondary;
          const pi = pickPrimaryPeerIndex(
            allPeers.map((p) => p.peerId),
            {
              wasMatched,
              prevPrimary: prevPrimary || "",
              prevSecondary: prevSecondary || "",
              keepFirstOnOmit,
            }
          );
          let peer = allPeers[pi] || allPeers[0];
          if (pi < 0 && wasMatched && prevPrimary) {
            // Hub listed only the 3rd. Reconstruct Courtier from refs —
            // never spread allPeers[0] (Laptop userId / isOfferer / platform).
            const keptName = String(partnerNameRef.current || "").trim();
            const uid = String(
              partnerUserId.current || lastPartnerIdsRef.current.userId || ""
            ).trim();
            const cachedName = String(
              lastGoodNameByUidRef.current[uid.toLowerCase()] || ""
            ).trim();
            const name =
              keptName && !/^partner$/i.test(keptName)
                ? keptName
                : cachedName && !/^partner$/i.test(cachedName)
                  ? cachedName
                  : "";
            peer = {
              peerId: prevPrimary,
              name,
              mode: String(m.mode || matchModeRef.current || "party_browse"),
              userId: uid,
              isOfferer: !!isOffererRef.current,
              friendCode: "",
              stars: 0,
              trust: 0,
              starsKnown: false,
              trustKnown: false,
              role: "",
              flag: "",
              country: "",
              city: "",
              hideIp: false,
              avatar: partnerAvatarRef.current || "",
            };
            log(
              `3rd-join omit-primary keep peer=${prevPrimary.slice(0, 8)} extras_listed=${allPeers.length}`
            );
          }
          peer = {
            ...peer,
            mode: String(m.mode || peer.mode || "solo"),
          };
          try {
            const plat = String(
              (peer as { platform?: string }).platform ||
                (rawPeers[0] as { platform?: string } | undefined)?.platform ||
                ""
            ).toLowerCase();
            log(
              `force_relay hub=${hubForceRelay ? 1 : 0} peerPlat=${plat || "?"} `
            );
          } catch {
            /* ignore */
          }
          // Cap extras at MAX_EXTRA_PEERS (primary + 2 extras = 4 people). Drop legacy /
          // empty ids so multiRemote / multi-audio never latches on poison rows.
          // Loose-exclude primary so first partner is never bound as extra.
          // Always setExtraPeers from Matched extras (even if stream2 is null)
          // so ExtraRemoteTile paints the connecting 3rd immediately.
          const extrasListed = extraPeersFromMatch(m, peer.peerId);
          const extrasFallback = allPeers
            .filter((p) => {
              if (!p.peerId || p.peerId === "legacy") return false;
              if (p.peerId === peer.peerId) return false;
              if (peerIdsLooseMatch(p.peerId, peer.peerId)) return false;
              return true;
            })
            .slice(0, MAX_EXTRA_PEERS);
          const extrasRaw =
            extrasListed.length > 0 ? extrasListed : extrasFallback;
          const extras = extrasAfterOmitPrimary({
            extras: extrasRaw,
            wasMatched,
            prevSecondary: prevSecondary || "",
            prevExtras: extraPeersRef.current,
            listedIds: allPeers.map((p) => p.peerId),
            primaryId: peer.peerId,
            keepListed3rd:
              keepFirstOnOmit || extrasCountRef.current > 0,
          });
          if (extras.length > extrasRaw.length) {
            log(
              `3rd-join omit-extra keep extra=${extras[0].peerId.slice(0, 8)} listed=${allPeers.length}`
            );
          }
          const extrasPainted = extras.map((p) => ({
            ...p,
            name: paintSafePartnerName(p.name, "Partner", {
              peerId: p.peerId,
              userId: p.userId,
            }),
          }));
          extraPeersRef.current = extrasPainted;
          extrasCountRef.current = extrasPainted.length;
          setExtraPeers(extrasPainted);
          // 060444Z: laptop no_cam landed on Dragonov before extras counted.
          if (
            shouldRehomePrimaryNoCam({
              extrasCount: extrasPainted.length,
              partnerNoCam: partnerNoCamRef.current,
              partnerCamHidden: partnerCamHiddenRef.current,
            })
          ) {
            setPartnerNoCam(false);
            partnerNoCamRef.current = false;
            setPartnerCamHidden(false);
            partnerCamHiddenRef.current = false;
            setExtraNoCam2(true);
            log("rehome_nocam primary→extra0 (3rd listed)");
          }
          if (extrasPainted[0]?.peerId) {
            secondaryPeerId.current = extrasPainted[0].peerId;
          }
          if (extrasPainted[1]?.peerId) {
            tertiaryPeerId.current = extrasPainted[1].peerId;
          }
          // extras>=1 paints ExtraRemoteTile; unswap so first VideoView stays
          // on remoteStream (swap flip remounts SurfaceView).
          if (extras.length > 0) {
            setSwapViews(false);
          }
          const second = extras[0] || null;
          // 4-way: second extra peer (you + 3 remotes). Cap via matchPeers MAX_EXTRA.
          const third = extras[1] || null;
          const prevTertiary = tertiaryPeerId.current;
          const listedPeerIds = allPeers.map((p) => p.peerId);
          extrasCountRef.current = extras.length;
          listedPeerIdsRef.current = listedPeerIds;
          // 3rd-joiner latch both remotes before startCall / queued SDP.
          // Android-as-3rd: extras listed while secondaryPeerId is still empty.
          const thirdLatch = latchThirdJoinerPeerIds({
            extrasCount: extras.length,
            keepPeerId: peer.peerId,
            extraPeerId: second?.peerId,
            currentPrimary: remotePeerId.current,
            currentSecondary: secondaryPeerId.current,
          });
          if (thirdLatch) {
            if (thirdLatch.primaryId) remotePeerId.current = thirdLatch.primaryId;
            if (thirdLatch.secondaryId) {
              secondaryPeerId.current = thirdLatch.secondaryId;
            }
            if (
              third?.peerId &&
              third.peerId !== "legacy" &&
              (!tertiaryPeerId.current || tertiaryPeerId.current === "legacy")
            ) {
              tertiaryPeerId.current = third.peerId;
            }
            log(
              `3rd-join latch primary=${(remotePeerId.current || "").slice(0, 8)} secondary=${(secondaryPeerId.current || "").slice(0, 8)} extras=${extras.length}`
            );
          }
          let { keepPrimary, keepSecondary, promoteSecondary } =
            computeMatchContinuity({
              wasMatched,
              prevPrimary: prevPrimary || "",
              prevSecondary: prevSecondary || "",
              primaryPeerId: peer.peerId,
              secondaryPeerId: second?.peerId,
              hasMedia2: !!media2Ref.current,
              listedPeerIds,
            });
          // 3rd join: prevPrimary still listed → keep first RTCView always.
          if (
            wasMatched &&
            peerStillListed(prevPrimary || "", listedPeerIds)
          ) {
            keepPrimary = true;
          }
          // Keep tertiary PC when same peer still listed (inline — no matchContinuity thrash).
          const keepTertiary =
            wasMatched &&
            !!prevTertiary &&
            !!third?.peerId &&
            third.peerId !== "legacy" &&
            (prevTertiary === third.peerId ||
              peerIdsLooseMatch(prevTertiary, third.peerId));
          // Extra left (3→2 / 4→3): keep primary PC + RTCView. No startCall rematch.
          // Latch covers bye that already cleared secondary/tertiary refs.
          const extraHangupKeep =
            wasMatched &&
            !!prevPrimary &&
            prevPrimary !== "legacy" &&
            (prevPrimary === peer.peerId ||
              peerIdsLooseMatch(prevPrimary, peer.peerId)) &&
            (((!!prevSecondary && !keepSecondary) ||
              (!!prevTertiary && !keepTertiary)) ||
              extraDroppedKeepRef.current);
          extraDroppedKeepRef.current = false;
          if (extraHangupKeep) {
            keepPrimary = true;
            log(
              `matched extra hangup keep primary peer=${peer.peerId.slice(0, 8)} drop2=${prevSecondary && !keepSecondary ? 1 : 0} drop3=${prevTertiary && !keepTertiary ? 1 : 0}`
            );
          }

          // Same partner re-Matched — keep if video OR audio is live.
          // Mount-only listener cannot read React `remoteStream` (always null
          // here) — read MediaSession. Laptop no-cam = live audio = keep.
          // 3rd join / hunt rematch must NOT remount primary (black PiP).
          {
            const primRemote =
              (mediaRef.current || media).getRemoteStream?.() || null;
            const hasLiveRemoteEarly = hasLiveRemoteMedia(primRemote);
            const huntOrBrowse =
              huntingWithPartnerRef.current ||
              String(peer.mode || "") === "party_browse" ||
              matchModeRef.current === "party_browse";
            const thirdJoining = extras.length > 0;
            const samePrimary =
              !!prevPrimary &&
              prevPrimary !== "legacy" &&
              (prevPrimary === peer.peerId ||
                peerIdsLooseMatch(prevPrimary, peer.peerId));
            if (
              wasMatched &&
              samePrimary &&
              (hasLiveRemoteEarly || huntOrBrowse || thirdJoining)
            ) {
              keepPrimary = true;
              log(
                `matched keep same peer=${peer.peerId.slice(0, 8)} (${
                  hasLiveRemoteEarly
                    ? hasLiveRemoteVideoTrack(primRemote)
                      ? "live video"
                      : "live audio"
                    : thirdJoining
                      ? "3rd join no remount"
                      : "hunt keep"
                })`
              );
            } else if (
              wasMatched &&
              samePrimary &&
              !hasLiveRemoteEarly &&
              !huntOrBrowse &&
              !thirdJoining &&
              !extraHangupKeep
            ) {
              keepPrimary = false;
              log(
                `matched rebuild peer=${String(peer.peerId).slice(0, 8)} (no live media)`
              );
            }

            // SPEED: kick WebRTC the instant we know offerer role — before UI
            // state storm / secondary PC shuffle (those added multi-second lag).
            // Same peer already painting: never kick startCall again.
            // First-match race (was search) still kicks — leftover there is
            // THIS startCall, not a rebuild.
            // extras / party_browse hunt: never remount first partner.
            const skipEarly =
              shouldSkipPrimaryStartCall({
                keepPrimary,
                extrasCount: extras.length,
                partyBrowse: huntOrBrowse,
                hunting: huntingWithPartnerRef.current,
                extraHangupKeep,
                hasLiveRemote: hasLiveRemoteEarly,
              }) ||
              (!!remoteVideoSeenRef.current &&
                hasLiveRemoteEarly &&
                samePrimary);
            if (!skipEarly && !promoteSecondary) {
              remotePeerId.current = peer.peerId;
              const sess = mediaRef.current || media;
              // Re-arm before kick — only arm true (never clear mid-match).
              try {
                if (hubForceRelay || forceRelayHubRef.current) {
                  sess.setForceRelay?.(true);
                }
              } catch {
                /* ignore */
              }
              const t0 = Date.now();
              const answererEarly = !peer.isOfferer;
              log(
                `startCall EARLY offerer=${peer.isOfferer ? 1 : 0} force_relay_hub=${hubForceRelay ? 1 : 0} answerer=${answererEarly ? 1 : 0}`
              );
              // hop9: answerer must fire startCall before geo/UI/warm polls —
              // inbound offer often races matched; any await here delays createAnswer.
              // Offerer: may briefly warm ICE if cold; never waitWarmTurnPrimed
              // (pool=0 pure never primes — was a free 200ms stall).
              const kick = async () => {
                // Re-apply immediately before any await (offer may race in).
                const fr = !!(forceRelayHubRef.current || hubForceRelay);
                try {
                  if (fr) sess.setForceRelay?.(true);
                } catch {
                  /* ignore */
                }
                // ANSWERER FAST PATH: no pre-startCall awaits. MediaSession
                // startCall already waits for TURN when force_relay needs it.
                // Background ICE refresh only — never block createAnswer readiness.
                if (answererEarly) {
                  void hubRefLive.current
                    .fetchIceConfig()
                    .then((cfg) => {
                      try {
                        sess.setIceConfig(cfg);
                        iceHasTurnRef.current = !!cfg.has_turn;
                      } catch {
                        /* ignore */
                      }
                    })
                    .catch(() => {});
                  try {
                    if (fr) sess.setForceRelay?.(true);
                  } catch {
                    /* ignore */
                  }
                  return sess.startCall({
                    isOfferer: false,
                    forceRelay: fr ? true : undefined,
                  });
                }
                // OFFERER: if search already prefetched TURN, do not await HTTP ICE.
                const iceWarm =
                  iceHasTurnRef.current ||
                  !!(sess as { hasTurn?: () => boolean }).hasTurn?.();
                if (!iceWarm) {
                  try {
                    const cfg = await Promise.race([
                      hubRefLive.current.fetchIceConfig(),
                      new Promise<null>((r) => setTimeout(() => r(null), 400)),
                    ]);
                    if (cfg) {
                      sess.setIceConfig(cfg);
                      iceHasTurnRef.current = !!cfg.has_turn;
                    }
                  } catch {
                    /* startCall still waits internally */
                  }
                } else {
                  // Background refresh only — never block first SDP
                  void hubRefLive.current
                    .fetchIceConfig()
                    .then((cfg) => {
                      sess.setIceConfig(cfg);
                      iceHasTurnRef.current = !!cfg.has_turn;
                    })
                    .catch(() => {});
                }
                // After any await: re-arm pure only (never clear sticky here).
                try {
                  if (fr) sess.setForceRelay?.(true);
                } catch {
                  /* ignore */
                }
                // warmConnection only pre-SDP — never rebuild mid-offer
                // (closes hybrid PC → ice=new / black “linking” after answer).
                // hop9: fire-and-forget warm (no await) — startCall owns TURN wait.
                try {
                  const iceSnap =
                    (
                      sess as {
                        getIceSnapshot?: () => { ice?: string; cs?: string };
                      }
                    ).getIceSnapshot?.() || {};
                  const iceNow = String(iceSnap.ice || "");
                  const midLink =
                    iceNow === "checking" ||
                    iceNow === "connected" ||
                    iceNow === "completed" ||
                    iceSnap.cs === "connecting" ||
                    iceSnap.cs === "connected";
                  if (!midLink) {
                    void sess.warmConnection?.({
                      preferRelay: fr,
                    });
                  } else {
                    log(`warm skip mid-link ice=${iceNow || "?"}`);
                  }
                  // Do NOT await waitWarmTurnPrimed — pure pool=0 never primes;
                  // that poll only delayed createOffer/startCall by ~200ms.
                } catch {
                  /* ignore */
                }
                try {
                  if (fr) sess.setForceRelay?.(true);
                } catch {
                  /* ignore */
                }
                return sess.startCall({
                  isOfferer: true,
                  forceRelay: fr ? true : undefined,
                });
              };
              void kick()
                .then(() =>
                  log(
                    `startCall early ok +${Date.now() - t0}ms (${answererEarly ? "answerer-fast" : "offerer"})`
                  )
                )
                .catch((e) => log(`startCall early FAIL ${e}`));
            }
          }

          if (promoteSecondary) {
            const oldPrimary = mediaRef.current;
            const surviving = media2Ref.current;
            try {
              oldPrimary?.closeCall({
                keepLocal: true,
                sendBye: false,
                // keep hub pure sticky across rebuild (see MediaSession.closeCall)
              });
              try {
                if (forceRelayHubRef.current || hubForceRelay) {
                  (mediaRef.current || media).setForceRelay?.(true);
                }
              } catch {
                /* ignore */
              }
            } catch {
              /* ignore */
            }
            // Surviving PC becomes primary for all future signals (via refs)
            mediaRef.current = surviving;
            media2Ref.current = oldPrimary;
            // Ex-secondary must own hangup + mid encode budget (not secondary low)
            try {
              surviving?.markAsPrimary?.();
            } catch {
              /* ignore */
            }
            // Rebind handlers so streams land on the right React state
            surviving?.setHandlers({
              onLocalStream: (s) => {
                setLocalStream(s);
                setMediaBlocked(false);
                try {
                  if (s) media2Ref.current?.adoptLocalStream?.(s);
                } catch {
                  /* ignore */
                }
                try {
                  if (s) media3Ref.current?.adoptLocalStream?.(s);
                } catch {
                  /* ignore */
                }
              },
              onRemoteStream: (s) => {
                setRemoteStream(s);
                setRemoteEpoch((n) => n + 1);
                const vt = s.getVideoTracks?.()?.length ?? 0;
                const at = s.getAudioTracks?.()?.length ?? 0;
                // Audio-only (laptop no-cam) is a finished link.
                // Dummy muted video is not a camera — do not mark video ready.
                if (vt > 0 || at > 0) {
                  setAwaitingRemoteVideo(false);
                  if (remoteVideoHasPicture(s)) {
                    remoteVideoSeenRef.current = true;
                    setRemoteVideoReady(true);
                  }
                }
                try {
                  s.getAudioTracks?.().forEach((tr) => {
                    tr.enabled = !partnerMutedRef.current;
                  });
                } catch {
                  /* ignore */
                }
              },
              onSignal: (kind, payload) => {
                try {
                  const to = remotePeerId.current;
                  hubRefLive.current.signal(
                    kind,
                    payload,
                    to && to !== "legacy" ? to : ""
                  );
                } catch (e) {
                  log(`signal send fail ${e}`);
                }
              },
              onConnectionState: (s) => {
                if (s === "connected" || s.startsWith("remote_video_ok")) {
                  setConn("connected");
                  setConnSince(0);
                  if (s.startsWith("remote_video_ok")) {
                    setAwaitingRemoteVideo(false);
                  }
                } else if (
                  s === "failed" ||
                  s === "disconnected" ||
                  s === "connecting" ||
                  s === "checking"
                ) {
                  setConn(s === "checking" ? "connecting" : s);
                }
                log(`pc(promoted) ${s}`);
              },
              onIceConnectionState: (s) => log(`ice(promoted) ${s}`),
              onError: (e) => log(`media promoted ${e.message}`),
              onDataChannel: (open) => setDcOpen(open),
              onDataMessage: (msg) => {
                // Chat/debate stay on whoever owns DC — may be empty after promote
                try {
                  const typ = String(msg.type || "");
                  if (typ === "chat" || typ === "friend_chat") {
                    const body = String(msg.body || "").trim().slice(0, 280);
                    if (!body) return;
                    const from =
                      String(msg.name || msg.user_id || "peer").slice(0, 24) ||
                      "peer";
                    setChat((c) => [...c, { from, body }].slice(-30));
                    hapticLight();
                  }
                } catch {
                  /* ignore */
                }
              },
            });
            oldPrimary?.setHandlers({
              onRemoteStream: (s) => {
                applyRemote2(s, "promote_old_primary");
                setRemoteEpoch2((n) => n + 1);
              },
              onSignal: (kind, payload) => {
                try {
                  const to = secondaryPeerId.current;
                  if (!to || to === "legacy") return;
                  hubRefLive.current.signal(kind, payload, to);
                } catch {
                  /* ignore */
                }
              },
              onConnectionState: (s) => log(`pc2 ${s}`),
              onIceConnectionState: (s) => log(`ice2 ${s}`),
              onError: (e) => log(`media2 ${e.message}`),
            });
            const kept = surviving?.getRemoteStream() || null;
            setRemoteStream(kept);
            setRemoteEpoch((n) => n + 1);
            setRemoteStream2(null);
            setRemoteEpoch2(0);
            secondaryPeerId.current = "";
            setFocusExtra(false);
            setSwapViews(false);
            setAwaitingRemoteVideo(!hasLiveRemoteMedia(kept));
            if (hasLiveRemoteMedia(kept)) {
              setConn("connected");
              setConnSince(0);
            }
            keepPrimary = true; // skip primary startCall — already connected
            showToastRef.current(
              tRef.current("mobile.live.partnerLeftKeep", {
                name: paintSafePartnerName(peer.name, "…", {
                  peerId: peer.peerId,
                  userId: peer.userId,
                }),
              })
            );
            hapticLight();
            log(
              `promote secondary→primary peer=${peer.peerId.slice(0, 8)} kept_video=${!!kept?.getVideoTracks?.()?.length}`
            );
            track("multi_promote", { kept: kept ? 1 : 0 });
          }

          // Extra PCs: kick startCall2/3 NOW (before identity/geo storm).
          // 3-way FAIL: extras listed but startCall2 sat after UI merge —
          // phone never saw the second conversationalist. Never remount primary.
          let secondaryKickStarted = false;
          let tertiaryKickStarted = false;
          const startSecondary = () => {
            if (!second || second.peerId === "legacy") return;
            if (secondaryKickStarted) return;
            const sess = media2Ref.current || media2;
            const prim = mediaRef.current || media;
            if (keepSecondary) {
              const existingKeep2 = sess.getRemoteStream?.() || null;
              if (existingKeep2 && hasLiveRemoteMedia(existingKeep2)) {
                applyRemote2(existingKeep2, "keep_secondary");
                secondaryPeerId.current = second.peerId;
                log(`keep secondary PC peer=${second.peerId.slice(0, 8)}`);
                return;
              }
              // Same extra listed but no live media2 — still startCall2.
              log(
                `keep secondary listed no-live — startCall2 peer=${second.peerId.slice(0, 8)}`
              );
            }
            secondaryKickStarted = true;
            secondaryPeerId.current = second.peerId;
            // Latch multi before startCall2 so primary outbound-zero cannot
            // re-GUM (Camera2 CaptureThread crash 20:04:34).
            try {
              prim.setMultiPeerAudio(true);
              sess.setMultiPeerAudio(true, { secondary: true });
            } catch {
              /* ignore */
            }
            // Never defer extra SDP waiting for primary GUM (2nd answer +8s).
            // Missing local: startCall anyway; onLocalStream re-adopts later.
            const local = prim.getLocalStream();
            if (local) sess.adoptLocalStream(local);
            const fr2 = !!forceRelayHubRef.current;
            try {
              if (fr2) sess.setForceRelay?.(true);
            } catch {
              /* ignore */
            }
            try {
              const cfg = (
                prim as { getIceConfig?: () => unknown }
              ).getIceConfig?.();
              if (
                cfg &&
                typeof (sess as { setIceConfig?: (c: unknown) => void })
                  .setIceConfig === "function"
              ) {
                (sess as { setIceConfig: (c: unknown) => void }).setIceConfig(
                  cfg
                );
              }
            } catch {
              /* ignore */
            }
            const t2 = Date.now();
            log(
              `startCall2 kick offerer=${second.isOfferer ? 1 : 0} force_relay=${fr2 ? 1 : 0} peer=${second.peerId.slice(0, 8)} adopt=${local ? 1 : 0} (early)`
            );
            sess
              .startCall({
                isOfferer: second.isOfferer,
                forceRelay: fr2 ? true : undefined,
              })
              .then(() => {
                log(`startCall2 ok +${Date.now() - t2}ms`);
                if (!local) {
                  const later = prim.getLocalStream();
                  if (later) sess.adoptLocalStream(later);
                }
                const got = sess.getRemoteStream?.() || null;
                if (got) applyRemote2(got, "startCall2");
              })
              .catch((e) => log(`startCall2 ${e}`));
          };
          const startTertiary = () => {
            if (!third || third.peerId === "legacy") return;
            if (tertiaryKickStarted) return;
            const sess = media3Ref.current || media3;
            const prim = mediaRef.current || media;
            if (keepTertiary) {
              const existingKeep3 = sess.getRemoteStream?.() || null;
              if (existingKeep3 && hasLiveRemoteMedia(existingKeep3)) {
                applyRemote3(existingKeep3, "keep_tertiary");
                tertiaryPeerId.current = third.peerId;
                log(`keep tertiary PC peer=${third.peerId.slice(0, 8)}`);
                return;
              }
              log(
                `keep tertiary listed no-live — startCall3 peer=${third.peerId.slice(0, 8)}`
              );
            }
            tertiaryKickStarted = true;
            tertiaryPeerId.current = third.peerId;
            try {
              prim.setMultiPeerAudio(true);
              sess.setMultiPeerAudio(true, { secondary: true });
            } catch {
              /* ignore */
            }
            // Never defer extra SDP waiting for primary GUM.
            const local3 = prim.getLocalStream();
            if (local3) sess.adoptLocalStream(local3);
            const fr3 = !!forceRelayHubRef.current;
            try {
              if (fr3) sess.setForceRelay?.(true);
            } catch {
              /* ignore */
            }
            try {
              const cfg = (
                prim as { getIceConfig?: () => unknown }
              ).getIceConfig?.();
              if (
                cfg &&
                typeof (sess as { setIceConfig?: (c: unknown) => void })
                  .setIceConfig === "function"
              ) {
                (sess as { setIceConfig: (c: unknown) => void }).setIceConfig(
                  cfg
                );
              }
            } catch {
              /* ignore */
            }
            const t3 = Date.now();
            log(
              `startCall3 kick offerer=${third.isOfferer ? 1 : 0} force_relay=${fr3 ? 1 : 0} peer=${third.peerId.slice(0, 8)} adopt=${local3 ? 1 : 0} (early)`
            );
            sess
              .startCall({
                isOfferer: third.isOfferer,
                forceRelay: fr3 ? true : undefined,
              })
              .then(() => {
                log(`startCall3 ok +${Date.now() - t3}ms`);
                if (!local3) {
                  const later3 = prim.getLocalStream();
                  if (later3) sess.adoptLocalStream(later3);
                }
                const got = sess.getRemoteStream?.() || null;
                if (got) applyRemote3(got, "startCall3");
              })
              .catch((e) => log(`startCall3 ${e}`));
          };
          // Prepare extra slots then kick (do not touch primary PC).
          if (second && second.peerId !== "legacy") {
            if (
              !keepSecondary &&
              prevSecondary &&
              prevSecondary !== second.peerId
            ) {
              (media2Ref.current || media2).closeCall({
                keepLocal: true,
                sendBye: false,
              });
              setRemoteStream2(null);
            }
            startSecondary();
          } else if (prevSecondary && !promoteSecondary) {
            (media2Ref.current || media2).closeCall({
              keepLocal: true,
              sendBye: false,
            });
            setRemoteStream2(null);
            secondaryPeerId.current = "";
            log("secondary PC closed (solo again)");
          }
          if (third && third.peerId !== "legacy") {
            if (
              !keepTertiary &&
              prevTertiary &&
              prevTertiary !== third.peerId
            ) {
              (media3Ref.current || media3).closeCall({
                keepLocal: true,
                sendBye: false,
              });
              setRemoteStream3(null);
            }
            startTertiary();
          } else if (prevTertiary) {
            (media3Ref.current || media3).closeCall({
              keepLocal: true,
              sendBye: false,
            });
            setRemoteStream3(null);
            tertiaryPeerId.current = "";
            log("tertiary PC closed (not 4-way)");
          }

          // Capture prior identity before overwriting — used for geo merge.
          const prevPartnerUid = String(
            partnerUserId.current || lastPartnerIdsRef.current.userId || ""
          );
          // Labels / meta always refresh — never wipe a known user_id with empty
          // (thrash re-Matched can briefly omit peers[].user_id → block/report broken)
          remotePeerId.current = peer.peerId || remotePeerId.current;
          if (peer.userId) {
            partnerUserId.current = peer.userId;
          }
          if (peer.friendCode) {
            partnerFriendCode.current = peer.friendCode;
          }
          // Never blank on Android chrome/HUD: hub may omit name (whitespace /
          // empty) while still sending stars. Never paint 8-char peer hex —
          // prefer real name → friend_code → prev real → "Partner".
          // Keep prev name when same partner re-Matches OR same user_id latched
          // (hub thrash can flip wasMatched briefly while video stays up).
          // Use prevPartnerUid (captured before overwrite) — not partnerUserId.current.
          const sameUidAsPrev =
            !!peer.userId &&
            !!prevPartnerUid &&
            peer.userId.toLowerCase() === prevPartnerUid.toLowerCase();
          const samePeerAsPrev =
            !!prevPrimary &&
            prevPrimary !== "legacy" &&
            prevPrimary === peer.peerId;
          const keepPrevName =
            !promoteSecondary && (sameUidAsPrev || samePeerAsPrev);
          // Cache real names by user_id so rematch after hangup still paints
          // «Драконов» when hub name is empty/poison again.
          const uidKey = String(peer.userId || prevPartnerUid || "")
            .trim()
            .toLowerCase();
          const cachedName = uidKey
            ? lastGoodNameByUidRef.current[uidKey] || ""
            : "";
          const prevForResolve =
            (keepPrevName ? partnerNameRef.current : "") ||
            cachedName ||
            "";
          const nameResolved = resolvePartnerDisplayNameWithSource({
            name: peer.name,
            shortId: "", // never peer hex slice — friend_code / prev handle secondary
            friendCode:
              peer.friendCode ||
              partnerFriendCode.current ||
              lastPartnerIdsRef.current.friendCode,
            peerId: peer.peerId,
            userId: peer.userId || partnerUserId.current,
            prev: prevForResolve,
          });
          let partnerLabel = nameResolved.name;
          let nameFrom = nameResolved.from;
          // Never paint 6–12 hex / partner_short as the conversationalist name.
          if (isHexIdLike(partnerLabel)) {
            partnerLabel = "Partner";
            nameFrom = "default";
          }
          // Final belt: never stick on Partner if we have a cached real name
          if (
            isPlaceholderPartnerName(partnerLabel, {
              peerId: peer.peerId,
              userId: peer.userId,
            }) &&
            cachedName &&
            !isHexIdLike(cachedName) &&
            !isPlaceholderPartnerName(cachedName, {
              peerId: peer.peerId,
              userId: peer.userId,
            })
          ) {
            partnerLabel = cachedName;
            nameFrom = "prev";
          }
          partnerNameRef.current = partnerLabel;
          partnerNameFromRef.current = nameFrom;
          if (
            uidKey &&
            !isPlaceholderPartnerName(partnerLabel, {
              peerId: peer.peerId,
              userId: peer.userId,
            })
          ) {
            lastGoodNameByUidRef.current[uidKey] = partnerLabel;
          }
          lastPartnerIdsRef.current = {
            userId: partnerUserId.current || lastPartnerIdsRef.current.userId,
            peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId,
            friendCode:
              partnerFriendCode.current || lastPartnerIdsRef.current.friendCode,
            // Store peer prefix for id checks only — never use as painted name.
            shortId: String(peer.peerId || "").slice(0, 8) || lastPartnerIdsRef.current.shortId,
          };
          setPartnerCode(partnerFriendCode.current || peer.friendCode);
          if (!keepPrimary) setFriendAdded(false);
          // Never paint literal "Partner" when friend_code exists
          {
            const codeLatch = String(
              peer.friendCode ||
                partnerFriendCode.current ||
                lastPartnerIdsRef.current.friendCode ||
                ""
            )
              .trim()
              .toUpperCase();
            if (
              codeLatch &&
              !isHexIdLike(codeLatch) &&
              isPlaceholderPartnerName(partnerLabel, {
                peerId: peer.peerId,
                userId: peer.userId,
              })
            ) {
              partnerNameRef.current = codeLatch;
              partnerNameFromRef.current = "friend_code";
              setPartner(codeLatch);
            } else {
              setPartner(partnerLabel);
            }
          }
          // Hub weak: announce our identity + request peer name whenever dock
          // lacks a real display name (default / friend_code / prev / short_id).
          {
            // Always request peer identity over DC so stars+geo arrive even when
            // name is already known (hub name ok, MatchPeer geo empty).
            const needName =
              nameFrom === "default" ||
              nameFrom === "friend_code" ||
              nameFrom === "prev" ||
              nameFrom === "short_id" ||
              isPlaceholderPartnerName(partnerNameRef.current || partnerLabel, {
                peerId: peer.peerId,
                userId: peer.userId || partnerUserId.current,
              });
            try {
              sendPartnerIdentityP2pRef.current({ request: true });
              if (!needName) {
                // still poll for geo/stars
              }
            } catch {
              /* ignore */
            }
          }
          // Geo: full replace on new partner; same-partner re-Matched must NOT
          // wipe partner_geo-filled country/city with empty placeholders (hub
          // often re-sends Matched without re-pushing partner_geo).
          // Stars/trust: same rule — empty/legacy re-Matched must not wipe a
          // known badge with placeholder 0 (explicit hub 0 still applies).
          {
            // promoteSecondary = previous secondary becomes primary → new person,
            // so full-replace geo (do not treat as samePartner).
            // Also treat early-kick / pre-match partner_geo latch as same peer:
            // hub may send PartnerGeo then Matched with empty geo — full replace
            // would wipe flag/country and leave chrome on "Looking up…" forever.
            const idSameAsLatched =
              (prevPrimary &&
                prevPrimary !== "legacy" &&
                peerIdsLooseMatch(prevPrimary, peer.peerId)) ||
              (!!peer.userId &&
                !!prevPartnerUid &&
                peer.userId.toLowerCase() === prevPartnerUid.toLowerCase());
            const samePartner =
              !promoteSecondary &&
              (keepPrimary ||
                (wasMatched && idSameAsLatched) ||
                // First Matched after early kick — merge, don't wipe pre-match geo
                (!wasMatched && idSameAsLatched));
            // Stars/trust: merge with known-flag so empty re-Matched never
            // wipes a prior non-zero badge; explicit hub 0 still applies.
            // Never wipe hub/DC known stars with an empty peer object (known=0).
            if (peer.starsKnown) hubStarsKnownRef.current = true;
            else if (!samePartner) hubStarsKnownRef.current = false;
            if (!samePartner) identityStarsKnownRef.current = false;
            const cachedStars =
              uidKey && lastGoodStarsByUidRef.current[uidKey] != null
                ? lastGoodStarsByUidRef.current[uidKey]
                : undefined;
            setPartnerStars((prev) => {
              const merged = mergePartnerStars({
                samePartner,
                prev,
                next: peer.stars,
                nextKnown: !!peer.starsKnown,
              });
              // Rematch same uid with empty hub stars but we knew ★ earlier
              if (
                merged === 0 &&
                !peer.starsKnown &&
                cachedStars != null &&
                cachedStars > 0
              ) {
                return cachedStars;
              }
              if (uidKey && (peer.starsKnown || merged > 0)) {
                lastGoodStarsByUidRef.current[uidKey] = merged;
              }
              return merged;
            });
            setPartnerTrust((prev) =>
              mergePartnerTrust({
                samePartner,
                prev,
                next: peer.trust,
                nextKnown: !!peer.trustKnown,
              })
            );
            // Always flush Matched peer geo (incl. flag-only) so formatLocLine
            // can expand ISO→country. samePartner: merge non-empty only so a
            // second empty Matched does not wipe partner_geo-filled fields.
            const cachedGeo = uidKey
              ? lastGoodGeoByUidRef.current[uidKey]
              : undefined;
            let flag = String(peer.flag || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z]/g, "")
              .slice(0, 2);
            let country = String(peer.country || "").trim();
            let city = String(peer.city || "").trim();
            // Restore last geo for this user_id when hub MatchPeer has empty geo
            if (!flag && !country && !city && cachedGeo) {
              flag = cachedGeo.flag || "";
              country = cachedGeo.country || "";
              city = cachedGeo.city || "";
              console.log(
                `[geo] restore-cache uid=${uidKey.slice(0, 8)} flag=${flag || "-"} country=${country || "-"} city=${city || "-"}`
              );
            }
            if (samePartner) {
              // Flag-only still applies (country may arrive later via partner_geo).
              if (flag) setPartnerFlag(flag);
              if (country) setPartnerCountry(country);
              if (city) setPartnerCity(city);
              if (peer.hideIp) {
                // Cosmetic flag on name; loc line = Location hidden.
                setPartnerHideIp(true);
                setPartnerCountry("");
                setPartnerCity("");
                if (flag) setPartnerFlag(flag);
              } else if (country || city || flag) {
                // Only clear hide when matched payload has real/public geo signal
                setPartnerHideIp(false);
              }
            } else {
              // New partner: full replace; may still restore cache above.
              setPartnerFlag(flag);
              setPartnerCountry(country);
              setPartnerCity(city);
              setPartnerHideIp(!!peer.hideIp);
            }
            {
              const nextAv = String(peer.avatar || "").trim();
              if (nextAv) {
                partnerAvatarRef.current = nextAv;
                setPartnerAvatar(nextAv);
              } else if (!samePartner) {
                partnerAvatarRef.current = "";
                setPartnerAvatar("");
              }
            }
            if (uidKey && (flag || country || city) && !peer.hideIp) {
              lastGoodGeoByUidRef.current[uidKey] = {
                flag,
                country,
                city,
              };
            }
            // Diagnosis: raw MatchPeer fields (stars/trust/geo) before buffer merge.
            // ★0 + known=1 is empty ledger (hub serde u64 always present) — not a wipe bug.
            // ★0 + known=0 means legacy/omitted — samePartner merge must keep prior.
            const disp = displayPartnerStars(peer.stars, peer.trust);
            const raw0 = rawPeers[pi] || rawPeers[0] || ({} as MatchPeer);
            console.log(
              `[match] name=${partnerLabel || peer.name || "-"} from=${nameResolved.from} raw=${String(peer.name || "").slice(0, 24) || "-"} stars=${peer.stars} known=${peer.starsKnown ? 1 : 0} trust=${peer.trust} known=${peer.trustKnown ? 1 : 0} display★=${disp} flag=${flag || "-"} country=${country || "-"} city=${city || "-"} hide=${peer.hideIp ? 1 : 0} same=${samePartner ? 1 : 0} peers=${allPeers.length} code=${peer.friendCode || "-"} uid=${(peer.userId || "").slice(0, 8) || "-"} pid=${(peer.peerId || "").slice(0, 8) || "-"}`
            );
            console.log(
              `[geo] matched-apply flag=${flag || "-"} country=${country || "-"} city=${city || "-"} hide=${peer.hideIp ? 1 : 0} same=${samePartner ? 1 : 0} peers=${allPeers.length} rawFlag=${String((raw0 as { flag?: string }).flag || "-")} rawCountry=${String((raw0 as { country?: string }).country || "-")} rawCity=${String((raw0 as { city?: string }).city || "-")} rawHide=${(raw0 as { hide_ip?: boolean }).hide_ip === true ? 1 : 0}`
            );
            // Flush buffered partner_geo (arrived before this matched / id race).
            // Critical race: hub often pushes partner_geo in the same tick as
            // Matched (or just before phaseRef flips) — buffer must apply even
            // when peer_id forms differ (fed/ vs hex, short vs full).
            // Empty MatchPeer geo is OK — PartnerGeo / buffer later fills CA/city.
            let effFlag = flag;
            let effCountry = country;
            let effCity = city;
            let effHide = !!peer.hideIp;
            const buf = pendingPartnerGeoRef.current;
            if (buf) {
              const bufDecision = shouldApplyPartnerGeo({
                phaseMatched: true,
                msgPeerId: buf.peer_id,
                msgUserId: buf.user_id,
                primaryPeerId: peer.peerId,
                partnerUserId: peer.userId || partnerUserId.current,
                lastPeerId: remotePeerId.current || lastPartnerIdsRef.current.peerId,
                lastUserId: partnerUserId.current || lastPartnerIdsRef.current.userId,
                hasSecondary: !!second,
                matchMode: peer.mode || matchModeRef.current,
                peerCount: allPeers.length,
              });
              if (bufDecision.apply) {
                if (buf.hide_ip === true) {
                  setPartnerHideIp(true);
                  setPartnerCountry("");
                  setPartnerCity("");
                  if (buf.flag) setPartnerFlag(buf.flag);
                  effHide = true;
                  effCountry = "";
                  effCity = "";
                  if (buf.flag) effFlag = buf.flag;
                } else {
                  if (buf.hide_ip === false) setPartnerHideIp(false);
                  // Real geo fields ⇒ public (even if hide_ip was omitted on wire)
                  if (buf.country || buf.city || buf.flag) {
                    setPartnerHideIp(false);
                    effHide = false;
                  }
                  if (buf.flag) {
                    setPartnerFlag(buf.flag);
                    effFlag = buf.flag;
                  }
                  if (buf.country) {
                    setPartnerCountry(buf.country);
                    effCountry = buf.country;
                  }
                  if (buf.city) {
                    setPartnerCity(buf.city);
                    effCity = buf.city;
                  }
                }
                pendingPartnerGeoRef.current = null;
                console.log(
                  `[geo] partner_geo apply reason=${bufDecision.reason} flag=${buf.flag || "-"} country=${buf.country || "-"} city=${buf.city || "-"} hide=${buf.hide_ip === true ? 1 : 0} (matched-merge)`
                );
                log(
                  `partner_geo apply reason=${bufDecision.reason} flag=${buf.flag || "-"} country=${buf.country || "-"} city=${buf.city || "-"} hide=${buf.hide_ip === true ? 1 : 0} (matched-merge)`
                );
              } else {
                // Multi-party id mismatch only — keep for promote/rematch.
                console.log(
                  `[geo] partner_geo skip reason=${bufDecision.reason} buffer-keep pid=${(buf.peer_id || "").slice(0, 8)} primary=${String(peer.peerId || "").slice(0, 8)} secondary=${second ? String(second.peerId || "").slice(0, 8) : "-"}`
                );
                log(
                  `partner_geo skip reason=${bufDecision.reason} buffer-keep pid=${(buf.peer_id || "").slice(0, 8)}`
                );
              }
            }
            // Final dock paint intent after Matched + buffer (logcat diagnosis).
            console.log(
              `[match] paint name=${partnerLabel || peer.name || "-"} from=${nameResolved.from} display★=${disp} stars=${peer.stars}/${peer.starsKnown ? "k" : "?"} trust=${peer.trust}/${peer.trustKnown ? "k" : "?"} flag=${effFlag || "-"} country=${effCountry || "-"} city=${effCity || "-"} hide=${effHide ? 1 : 0} hasGeo=${effFlag || effCountry || effCity ? 1 : 0}`
            );
            console.log(
              `[geo] paint flag=${effFlag || "-"} country=${effCountry || "-"} city=${effCity || "-"} hide=${effHide ? 1 : 0} locWillShow=${!effHide && !!(effFlag || effCountry || effCity) ? 1 : effHide ? "hidden" : 0}`
            );
          }
          if (!keepPrimary) {
            setPartnerMuted(false);
            setTheyMutedMe(false);
            setPartnerCamHidden(false);
            partnerCamHiddenRef.current = false;
            setPartnerNoCam(false);
            partnerNoCamRef.current = false;
          }
          setFindThirdPending(false);
          extraPeersRef.current = extras.map((p) => ({
            ...p,
            name: paintSafePartnerName(p.name, "Partner", {
              peerId: p.peerId,
              userId: p.userId,
            }),
          }));
          setExtraPeers(extraPeersRef.current);
          if (extras.length > 0) {
            setSwapViews(false);
          }
          if (!second || !keepSecondary) {
            extraMuted2Ref.current = false;
            setExtraMuted2(false);
          }
          if (!third || !keepTertiary) {
            extraMuted3Ref.current = false;
            setExtraMuted3(false);
          }
          extras.forEach((p, i) => {
            const loc = p.hideIp
              ? "hidden"
              : p.country || p.city || p.flag || "-";
            log(
              `extra[${i}] name=${paintSafePartnerName(p.name, "Partner", {
                peerId: p.peerId,
                userId: p.userId,
              })} ★${displayPartnerStars(p.stars, p.trust)} loc=${loc} peer=${(p.peerId || "").slice(0, 8)}`
            );
          });
          setMatchMode(peer.mode);
          {
            const roleRaw = String(m.your_role || "").trim().toLowerCase();
            const role =
              roleRaw ||
              (String(peer.mode || "") === "party_browse" &&
              (huntingWithPartnerRef.current || yourRoleRef.current === "party")
                ? "party"
                : "solo");
            yourRoleRef.current = role;
            setYourRole(role);
          }
          // Hunt ends when extras are listed or stream2/3 is bound.
          // extras>=1 → ExtraRemoteTile connecting (not looking strip).
          {
            const modeStr = String(peer.mode || m.mode || "");
            const existing2 =
              extras.length > 0
                ? (media2Ref.current || media2).getRemoteStream?.() || null
                : null;
            const existing3 =
              extras.length > 1
                ? (media3Ref.current || media3).getRemoteStream?.() || null
                : null;
            if (existing2) applyRemote2(existing2, "matched_joinPeers");
            if (existing3) applyRemote3(existing3, "matched_joinPeers");
            if (existing2 || existing3 || extras.length > 0) {
              huntingWithPartnerRef.current = false;
              setHuntingWithPartner(false);
            } else if (modeStr === "friend" || String(m.your_role || "") === "friend") {
              // Friend phone stays 1v1 until Find 3rd is accepted
              huntingWithPartnerRef.current = false;
              setHuntingWithPartner(false);
            } else if (modeStr === "party_browse") {
              // Keep first partner + looking UI until a 3rd is listed
              huntingWithPartnerRef.current = true;
              setHuntingWithPartner(true);
            } else {
              huntingWithPartnerRef.current = false;
              setHuntingWithPartner(false);
            }
          }
          setPhase("matched");
          phaseRef.current = "matched";
          searchingRef.current = false;
          queueAckedRef.current = false;
          setQueueAcked(false);
          // Identity poll: re-request partner_identity until loc+★ settle.
          try {
            if (mediaRef.current?.isDataChannelOpen?.()) {
              startIdentityPollRef.current();
            }
          } catch {
            /* ignore */
          }
          // Brief grace so Match chime + first look aren't skipped by fat-finger Next
          if (!keepPrimary) {
            // ~2s fat-finger so first look isn't skipped. 12s MATCH_SETTLE
            // lock made Next feel dead (human: android buttons slow).
            nextGraceUntilRef.current = Date.now() + 2000;
          }
          setAlone(false);
          setMoreOpen(false);
          if (extras.length === 0) setFocusExtra(false);
          // Privacy veil when Settings intro/hold (default intro). Eye toggles anytime.
          // Hard default intro on prefs race: never treat empty/unknown as permanent off.
          // prefs_load peels optimistic intro if user explicitly chose off.
          // Always go through applyMatchBlurVeil so [blur] show is one path;
          // remote_stream re-applies if keepPrimary / thrash skipped this paint.
          const isFriendMatch =
            peer.mode === "friend" || String(m.mode || "") === "friend";
          const leftoverStreamEarly =
            (mediaRef.current || media).getRemoteStream?.() || null;
          const leftoverLiveEarly = hasLiveRemoteMedia(leftoverStreamEarly);
          const samePeerEarly =
            !!prevPrimary &&
            prevPrimary !== "legacy" &&
            (prevPrimary === peer.peerId ||
              peerIdsLooseMatch(prevPrimary, peer.peerId));
          const firstPaintWon = !shouldClearRemoteUi({
            keepPrimary,
            leftoverLive: leftoverLiveEarly,
            videoSeen: !!remoteVideoSeenRef.current,
            samePeer: samePeerEarly,
            hadPrevPrimary:
              !!prevPrimary && prevPrimary !== "legacy",
            leftoverHasPicture: remoteVideoHasPicture(leftoverStreamEarly),
          });
          {
            const raw = blurModeRef.current;
            const mode: BlurStrangersMode =
              raw === "off" || raw === "intro" || raw === "hold"
                ? raw
                : "intro";
            // Until AsyncStorage returns, never stay on off (ref starts intro).
            const effective: BlurStrangersMode =
              !blurPrefsReadyRef.current && mode === "off" ? "intro" : mode;
            const wantBlur =
              !isFriendMatch &&
              (effective === "hold" || effective === "intro");
            if (!keepPrimary && firstPaintWon) {
              // Face already on stage — veil-after-paint + SoftBlur sink
              // is "Partner video shown" then Linking then black.
              blurWantAutoRef.current = false;
              log(
                `blur skip after first_paint mode=${effective} leftover=${leftoverLiveEarly ? 1 : 0} seen=${remoteVideoSeenRef.current ? 1 : 0}`
              );
            } else if (!keepPrimary) {
              // New partner PC: new gen, arm want flag, apply or clear.
              clearIntroUnblurTimer();
              matchBlurGenRef.current += 1;
              blurWantAutoRef.current = wantBlur;
              if (wantBlur) {
                // Ref so mount-only hub handler always hits latest apply fn
                applyMatchBlurVeilRef.current("match", {
                  isFriend: isFriendMatch,
                });
              } else {
                setRemoteBlurred(false);
                remoteBlurredRef.current = false;
                blurAutoAppliedRef.current = false;
              }
              log(
                `blur match mode=${effective} veiled=${wantBlur ? 1 : 0} friend=${isFriendMatch ? 1 : 0} prefsReady=${blurPrefsReadyRef.current ? 1 : 0} keepP=0 gen=${matchBlurGenRef.current}`
              );
            } else if (wantBlur) {
              // Soft rematch keepPrimary: re-mount only if auto-veil still wanted
              // or never decided this gen (not peeled). Peel stamps blurPeelGenRef.
              const peeledThisGen =
                blurPeelGenRef.current === matchBlurGenRef.current;
              if (peeledThisGen) {
                // User/intro peel — leave clear; do not re-arm
                blurWantAutoRef.current = false;
              } else if (!remoteBlurredRef.current) {
                blurWantAutoRef.current = true;
                applyMatchBlurVeilRef.current("match_keep", {
                  isFriend: isFriendMatch,
                });
              } else {
                blurWantAutoRef.current = true;
              }
              log(
                `blur match_keep mode=${effective} veiled=${remoteBlurredRef.current ? 1 : 0} peeled=${peeledThisGen ? 1 : 0} friend=${isFriendMatch ? 1 : 0} prefsReady=${blurPrefsReadyRef.current ? 1 : 0}`
              );
            } else {
              blurWantAutoRef.current = false;
            }
          }

          if (!keepPrimary) {
            const leftoverStream =
              leftoverStreamEarly ||
              (mediaRef.current || media).getRemoteStream?.() ||
              null;
            const leftover = leftoverLiveEarly || hasLiveRemoteMedia(leftoverStream);
            const clearUi = shouldClearRemoteUi({
              keepPrimary: false,
              leftoverLive: leftover,
              videoSeen: !!remoteVideoSeenRef.current,
              samePeer: samePeerEarly,
              hadPrevPrimary:
                !!prevPrimary && prevPrimary !== "legacy",
              leftoverHasPicture: remoteVideoHasPicture(leftoverStream),
            });
            const started = Date.now();
            setMatchStartedAt(started);
            matchStartedAtRef.current = started;
            ratedThisMatchRef.current = false;
            isOffererRef.current = !!peer.isOfferer;
            // New match: first-path linking must not start 3×10s wait.
            hadConnectedThisMatchRef.current = leftover;
            clearPartnerReconnectArm();
            if (reconnectSnapRef.current) {
              reconnectSnapRef.current = null;
              setReconnectSnap(null);
            }
            if (clearUi) {
              remoteVideoSeenRef.current = false;
              setRemoteVideoReady(false);
              setRemoteStream(null);
              const leftoverAv = hasLiveRemoteMedia(leftoverStream);
              setAwaitingRemoteVideo(!leftoverAv);
              setConn(leftoverAv ? "connected" : "connecting");
              setConnSince(leftoverAv ? 0 : Date.now());
            } else {
              // First paint already happened — do not unmount / re-arm Linking.
              if (leftoverStream) setRemoteStream(leftoverStream);
              setAwaitingRemoteVideo(false);
              setConn("connected");
              setConnSince(0);
            }
            setChat([]);
            setDcOpen(false);
            try {
              if (mediaRef.current?.isDataChannelOpen?.()) setDcOpen(true);
            } catch {
              /* leftover DC from hunt-keep */
            }
            setSwapViews(false);
            setFocusExtra(false);
            // Clear any background cam/mic pause so partner sees/hears us
            bgPausedCamRef.current = false;
            bgPausedMicRef.current = false;
            const m1 = mediaRef.current || media;
            const m2 = media2Ref.current || media2;
            const m3 = media3Ref.current || media3;
            if (camOnRef.current) {
              m1.setCamEnabled(true);
              m2.setCamEnabled(true);
              m3.setCamEnabled(true);
              try {
                // Remount RTCView only when we just cleared — first paint
                // already showing must not get a second sink/epoch bump.
                if (clearUi) m1.forceRepaintRemote?.("match_start");
              } catch {
                /* ignore */
              }
            }
            if (micOnRef.current && !debateMicLockedRef.current) {
              m1.setMicEnabled(true);
              m2.setMicEnabled(true);
              m3.setMicEnabled(true);
            }
            debate.reset();
            setDebateComposeOpen(false);
            setPeerTyping(false);
            hapticMatch();
            void playMatchChime();
            track("match_ok", {
              mode: peer.mode || "solo",
              offerer: peer.isOfferer ? 1 : 0,
              turn: iceHasTurnRef.current ? 1 : 0,
            });
          } else {
            // Soft re-match (party join / find-3rd / promote / extra hangup)
            // — keep A/V + chat. Extra leave must not wipe primary RTCView.
            log(
              `keep primary PC peer=${peer.peerId.slice(0, 8)} extras=${extras.length} promote=${promoteSecondary ? 1 : 0} extraHangup=${extraHangupKeep ? 1 : 0}`
            );
            if (extras.length === 0) {
              setSwapViews(false);
              setFocusExtra(false);
            }
            if (extraHangupKeep) {
              const keptSoft =
                (mediaRef.current || media).getRemoteStream?.() || null;
              if (keptSoft) setRemoteStream(keptSoft);
              if (hasLiveRemoteMedia(keptSoft)) {
                setAwaitingRemoteVideo(false);
                setConn("connected");
                setConnSince(0);
              }
            }
          }
          void enterCallAudio();
          {
            const d = displayPartnerStars(peer.stars, peer.trust);
            log(
              `[match] name=${partnerLabel || "-"} from=${nameResolved.from} mode=${peer.mode} offerer=${peer.isOfferer} uid=${(peer.userId || "").slice(0, 8) || "-"} code=${peer.friendCode || "-"} ★${peer.stars}${peer.starsKnown ? "" : "?"} trust=${peer.trust}${peer.trustKnown ? "" : "?"} display★=${d} loc=${peer.flag || "-"}/${peer.country || "-"}/${peer.city || "-"} hideIp=${peer.hideIp ? 1 : 0} peers=${allPeers.length} keepP=${keepPrimary} keepS=${keepSecondary} turn=${iceHasTurnRef.current}`
            );
            // Dedicated one-liner for ★ diagnosis (hub field present vs omitted)
            log(
              `partner_stars stars=${peer.stars} known=${peer.starsKnown ? 1 : 0} trust=${peer.trust} known=${peer.trustKnown ? 1 : 0} display=${d}`
            );
          }

          // Real remote peer count after cap/filter (primary + extras).
          // Multi-audio / encode floor only when a 2nd peer is real — not while
          // party_browse is only "looking for 3rd" (1 media link), and not when
          // hub poison/legacy rows inflate allPeers.length. That thrash froze
          // Android outbound → PC saw frozen conversationalist mid-hunt.
          const nPeers = 1 + extras.length;
          const multi = nPeers >= 2 && !!second;
          const m1 = mediaRef.current || media;
          const m2 = media2Ref.current || media2;
          const m3 = media3Ref.current || media3;
          if (multi) {
            m1.setMultiPeerAudio(true);
            m2.setMultiPeerAudio(true, { secondary: true });
            m3.setMultiPeerAudio(true, { secondary: true });
            // Do not applyFullAudioProcessing mid 3-way — audio
            // applyConstraints can restart Camera2 (same crash class).
          } else {
            m1.setMultiPeerAudio(false);
            m2.setMultiPeerAudio(false);
            m3.setMultiPeerAudio(false);
          }

          // Extra PCs already prepared + kicked above (before identity storm).
          // Do not closeCall a live startCall2/3 — that tore the 2nd remote.
          if (second && second.peerId !== "legacy") {
            log(
              `multi-peer secondary ${paintSafePartnerName(second.name, "Partner", {
                peerId: second.peerId,
                userId: second.userId,
              })} role=${second.role} offerer=${second.isOfferer} kicked=${secondaryKickStarted ? 1 : 0} keepS=${keepSecondary ? 1 : 0}`
            );
          }
          if (third && third.peerId !== "legacy") {
            log(
              `multi-peer tertiary ${paintSafePartnerName(third.name, "Partner", {
                peerId: third.peerId,
                userId: third.userId,
              })} role=${third.role} offerer=${third.isOfferer} kicked=${tertiaryKickStarted ? 1 : 0} keepT=${keepTertiary ? 1 : 0}`
            );
          }

          // ICE: startCall first when cache warm — never block match on HTTP.
          // Background-refresh TURN so next match stays hot.
          // startSecondary/startTertiary defined earlier; calls below are no-ops
          // if already kicked. Never remount primary on 3rd join / hunt.
          // Skip startCall on live remount (3rd join / extra hangup).
          // Read from MediaSession (mount-only listener — React remoteStream is stale).
          // Live audio counts (laptop no-cam). Extra leave never remounts primary.
          const hasLiveRemote = hasLiveRemoteMedia(
            (mediaRef.current || media).getRemoteStream?.() || null
          );
          const huntOrBrowseSkip =
            huntingWithPartnerRef.current ||
            String(peer.mode || "") === "party_browse" ||
            matchModeRef.current === "party_browse";
          const skipStart = shouldSkipPrimaryStartCall({
            keepPrimary,
            extrasCount: extras.length,
            partyBrowse: huntOrBrowseSkip,
            hunting: huntingWithPartnerRef.current,
            extraHangupKeep,
            hasLiveRemote,
          });

          const startPrimary = (why: string) => {
            if (skipStart) {
              // 3rd join keepPrimary: do NOT remount primary, but extras
              // must still startCall2 / startCall3 (parallel).
              log(
                `startCall skip keep_live peer=${peer.peerId.slice(0, 8)} extras_kick=${second ? 1 : 0} four=${third ? 1 : 0}`
              );
              startSecondary();
              startTertiary();
              return;
            }
            // Early kick already fired startCall (unless promoteSecondary)
            if (why === "matched-immediate" && !promoteSecondary) {
              // Parallel: third/party peer must start NOW (not after primary settles)
              startSecondary();
              startTertiary();
              return;
            }
            const sess = mediaRef.current || media;
            const fr = !!forceRelayHubRef.current;
            try {
              if (fr) sess.setForceRelay?.(true);
            } catch {
              /* ignore */
            }
            const t0 = Date.now();
            log(
              `startCall kick offerer=${peer.isOfferer ? 1 : 0} force_relay_hub=${fr ? 1 : 0} (${why}) multi=${second ? 1 : 0} four=${third ? 1 : 0}`
            );
            // Kick secondary + tertiary in parallel with primary (3/4-way speed)
            startSecondary();
            startTertiary();
            sess
              .startCall({
                isOfferer: !!peer.isOfferer,
                forceRelay: fr ? true : undefined,
              })
              .then(() => {
                log(`startCall ok (${why}) +${Date.now() - t0}ms`);
              })
              .catch((e) => log(`startCall FAIL ${e}`));
          };
          startPrimary("matched-immediate");
          void hubRefLive.current
            .fetchIceConfig()
            .then((cfg) => {
              (mediaRef.current || media).setIceConfig(cfg);
              (media2Ref.current || media2).setIceConfig(cfg);
              (media3Ref.current || media3).setIceConfig(cfg);
              iceHasTurnRef.current = !!cfg.has_turn;
              log(`ICE match has_turn=${cfg.has_turn}`);
              return cfg;
            })
            .catch((e) => log(`ICE match fail ${e}`));
          break;
        }
        case "signal": {
          const m = msg as {
            kind?: string;
            payload?: string;
            from_peer?: string;
          };
          const from = String(m.from_peer || "");
          const kind = String(m.kind || "");
          // Hub forensics beacon (av-verify) — logged server-side; do not apply to RTC
          if (kind === "av_path") break;
          // App-level control plane over hub (works when P2P datachannel is down)
          if (kind === "gift_fx" || kind === "star_gift_fx") {
            try {
              let raw: unknown = m.payload;
              if (typeof raw === "string" && raw.trim()) {
                raw = JSON.parse(raw);
                if (typeof raw === "string") {
                  try {
                    raw = JSON.parse(raw);
                  } catch {
                    /* keep */
                  }
                }
              }
              const body =
                raw && typeof raw === "object"
                  ? (raw as Record<string, unknown>)
                  : {};
              applyInboundGiftFxRef.current(body, "hub_signal");
            } catch (e) {
              log(`gift_fx hub parse ${e}`);
            }
            break;
          }
          if (kind === "partner_mute" || kind === "partnerMute") {
            try {
              let raw: unknown = m.payload;
              if (typeof raw === "string" && raw.trim()) {
                raw = JSON.parse(raw);
                // Double-encoded JSON string
                if (typeof raw === "string") {
                  try {
                    raw = JSON.parse(raw);
                  } catch {
                    /* keep */
                  }
                }
              }
              const body =
                raw && typeof raw === "object"
                  ? (raw as Record<string, unknown>)
                  : {};
              const fromUid = String(body.user_id || body.from || "").trim();
              if (
                fromUid &&
                userIdRef.current &&
                fromUid === userIdRef.current
              ) {
                break; // own echo
              }
              if (fromUid) notePartnerUserId(fromUid, "partner_mute_hub");
              const mutedVal = body.muted;
              const on =
                mutedVal === true ||
                mutedVal === 1 ||
                mutedVal === "1" ||
                mutedVal === "true";
              applyTheyMutedMeRef.current(on, "hub_signal");
            } catch (e) {
              log(`partner_mute hub parse ${e}`);
            }
            break;
          }
          if (kind === "no_cam") {
            try {
              let raw: unknown = m.payload;
              if (typeof raw === "string" && raw.trim()) {
                raw = JSON.parse(raw);
              }
              const body =
                raw && typeof raw === "object"
                  ? (raw as Record<string, unknown>)
                  : {};
              const fromUid = String(body.user_id || body.from || "").trim();
              if (
                fromUid &&
                userIdRef.current &&
                fromUid === userIdRef.current
              ) {
                break;
              }
              const onVal = body.on ?? body.hidden;
              const on =
                onVal === true ||
                onVal === 1 ||
                onVal === "1" ||
                onVal === "true";
              applyNoCamFromPeer(on, fromUid, "hub_signal");
            } catch (e) {
              log(`no_cam hub parse ${e}`);
            }
            break;
          }
          if (kind === "self_hide" || kind === "cam_hide") {
            try {
              let raw: unknown = m.payload;
              if (typeof raw === "string" && raw.trim()) {
                raw = JSON.parse(raw);
                if (typeof raw === "string") {
                  try {
                    raw = JSON.parse(raw);
                  } catch {
                    /* keep */
                  }
                }
              }
              const body =
                raw && typeof raw === "object"
                  ? (raw as Record<string, unknown>)
                  : {};
              const fromUid = String(body.user_id || body.from || "").trim();
              if (
                fromUid &&
                userIdRef.current &&
                fromUid === userIdRef.current
              ) {
                break; // own echo
              }
              if (fromUid) notePartnerUserId(fromUid, "self_hide_hub");
              const onVal = body.on ?? body.hidden ?? body.muted;
              const on =
                onVal === true ||
                onVal === 1 ||
                onVal === "1" ||
                onVal === "true";
              applyHideFromPeer(on, fromUid, "hub_signal");
            } catch (e) {
              log(`self_hide hub parse ${e}`);
            }
            break;
          }
          // Route multi-peer signals via refs (survives promote swap)
          const primarySess = mediaRef.current || media;
          const secondarySess = media2Ref.current || media2;
          const tertiarySess = media3Ref.current || media3;
          // Extra bye: close only that PC. Never apply bye to primary (that
          // tore the remaining 1v1 and re-armed Linking / startCall).
          if (kind === "bye") {
            const extra2 =
              !!from &&
              !!secondaryPeerId.current &&
              from === secondaryPeerId.current;
            const extra3 =
              !!from &&
              !!tertiaryPeerId.current &&
              from === tertiaryPeerId.current;
            const fromPrimary =
              !!from &&
              !!remotePeerId.current &&
              from === remotePeerId.current &&
              remotePeerId.current !== "legacy";
            const extrasLive = !!(
              secondaryPeerId.current || tertiaryPeerId.current
            );
            if (extra2) {
              dropExtraKeepPrimary("2", "bye");
              break;
            }
            if (extra3) {
              dropExtraKeepPrimary("3", "bye");
              break;
            }
            if (
              !fromPrimary &&
              extrasLive &&
              phaseRef.current === "matched"
            ) {
              dropExtraKeepPrimary("all", "bye_unscoped");
              break;
            }
            // 1v1 PC Stop/refresh: MediaSession bye closes ICE but React kept
            // the last frame (matched). Auto-Next like hub "partner stopped".
            if (
              phaseRef.current === "matched" &&
              !extrasLive &&
              (fromPrimary || !from)
            ) {
              const leftName = partnerNameRef.current || "Partner";
              const autoNext =
                matchModeRef.current !== "friend" && !isFriendsOnly();
              try {
                primarySess.closeCall({ keepLocal: true, sendBye: false });
                secondarySess.closeCall({ keepLocal: true, sendBye: false });
                tertiarySess.closeCall({ keepLocal: true, sendBye: false });
              } catch {
                /* ignore */
              }
              setRemoteStream(null);
              setRemoteStream2(null);
              setRemoteStream3(null);
              extraPeersRef.current = [];
              setExtraPeers([]);
              extrasCountRef.current = 0;
              remotePeerId.current = "";
              secondaryPeerId.current = "";
              tertiaryPeerId.current = "";
              setHuntingWithPartner(false);
              setFindThirdPending(false);
              setMatchMode("");
              matchModeRef.current = "";
              void leaveCallAudio();
              if (autoNext) {
                searchingRef.current = true;
                queueAckedRef.current = false;
                setQueueAcked(false);
                setPhase("search");
                phaseRef.current = "search";
                setAlone(true);
                setWaiting((w) => Math.max(w, 1));
                showToastRef.current(
                  tRef.current("mobile.live.autoNextSkip", {
                    name: leftName,
                  }) ||
                    tRef.current("mobile.live.autoNextShort", {
                      name: leftName,
                    })
                );
                try {
                  hubRefLive.current.spin();
                } catch {
                  /* ignore */
                }
                log("bye primary — auto-next");
              } else {
                searchingRef.current = false;
                setPhase("idle");
                phaseRef.current = "idle";
                showToastRef.current(
                  tRef.current("mobile.live.partnerLeft", { name: leftName })
                );
                log("bye primary — idle (friend)");
              }
              break;
            }
          }
          // Dual inbound offers (Android-as-3rd): never apply a foreign from=
          // to media1 when extras are listed or primary is already latched.
          const signalTarget = routeInboundSignalTarget({
            from,
            primaryId: remotePeerId.current,
            secondaryId: secondaryPeerId.current,
            tertiaryId: tertiaryPeerId.current,
            extrasCount: extrasCountRef.current,
            listedPeerIds: listedPeerIdsRef.current,
            phaseMatched: phaseRef.current === "matched",
          });
          if (signalTarget === "drop") {
            log(
              `signal drop ${kind} from=${from.slice(0, 8)} (no slot)`
            );
            break;
          }
          if (signalTarget === "secondary") {
            if (
              from &&
              (!secondaryPeerId.current || secondaryPeerId.current === "legacy")
            ) {
              secondaryPeerId.current = from;
            }
            log(
              `signal2 ← ${kind} from=${from.slice(0, 8)} len=${String(m.payload || "").length}`
            );
            secondarySess
              .handleRemoteSignal(kind, String(m.payload || ""))
              .catch((e) => log(`signal2 ${e}`));
            break;
          }
          if (signalTarget === "tertiary") {
            if (
              from &&
              (!tertiaryPeerId.current || tertiaryPeerId.current === "legacy")
            ) {
              tertiaryPeerId.current = from;
            }
            log(
              `signal3 ← ${kind} from=${from.slice(0, 8)} len=${String(m.payload || "").length}`
            );
            tertiarySess
              .handleRemoteSignal(kind, String(m.payload || ""))
              .catch((e) => log(`signal3 ${e}`));
            break;
          }
          if (from && !remotePeerId.current) remotePeerId.current = from;
          log(
            `signal ← ${kind} from=${(m.from_peer || "").slice(0, 8)} len=${String(m.payload || "").length}`
          );
          if (kind === "offer" || kind === "answer") {
            console.log(
              `[client-ice] signal recv kind=${kind} peer=${from.slice(0, 8)}`
            );
          }
          if (kind && m.payload != null) {
            // Offer before matched-handler finish: re-arm hub force_relay so
            // answer rebuilds policy=relay (web pure) before setRemote.
            if (kind === "offer" && forceRelayHubRef.current) {
              try {
                primarySess.setForceRelay?.(true);
                const once =
                  typeof (primarySess as { isForceRelay?: () => boolean })
                    .isForceRelay === "function"
                    ? (primarySess as { isForceRelay: () => boolean }).isForceRelay()
                      ? 1
                      : 0
                    : -1;
                log(
                  `force_relay re-arm on offer force_relay_hub=1 forceRelayOnce=${once}`
                );
              } catch {
                /* ignore */
              }
            }
            primarySess
              .handleRemoteSignal(kind, m.payload)
              .then(() => {
                if (kind === "offer" || kind === "answer") {
                  log(`signal ${kind} applied ok`);
                  console.log(`[client-ice] signal ${kind} applied ok`);
                }
              })
              .catch((e) => {
                if (kind === "offer" || kind === "answer") {
                  console.log(`[client-ice] signal ${kind} applied fail err=${e}`);
                }
                log(`handle ${e}`);
              });
          }
          break;
        }
        case "error": {
          // Hub "not matched" = signal outside a room (benign). Never force error UI.
          const em = String((msg as { message?: string }).message || "");
          const low = em.toLowerCase();
          log(`hub error: ${em}`);
          if (
            !em ||
            low === "not matched" ||
            low.includes("not matched") ||
            low.includes("rate limited")
          ) {
            break;
          }
          // Only surface while user is actively searching/matched — not idle preview
          setPhase((p) => {
            if (p === "search") {
              searchingRef.current = false;
              return "error";
            }
            return p;
          });
          break;
        }
        case "chat": {
          const m = msg as {
            author?: string;
            body?: string;
            from_user_id?: string;
          };
          const bodyRaw = String(m.body || "");
          const debateHub = parseDebateHubBody(bodyRaw);
          if (debateHub) {
            const fromUid = String(m.from_user_id || "").trim();
            if (
              fromUid &&
              userIdRef.current &&
              fromUid === userIdRef.current
            ) {
              break;
            }
            if (!debateHub.user_id && fromUid) debateHub.user_id = fromUid;
            log(`debate ← hub ${String(debateHub.type || "")}`);
            debateRef.current?.handleMessage(debateHub);
            break;
          }
          // Control plane fallback (partner mute) — never show as chat bubble
          const muteCtrl = tryParseMuteControl(bodyRaw);
          if (muteCtrl !== null) {
            const fromUid = String(m.from_user_id || "").trim();
            if (
              fromUid &&
              userIdRef.current &&
              fromUid === userIdRef.current
            ) {
              break; // own echo
            }
            applyTheyMutedMeRef.current(muteCtrl, "hub_chat_ctrl");
            break;
          }
          // Control plane: partner self-hide — never show as chat bubble
          const noCamCtrl = tryParseNoCamControl(bodyRaw);
          if (noCamCtrl !== null) {
            const fromUid = String(m.from_user_id || "").trim();
            if (
              fromUid &&
              userIdRef.current &&
              fromUid === userIdRef.current
            ) {
              break;
            }
            applyNoCamFromPeer(
              noCamCtrl,
              String(m.from_user_id || "").trim(),
              "hub_chat_ctrl"
            );
            break;
          }
          const hideCtrl = tryParseSelfHideControl(bodyRaw);
          if (hideCtrl !== null) {
            const fromUid = String(m.from_user_id || "").trim();
            if (
              fromUid &&
              userIdRef.current &&
              fromUid === userIdRef.current
            ) {
              break; // own echo
            }
            applyHideFromPeer(
              hideCtrl,
              String(m.from_user_id || "").trim(),
              "hub_chat_ctrl"
            );
            break;
          }
          const body = bodyRaw.trim().slice(0, 280);
          if (body) {
            setChat((c) =>
              [...c, { from: m.author || "peer", body }].slice(-30)
            );
            hapticLight();
          }
          break;
        }
        case "star_effect": {
          const m = msg as {
            ok?: boolean;
            effect?: string;
            from_name?: string;
            from_user_id?: string;
            user_id?: string;
            cost?: number;
            until?: number;
            effect_until?: number;
            message?: string;
            spender_stars?: number;
            target_stars?: number;
          };
          if (m.ok === false) {
            // Hub rejected spend — clear optimistic FX + show why
            setGiftFlash(null);
            setGiftEffect(null);
            setPartnerFx(null);
            setSelfFx(null);
            if (m.message) {
              showToastRef.current(String(m.message).slice(0, 80));
            }
            break;
          }
          // Keep partner ★ badge live when hub reports target balance
          if (m.target_stars != null) {
            const targetUid = String(m.user_id || "").trim().toLowerCase();
            const partnerUid = String(
              partnerUserId.current || lastPartnerIdsRef.current.userId || ""
            )
              .trim()
              .toLowerCase();
            const me = String(userIdRef.current || "").trim().toLowerCase();
            const fromUid = String(m.from_user_id || "").trim().toLowerCase();
            const matched = phaseRef.current === "matched";
            // Match by partner user_id; also accept peer-identity fallbacks when
            // thrash cleared partnerUserId or hub omits user_id on the effect.
            const isPartnerTarget =
              (!!targetUid && !!partnerUid && targetUid === partnerUid) ||
              (matched &&
                !!targetUid &&
                !!me &&
                targetUid !== me &&
                !partnerUid) ||
              (matched &&
                !targetUid &&
                !!me &&
                !!fromUid &&
                fromUid === me);
            if (isPartnerTarget) {
              setPartnerStars(
                Math.max(0, Math.floor(Number(m.target_stars) || 0))
              );
            }
          }
          if (m.ok && m.effect) {
            const gift = GIFTS.find((g) => g.id === m.effect);
            const label = gift
              ? `${gift.emoji} ${m.from_name || ""}`.trim()
              : m.effect;
            const effectId = String(m.effect);
            const giftLabel =
              effectId === "pass_mic"
                ? `${gift?.emoji || "🎤"} ${m.from_name || tRef.current("mobile.live.passMicTitle")}`.trim()
                : label || m.effect;
            setGiftFlash(giftLabel);
            // Non-bars gifts keep full-stage flash; bars paint on the tile (SurfaceView)
            if (effectId !== "bars") {
              setGiftEffect(effectId);
            } else {
              setGiftEffect(null);
            }
            if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
            const rawUntil = m.until ?? m.effect_until;
            const untilMs =
              rawUntil && rawUntil > 1e9
                ? rawUntil * 1000
                : rawUntil && rawUntil > Date.now()
                  ? rawUntil
                  : Date.now() + giftFxHoldMs(effectId);
            const hold = Math.max(800, untilMs - Date.now());
            giftFxTimerRef.current = setTimeout(() => {
              setGiftFlash(null);
              setGiftEffect(null);
            }, hold);
            // Route bars to partner vs self tile (web: remote-fx / local-fx)
            const targetUid = String(m.user_id || "").trim();
            const me = String(userIdRef.current || "").trim();
            if (effectId === "bars") {
              if (targetUid && me && targetUid === me) {
                setSelfFx("bars");
                if (selfFxTimerRef.current) clearTimeout(selfFxTimerRef.current);
                selfFxTimerRef.current = setTimeout(() => setSelfFx(null), hold);
              } else {
                setPartnerFx("bars");
                if (partnerFxTimerRef.current)
                  clearTimeout(partnerFxTimerRef.current);
                partnerFxTimerRef.current = setTimeout(
                  () => setPartnerFx(null),
                  hold
                );
              }
            }
            // please_stay: lock Next ~15s (hub may also send effect_until)
            if (m.effect === "please_stay") {
              const rawUntil = m.until ?? m.effect_until;
              const untilMs =
                rawUntil && rawUntil > 1e9
                  ? rawUntil * 1000
                  : rawUntil && rawUntil > Date.now()
                    ? rawUntil
                    : Date.now() + 15_000;
              stayUntilRef.current = Math.max(stayUntilRef.current, untilMs);
              setStayRemSecs(
                Math.max(0, Math.ceil((stayUntilRef.current - Date.now()) / 1000))
              );
            }
            // Shooting star receive = same center popup as admin grant
            if (
              effectId === "shooting_star" &&
              targetUid &&
              me &&
              targetUid === me &&
              String(m.from_user_id || "") !== me
            ) {
              const title =
                tRef.current("stars.received") || "You received a star ★";
              const from = String(m.from_name || "").trim();
              const total = Math.max(0, Number(m.target_stars) || 0);
              if (starGiftPopTimer.current) {
                clearTimeout(starGiftPopTimer.current);
              }
              setStarGiftPop({
                title,
                sub: from + (total ? ` · ★ ${total}` : ""),
              });
              void playStarGiftClick(1);
              starGiftPopTimer.current = setTimeout(
                () => setStarGiftPop(null),
                2000
              );
            }
            // Toast when they pass YOU the mic (not when you spend)
            if (
              effectId === "pass_mic" &&
              m.from_name &&
              String(m.from_user_id || "") !== userIdRef.current
            ) {
              showToastRef.current(
                tRef.current("mobile.live.passMicToast", {
                  name: m.from_name || "…",
                })
              );
            }
            void playGiftChime(effectId);
            hapticMatch();
          }
          break;
        }
        case "find_third_result": {
          const m = msg as { ok?: boolean; reason?: string };
          const reason = String(m.reason || "");
          if (m.ok || reason === "accepted") {
            // CRITICAL: do not go to pure search — keep partner stream + split UI
            enterHuntingWithPartner("find_third_result");
            showToastRef.current(
              t("mobile.toast.findThirdAccepted") ||
                t("trio.searching") ||
                "Looking for a 3rd together…"
            );
          } else {
            setFindThirdPending(false);
            setHuntingWithPartner(false);
          }
          break;
        }
        case "call_ended": {
          // Friend hangup → idle. Short stranger call → auto-search next.
          const wasMatched = phaseRef.current === "matched";
          // 3-way listed: do not idle-tear first PC (Courtier freeze + Start).
          if (
            wasMatched &&
            shouldKeepTrioOnCallEnded({
              extrasCount: extrasCountRef.current,
              secondaryPeerId: secondaryPeerId.current,
              tertiaryPeerId: tertiaryPeerId.current,
            })
          ) {
            log("call_ended keep 3-way — skip idle teardown");
            break;
          }
          const leftName = partnerNameRef.current || "Partner";
          const started = matchStartedAtRef.current;
          const mode = matchModeRef.current || "";
          const dur = started
            ? Math.floor((Date.now() - started) / 1000)
            : 0;
          const autoNext =
            wasMatched && mode !== "friend" && !isFriendsOnly();
          try {
            const uid = partnerUserId.current;
            if (uid && dur >= 5 && mode !== "friend") {
              void pushMatchHistory({
                user_id: uid,
                name: leftName,
                friend_code: partnerFriendCode.current || undefined,
                mode,
                duration_secs: dur,
              });
            }
          } catch {
            /* ignore */
          }
          void leaveCallAudio();
          if (wasMatched) {
            showToastRef.current(
              autoNext
                ? tRef.current("mobile.live.autoNextSkip", { name: leftName }) ||
                    tRef.current("mobile.live.autoNextShort", { name: leftName })
                : tRef.current("mobile.live.partnerLeft", { name: leftName })
            );
            hapticLight();
          }
          debate.reset();
          setDebateComposeOpen(false);
          setDcOpen(false);
          forceRelayHubRef.current = false;
          media2.closeCall({ keepLocal: true, sendBye: false });
          setRemoteStream2(null);
          secondaryPeerId.current = "";
          extrasCountRef.current = 0;
          listedPeerIdsRef.current = [];
          media3.closeCall({ keepLocal: true, sendBye: false });
          setRemoteStream3(null);
          tertiaryPeerId.current = "";
          extraPeersRef.current = [];
          setExtraPeers([]);
          setPartnerStars(0);
          setPartnerTrust(0);
          setPartnerFlag("");
          setPartnerCountry("");
          setPartnerCity("");
          setPartnerHideIp(false);
          partnerAvatarRef.current = "";
          setPartnerAvatar("");
          pendingPartnerGeoRef.current = null;
          clearIdentityPollRef.current();
          identityStarsKnownRef.current = false;
          hubStarsKnownRef.current = false;
          setPartnerMuted(false);
          setTheyMutedMe(false);
          setPartnerCamHidden(false);
          partnerCamHiddenRef.current = false;
          setPartnerNoCam(false);
          partnerNoCamRef.current = false;
          setExtraNoCam2(false);
          setExtraNoCam3(false);
          setFindThirdPending(false);
          setHuntingWithPartner(false);
          setGiftFlash(null);
          setGiftEffect(null);
          setPartnerFx(null);
          setSelfFx(null);
          setRemoteBlurred(false);
          remoteBlurredRef.current = false;
          blurAutoAppliedRef.current = false;
          blurWantAutoRef.current = false;
          clearIntroUnblurTimer();
          stayUntilRef.current = 0;
          setStayRemSecs(0);
          nextGraceUntilRef.current = 0;
          matchStartedAtRef.current = 0;
          setMatchStartedAt(0);
          media.closeCall({ keepLocal: true, sendBye: false });
          setRemoteStream(null);
          setPartner("");
          setChat([]);
          setAwaitingRemoteVideo(false);
          setMoreOpen(false);
          remotePeerId.current = "";
          // Keep lastPartnerIdsRef until Start/Next so late Report still works
          partnerUserId.current = lastPartnerIdsRef.current.userId || "";
          partnerFriendCode.current =
            lastPartnerIdsRef.current.friendCode || "";
          setMatchMode("");
          matchModeRef.current = "";
          yourRoleRef.current = "solo";
          setYourRole("solo");
          if (autoNext) {
            searchingRef.current = true;
            queueAckedRef.current = false;
            setQueueAcked(false);
            setPhase("search");
            phaseRef.current = "search";
            setAlone(true);
            setWaiting((w) => Math.max(w, 1));
            try {
              hubRefLive.current.spin();
            } catch {
              /* ignore */
            }
            track("auto_next_short_call", {
              dur,
              via: "call_ended",
            });
          } else {
            setPhase("idle");
            phaseRef.current = "idle";
            searchingRef.current = false;
            queueAckedRef.current = false;
            setQueueAcked(false);
            loadMatchHistory()
              .then((list) => setLastMatchHint(list[0] || null))
              .catch(() => {});
          }
          break;
        }
        case "rate_prompt": {
          // Hub will show global sheet — don't double-offer on Next/Stop
          ratedThisMatchRef.current = true;
          break;
        }
        case "rate_result": {
          ratedThisMatchRef.current = true;
          {
            const m = msg as {
              ok?: boolean;
              star?: boolean;
              stars?: number;
              amount?: number;
              user_id?: string;
              from_name?: string;
              message?: string;
            };
            const me = String(userIdRef.current || "");
            const uid = String(m.user_id || "");
            const amt = Math.max(1, Number(m.amount) || 1);
            if (m.ok && m.star && uid && me && uid === me) {
              const title =
                amt > 1
                  ? tRef.current("stars.receivedN", { n: amt }) ||
                    `You received ★ ${amt}`
                  : tRef.current("stars.received") ||
                    "You received a star ★";
              const admin = /admin grant/i.test(String(m.message || ""));
              const from = admin
                ? tRef.current("stars.adminGrantFrom") || "Admin"
                : String(m.from_name || "").trim();
              const total = Math.max(0, Number(m.stars) || 0);
              const sub = from
                ? from + (total ? ` · ★ ${total}` : "")
                : total
                  ? `★ ${total}`
                  : "";
              if (starGiftPopTimer.current) {
                clearTimeout(starGiftPopTimer.current);
              }
              setStarGiftPop({ title, sub });
              void playStarGiftClick(amt);
              starGiftPopTimer.current = setTimeout(
                () => setStarGiftPop(null),
                2000
              );
            }
          }
          break;
        }
        default:
          break;
      }
    });

    return () => {
      dropExtraKeepPrimaryRef.current = null;
      clearInterval(iceRefresh);
      unsub();
      try {
        clearIdentityPollRef.current();
      } catch {
        /* ignore */
      }
      debate.reset();
      debateRef.current = null;
      // Secondary/tertiary share primary local tracks — never stop tracks here
      media2.closeCall({ keepLocal: true, sendBye: false });
      media2Ref.current = null;
      media3.closeCall({ keepLocal: true, sendBye: false });
      media3Ref.current = null;
      media.close();
      mediaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; hub/push via refs
  }, []);

  // Keep screen on during search / call
  useEffect(() => {
    const tag = "ruletka-live";
    if (phase === "search" || phase === "matched") {
      activateKeepAwakeAsync(tag).catch(() => {});
      return () => {
        try {
          deactivateKeepAwake(tag);
        } catch {
          /* ignore */
        }
      };
    }
    try {
      deactivateKeepAwake(tag);
    } catch {
      /* ignore */
    }
  }, [phase]);

  // Re-read hideIp / data-saver when returning from Settings
  useFocusEffect(
    useCallback(() => {
      // Idle Live should never show a leftover hub error from a prior session
      if (phaseRef.current === "idle") clearLastError();
      loadMatchPrefs().then((prefs) => {
        selfHideIpRef.current = !!prefs.hideIp;
        selfCosmeticFlagRef.current = String(prefs.flag || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .slice(0, 2);
        mediaRef.current?.setHideIp(prefs.hideIp);
        mediaRef.current?.setDataSaver(!!prefs.dataSaver);
        mediaRef.current?.setNoiseReduction(prefs.noiseReduction !== false);
        media2Ref.current?.setDataSaver(!!prefs.dataSaver);
        media2Ref.current?.setNoiseReduction(prefs.noiseReduction !== false);
        media3Ref.current?.setDataSaver(!!prefs.dataSaver);
        media3Ref.current?.setNoiseReduction(prefs.noiseReduction !== false);
        setDataSaverOn(!!prefs.dataSaver);
        const raw = prefs.blurStrangersMode;
        const mode: BlurStrangersMode =
          raw === "off" || raw === "intro" || raw === "hold" ? raw : "intro";
        blurModeRef.current = mode;
        setBlurMode(mode);
        blurStrangersRef.current = mode !== "off";
        blurPrefsReadyRef.current = true;
        // Returning from Settings mid-call: apply intro/hold; do not force-off
        // eye-toggle veil (blurAutoAppliedRef gates prefs_off only on first load).
        if (phaseRef.current === "matched") {
          if (mode === "hold" || mode === "intro") {
            blurWantAutoRef.current = matchModeRef.current !== "friend";
            applyMatchBlurVeil("settings_focus");
          } else {
            blurWantAutoRef.current = false;
          }
        }
        void mediaRef.current?.reapplyLocalVideoConstraints();
      });
      // Idle teaser: most recent stranger chat
      if (phaseRef.current === "idle" || phaseRef.current === "error") {
        loadMatchHistory()
          .then((list) => setLastMatchHint(list[0] || null))
          .catch(() => setLastMatchHint(null));
      }
      // Warm camera early so Start → match is snappier (no dialog if already allowed)
      if (phaseRef.current === "idle" || phaseRef.current === "error") {
        void hasMediaPermissions().then((ok) => {
          if (ok) {
            void mediaRef.current?.ensureLocalStream();
            return;
          }
          void ensureMediaPermissions().then((p) => {
            if (p.allGranted) {
              void mediaRef.current?.ensureLocalStream();
            }
          });
        });
      }
    }, [clearLastError])
  );

  // Soft auto-reconnect while Live is active and hub is down
  useEffect(() => {
    if (connected) return;
    if (phase !== "search" && phase !== "matched") return;
    // Immediate nudge, then every 10s
    reconnectHub();
    const id = setInterval(() => {
      reconnectHub();
    }, 10_000);
    return () => clearInterval(id);
  }, [connected, phase, reconnectHub]);

  // Prefetch ICE/TURN + cam on Live focus so first match is cache-hot.
  // Hybrid warm only — preferRelay arms pure force_relay (black same-LAN).
  useFocusEffect(
    useCallback(() => {
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          media2Ref.current?.setIceConfig(cfg);
          media3Ref.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          void mediaRef.current?.ensureLocalStream().catch(() => {});
          void mediaRef.current
            ?.warmConnection({ preferRelay: false })
            .catch(() => {});
        })
        .catch(() => {});
    }, [hub])
  );

  // Friend call: open Live while ringing so cam/ICE warm before matched
  useEffect(() => {
    if (!outboundCall) return;
    hub
      .fetchIceConfig()
      .then((cfg) => {
        mediaRef.current?.setIceConfig(cfg);
        iceHasTurnRef.current = !!cfg.has_turn;
        return mediaRef.current?.warmConnection({
          preferRelay: false,
        });
      })
      .catch(() => {});
  }, [outboundCall?.user_id, hub]);

  // Resume stranger search after reconnect (queue slot is lost on WS drop)
  useEffect(() => {
    if (connected && searchingRef.current && phase === "search") {
      queueAckedRef.current = false;
      setQueueAcked(false);
      try {
        hub.spin();
        push("→ spin (resume)");
      } catch {
        /* ignore */
      }
    }
  }, [connected, hub, phase, push]);

  // Fast confirm: if hub never acks phase=waiting after Start, re-spin quickly
  // (missed spin / rate-limit blip / race before hello). Keep-alive covers later.
  useEffect(() => {
    if (phase !== "search" || !connected) return;
    const timers = QUEUE_CONFIRM_DELAYS_MS.map((ms) =>
      setTimeout(() => {
        if (phaseRef.current !== "search" || !searchingRef.current) return;
        if (queueAckedRef.current) return;
        try {
          hub.spin();
          push(`→ spin (queue confirm ${ms}ms)`);
        } catch {
          /* ignore */
        }
      }, ms)
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [phase, connected, hub, push]);

  // While searching: re-assert spin (rate-limit safe) so a dropped
  // queue slot or missed try_match still recovers without leaving Live.
  useEffect(() => {
    if (phase !== "search" || !connected) return;
    const id = setInterval(() => {
      if (phaseRef.current !== "search" || !searchingRef.current) return;
      try {
        hub.spin();
        push("→ spin (keep-alive)");
      } catch {
        /* ignore */
      }
    }, SPIN_KEEPALIVE_MS);
    return () => clearInterval(id);
  }, [phase, connected, hub, push]);

  function resetDebateUi() {
    debateRef.current?.reset();
    setDebateComposeOpen(false);
    setDcOpen(false);
    debateMicLockedRef.current = false;
  }

  /** Persist stranger/party match for local history (skip pure friend 1:1). */
  function recordMatchToHistory() {
    const uid = partnerUserId.current;
    if (!uid) return;
    const mode = matchModeRef.current || matchMode || "";
    // Friend-only 1:1 is covered by call history
    if (mode === "friend") return;
    const started = matchStartedAtRef.current;
    const dur = started ? Math.floor((Date.now() - started) / 1000) : 0;
    if (dur < 5) return; // bounce / failed connect
    // On-device partner crop for Friends → History (never uploaded)
    void (async () => {
      try {
        if (!stageRef.current) return;
        // Respect Settings → Save partner snapshots
        try {
          const { loadMatchPrefs } = await import("../src/prefs/store");
          const p = await loadMatchPrefs();
          if (p.historySnaps === false) return;
        } catch {
          /* default on */
        }
        // Skip while stranger blur is still covering video
        if (remoteBlurredRef.current && !isFriendCall) return;
        const uri = await captureRef(stageRef, {
          format: "jpg",
          quality: 0.45,
          result: "tmpfile",
          width: 160,
        });
        if (uri) {
          const { saveMatchThumbFromUri } = await import(
            "../src/calls/matchThumbs"
          );
          await saveMatchThumbFromUri(uid, uri);
        }
      } catch {
        /* optional */
      }
    })();
    void pushMatchHistory({
      user_id: uid,
      name: paintSafePartnerName(
        partnerNameRef.current || partner,
        "Partner",
        {
          peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId,
          userId: uid,
        }
      ),
      friend_code: partnerFriendCode.current || partnerCode || undefined,
      mode,
      stars: partnerStars || undefined,
      trust: partnerTrust || undefined,
      flag: partnerFlag || undefined,
      duration_secs: dur,
    });
  }

  function toastMatchEnded() {
    const started = matchStartedAtRef.current;
    if (!started) return;
    const dur = Math.floor((Date.now() - started) / 1000);
    if (dur < 8) return;
    const m = Math.floor(dur / 60);
    const s = dur % 60;
    const time =
      m > 0
        ? t("mobile.live.callEndedMin", { m, s })
        : t("mobile.live.callEndedSec", { s });
    showToastRef.current(
      t("mobile.live.callEndedToast", {
        name: paintSafePartnerName(
          partnerNameRef.current || partner,
          "…",
          {
            peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId,
            userId: partnerUserId.current || lastPartnerIdsRef.current.userId,
          }
        ),
        time,
      })
    );
  }

  /**
   * Post-match grey "Add friend" Alert removed (user 2026-08-11).
   * Add-friend remains in More sheet / home last-match card / Friends.
   */
  function maybeOfferAddFriend() {
    return;
  }

  function copyPartnerCode() {
    copyPartnerIdentity();
  }

  /** Copy name · location · ★ · friend code for paste / share. */
  function copyPartnerIdentity() {
    // Prefer resolved display name (never hex peer slice when friend_code exists).
    const codeForName = (
      partnerFriendCode.current ||
      partnerCode ||
      lastPartnerIdsRef.current.friendCode ||
      ""
    ).trim();
    const name = paintSafePartnerName(
      resolvePartnerDisplayName({
        name: partnerNameRef.current || partner || "",
        friendCode: isHexIdLike(codeForName) ? "" : codeForName,
        peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId || "",
        userId: partnerUserId.current || lastPartnerIdsRef.current.userId || "",
        shortId: "",
      }),
      "Partner",
      {
        peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId || "",
        userId: partnerUserId.current || lastPartnerIdsRef.current.userId || "",
      }
    );
    const code = (
      partnerFriendCode.current ||
      partnerCode ||
      ""
    )
      .trim()
      .toUpperCase();
    const loc = formatLocLine({
      flag: partnerFlag,
      country: partnerCountry,
      city: partnerCity,
      lang: lang || "ru",
      hideIp: partnerHideIp,
    });
    // Same as PartnerChrome / dock: max(spendable, trust) so reputation isn't hidden
    const displayStars = displayPartnerStars(partnerStars, partnerTrust);
    const lines = [
      name || null,
      loc ||
        (partnerHideIp
          ? t("mobile.live.locPrivate") || "Location hidden"
          : null),
      `★ ${displayStars}`,
      code ? `${t("mobile.live.friendCodeLabel") || "Code"}: ${code}` : null,
    ].filter(Boolean) as string[];
    if (!lines.length) {
      showToastRef.current(t("mobile.live.partnerNotReady"));
      return;
    }
    void Clipboard.setStringAsync(lines.join("\n"))
      .then(() => {
        showToastRef.current(
          t("mobile.live.partnerCopied") ||
            (code
              ? t("mobile.friends.codeCopied")
              : "Partner info copied")
        );
        hapticLight();
      })
      .catch(() => {});
  }

  /**
   * Local rate sheet only if hub may accept it.
   * Hub needs chat ≥ rate_min_secs (5 min first partners, else 15 min) and a
   * pending review. Showing at hard-coded 5 min while hub wants 15 min caused
   * "no review available" / can't-review toasts after tapping ★.
   * Prefer waiting for hub `rate_prompt`; local is a fallback only.
   */
  function maybeOfferRateAfterChat() {
    if (ratedThisMatchRef.current) return;
    const uid = partnerUserId.current;
    if (!uid || uid.length < 8) return;
    // Peer ids / short slices are not rate targets
    if (uid === "legacy" || !uid.includes("-")) return;
    const started = matchStartedAtRef.current;
    if (!started) return;
    const dur = Math.floor((Date.now() - started) / 1000);
    const need = Math.max(60, rateMinSecsRef.current || 15 * 60);
    if (dur < need) return;
    ratedThisMatchRef.current = true;
    offerRateRef.current({
      user_id: uid,
      name: paintSafePartnerName(
        partnerNameRef.current || partner,
        "Partner",
        { userId: uid }
      ),
      duration_secs: dur,
      max_gift: 1,
      early: need < 15 * 60,
    });
  }

  /**
   * Search/Next ICE prefetch: pure only when Hide IP.
   * Default hybrid — always-true preferRelay blacked same-LAN Play↔PC.
   */
  function preferRelayWarm(): boolean {
    return !!selfHideIpRef.current;
  }

  function enterSearchUi(opts?: { toast?: boolean }) {
    searchingRef.current = true;
    queueAckedRef.current = false;
    setQueueAcked(false);
    setPhase("search");
    phaseRef.current = "search";
    setAlone(true);
    // Optimistic pool: we are waiting (hub status will refine counts)
    setWaiting((w) => Math.max(w, 1));
    setOnline((o) => Math.max(o, 1));
    if (opts?.toast !== false) {
      showToastRef.current(t("mobile.live.queueJoined"));
    }
    // While queueing: warm TURN PC so match→offer is near-instant for web partners
    void mediaRef.current
      ?.warmConnection({ preferRelay: preferRelayWarm() })
      .catch(() => {});
  }

  function sendSpin(why: string) {
    try {
      hub.spin();
      push(`→ spin (${why})`);
      return true;
    } catch (e) {
      push(`spin fail ${e}`);
      return false;
    }
  }

  function start(opts?: { via?: string }) {
    if (friendsOnly) {
      push("friends-only: stranger Start disabled");
      showToastRef.current(t("mobile.live.friendsOnlyHint"));
      return;
    }
    if (!guardAction()) return;
    // Flip Start → Next/Stop immediately (before media work can delay/fail).
    enterSearchUi();
    try {
      clearLastError();
      resetDebateUi();
      hapticLight();
      // Clear any residual remote so uiPhase never sticks on "matched"
      setRemoteStream(null);
      setRemoteStream2(null);
      setRemoteStream3(null);
      extraPeersRef.current = [];
      setExtraPeers([]);
      setPartner("");
      setPartnerCode("");
      setPartnerStars(0);
      setPartnerTrust(0);
      setPartnerFlag("");
      setPartnerCountry("");
      setPartnerCity("");
      setPartnerHideIp(false);
      partnerAvatarRef.current = "";
      setPartnerAvatar("");
      pendingPartnerGeoRef.current = null;
      clearIdentityPollRef.current();
      identityStarsKnownRef.current = false;
      hubStarsKnownRef.current = false;
      setPartnerMuted(false);
      setTheyMutedMe(false);
      setPartnerCamHidden(false);
      partnerCamHiddenRef.current = false;
      setPartnerNoCam(false);
      partnerNoCamRef.current = false;
      setExtraNoCam2(false);
      setExtraNoCam3(false);
      setFindThirdPending(false);
      setHuntingWithPartner(false);
      setAwaitingRemoteVideo(false);
      secondaryPeerId.current = "";
      tertiaryPeerId.current = "";
      extrasCountRef.current = 0;
      listedPeerIdsRef.current = [];
      remotePeerId.current = "";
      partnerUserId.current = "";
      partnerFriendCode.current = "";
      lastPartnerIdsRef.current = {
        userId: "",
        peerId: "",
        friendCode: "",
        shortId: "",
      };
      setChat([]);
      media2Ref.current?.closeCall({ keepLocal: true, sendBye: false });
      media3Ref.current?.closeCall({ keepLocal: true, sendBye: false });
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: false });
      // Prefetch TURN + warm PC while searching (match path hits cache + pre-gather)
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          media2Ref.current?.setIceConfig(cfg);
          media3Ref.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          push(`ICE prefetch has_turn=${cfg.has_turn}`);
          return mediaRef.current?.warmConnection({
            preferRelay: preferRelayWarm(),
          });
        })
        .catch(() => {});
      if (!connected) {
        reconnectHub();
        push("→ spin deferred (reconnecting hub)");
        showToastRef.current(t("mobile.settings.hubReconnecting"));
      } else {
        sendSpin(opts?.via === "autostart" ? "autostart" : "start");
      }
      track("start_match", { via: opts?.via || "start" });
    } catch (e) {
      push(String(e));
      // Keep search UI so user never stuck on Start after pressing it
      if (phaseRef.current !== "search") enterSearchUi({ toast: false });
    }
  }

  // Home "Start chatting" / match CTAs open /live?autostart=1 — spin immediately
  // so users do not tap Start again on Live. Nav-only Live (no param) stays idle.
  //
  // Race hardens (2026-08-11):
  // 1) Paint search UI in layout (no idle Start flash).
  // 2) Fire start() BEFORE setParams clear — clearing first re-ran the effect,
  //    cleanup cancelled the timer → idle forever (deep-link flake).
  // 3) Keep param until after the 1200ms last-resort window so cleanup cannot
  //    kill a pending retry.
  // 4) Retry if still idle/error @500ms and again @1200ms (last resort),
  //    then always drop autostart param.
  // Depend on a stable boolean so array-shaped search params do not retrigger.
  const { autostart: autostartParam } = useLocalSearchParams<{
    autostart?: string | string[];
  }>();
  const autostartRaw = Array.isArray(autostartParam)
    ? autostartParam[0]
    : autostartParam;
  const wantAutostart =
    autostartRaw === "1" ||
    autostartRaw === "true" ||
    autostartRaw === "yes";
  // Paint "Looking…" before first frame — avoid idle Start flash on autostart
  useLayoutEffect(() => {
    if (!wantAutostart || friendsOnly) return;
    if (phaseRef.current === "idle" || phaseRef.current === "error") {
      searchingRef.current = true;
      queueAckedRef.current = false;
      setQueueAcked(false);
      setPhase("search");
      phaseRef.current = "search";
      setAlone(true);
    }
  }, [wantAutostart, friendsOnly]);
  useEffect(() => {
    if (!wantAutostart || friendsOnly) return;
    let cancelled = false;
    let paramCleared = false;
    const clearAutostartParam = () => {
      if (paramCleared) return;
      paramCleared = true;
      try {
        router.setParams({ autostart: undefined });
      } catch {
        /* ignore */
      }
    };
    const tryAutostartSpin = (why: string) => {
      if (cancelled) return;
      // Already in a call — do not re-spin
      if (phaseRef.current === "matched") return;
      // Only idle / error / search (layout optimistic) may start
      if (
        phaseRef.current !== "idle" &&
        phaseRef.current !== "error" &&
        phaseRef.current !== "search"
      ) {
        return;
      }
      push(`autostart → spin (${why})`);
      start({ via: "autostart" });
    };
    // Primary: spin first (never clear before spin — setParams re-render
    // must not cancel this path).
    const tId = setTimeout(() => {
      if (cancelled) return;
      tryAutostartSpin("from Start chatting");
    }, 80);
    // Retry once if still idle after 500ms (start threw / guard / effect thrash).
    const retryId = setTimeout(() => {
      if (cancelled) return;
      if (phaseRef.current === "idle" || phaseRef.current === "error") {
        searchingRef.current = true;
        queueAckedRef.current = false;
        setQueueAcked(false);
        setPhase("search");
        phaseRef.current = "search";
        setAlone(true);
        tryAutostartSpin("retry still idle @500ms");
      }
    }, 500);
    // Last resort @1200ms if both prior attempts left us idle/error,
    // then always drop param so Stop → idle cannot re-read autostart=1.
    const lastId = setTimeout(() => {
      if (cancelled) return;
      if (phaseRef.current === "idle" || phaseRef.current === "error") {
        searchingRef.current = true;
        queueAckedRef.current = false;
        setQueueAcked(false);
        setPhase("search");
        phaseRef.current = "search";
        setAlone(true);
        tryAutostartSpin("last resort still idle @1200ms");
      }
      clearAutostartParam();
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(tId);
      clearTimeout(retryId);
      clearTimeout(lastId);
    };
    // start() closes over hub/connected; only re-run when intent changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAutostart, friendsOnly]);

  function next() {
    if (!guardAction()) return;
    if (stayUntilRef.current > Date.now()) {
      const s = Math.max(
        1,
        Math.ceil((stayUntilRef.current - Date.now()) / 1000)
      );
      showToastRef.current(t("mobile.live.stayLock", { s }));
      hapticMedium();
      return;
    }
    if (Date.now() < nextGraceUntilRef.current) {
      const s = Math.max(
        1,
        Math.ceil((nextGraceUntilRef.current - Date.now()) / 1000)
      );
      showToastRef.current(t("mobile.live.nextGraceSecs", { s }));
      hapticMedium();
      return;
    }
    hadConnectedThisMatchRef.current = false;
    clearPartnerReconnectArm();
    if (reconnectSnapRef.current) {
      reconnectSnapRef.current = null;
      setReconnectSnap(null);
    }
    try {
      // Pair Next: keep teammate PC, drop 3rd only, hunt next 3rd.
      // Must run BEFORE primary closeCall — tearing media1 remounts hunt.
      if (isPartyKeepOnSkip(yourRoleRef.current)) {
        recordMatchToHistory();
        hapticLight();
        media2Ref.current?.closeCall({ keepLocal: true, sendBye: true });
        media3Ref.current?.closeCall({ keepLocal: true, sendBye: true });
        setRemoteStream2(null);
        setRemoteStream3(null);
        extraPeersRef.current = [];
        setExtraPeers([]);
        setFocusExtra(false);
        setHuntingWithPartner(true);
        setFindThirdPending(false);
        setPhase("matched");
        phaseRef.current = "matched";
        searchingRef.current = false;
        try {
          hub.next();
          push("→ next stranger (keep party)");
        } catch (e) {
          push(`next fail ${e}`);
        }
        track("start_match", { via: "next_keep_party" });
        return;
      }
      recordMatchToHistory();
      toastMatchEnded();
      maybeOfferAddFriend();
      maybeOfferRateAfterChat();
      void leaveCallAudio();
      resetDebateUi();
      hapticLight();
      stayUntilRef.current = 0;
      setStayRemSecs(0);
      forceRelayHubRef.current = false;
      try {
        mediaRef.current?.setForceRelay?.(false);
        media2Ref.current?.setForceRelay?.(false);
        media3Ref.current?.setForceRelay?.(false);
      } catch {
        /* ignore */
      }
      media2Ref.current?.closeCall({ keepLocal: true, sendBye: true });
      media3Ref.current?.closeCall({ keepLocal: true, sendBye: true });
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: true });
      // Next = re-search; hybrid warm (pure only if Hide IP)
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          try {
            // Never arm force_relay on search unless Hide IP is actually on
            if (preferRelayWarm()) mediaRef.current?.setForceRelay?.(true);
            else mediaRef.current?.setForceRelay?.(false);
          } catch {
            /* ignore */
          }
          return mediaRef.current?.warmConnection({
            preferRelay: preferRelayWarm(),
          });
        })
        .catch(() => {});
      setRemoteStream(null);
      setRemoteStream2(null);
      setRemoteStream3(null);
      setPartner("");
      setPartnerStars(0);
      setPartnerTrust(0);
      setPartnerFlag("");
      setPartnerCountry("");
      setPartnerCity("");
      setPartnerHideIp(false);
      partnerAvatarRef.current = "";
      setPartnerAvatar("");
      pendingPartnerGeoRef.current = null;
      clearIdentityPollRef.current();
      identityStarsKnownRef.current = false;
      hubStarsKnownRef.current = false;
      setPartnerMuted(false);
      setTheyMutedMe(false);
      setPartnerCamHidden(false);
      partnerCamHiddenRef.current = false;
      setPartnerNoCam(false);
      partnerNoCamRef.current = false;
      setExtraNoCam2(false);
      setExtraNoCam3(false);
      setFindThirdPending(false);
      setHuntingWithPartner(false);
      setGiftFlash(null);
      setGiftEffect(null);
      setPartnerFx(null);
      setSelfFx(null);
      setFocusExtra(false);
      setRemoteBlurred(false);
      remoteBlurredRef.current = false;
      blurAutoAppliedRef.current = false;
      blurWantAutoRef.current = false;
      clearIntroUnblurTimer();
      stayUntilRef.current = 0;
      setStayRemSecs(0);
      extraPeersRef.current = [];
      setExtraPeers([]);
      setChat([]);
      setAwaitingRemoteVideo(false);
      setMoreOpen(false);
      remotePeerId.current = "";
      secondaryPeerId.current = "";
      tertiaryPeerId.current = "";
      extrasCountRef.current = 0;
      listedPeerIdsRef.current = [];
      partnerUserId.current = "";
      partnerFriendCode.current = "";
      lastPartnerIdsRef.current = {
        userId: "",
        peerId: "",
        friendCode: "",
        shortId: "",
      };
      matchStartedAtRef.current = 0;
      if (matchMode === "friend") {
        try {
          hub.hangupFriend();
        } catch {
          /* ignore */
        }
        searchingRef.current = false;
        setPhase("idle");
        phaseRef.current = "idle";
        setMatchMode("");
        push("→ hangup friend");
        return;
      }
      enterSearchUi({ toast: false });
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          media2Ref.current?.setIceConfig(cfg);
          media3Ref.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          return mediaRef.current?.warmConnection({
            preferRelay: preferRelayWarm(),
          });
        })
        .catch(() => {});
      try {
        hub.next();
        push("→ next");
      } catch (e) {
        push(`next fail ${e}`);
        sendSpin("next-fallback");
      }
      track("start_match", { via: "next" });
    } catch (e) {
      push(String(e));
    }
  }
  nextActionRef.current = next;

  // Stranger 1v1 ICE drop: 3×10s then next(). Friend / hub partner-left stay immediate.
  useEffect(() => {
    if (!reconnectSnap) return;
    const id = setInterval(() => {
      const ice = iceStateRef.current;
      const iceOk = ice === "connected" || ice === "completed";
      const result = tickReconnect(reconnectSnapRef.current, Date.now(), iceOk);
      if (result.recovered) {
        reconnectSnapRef.current = null;
        setReconnectSnap(null);
        markPartnerConnectedThisMatch();
        push("reconnect recovered");
        return;
      }
      if (result.giveUp) {
        reconnectSnapRef.current = null;
        setReconnectSnap(null);
        push("reconnect giveUp → next");
        nextActionRef.current();
        // stayLock / grace may block Next — re-arm if ICE still down
        if (
          phaseRef.current === "matched" &&
          (connRef.current === "failed" ||
            connRef.current === "disconnected" ||
            iceStateRef.current === "failed" ||
            iceStateRef.current === "disconnected")
        ) {
          tryStartPartnerReconnectRef.current("giveUp blocked");
        }
        return;
      }
      const nextSnap = result.snap;
      const prev = reconnectSnapRef.current;
      if (
        nextSnap &&
        (!prev ||
          nextSnap.chance !== prev.chance ||
          nextSnap.until !== prev.until)
      ) {
        reconnectSnapRef.current = nextSnap;
        setReconnectSnap(nextSnap);
        push(`reconnect chance=${nextSnap.chance}`);
      }
    }, 250);
    return () => clearInterval(id);
  }, [reconnectSnap, push]);

  useEffect(() => {
    const keep1v1 =
      phase === "matched" &&
      extrasCountRef.current < 1 &&
      !huntingWithPartner &&
      matchModeRef.current !== "party_browse";
    if (keep1v1) return;
    clearPartnerReconnectArm();
    if (phase !== "matched") {
      hadConnectedThisMatchRef.current = false;
    }
    if (!reconnectSnapRef.current) return;
    reconnectSnapRef.current = null;
    setReconnectSnap(null);
  }, [phase, extraPeers.length, huntingWithPartner]);

  function doStop() {
    hadConnectedThisMatchRef.current = false;
    clearPartnerReconnectArm();
    if (reconnectSnapRef.current) {
      reconnectSnapRef.current = null;
      setReconnectSnap(null);
    }
    try {
      recordMatchToHistory();
      toastMatchEnded();
      maybeOfferAddFriend();
      maybeOfferRateAfterChat();
      void leaveCallAudio();
      resetDebateUi();
      hapticLight();
      // Clear pure-relay sticky — hub force_relay only (or Hide IP) may re-arm.
      forceRelayHubRef.current = false;
      try {
        mediaRef.current?.setForceRelay?.(false);
        media2Ref.current?.setForceRelay?.(false);
        media3Ref.current?.setForceRelay?.(false);
      } catch {
        /* ignore */
      }
      media2Ref.current?.closeCall({ keepLocal: true, sendBye: true });
      media3Ref.current?.closeCall({ keepLocal: true, sendBye: true });
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: true });
      // Hybrid warm (TURN available, policy=all) — pure only if hide IP pref
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          try {
            // Never arm force_relay on this path unless Hide IP is actually on
            if (preferRelayWarm()) mediaRef.current?.setForceRelay?.(true);
            else mediaRef.current?.setForceRelay?.(false);
          } catch {
            /* ignore */
          }
          return mediaRef.current?.warmConnection({
            preferRelay: preferRelayWarm(),
          });
        })
        .catch(() => {});
      setRemoteStream(null);
      setRemoteStream2(null);
      setRemoteStream3(null);
      setPartner("");
      setPartnerStars(0);
      setPartnerTrust(0);
      setPartnerFlag("");
      setPartnerCountry("");
      setPartnerCity("");
      setPartnerHideIp(false);
      partnerAvatarRef.current = "";
      setPartnerAvatar("");
      pendingPartnerGeoRef.current = null;
      clearIdentityPollRef.current();
      identityStarsKnownRef.current = false;
      hubStarsKnownRef.current = false;
      setPartnerMuted(false);
      setTheyMutedMe(false);
      setPartnerCamHidden(false);
      partnerCamHiddenRef.current = false;
      setPartnerNoCam(false);
      partnerNoCamRef.current = false;
      setExtraNoCam2(false);
      setExtraNoCam3(false);
      setFindThirdPending(false);
      setHuntingWithPartner(false);
      setGiftFlash(null);
      setGiftEffect(null);
      setPartnerFx(null);
      setSelfFx(null);
      setFocusExtra(false);
      setRemoteBlurred(false);
      remoteBlurredRef.current = false;
      blurAutoAppliedRef.current = false;
      blurWantAutoRef.current = false;
      clearIntroUnblurTimer();
      stayUntilRef.current = 0;
      setStayRemSecs(0);
      extraPeersRef.current = [];
      setExtraPeers([]);
      setChat([]);
      setAwaitingRemoteVideo(false);
      setMoreOpen(false);
      remotePeerId.current = "";
      secondaryPeerId.current = "";
      tertiaryPeerId.current = "";
      extrasCountRef.current = 0;
      listedPeerIdsRef.current = [];
      partnerUserId.current = "";
      partnerFriendCode.current = "";
      lastPartnerIdsRef.current = {
        userId: "",
        peerId: "",
        friendCode: "",
        shortId: "",
      };
      matchStartedAtRef.current = 0;
      searchingRef.current = false;
      queueAckedRef.current = false;
      setQueueAcked(false);
      setAlone(false);
      setWaiting(0);
      if (matchMode === "friend") {
        try {
          hub.hangupFriend();
        } catch {
          /* ignore */
        }
      } else {
        hub.stop();
      }
      setMatchMode("");
      yourRoleRef.current = "solo";
      setYourRole("solo");
      setPhase("idle");
      phaseRef.current = "idle";
      push("→ stop");
    } catch (e) {
      push(String(e));
    }
  }

  function stop() {
    if (!guardAction()) return;
    // Immediate stop — no confirm dialogs (web parity; one tap = leave)
    doStop();
  }

  function toggleMic() {
    if (debateMicLockedRef.current) {
      flashStatus(t("debate.waitTurn"));
      return;
    }
    const nextOn = !micOn;
    setMicOn(nextOn);
    micOnRef.current = nextOn;
    bgPausedMicRef.current = false;
    mediaRef.current?.setMicEnabled(nextOn);
    media2Ref.current?.setMicEnabled(nextOn);
    media3Ref.current?.setMicEnabled(nextOn);
    hapticLight();
  }

  function onDebateInvitePress() {
    const sess = debateRef.current;
    if (!sess) return;
    if (debate.active) {
      sess.end({ notify: true, reason: "user" });
      return;
    }
    if (debate.pending === "out") {
      sess.inviteOrToggle();
      return;
    }
    const r = sess.inviteOrToggle();
    if (r === "compose") {
      setDebateTopicDraft(debate.topic || "");
      setDebateTurnSecs(debate.composeTurnSecs || 30);
      setDebateComposeOpen(true);
    } else if (r === "need_p2p") {
      showToastRef.current(
        t("debate.needP2p") || "Wait for the chat link, then try Debate again"
      );
    } else if (r === "blocked") {
      showToastRef.current(t("debate.needLive") || "Need a live match");
    }
  }

  function sendDebateInvite() {
    const ok = debateRef.current?.sendInviteFromCompose({
      turnSecs: debateTurnSecs,
      topic: debateTopicDraft,
    });
    if (ok) setDebateComposeOpen(false);
  }

  function toggleCam() {
    // Parity with web Hide: pause outbound video track so partner cannot see you.
    // Local preview stays bound; UI shows cam-off state on the button.
    const nextOn = !camOn;
    setCamOn(nextOn);
    camOnRef.current = nextOn;
    bgPausedCamRef.current = false;
    mediaRef.current?.setCamEnabled(nextOn);
    media2Ref.current?.setCamEnabled(nextOn);
    media3Ref.current?.setCamEnabled(nextOn);
    // Notify partner (web/Android) so they show mosaic instead of black/off track
    const hideOn = !nextOn;
    const hidePayload = {
      v: 1 as const,
      type: "self_hide",
      on: hideOn,
      user_id: userIdRef.current || "",
      name: displayNameRef.current || "anon",
      ts: Date.now(),
    };
    try {
      mediaRef.current?.sendDataMessage(hidePayload);
    } catch {
      /* ignore */
    }
    try {
      hubRefLive.current.signal("self_hide", JSON.stringify(hidePayload), "");
    } catch {
      /* hub optional */
    }
    if (remotePeerId.current) {
      try {
        hubRefLive.current.signal(
          "self_hide",
          JSON.stringify(hidePayload),
          remotePeerId.current
        );
      } catch {
        /* ignore */
      }
    }
    try {
      hubRefLive.current.chat(`\x01shide:${hideOn ? "1" : "0"}`);
    } catch {
      /* ignore */
    }
    hapticLight();
    try {
      showToastRef.current(
        nextOn
          ? t("mobile.live.camOnToast")
          : t("mobile.live.camOffToast")
      );
    } catch {
      /* ignore */
    }
  }

  // Android system back: leave call/search immediately (no confirm popup)
  useEffect(() => {
    const onBack = () => {
      const p = phaseRef.current;
      if (p === "matched" || p === "search") {
        doStop();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    };
  }, [t]);

  function applyTheyMutedMe(muted: boolean, why: string) {
    const on = !!muted;
    const was = theyMutedMeRef.current;
    theyMutedMeRef.current = on;
    setTheyMutedMe(on);
    if (was === on) {
      push(`theyMutedMe keep=${on ? 1 : 0} (${why})`);
      return;
    }
    push(`theyMutedMe=${on ? 1 : 0} (${why})`);
    // Single UI: mid-stage mute icon only. No Alert, no stage duplicates.
    if (on) {
      hapticLight();
    }
  }
  applyTheyMutedMeRef.current = applyTheyMutedMe;

  /**
   * Apply inbound gift_fx from P2P or hub signal.
   * Partner spent → paint on our self tile; we spent echo → partner tile.
   */
  function applyInboundGiftFx(msg: Record<string, unknown>, why: string) {
    const effectId = String(msg.effect || msg.kind || "").trim();
    if (!effectId) return;
    const me = String(userIdRef.current || "").trim();
    const fromUid = String(msg.from_user_id || msg.user_id || "").trim();
    const targetUid = String(
      msg.target_user_id || msg.user_id || ""
    ).trim();
    const partnerUid = String(
      partnerUserId.current || lastPartnerIdsRef.current.userId || ""
    ).trim();
    const fromMe = !!(fromUid && me && fromUid === me);
    let onMe = !!(targetUid && me && targetUid === me);
    let onPartner = !!(
      targetUid &&
      partnerUid &&
      targetUid === partnerUid
    );
    const extraHit = (extraPeersRef.current || []).some((p) => {
      const a = String(p?.userId || "").trim();
      const b = String(p?.peerId || "").trim();
      return (
        !!targetUid &&
        ((a && a === targetUid) || (b && b === targetUid))
      );
    });
    if (!onMe && !onPartner) {
      if (extraHit && !fromMe) {
        // Gift is on the other extra (laptop) — do not paint our face.
        return;
      }
      if (fromMe) onPartner = !extraHit;
      else onMe = true;
    }
    if (extraHit && fromMe) {
      const extras = extraPeersRef.current || [];
      const idx = extras.findIndex((p) => {
        const a = String(p?.userId || "").trim();
        const b = String(p?.peerId || "").trim();
        return (
          !!targetUid &&
          ((a && a === targetUid) || (b && b === targetUid))
        );
      });
      const hold = giftFxHoldMs(effectId);
      if (idx <= 0) {
        setExtraGiftFx0(effectId);
        if (extraFx0TimerRef.current) clearTimeout(extraFx0TimerRef.current);
        extraFx0TimerRef.current = setTimeout(() => setExtraGiftFx0(null), hold);
      } else {
        setExtraGiftFx1(effectId);
        if (extraFx1TimerRef.current) clearTimeout(extraFx1TimerRef.current);
        extraFx1TimerRef.current = setTimeout(() => setExtraGiftFx1(null), hold);
      }
      void playGiftChime(effectId);
      hapticMatch();
      push(`gift_fx← ${effectId} extra${idx <= 0 ? 0 : 1} (${why})`);
      return;
    }
    if (fromUid && !fromMe) notePartnerUserId(fromUid, `gift_fx_${why}`);
    const rawUntil = msg.until ?? msg.effect_until;
    const untilMs =
      rawUntil && Number(rawUntil) > 1e9
        ? Number(rawUntil) * 1000
        : rawUntil && Number(rawUntil) > Date.now()
          ? Number(rawUntil)
          : Date.now() + giftFxHoldMs(effectId);
    const hold = Math.max(800, untilMs - Date.now());
    const gift = GIFTS.find((g) => g.id === effectId);
    const fromName = String(msg.from_name || "").trim();
    const label = gift
      ? `${gift.emoji}${fromName ? ` ${fromName}` : ""}`.trim()
      : effectId;
    setGiftFlash(label || effectId);
    if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
    giftFxTimerRef.current = setTimeout(() => {
      setGiftFlash(null);
      setGiftEffect(null);
    }, Math.min(hold, 4000));
    if (effectId === "bars") {
      setGiftEffect(null);
      if (onMe) {
        setSelfFx("bars");
        if (selfFxTimerRef.current) clearTimeout(selfFxTimerRef.current);
        selfFxTimerRef.current = setTimeout(() => setSelfFx(null), hold);
      } else {
        setPartnerFx("bars");
        if (partnerFxTimerRef.current)
          clearTimeout(partnerFxTimerRef.current);
        partnerFxTimerRef.current = setTimeout(
          () => setPartnerFx(null),
          hold
        );
      }
    } else {
      setGiftEffect(effectId);
      if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
      giftFxTimerRef.current = setTimeout(() => {
        setGiftFlash(null);
        setGiftEffect(null);
      }, hold);
    }
    if (effectId === "please_stay" && onMe) {
      stayUntilRef.current = Math.max(stayUntilRef.current, untilMs);
      setStayRemSecs(
        Math.max(0, Math.ceil((stayUntilRef.current - Date.now()) / 1000))
      );
    }
    void playGiftChime(effectId);
    hapticMatch();
    push(
      `gift_fx← ${effectId} onMe=${onMe ? 1 : 0} onPartner=${onPartner ? 1 : 0} (${why})`
    );
  }
  applyInboundGiftFxRef.current = applyInboundGiftFx;

  /** Parse mute control from hub chat fallback: "\x01pmute:1" / "\x01pmute:0" */
  function tryParseMuteControl(body: string): boolean | null {
    const s = String(body || "");
    if (s.startsWith("\x01pmute:")) {
      return s.charAt(7) === "1" || s.slice(7, 8) === "t";
    }
    if (s.startsWith("__pmute:")) {
      return s.charAt(8) === "1" || s.startsWith("__pmute:true");
    }
    return null;
  }

  /** Laptop no_cam / self_hide must not cover Dragonov (055528Z / 060444Z). */
  function extraSlotIds(): { extra0: string; extra1: string } {
    const e0 = extraPeersRef.current[0];
    const e1 = extraPeersRef.current[1];
    return {
      extra0: e0?.userId || e0?.peerId || "",
      extra1: e1?.userId || e1?.peerId || "",
    };
  }

  function applyNoCamFromPeer(
    on: boolean,
    fromUid: string,
    via: string
  ): void {
    const ids = extraSlotIds();
    const extrasCount = extrasCountRef.current;
    const slot = routeInboundNoCamSlot({
      fromUid,
      primaryUid: partnerUserId.current,
      extra0Uid: ids.extra0,
      extra1Uid: ids.extra1,
      extrasCount,
    });
    const from = String(fromUid || "").trim();
    const primary = String(partnerUserId.current || "").trim();
    const fromIsPrimary = !!(
      from &&
      primary &&
      (from === primary || peerIdsLooseMatch(from, primary))
    );
    // remoteVideoSeenRef survives stale handler closures (media/hub setup).
    const primaryHasPictures =
      !!remoteVideoSeenRef.current || remoteVideoHasPicture(remoteStream);
    if (
      shouldIgnorePrimaryNoCam({
        on,
        slot,
        primaryHasPictures,
        fromIsPrimary,
        extrasCount,
      }) ||
      (on && slot === "primary" && primaryHasPictures)
    ) {
      log(`ignore_nocam_has_pictures via=${via} slot=${slot}`);
      return;
    }
    if (slot === "extra0") {
      setExtraNoCam2(on);
      log(`extra_nocam2 on=${on ? 1 : 0} via=${via}`);
      return;
    }
    if (slot === "extra1") {
      setExtraNoCam3(on);
      log(`extra_nocam3 on=${on ? 1 : 0} via=${via}`);
      return;
    }
    setPartnerNoCam(on);
    partnerNoCamRef.current = on;
    if (on) setAwaitingRemoteVideo(false);
    log(`partner_nocam on=${on ? 1 : 0} via=${via}`);
  }

  function applyHideFromPeer(
    on: boolean,
    fromUid: string,
    via: string
  ): void {
    const ids = extraSlotIds();
    const extrasCount = extrasCountRef.current;
    const slot = routeInboundNoCamSlot({
      fromUid,
      primaryUid: partnerUserId.current,
      extra0Uid: ids.extra0,
      extra1Uid: ids.extra1,
      extrasCount,
    });
    const from = String(fromUid || "").trim();
    const primary = String(partnerUserId.current || "").trim();
    const fromIsPrimary = !!(
      from &&
      primary &&
      (from === primary || peerIdsLooseMatch(from, primary))
    );
    const primaryHasPictures =
      !!remoteVideoSeenRef.current || remoteVideoHasPicture(remoteStream);
    // Extra/laptop hide must not cover a primary tile that already painted.
    // Real hide from the first person still applies (they tapped Hide).
    if (on && slot === "primary" && primaryHasPictures && !fromIsPrimary) {
      log(`ignore_nocam_has_pictures via=${via} slot=${slot} hide=1`);
      return;
    }
    if (slot === "extra0") {
      setExtraNoCam2(on);
      log(`extra_hide2 on=${on ? 1 : 0} via=${via}`);
      return;
    }
    if (slot === "extra1") {
      setExtraNoCam3(on);
      log(`extra_hide3 on=${on ? 1 : 0} via=${via}`);
      return;
    }
    setPartnerCamHidden(on);
    partnerCamHiddenRef.current = on;
    if (on) setAwaitingRemoteVideo(false);
    console.log(`[blur] partner_hide on=${on ? 1 : 0}`);
    log(`partner_hide on=${on ? 1 : 0} via=${via}`);
  }

  /** Parse no-cam advertise: "\x01nocam:1" / "__nocam:0" */
  function tryParseNoCamControl(body: string): boolean | null {
    const s = String(body || "");
    if (s.startsWith("\x01nocam:")) {
      return s.charAt(8) === "1" || s.slice(8, 9) === "t";
    }
    if (s.startsWith("__nocam:")) {
      return s.charAt(8) === "1" || s.startsWith("__nocam:true");
    }
    return null;
  }

  /** Parse self-hide control: "\x01shide:1" / "__shide:0" / "\x01camhide:1" */
  function tryParseSelfHideControl(body: string): boolean | null {
    const s = String(body || "");
    if (s.startsWith("\x01shide:")) {
      return s.charAt(8) === "1" || s.slice(8, 9) === "t";
    }
    if (s.startsWith("__shide:")) {
      return s.charAt(8) === "1" || s.startsWith("__shide:true");
    }
    if (s.startsWith("\x01camhide:")) {
      return s.charAt(10) === "1" || s.slice(10, 11) === "t";
    }
    return null;
  }

  /** Per-extra tile volume. LiveStageVideo has no onTileVolume yet — see-stage. */
  function setExtraTileMuted(index: number, muted: boolean) {
    const sess =
      index === 2 ? media3Ref.current : index === 1 ? media2Ref.current : null;
    if (index === 1) {
      extraMuted2Ref.current = muted;
      setExtraMuted2(muted);
    } else if (index === 2) {
      extraMuted3Ref.current = muted;
      setExtraMuted3(muted);
    } else {
      return;
    }
    try {
      sess?.setRemoteAudioEnabled(!muted);
      sess?.getRemoteStream?.()?.getAudioTracks?.().forEach((tr) => {
        tr.enabled = !muted && !partnerMutedRef.current;
      });
    } catch {
      /* ignore */
    }
    hapticLight();
    push(`extra_vol i=${index} muted=${muted ? 1 : 0}`);
  }

  function togglePartnerMute() {
    const next = !partnerMuted;
    setPartnerMuted(next);
    partnerMutedRef.current = next;
    mediaRef.current?.setRemoteAudioEnabled(!next);
    media2Ref.current?.setRemoteAudioEnabled(
      !next && !extraMuted2Ref.current
    );
    media3Ref.current?.setRemoteAudioEnabled(
      !next && !extraMuted3Ref.current
    );
    hapticLight();
    // Triple path: P2P DC + hub signal + hub chat control (chat always relays)
    const sendMute = (why: string): boolean => {
      const muted = !!partnerMutedRef.current;
      const payload = {
        v: 1 as const,
        type: "partner_mute",
        muted,
        user_id: userIdRef.current || "",
        name: displayNameRef.current || "anon",
        ts: Date.now(),
      };
      let p2p = false;
      try {
        p2p = !!mediaRef.current?.sendDataMessage(payload);
      } catch {
        p2p = false;
      }
      let hubSig = false;
      try {
        hubRefLive.current.signal(
          "partner_mute",
          JSON.stringify(payload),
          ""
        );
        hubSig = true;
      } catch {
        hubSig = false;
      }
      if (remotePeerId.current) {
        try {
          hubRefLive.current.signal(
            "partner_mute",
            JSON.stringify(payload),
            remotePeerId.current
          );
        } catch {
          /* ignore */
        }
      }
      // Hub chat control — works whenever chat works (match room)
      let hubChat = false;
      try {
        hubRefLive.current.chat(`\x01pmute:${muted ? "1" : "0"}`);
        hubChat = true;
      } catch {
        hubChat = false;
      }
      if (p2p || hubSig || hubChat) {
        push(
          `partner_mute → ${muted ? 1 : 0} p2p=${p2p ? 1 : 0} sig=${hubSig ? 1 : 0} chat=${hubChat ? 1 : 0} (${why})`
        );
      }
      return p2p || hubSig || hubChat;
    };
    const ok = sendMute("tap");
    for (const ms of [300, 900, 2000, 4000]) {
      setTimeout(() => sendMute(`retry_${ms}`), ms);
    }
    // No mute toast — mid-stage 🔇 + mute button state are enough (no UX spam).
    if (!ok) {
      push("partner_mute first send failed — hub+p2p retries armed");
    }
  }

  function browseTogether() {
    if (phase !== "matched") return;
    // Friend 1v1 stays 1v1 — instant hunt needs Find 3rd accept, not this.
    if (
      (matchMode === "friend" || matchModeRef.current === "friend") &&
      extraPeersRef.current.length < 2
    ) {
      findThirdInvite();
      return;
    }
    try {
      hub.browseTogether();
      setFindThirdPending(true);
      setHuntingWithPartner(true);
      setMatchMode("party_browse");
      showToastRef.current(t("mobile.party.browseSent"));
      push("→ browse_together");
    } catch (e) {
      showToastRef.current(
        t("mobile.live.errorTitle") + `: ${String(e).slice(0, 80)}`
      );
    }
  }

  function findThirdInvite() {
    if (phase !== "matched") return;
    try {
      hub.findThirdInvite();
      setFindThirdPending(true);
      // Wait for them to accept — do not open hunt split on invite alone.
      showToastRef.current(t("mobile.party.findThirdSent"));
      push("→ find_third_invite");
    } catch (e) {
      showToastRef.current(
        t("mobile.live.errorTitle") + `: ${String(e).slice(0, 80)}`
      );
    }
  }

  function cancelFindThird() {
    try {
      hub.findThirdCancel();
    } catch {
      /* ignore */
    }
    setFindThirdPending(false);
    setHuntingWithPartner(false);
    // Leave party_browse so looking strip drops; stay matched 1v1 with partner
    if (matchMode === "party_browse" || matchModeRef.current === "party_browse") {
      setMatchMode("");
      matchModeRef.current = "";
      yourRoleRef.current = "solo";
      setYourRole("solo");
    }
    showToastRef.current(t("mobile.toast.findThirdEnded"));
  }

  /** Hub accepted find-3rd / both in party hunt — keep 1st partner media + split UI */
  function enterHuntingWithPartner(why = "find_third") {
    setHuntingWithPartner(true);
    setFindThirdPending(false);
    setMatchMode("party_browse");
    yourRoleRef.current = "party";
    setYourRole("party");
    // Never demote to pure search (that full-screens brand and drops partner)
    if (phaseRef.current !== "matched") {
      setPhase("matched");
      phaseRef.current = "matched";
    }
    searchingRef.current = false;
    log(`hunt_with_partner why=${why}`);
  }

  function sendChat() {
    const body = chatDraft.trim().slice(0, CHAT_MAX);
    if (!body || phase !== "matched") return;
    // Prefer P2P data channel (lower lag); fall back to hub
    const viaP2p = mediaRef.current?.sendDataMessage({
      type: "chat",
      body,
      user_id: userIdRef.current || "",
      name: displayNameRef.current || "anon",
    });
    try {
      if (!viaP2p) hub.chat(body);
      // Mutual friends: also store in the DM conversation (hub + FriendChatSheet)
      const uid =
        partnerUserId.current || lastPartnerIdsRef.current.userId || "";
      const isFriend =
        !!uid &&
        (matchModeRef.current === "friend" ||
          (friendsRef.current || []).some((f) => f.user_id === uid));
      if (isFriend && uid) {
        try {
          hub.friendChat(uid, body);
        } catch {
          /* hub may reject if not mutual yet */
        }
      }
      // Always clear typing indicator for peer when we send a line
      try {
        mediaRef.current?.sendDataMessage({ type: "typing_stop" });
      } catch {
        /* DC may be closed */
      }
      setChat((c) =>
        [
          ...c,
          { from: viaP2p ? t("mobile.chat.youP2p") : "you", body },
        ].slice(-40)
      );
      setChatDraft("");
      hapticLight();
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch (e) {
      push(String(e));
    }
  }

  function guardAction(): boolean {
    const now = Date.now();
    if (now - actionLockRef.current < 900) return false;
    actionLockRef.current = now;
    return true;
  }

  function onChatDraftChange(text: string) {
    const hitCap = text.length > CHAT_MAX;
    const clipped = hitCap ? text.slice(0, CHAT_MAX) : text;
    if (hitCap && chatDraft.length < CHAT_MAX) {
      hapticLight();
      showToastRef.current(t("mobile.chat.atLimit"));
    }
    setChatDraft(clipped);
    if (phase !== "matched" || !mediaRef.current?.isDataChannelOpen()) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1200) return;
    lastTypingSentRef.current = now;
    mediaRef.current.sendDataMessage({
      type: clipped.trim() ? "typing" : "typing_stop",
    });
  }

  function shareInvite(via: string = "live") {
    const code = friendCode || "……";
    const share = friendInviteShareMessage(hubBase(), code, "ruletka");
    track("funnel_invite_share", { via });
    if (via === "alone" || phase === "search") {
      track("empty_alone_invite_share", { via });
    }
    track("friend_invite_share", { via });
    Share.share({
      message: share.message,
      title: share.title,
      url: share.url,
    }).catch(() => {});
  }

  /**
   * Best partner id for report/block. Prefer persistent user_id; fall back to
   * peer_id / friend_code so hub can resolve while they are still online.
   * Never wipe a known user_id with empty on thrash rematch.
   * Extra tile sheet uses that extra's userId/peerId — never primary.
   */
  function resolvePartnerTargetId(): string {
    const mine = String(userIdRef.current || "").trim();
    const slot = actionSlotRef.current;
    if (slot === "extra0" || slot === "extra1") {
      const extras = extraPeersRef.current;
      const picked = extraPartnerActionTarget({ extras, slot });
      const i = slot === "extra1" ? 1 : 0;
      const p = extras[i];
      const candidates = [
        picked?.userId,
        p?.userId,
        picked?.peerId,
        p?.peerId,
        p?.friendCode,
      ];
      for (const c of candidates) {
        const id = String(c || "").trim();
        if (!id || id === "legacy") continue;
        if (mine && id === mine) continue;
        return id;
      }
      return "";
    }
    const candidates = [
      partnerUserId.current,
      lastPartnerIdsRef.current.userId,
      partnerFriendCode.current,
      lastPartnerIdsRef.current.friendCode,
      remotePeerId.current,
      lastPartnerIdsRef.current.peerId,
      lastPartnerIdsRef.current.shortId,
    ];
    for (const c of candidates) {
      const id = String(c || "").trim();
      if (!id || id === "legacy") continue;
      if (mine && id === mine) continue;
      return id;
    }
    return "";
  }

  /** Extra report/block: keep the pair. Drop extra PC only via existing helper. */
  function finishExtraSafetyKeepPair(why: string): boolean {
    const slot = actionSlotRef.current;
    if (slot !== "extra0" && slot !== "extra1") return false;
    const dropSlot = slot === "extra1" ? "3" : "2";
    const drop = dropExtraKeepPrimaryRef.current;
    if (drop) drop(dropSlot, why);
    actionSlotRef.current = "primary";
    setActionSlot("primary");
    setMoreOpen(false);
    return true;
  }

  function notePartnerUserId(raw: string, src = "") {
    const uid = String(raw || "").trim();
    if (!uid || uid === "legacy") return;
    const mine = String(userIdRef.current || "").trim();
    if (mine && uid === mine) return;
    if (!partnerUserId.current) {
      partnerUserId.current = uid;
      if (src) push(`partner uid learned (${src}) ${uid.slice(0, 8)}`);
    }
    if (!lastPartnerIdsRef.current.userId) {
      lastPartnerIdsRef.current = {
        ...lastPartnerIdsRef.current,
        userId: uid,
      };
    }
  }

  async function openReport() {
    const uid = resolvePartnerTargetId();
    if (!uid) {
      showToastRef.current(t("mobile.live.partnerNotReady"));
      return;
    }
    // Prefer sticky user_id for rest of report flow
    if (!partnerUserId.current) partnerUserId.current = uid;
    reportShotB64.current = null;
    setReportShotUri(null);
    // Report sheet stacks above privacy veil; keep veil (don't force unblur).
    setMoreOpen(false);
    setReportOpen(true);
    setReportCapturing(true);
    try {
      // Capture stage (remote + local PiP). While privacy veil is on, partner
      // RTCView is unmounted — shot may be underlay only; report still proceeds.
      // Android SurfaceView may not always appear in the bitmap either.
      const uri = await captureRef(stageRef, {
        format: "jpg",
        quality: 0.55,
        result: "tmpfile",
        width: 480,
      });
      if (uri) {
        setReportShotUri(uri);
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const FileSystem = require("expo-file-system") as {
            readAsStringAsync: (
              path: string,
              opts: { encoding: string }
            ) => Promise<string>;
            EncodingType?: { Base64: string };
          };
          const enc = FileSystem.EncodingType?.Base64 || "base64";
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: enc,
          });
          if (b64 && b64.length > 32) reportShotB64.current = b64;
        } catch {
          /* evidence optional */
        }
      }
    } catch (e) {
      push(`report shot ${e}`);
    } finally {
      setReportCapturing(false);
    }
  }

  function closeReport() {
    if (reportBusy) return;
    setReportOpen(false);
    setReportShotUri(null);
    reportShotB64.current = null;
  }

  function doBlockOnly() {
    const uid = resolvePartnerTargetId();
    if (!uid) {
      showToastRef.current(t("mobile.live.partnerNotReady"));
      return;
    }
    try {
      hub.blockUser(uid);
      void rememberBlock(
        uid,
        paintSafePartnerName(partnerNameRef.current || partner, "Partner", {
          userId: uid,
        })
      );
      void pushReportHistory({
        user_id: uid,
        name: paintSafePartnerName(
          partnerNameRef.current || partner,
          "Partner",
          { userId: uid }
        ),
        kind: "block",
      });
      push("→ block");
      track("block_next", {});
      showToastRef.current(t("mobile.live.blockedNext"));
    } catch (e) {
      push(String(e));
    }
    setReportOpen(false);
    setReportShotUri(null);
    reportShotB64.current = null;
    // Skip rate after block
    ratedThisMatchRef.current = true;
    if (finishExtraSafetyKeepPair("block")) return;
    next();
  }

  function doReport(reason: ReportReason) {
    const uid = resolvePartnerTargetId();
    if (!uid || reportBusy) {
      if (!uid) {
        showToastRef.current(t("mobile.live.partnerNotReady"));
      }
      return;
    }
    setReportBusy(true);
    try {
      const shot = reportShotB64.current || undefined;
      hub.reportUser(uid, reason, shot);
      hub.blockUser(uid);
      void rememberBlock(
        uid,
        paintSafePartnerName(partnerNameRef.current || partner, "Partner", {
          userId: uid,
        })
      );
      void pushReportHistory({
        user_id: uid,
        name: paintSafePartnerName(
          partnerNameRef.current || partner,
          "Partner",
          { userId: uid }
        ),
        kind: "report",
        reason,
      });
      push(`→ report ${reason} + block${shot ? " + shot" : ""}`);
      track("report_next", { reason, has_shot: !!shot });
      showToastRef.current(
        t("mobile.live.reportedNext") ||
          "✓ Reported · blocked · finding next"
      );
    } catch (e) {
      push(String(e));
    }
    setReportBusy(false);
    setReportOpen(false);
    setReportShotUri(null);
    reportShotB64.current = null;
    ratedThisMatchRef.current = true;
    if (finishExtraSafetyKeepPair("report")) return;
    next();
  }

  /**
   * Soft: ICE restart. Hard: tear down PC and renegotiate (phone↔browser stuck).
   * Core logic lives in `runConnectRetry` (Track A4 extract).
   */
  const retryConnection = useCallback(
    async (opts?: { hard?: boolean }) => {
      if (retryBusy || phaseRef.current !== "matched") return;
      const hard = !!opts?.hard;
      // Answerer who already completed SDP must never hard-rebuild as offerer
      // (hub thrash: match_to_offer_ms 17–24s after healthy answer).
      let doHard = hard;
      if (
        doHard &&
        mediaRef.current?.hasAnsweredAsAnswerer?.()
      ) {
        push("hard retry blocked — answered as answerer; soft ICE only");
        doHard = false;
        mediaRef.current?.forceRepaintRemote?.("hard_block_answerer");
      }
      if (doHard) {
        const startedAt = matchStartedAtRef.current;
        const age = startedAt > 0 ? Date.now() - startedAt : 99999;
        const framesOk = !!mediaRef.current?.hasInboundVideoFrames?.();
        const need = framesOk ? 30000 : 28000;
        if (age < need) {
          push(`hard retry skipped — match grace age=${age} need=${need}`);
          return;
        }
        try {
          const snap = mediaRef.current?.getIceSnapshot?.();
          const ice = `${snap?.ice || ""} ${snap?.cs || ""}`;
          if (/connected|completed|checking/i.test(ice) && !framesOk) {
            push(`hard retry demoted — path alive (${ice.trim()}), soft only`);
            mediaRef.current?.forceRepaintRemote?.("hard_demote_ice_ok");
            void mediaRef.current?.tryIceRestart?.({
              force: true,
              promoteOfferer: false,
            });
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setRetryBusy(true);
      hapticLight();
      flashStatus(
        doHard ? t("mobile.live.retryHard") : t("mobile.live.retrying")
      );
      track(doHard ? "hard_retry" : "ice_retry", {
        turn: iceHasTurnRef.current ? 1 : 0,
      });
      const result = await runConnectRetry(
        {
          media: mediaRef.current,
          media2: media2Ref.current,
          fetchIce: () => hub.fetchIceConfig(),
          setIceHasTurn: (v) => {
            iceHasTurnRef.current = v;
          },
          log: push,
          // Hard as offerer ONLY if we never answered (true cold silence).
          forceOfferer: doHard && !mediaRef.current?.hasAnsweredAsAnswerer?.(),
        },
        { hard: doHard }
      );
      if (doHard && result.ok && result.hard) {
        setRemoteStream(null);
        setRemoteEpoch((n) => n + 1);
        if (
          !partnerNoCamRef.current &&
          !partnerCamHiddenRef.current &&
          !hasLiveRemoteMedia(
            mediaRef.current?.getRemoteStream?.() || null
          )
        ) {
          setAwaitingRemoteVideo(true);
        }
        remoteVideoSeenRef.current = false;
        setRemoteVideoReady(false);
        if (!mediaRef.current?.hasAnsweredAsAnswerer?.()) {
          isOffererRef.current = true;
        }
      } else if (result.remoteStream) {
        setRemoteStream(result.remoteStream);
        setRemoteEpoch((n) => n + 1);
      }
      setConn("connecting");
      setConnSince(Date.now());
      if (!result.ok) {
        track("match_fail_ice", { hard: hard ? 1 : 0 });
      }
      setRetryBusy(false);
    },
    [retryBusy, t, hub, flashStatus, push]
  );

  /** Match web GIFT_RATE_LIMIT_MS — hub also rate-limits, but UI should not spam. */
  const lastGiftSpendAtRef = useRef(0);
  const GIFT_RATE_LIMIT_MS = 10_000;

  function spend(effect: string, cost: number) {
    // Prefer sticky user_id; fall back to peer/code resolve (same as report)
    const uid = resolvePartnerTargetId();
    const inLive =
      phase === "matched" ||
      phaseRef.current === "matched" ||
      !!(remoteStream?.getVideoTracks?.()?.length || remoteStream?.getAudioTracks?.()?.length);
    if (!uid || !inLive) {
      if (inLive && !uid) {
        showToastRef.current(
          t("mobile.live.partnerNotReady") || "Partner id not ready yet"
        );
      } else if (!inLive) {
        showToastRef.current(
          t("mobile.live.needLiveChat") || "Only during a live chat"
        );
      }
      return;
    }
    if (!partnerUserId.current) partnerUserId.current = uid;
    // Double-tap debounce (short) + gift rate limit (10s, web parity)
    if (!guardAction()) return;
    const now = Date.now();
    if (
      lastGiftSpendAtRef.current &&
      now - lastGiftSpendAtRef.current < GIFT_RATE_LIMIT_MS
    ) {
      const wait = Math.ceil(
        (GIFT_RATE_LIMIT_MS - (now - lastGiftSpendAtRef.current)) / 1000
      );
      showToastRef.current(
        t("mobile.live.giftRateLimit", { s: wait }) ||
          `Wait ${wait}s before next gift`
      );
      return;
    }
    if (stars < cost) {
      showToastRef.current(
        t("mobile.live.needStars", { cost, stars })
      );
      return;
    }
    try {
      lastGiftSpendAtRef.current = now;
      hub.spendStars(uid, effect);
      push(`→ spend ${effect} (−${cost}★)`);
      hapticLight();
      // Local feedback before hub echo
      const gift = GIFTS.find((g) => g.id === effect);
      const holdMs = giftFxHoldMs(effect);
      const untilSec = Math.floor((Date.now() + holdMs) / 1000);
      if (gift) {
        setGiftFlash(`${gift.emoji}`);
        const slot = actionSlotRef.current;
        if (slot === "extra0" || slot === "extra1") {
          setGiftEffect(null);
          if (slot === "extra0") {
            setExtraGiftFx0(effect);
            if (extraFx0TimerRef.current) clearTimeout(extraFx0TimerRef.current);
            extraFx0TimerRef.current = setTimeout(
              () => setExtraGiftFx0(null),
              holdMs
            );
          } else {
            setExtraGiftFx1(effect);
            if (extraFx1TimerRef.current) clearTimeout(extraFx1TimerRef.current);
            extraFx1TimerRef.current = setTimeout(
              () => setExtraGiftFx1(null),
              holdMs
            );
          }
        } else if (effect === "bars" || effect === "fence") {
          setGiftEffect(null);
          setPartnerFx(effect);
          if (partnerFxTimerRef.current) clearTimeout(partnerFxTimerRef.current);
          partnerFxTimerRef.current = setTimeout(
            () => setPartnerFx(null),
            holdMs
          );
        } else {
          setGiftEffect(effect);
          if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
          giftFxTimerRef.current = setTimeout(() => {
            setGiftFlash(null);
            setGiftEffect(null);
          }, holdMs);
        }
        if (effect === "bars" || effect === "fence") {
          if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
          giftFxTimerRef.current = setTimeout(() => setGiftFlash(null), 2200);
        }
        void playGiftChime(effect);
      }
      // P2P + hub signal gift_fx so PC paints even if star_effect user_id thrash
      try {
        const payload = {
          v: 1,
          type: "gift_fx",
          effect,
          until: untilSec,
          level: 1,
          target_user_id: uid,
          from_user_id: String(userIdRef.current || ""),
          from_name: String(displayNameRef.current || "anon"),
          ts: Date.now(),
        };
        let dcOk = false;
        try {
          if (mediaRef.current?.sendDataMessage?.(payload)) dcOk = true;
        } catch {
          /* ignore */
        }
        try {
          if (media2.sendDataMessage(payload)) dcOk = true;
        } catch {
          /* ignore */
        }
        try {
          if (media3.sendDataMessage(payload)) dcOk = true;
        } catch {
          /* ignore */
        }
        try {
          hub.signal("gift_fx", JSON.stringify(payload));
        } catch {
          /* hub optional */
        }
        push(`gift_fx→ ${effect} dc=${dcOk ? 1 : 0}`);
      } catch (e) {
        push(`gift_fx send ${e}`);
      }
      // Local please_stay lock (also applied on hub echo)
      if (effect === "please_stay") {
        stayUntilRef.current = Math.max(
          stayUntilRef.current,
          Date.now() + 15_000
        );
        setStayRemSecs(15);
      }
    } catch (e) {
      push(String(e));
    }
  }

  async function retryMedia() {
    setMediaBlocked(false);
    clearMediaPermissionCache();
    const perm = await ensureMediaPermissions();
    if (!perm.allGranted) {
      setMediaBlocked(true);
      return;
    }
    const s = await mediaRef.current?.ensureLocalStream();
    if (s) setMediaBlocked(false);
    else setMediaBlocked(true);
  }

  function addPartnerFriend() {
    let code = partnerFriendCode.current || partnerCode;
    const slot = actionSlotRef.current;
    if (slot === "extra0" || slot === "extra1") {
      const i = slot === "extra1" ? 1 : 0;
      const extraCode = String(
        extraPeersRef.current[i]?.friendCode || extraPeers[i]?.friendCode || ""
      ).trim();
      // addFriend is code-only — do not invent a userId hub API.
      // Never fall back to primary's code when the extra has none yet.
      code = extraCode.length >= 4 ? extraCode : "";
    }
    if (!code || code.length < 4) {
      showToastRef.current(t("mobile.live.partnerNotReady"));
      return;
    }
    try {
      hub.addFriend(code);
      setFriendAdded(true);
      push(`→ add_friend ${code}`);
      track("add_friend_match", { via: "live" });
      showToastRef.current(t("mobile.friends.requestSent", { code }));
    } catch (e) {
      showToastRef.current(
        t("mobile.friends.notConnected") +
          (e ? `: ${String(e).slice(0, 60)}` : "")
      );
    }
  }

  // Controls phase: if remote A/V is live, never show idle Start (desync fix)
  const remoteLive =
    hasLiveRemoteMedia(remoteStream) ||
    hasLiveRemoteMedia(remoteStream2) ||
    hasLiveRemoteMedia(remoteStream3);
  const uiPhase =
    phase === "search"
      ? "search"
      : phase === "matched" || remoteLive
        ? "matched"
        : phase;

  // Heal desync: remote media alive but React phase stuck idle/error.
  // Also re-ensure armed auto-veil once remote is live while already matched
  // (covers Matched paint before stream + stream without re-fire).
  useEffect(() => {
    if (!remoteLive) return;
    if (phase === "search") return;
    if (phase !== "matched") {
      setPhase("matched");
      phaseRef.current = "matched";
      searchingRef.current = false;
      // Start clocks so gift/review timers advance even if Matched was missed
      if (!matchStartedAtRef.current) {
        const t0 = Date.now();
        matchStartedAtRef.current = t0;
        setMatchStartedAt(t0);
      }
      // Phase was idle/error with live media — Matched may never have armed want.
      const mode = blurModeRef.current || "intro";
      if (
        (mode === "intro" || mode === "hold") &&
        matchModeRef.current !== "friend" &&
        !remoteBlurredRef.current
      ) {
        blurWantAutoRef.current = true;
        applyMatchBlurVeil("heal_matched");
      }
      return;
    }
    // Already matched + remote live: mount veil if Matched armed want but paint missed.
    if (
      blurWantAutoRef.current &&
      !remoteBlurredRef.current &&
      phaseRef.current === "matched"
    ) {
      applyMatchBlurVeil("remote_ready");
    }
  }, [remoteLive, phase, applyMatchBlurVeil]);

  // Alone-queue "Invite someone to live" card removed (product: less noise on Android Live).
  const showAloneBanner = false;
  const isFriendCall = matchMode === "friend";
  const extraActionIdx =
    actionSlot === "extra1" ? 1 : actionSlot === "extra0" ? 0 : -1;
  const extraActionPeer =
    extraActionIdx >= 0
      ? extraPeers[extraActionIdx] || extraPeersRef.current[extraActionIdx]
      : undefined;
  const extraActionPicked =
    extraActionIdx >= 0
      ? extraPartnerActionTarget({ extras: extraPeers, slot: actionSlot })
      : null;
  const extraActionUid = String(
    extraActionPicked?.userId || extraActionPeer?.userId || ""
  ).trim();
  const extraActionCode = String(
    extraActionPicked?.friendCode || extraActionPeer?.friendCode || ""
  ).trim();
  const alreadyFriends = !!(
    partnerUserId.current &&
    friends.some((f) => f.user_id === partnerUserId.current)
  );
  const alreadyFriendsForSlot =
    extraActionIdx >= 0
      ? friends.some(
          (f) =>
            (!!extraActionUid && f.user_id === extraActionUid) ||
            (extraActionCode.length >= 4 &&
              String(f.friend_code || "").trim().toUpperCase() ===
                extraActionCode.toUpperCase())
        )
      : alreadyFriends;
  // Extra slot Add friend is independent of primary alreadyFriends / partnerCode.
  const canAddFriend =
    extraActionIdx >= 0
      ? uiPhase === "matched" &&
        !isFriendCall &&
        !alreadyFriendsForSlot &&
        (extraActionCode.length >= 4 || extraActionUid.length > 0)
      : uiPhase === "matched" &&
        !isFriendCall &&
        !friendAdded &&
        !alreadyFriends &&
        !!(partnerCode || partnerFriendCode.current);
  const elapsedSecs =
    phase === "matched" && matchStartedAt
      ? elapsedSince(matchStartedAt, nowTick)
      : 0;
  const starProgress = starProgressOf(elapsedSecs, rateMinSecs);
  const starReady = starProgress >= 1;
  const needMin = starNeedMinutes(rateMinSecs);
  const callElapsedSecs = elapsedSecs;
  const callTimerText = formatCallTimer(callElapsedSecs);

  // Any non-ended video track — don't require readyState===live (Android often
  // keeps tracks "muted" until first frame; requiring live left black stage).
  const hasRemoteVideo = hasLiveRemoteVideoTrack(remoteStream);
  // Laptop no-cam: live audio is a finished link (do not sit on Linking).
  const hasRemoteMedia =
    hasLiveRemoteMedia(remoteStream) ||
    hasLiveRemoteMedia(remoteStream2) ||
    hasLiveRemoteMedia(remoteStream3);

  // Belt: 3rd stream (incl audio-only) ends hunt; live audio clears Linking.
  useEffect(() => {
    if (remoteStream2 || remoteStream3) {
      if (huntingWithPartnerRef.current) {
        huntingWithPartnerRef.current = false;
        setHuntingWithPartner(false);
      }
      setFindThirdPending(false);
    }
    if (
      awaitingRemoteVideo &&
      (hasRemoteMedia || partnerNoCam || partnerCamHidden)
    ) {
      setAwaitingRemoteVideo(false);
    }
  }, [
    remoteStream2,
    remoteStream3,
    hasRemoteMedia,
    awaitingRemoteVideo,
    partnerNoCam,
    partnerCamHidden,
  ]);

  // One-shot: teach swipe → Next after first live stranger match with video.
  useEffect(() => {
    if (phase !== "matched" || isFriendCall || !swipeSkipOn) return;
    if (!hasRemoteVideo || swipeCoachShownRef.current) return;
    let cancelled = false;
    const SWIPE_COACH_KEY = "ruletka-swipe-coach-v1";
    const tId = setTimeout(() => {
      void (async () => {
        try {
          const done = await AsyncStorage.getItem(SWIPE_COACH_KEY);
          if (done === "1" || cancelled || swipeCoachShownRef.current) return;
          swipeCoachShownRef.current = true;
          await AsyncStorage.setItem(SWIPE_COACH_KEY, "1");
          showToastRef.current(
            t("swipe.coachBody") ||
              t("swipe.hint") ||
              "Swipe left or right on their video for Next"
          );
          track("swipe_coach_show", { platform: Platform.OS });
        } catch {
          /* ignore storage */
        }
      })();
    }, 2200);
    return () => {
      cancelled = true;
      clearTimeout(tId);
    };
  }, [phase, isFriendCall, swipeSkipOn, hasRemoteVideo, t]);

  // Never keep self as fullscreen main if partner video is gone / not live
  useEffect(() => {
    if (!hasRemoteVideo && swapViews) setSwapViews(false);
  }, [hasRemoteVideo, swapViews]);

  // New match: always partner-main / self-PiP (not leftover swap from prior call)
  useEffect(() => {
    if (uiPhase === "matched") setSwapViews(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on match entry
  }, [matchStartedAt]);

  // No timed epoch bumps — MediaSession paints once; remount only on stream change.

  const {
    tier: linkTier,
    rttMs: linkRtt,
    relay: linkRelay,
  } = useLinkQuality(mediaRef, phase === "matched");

  // Network-aware: cellular → quality ceiling; wifi↔cell → ICE restart
  const netPolicy = useNetworkMediaPolicy(
    phase === "search" || phase === "matched"
  );
  const lastNetEpochRef = useRef(0);
  useEffect(() => {
    const cellular = netPolicy.kind === "cellular";
    mediaRef.current?.setNetworkHints({
      cellular,
      dataSaver: dataSaverOn || netPolicy.preferDataSaver,
    });
    media2Ref.current?.setNetworkHints({
      cellular,
      dataSaver: dataSaverOn || netPolicy.preferDataSaver,
    });
    media3Ref.current?.setNetworkHints({
      cellular,
      dataSaver: dataSaverOn || netPolicy.preferDataSaver,
    });
    // Auto data-saver on cellular (doesn't override user toggle off permanently —
    // we only lower encode ceiling via setNetworkHints; UI switch stays user-owned)
    if (
      netPolicy.preferDataSaver &&
      phase === "matched" &&
      !dataSaverOn
    ) {
      // Soft: only media ceiling — avoid thrashing camera constraints every cell blip
    }
  }, [netPolicy.kind, netPolicy.preferDataSaver, dataSaverOn, phase]);

  useEffect(() => {
    if (phase !== "matched") {
      lastNetEpochRef.current = netPolicy.pathEpoch;
      return;
    }
    if (netPolicy.pathEpoch === lastNetEpochRef.current) return;
    if (lastNetEpochRef.current === 0 && netPolicy.pathEpoch > 0) {
      // First classification after match — don't restart yet
      lastNetEpochRef.current = netPolicy.pathEpoch;
      return;
    }
    lastNetEpochRef.current = netPolicy.pathEpoch;
    if (!netPolicy.isConnected) {
      showToastRef.current(t("mobile.live.netOffline"));
      return;
    }
    // NetInfo can blip wifi→unknown→wifi; only restart on real cell/wifi flip
    // after media is established — not during first connect (kills same-WiFi).
    const age =
      matchStartedAtRef.current > 0
        ? Date.now() - matchStartedAtRef.current
        : 0;
    if (age < 8000) {
      push(
        `net path → ${netPolicy.kind} epoch=${netPolicy.pathEpoch} (ignore, match age ${age}ms)`
      );
      return;
    }
    track("net_path_change", {
      kind: netPolicy.kind,
      epoch: netPolicy.pathEpoch,
    });
    showToastRef.current(
      t("mobile.live.netPathChange", { kind: netPolicy.kind })
    );
    push(
      `net path → ${netPolicy.kind} epoch=${netPolicy.pathEpoch} — soft ICE restart`
    );
    void mediaRef.current?.tryIceRestart({
      force: true,
      promoteOfferer: false,
    });
    void media2Ref.current?.tryIceRestart({ force: true });
    void media3Ref.current?.tryIceRestart({ force: true });
  }, [netPolicy.pathEpoch, netPolicy.isConnected, netPolicy.kind, phase, push, t]);

  // Tracks alone are not enough — black partner + Report meant auto-retry
  // never fired. Only treat as OK when inbound frames decoded.
  const remoteFramesOk = !!mediaRef.current?.hasInboundVideoFrames?.();
  const autoRetryCount = useAutoConnectRetry({
    phase,
    matchStartedAt,
    nowTick,
    remoteFramesOk,
    onSoft: () => {
      // Soft only: paint + iceRestart. NEVER force_relay arm mid-call —
      // that rebuilt pure-relay PC and zeroed peer_usage (PC black partner).
      if (mediaRef.current?.hasAnsweredAsAnswerer?.()) {
        push("auto soft answerer — paint/outbound only");
        mediaRef.current?.forceRepaintRemote?.("auto_soft_answerer");
        try {
          mediaRef.current?.kickMediaAfterIce?.("auto_soft");
        } catch {
          /* ignore */
        }
        return;
      }
      void retryConnection({ hard: false });
    },
    onHard: () => {
      // Do not closeCall during reconnect wait — ICE may recover.
      if (reconnectSnapRef.current) {
        push("auto hard skipped — partner reconnect wait");
        return;
      }
      // Never auto hard-rebuild as offerer after we already answered web.
      if (mediaRef.current?.hasAnsweredAsAnswerer?.()) {
        push("auto hard demoted → paint only (was answerer)");
        mediaRef.current?.forceRepaintRemote?.("auto_hard_demote");
        try {
          mediaRef.current?.kickMediaAfterIce?.("auto_hard_answerer");
        } catch {
          /* ignore */
        }
        return;
      }
      void retryConnection({ hard: true });
    },
    onTip: () => showToastRef.current(t("mobile.live.stillNoVideoTip")),
    log: push,
  });

  const connSlow = computeConnSlow({
    phase,
    conn,
    awaitingRemoteVideo,
    hasRemoteVideo: hasRemoteMedia,
    connSince,
    now: nowTick,
  });

  const labelKey = connLabelKey(conn, connSlow);
  const connLabel = labelKey ? t(labelKey) : conn;
  const reconnectBanner = reconnectSnap
    ? (() => {
        const n = reconnectSnap.chance;
        const s = remainingSecs(reconnectSnap, nowTick);
        const chanceRaw = t("mobile.live.reconnectChance", { n });
        const secsRaw = t("mobile.live.reconnectSecs", { s });
        const chance =
          chanceRaw && chanceRaw !== "mobile.live.reconnectChance"
            ? chanceRaw
            : `Reconnecting ${n}/3`;
        const secs =
          secsRaw && secsRaw !== "mobile.live.reconnectSecs"
            ? secsRaw
            : `${s}s`;
        return `${chance} · ${secs}`;
      })()
    : "";

  const showConnRetry = computeShowConnRetry({
    phase,
    conn,
    connSlow,
    awaitingRemoteVideo,
    hasRemoteVideo: hasRemoteMedia,
    matchStartedAt,
    now: nowTick,
  });
  const showHardRetry = computeShowHardRetry({
    phase,
    conn,
    connSlow,
    linkTier,
    awaitingRemoteVideo,
    hasRemoteVideo: hasRemoteMedia,
    matchStartedAt,
    now: nowTick,
  });
  const linkTierLabel =
    linkTier === "good"
      ? t("mobile.live.qGood")
      : linkTier === "ok"
        ? t("mobile.live.qOk")
        : linkTier === "weak"
          ? t("mobile.live.qWeak")
          : linkTier === "bad"
            ? t("mobile.live.qBad")
            : "";

  const debateISpeak =
    debate.active &&
    !!userId &&
    debate.speakerId.toLowerCase() === userId.toLowerCase();
  const debateRound = debateRoundNumber(debate.turnIndex);
  const debateTimerText = formatDebateTimer(debate.remMs);
  const debateUrgent = debate.active && debate.remMs > 0 && debate.remMs <= 5000;
  const debateProgress =
    debate.active && debate.turnMs > 0
      ? Math.max(0, Math.min(1, debate.remMs / debate.turnMs))
      : 0;

  const partnerBlurLine = formatPartnerSummary({
    name: paintSafePartnerName(partner, "Partner", {
      peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId || "",
      userId: partnerUserId.current || lastPartnerIdsRef.current.userId || "",
    }),
    stars: partnerStars,
    trust: partnerTrust,
    flag: partnerFlag,
    country: partnerCountry,
    city: partnerCity,
    lang: lang || "ru",
    hideIp: partnerHideIp,
  });
  /**
   * Stage HUD / connect card loc line.
   * hide_ip → never "Looking up…" (privacy is settled).
   * Flag ISO alone → formatLocLine expands to emoji + country (not empty).
   * Empty only while hub geo is still racing → stage shows pending copy.
   */
  const partnerLocDisplay = partnerHideIp
    ? t("mobile.live.locPrivate") || "Location hidden"
    : formatLocLine({
        flag: partnerFlag,
        country: partnerCountry,
        city: partnerCity,
        lang: lang || "ru",
        hideIp: false,
      });
  const showPrivacyBlur =
    remoteBlurred && (phase === "matched" || uiPhase === "matched");

  // Single partner identity surface (name · ★ · loc) — dock only.
  // No stagePartnerHud / PartnerChrome / second dock (human: 3× ★ chips wrong).
  const partnerIdFriendCode = (
    partnerCode ||
    partnerFriendCode.current ||
    lastPartnerIdsRef.current.friendCode ||
    ""
  )
    .trim()
    .toUpperCase();
  // Never paint 8-char hex peer id as the conversationalist's name.
  // Order: real name → friend_code → prev real → "Partner".
  // Do NOT pass peer shortId — that is always hex and confused the dock.
  const partnerIdNameResolved = resolvePartnerDisplayName({
    name: partner || partnerNameRef.current || "",
    shortId: "",
    // Hex friend_code / partner_short must not become the painted name.
    friendCode: isHexIdLike(partnerIdFriendCode) ? "" : partnerIdFriendCode,
    peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId || "",
    userId: partnerUserId.current || lastPartnerIdsRef.current.userId || "",
    prev: partnerNameRef.current || partner || "",
    fallback: isHexIdLike(partnerIdFriendCode)
      ? undefined
      : partnerIdFriendCode || undefined,
  });
  const partnerIdName = paintSafePartnerName(
    partnerIdNameResolved,
    "Partner",
    {
      peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId || "",
      userId: partnerUserId.current || lastPartnerIdsRef.current.userId || "",
    }
  );
  // Prefer friend_code over literal "Partner" when name resolves empty —
  // but never a 6–12 hex who-sub / partner_short.
  const partnerIdNameFallback =
    partnerIdFriendCode && !isHexIdLike(partnerIdFriendCode)
      ? partnerIdFriendCode
      : "Partner";
  // Pre-compute display ★ once for dock (max spendable, trust)
  const partnerDisplayStars = displayPartnerStars(partnerStars, partnerTrust);
  // Extra tile chrome (loc + ★ + flag). Loc omits emoji — one flag on chrome.
  const extraTileChrome = extraPeers.slice(0, 2).map((p, i) => ({
    name: paintSafePartnerName(
      p.name,
      i === 0 ? t("mobile.live.peer2") : t("mobile.live.peer3") || "…",
      { peerId: p.peerId, userId: p.userId }
    ),
    loc: p.hideIp
      ? t("mobile.live.locPrivate") || "Location hidden"
      : formatLocLine({
          flag: p.flag,
          country: p.country,
          city: p.city,
          lang: lang || "ru",
          hideIp: false,
          omitFlag: true,
        }),
    hideIp: !!p.hideIp,
    stars: displayPartnerStars(p.stars, p.trust),
    flag: p.flag,
    avatar: p.avatar || "",
    code: String(p.friendCode || "").trim().toUpperCase(),
    muted: i === 0 ? extraMuted2 : extraMuted3,
    onVolume: (muted: boolean) => setExtraTileMuted(i + 1, muted),
  }));

  // Settled dock state after React applies Matched / partner_geo setStates.
  // logcat: [match] dock + [geo] dock — full fields for ★0 vs empty-geo diagnosis.
  useEffect(() => {
    if (uiPhase !== "matched") return;
    const loc =
      partnerHideIp
        ? "hidden"
        : partnerLocDisplay ||
          (partnerFlag || partnerCountry || partnerCity ? "(signal)" : "-");
    console.log(
      `[match] dock name=${partnerIdName || "-"} from=${partnerNameFromRef.current || "-"} display★=${partnerDisplayStars} stars=${partnerStars} trust=${partnerTrust} code=${partnerIdFriendCode || "-"}`
    );
    console.log(
      `[geo] dock flag=${partnerFlag || "-"} country=${partnerCountry || "-"} city=${partnerCity || "-"} hide=${partnerHideIp ? 1 : 0} loc=${loc}`
    );
  }, [
    uiPhase,
    partnerIdName,
    partnerDisplayStars,
    partnerStars,
    partnerTrust,
    partnerIdFriendCode,
    partnerFlag,
    partnerCountry,
    partnerCity,
    partnerHideIp,
    partnerLocDisplay,
  ]);

  return (
    <KeyboardAvoidingView
      style={
        isBrowserLayout
          ? styles.rootBrowser
          : uiPhase === "matched" || uiPhase === "search"
            ? styles.rootMatched
            : styles.root
      }
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        ref={stageRef}
        style={isBrowserLayout ? styles.stageBrowser : styles.stage}
        collapsable={false}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setStageSize({ w: width, h: height });
          }
        }}
      >
        <LiveStageVideo
          phase={uiPhase}
          localStream={localStream}
          remoteStream={remoteStream}
          remoteStream2={remoteStream2}
          remoteStream3={remoteStream3}
          remoteEpoch={remoteEpoch}
          remoteEpoch2={remoteEpoch2}
          remoteEpoch3={remoteEpoch3}
          extraPeerCount={extraPeers.length}
          yourRole={yourRole}
          // Find-3rd hunt: top=partner · bottom=looking. Drive from hunt flags
          // only — matchMode party_browse alone must not stick after cancel.
          // Matched + party_browse sets huntingWithPartner; remote2/3 ends it.
          lookingForThird={isLookingForThird({
            remoteStream,
            remoteStream2,
            remoteStream3,
            huntingWithPartner,
            findThirdPending,
            extraPeerCount: extraPeers.length,
          })}
          swapViews={swapViews}
          focusExtra={focusExtra}
          // Same resolver as PartnerIdentityDock — never raw hex short id.
          partnerName={partnerIdName}
          // LiveStageVideo falls back to partnerIdShort when name is empty/
          // "Partner". Pass friend_code only — never 6–12 hex / partner_short.
          partnerIdShort={
            partnerIdFriendCode && !isHexIdLike(partnerIdFriendCode)
              ? partnerIdFriendCode
              : ""
          }
          partnerStars={partnerStars}
          partnerTrust={partnerTrust}
          partnerLoc={partnerLocDisplay}
          partnerFlag={partnerFlag}
          partnerCode={partnerIdFriendCode || ""}
          // Dock is tighter under status bar — flag sits just under name·loc
          partnerFlagTopInset={Math.max(insets.top, 4) + 44}
          callTimerText={
            uiPhase === "matched" && hasRemoteMedia && !awaitingRemoteVideo
              ? callTimerText
              : ""
          }
          secondName={
            extraTileChrome[0]?.name ||
            paintSafePartnerName(
              extraPeers[0]?.name,
              t("mobile.live.peer2"),
              extraPeers[0]
                ? {
                    peerId: extraPeers[0].peerId,
                    userId: extraPeers[0].userId,
                  }
                : undefined
            )
          }
          thirdName={
            extraTileChrome[1]?.name ||
            paintSafePartnerName(
              extraPeers[1]?.name,
              t("mobile.live.peer3") || "…",
              extraPeers[1]
                ? {
                    peerId: extraPeers[1].peerId,
                    userId: extraPeers[1].userId,
                  }
                : undefined
            )
          }
          secondLoc={extraTileChrome[0]?.loc || ""}
          secondStars={extraTileChrome[0]?.stars || 0}
          secondTrust={extraPeers[0]?.trust || 0}
          thirdLoc={extraTileChrome[1]?.loc || ""}
          thirdStars={extraTileChrome[1]?.stars || 0}
          thirdTrust={extraPeers[1]?.trust || 0}
          // p-stage extra-tile flag chrome — loc is country · city only (omitFlag).
          secondFlag={extraTileChrome[0]?.flag || extraPeers[0]?.flag || ""}
          secondHideIp={!!extraPeers[0]?.hideIp}
          thirdFlag={extraTileChrome[1]?.flag || extraPeers[1]?.flag || ""}
          secondCode={extraTileChrome[0]?.code || extraPeers[0]?.friendCode || ""}
          thirdCode={extraTileChrome[1]?.code || extraPeers[1]?.friendCode || ""}
          onSecondVolume={() => setExtraTileMuted(1, !extraMuted2)}
          onThirdVolume={() => setExtraTileMuted(2, !extraMuted3)}
          isFriendCall={isFriendCall}
          remoteBlurred={remoteBlurred}
          partnerCamHidden={partnerCamHidden}
          partnerNoCam={partnerNoCam}
          extraNoCam2={extraNoCam2}
          extraNoCam3={extraNoCam3}
          mediaReady={
            uiPhase === "matched" &&
            !!remoteVideoReady &&
            !awaitingRemoteVideo
          }
          allowSoftBlur={true}
          camOn={camOn}
          partnerMuted={partnerMuted}
          theyMutedMe={theyMutedMe}
          retryBusy={retryBusy}
          autoRetryCount={autoRetryCount}
          hasTurn={iceHasTurnRef.current}
          partnerFx={partnerFx}
          extraGiftFx0={extraGiftFx0}
          extraGiftFx1={extraGiftFx1}
          stageGiftFx={
            extraPeers.length >= 1 ? giftEffect : null
          }
          selfFx={selfFx}
          barsCaption={
            partnerFx === "bars" || selfFx === "bars"
              ? t("mobile.live.giftBars")
              : partnerFx === "fence" || selfFx === "fence"
                ? t("mobile.live.giftFence")
                : undefined
          }
          connectElapsedSecs={
            matchStartedAt > 0 && uiPhase === "matched"
              ? Math.floor((nowTick - matchStartedAt) / 1000)
              : 0
          }
          stageW={stageSize.w}
          stageH={stageSize.h}
          pipHint={pipHint}
          labels={{
            connectingPeer: t("mobile.live.connectingPeer"),
            linkingCameras: t("mobile.live.linkingCameras"),
            findingPath: t("mobile.live.stageFindingPath"),
            tryingRelay: t("mobile.live.stageTryingRelay"),
            retryHard: t("mobile.live.retryHard"),
            retrying: t("mobile.live.retrying"),
            turnReady: t("mobile.live.turnReady"),
            turnLoading: t("mobile.live.turnLoading"),
            tapToRetry: t("mobile.live.tapToRetry"),
            retryPath: t("mobile.live.retryPath"),
            focus: t("mobile.live.focus"),
            pipHint: t("mobile.live.pipHint"),
            // Mute badges unused in LiveStageVideo (void'd) — mid-stage 🔇 only
            longPressReport: t("mobile.live.longPressReport"),
            selfHiddenBadge:
              t("mobile.live.selfHiddenBadge") || "Hidden from them",
            unblurShort:
              t("mobile.live.unblurShort") || "Show video",
            partnerHiddenTitle:
              t("mobile.live.partnerHiddenTitle") || "Partner hidden",
            partnerHiddenBody:
              t("mobile.live.partnerHiddenBody") ||
              "They hid their camera",
            partnerHiddenHint:
              t("mobile.live.partnerHiddenHint") ||
              "Show when they reveal",
            partnerHiddenBadge:
              t("mobile.live.partnerHiddenBadge") || "Hidden",
            noCamTitle: t("mobile.live.noCamTitle") || "No camera",
            noCamSub:
              t("mobile.live.noCamSub") || "Talking with microphone",
            locPending:
              t("mobile.live.locPending") || "Looking up location…",
            // Prefer short slot label; never blank (LiveStageVideo also falls back)
            lookingForThird:
              (t("trio.slotEmpty") || "").trim() ||
              (t("trio.searching") || "").trim() ||
              "Looking for a 3rd…",
          }}
          onToggleFocusExtra={() => setFocusExtra((v) => !v)}
          onSelectPartner={(slot) => {
            hapticLight();
            setActionSlot(slot);
            actionSlotRef.current = slot;
            setMoreOpen(true);
          }}
          onRetryConnect={(hard) => void retryConnection({ hard })}
          onReport={() => {
            hapticLight();
            setActionSlot("primary");
            actionSlotRef.current = "primary";
            setMoreOpen(false);
            void openReport();
          }}
          onDoubleTapReblur={() => {
            hapticLight();
            setMoreOpen(false);
            clearIntroUnblurTimer();
            setRemoteBlurred(true);
            remoteBlurredRef.current = true;
            blurAutoAppliedRef.current = false;
            console.log("[blur] show why=double_tap");
            showToastRef.current(
              t("mobile.live.reblurToast") || "Partner blurred again"
            );
          }}
          onPipHintSeen={() => setPipHint(false)}
          onSwapViews={() => setSwapViews((v) => !v)}
          onHaptic={() => hapticLight()}
          onSwipeNext={() => next()}
          onSwipeDropExtra={() => {
            // 2v2 (2 extras): swipe other pair → Next pair.
            // 3-way (1 extra): drop that 3rd, keep the pair.
            if (extrasCountRef.current >= 2) {
              next();
              return;
            }
            dropExtraKeepPrimaryRef.current?.("2", "swipe");
          }}
          onSwipeStart={
            friendsOnly
              ? undefined
              : () => {
                  setSearchArmed(true);
                  start();
                }
          }
          swipeSkip={swipeSkipOn}
          swipeNextLabel={t("swipe.next") || t("btn.next") || "Next"}
          swipeStartLabel={t("btn.start") || "Start"}
          // ONE identity only: PartnerIdentityDock top strip (no stage ★/name chip).
          showStagePartnerHud={false}
          blurVeil={
            showPrivacyBlur
              ? {
                  title: t("mobile.live.blurTitle") || "Privacy veil",
                  body:
                    t("mobile.live.blurTapAnywhere") ||
                    t("mobile.live.blurBodyHold") ||
                    "Partner video is hidden. Tap anywhere to show.",
                  buttonLabel:
                    t("mobile.live.unblurReady") ||
                    t("mobile.live.unblur") ||
                    "Show video",
                  hint:
                    t("mobile.live.blurTapAnywhereHint") ||
                    t("mobile.live.blurHint") ||
                    "Tap anywhere to reveal",
                  partnerLabel: partnerBlurLine,
                  ready: !!remoteVideoReady || !!hasRemoteVideo,
                  onUnblur: () => {
                    hapticLight();
                    revealPartnerVideo("veil_unblur");
                    showToastRef.current(
                      t("mobile.live.partnerVideoOn") || "Partner video shown"
                    );
                  },
                }
              : null
          }
        />
        {/* Report FAB removed from stage top-right — lives in LiveBottomBar */}
        <View
          style={[
            styles.overlay,
            { paddingTop: Math.max(insets.top, 8) + 2 },
          ]}
          pointerEvents="box-none"
        >
          <View pointerEvents="box-none">
            {/*
              Matched PartnerChrome is NOT here — Android SurfaceView composites
              above in-stage RN elevation. Root chromeTopOverlay (sibling of
              stage) owns identity/stars for matched. Keep search/idle labels.
            */}
            {uiPhase === "matched" ? null : uiPhase === "search" ? (
              <LiveSearchLabel
                queueAcked={queueAcked}
                alone={alone}
                waiting={waiting}
                online={online}
                searchDots={searchDots}
                searchSecs={searchSecs}
                connected={connected}
                lookingLabel={t("mobile.live.looking")}
                queueJoiningLabel={t("mobile.live.queueJoining")}
                waitLine={t("mobile.live.waitLine", {
                  wait: Math.max(waiting, 1),
                  online: Math.max(online, 1),
                })}
                firstInLineLabel={t("mobile.live.firstInLine")}
                queueInPoolLabel={t("mobile.live.queueInPool", {
                  n: Math.max(waiting - 1, 0),
                })}
                queueConfirmingLabel={t("mobile.live.queueConfirming")}
                reconnectingLabel={t("mobile.live.reconnecting")}
              />
            ) : (
              <View style={styles.stageLabelBlock}>
                <Text style={styles.stageLabel}>
                  {localStream
                    ? t("mobile.live.preview")
                    : t("mobile.live.idle")}
                </Text>
                <Text style={styles.stagePool}>
                  {connected
                    ? t("mobile.live.idleHint", {
                        online: Math.max(online, 0),
                      }) ||
                      (online > 0
                        ? `${online} online · tap Start`
                        : t("mobile.live.idleHintOffline") ||
                          "Tap Start when ready")
                    : t("mobile.live.reconnecting").replace(/^ · /, "") ||
                      "Reconnecting…"}
                </Text>
              </View>
            )}
          </View>
          {/* Steps only while joining queue — hide once looking (less top stack) */}
          {uiPhase === "search" && !queueAcked ? (
            <LiveConnectSteps
              phase={uiPhase}
              queueAcked={queueAcked}
              connectedHub={connected}
              conn={conn}
              hasRemoteVideo={hasRemoteVideo}
              awaitingRemoteVideo={awaitingRemoteVideo}
              labels={{
                queue: t("mobile.live.stepQueue"),
                media: t("mobile.live.stepMedia"),
                video: t("mobile.live.stepVideo"),
              }}
            />
          ) : null}
          {/* peerStrip removed — overlapped dock name/loc (223755Z). Tap tiles. */}
          {/* Build id for smoke — __DEV__ only; release APK has no version chip */}
          {__DEV__ && (uiPhase === "matched" || uiPhase === "search") ? (
            <Text
              style={{
                position: "absolute",
                top: 6,
                right: 8,
                zIndex: 20,
                fontSize: 10,
                opacity: 0.45,
                color: "#c8d0dc",
              }}
              pointerEvents="none"
            >
              {Constants.expoConfig?.version || "?"}
              {Constants.expoConfig?.android?.versionCode
                ? `·${Constants.expoConfig.android.versionCode}`
                : ""}
            </Text>
          ) : null}
          {/* One slim status line: timer + linking. Hide once media is live
              — conn=connecting after first paint was "video then Linking". */}
          {uiPhase === "matched" &&
          !partnerNoCam &&
          !partnerCamHidden &&
          !hasRemoteMedia &&
          (awaitingRemoteVideo ||
            conn === "connecting" ||
            conn === "checking" ||
            conn === "failed" ||
            conn === "disconnected" ||
            showConnRetry ||
            showHardRetry) ? (
            <LiveConnPill
              conn={conn || "connecting"}
              connLabel={connLabel || t("mobile.live.stageConnecting")}
              callTimerText={callTimerText}
              awaitingRemoteVideo={
                (awaitingRemoteVideo || !hasRemoteMedia) &&
                !partnerNoCam &&
                !partnerCamHidden
              }
              connSlow={connSlow}
              linkTier={linkTier}
              linkTierLabel=""
              linkRtt={0}
              linkRelay={false}
              qualityTier=""
              showConnRetry={showConnRetry && !hasRemoteMedia}
              showHardRetry={showHardRetry && !hasRemoteMedia}
              retryBusy={retryBusy}
              turnBadgeLabel=""
              stageWaitVideoLabel={t("mobile.live.stageWaitVideo")}
              stageConnectingLabel={t("mobile.live.stageConnecting")}
              stageFindingPathLabel={t("mobile.live.stageFindingPath")}
              stageTryingRelayLabel={t("mobile.live.stageTryingRelay")}
              connectElapsedSecs={
                matchStartedAt > 0 && !hasRemoteMedia
                  ? Math.floor((nowTick - matchStartedAt) / 1000)
                  : 0
              }
              retryPathLabel={t("mobile.live.retryPath")}
              retryingLabel={t("mobile.live.retrying")}
              rebuildPathLabel={t("mobile.live.rebuildPath")}
              retryHardLabel={t("mobile.live.retryHard")}
              onSoftRetry={() => void retryConnection({ hard: false })}
              onHardRetry={() => void retryConnection({ hard: true })}
            />
          ) : null}
          {/* ★ unlock countdown is easter egg only — double-tap self ★ in gifts
              dock if we re-add peek; default clean stage (no permanent ★ bar). */}
          {!webrtcOk ? (
            <Text style={styles.stageHint}>
              {t("mobile.live.webrtcNeedNative")}
            </Text>
          ) : null}
          {phase === "idle" && lastMatchHint && !friendsOnly ? (
            <Pressable
              style={styles.lastHintCard}
              onPress={start}
              accessibilityRole="button"
              accessibilityLabel={t("btn.start")}
            >
              <Text style={styles.lastHintLabel}>
                {t("mobile.live.lastHintLabel")}
              </Text>
              <Text style={styles.lastHintName} numberOfLines={1}>
                {lastMatchHint.flag ? `${lastMatchHint.flag} ` : ""}
                {lastMatchHint.name || "…"}
                {lastMatchHint.friend_code
                  ? ` · ${lastMatchHint.friend_code}`
                  : ""}
              </Text>
              <Text style={styles.lastHintMeta}>
                {t("mobile.live.lastHintMeta", {
                  time:
                    (lastMatchHint.duration_secs || 0) >= 60
                      ? `${Math.floor((lastMatchHint.duration_secs || 0) / 60)}m`
                      : `${lastMatchHint.duration_secs || 0}s`,
                })}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Partner privacy veil is drawn inside LiveStageVideo (hides clear RTCView). */}

        {(giftFlash || giftEffect) && extraPeers.length < 1 ? (
          <GiftFxOverlay
            effect={giftEffect}
            label={giftFlash}
            barsCaption={
              giftEffect === "bars"
                ? t("mobile.live.giftBars")
                : giftEffect === "pass_mic"
                  ? t("mobile.live.passMicSub")
                  : undefined
            }
          />
        ) : null}

        {mediaBlocked ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>{t("mobile.live.permDeniedTitle")}</Text>
            <Text style={styles.warnBody}>{t("mobile.live.permDeniedBody")}</Text>
            <View style={styles.row}>
              <Pressable style={styles.btnSecondary} onPress={retryMedia}>
                <Text style={styles.btnText}>{t("mobile.live.permRetry")}</Text>
              </Pressable>
              <Pressable
                style={styles.btnGhost}
                onPress={() => Linking.openSettings().catch(() => {})}
              >
                <Text style={styles.btnText}>{t("mobile.live.openSettings")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Real failures only — never idle "not matched" noise */}
        {(phase === "error" ||
          (lastError &&
            phase !== "idle" &&
            phase !== "matched" &&
            !/not matched/i.test(lastError))) ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>{t("mobile.live.errorTitle")}</Text>
            <Text style={styles.warnBody}>
              {lastError && !/not matched/i.test(lastError)
                ? lastError
                : t("mobile.live.errorBody")}
            </Text>
            <Pressable
              style={styles.btnGhost}
              onPress={() => {
                clearLastError();
                if (phase === "error") {
                  setPhase("idle");
                  phaseRef.current = "idle";
                }
              }}
            >
              <Text style={styles.btnText}>{t("mobile.common.ok")}</Text>
            </Pressable>
          </View>
        ) : null}

        <LiveQueueHints
          showLongSearch={
            phase === "search" && searchSecs >= 45 && !showAloneBanner
          }
          showAlone={showAloneBanner}
          friendCode={friendCode || ""}
          inviteUrl={
            friendInviteShareMessage(hubBase(), friendCode || "……", "ruletka")
              .url || hubBase()
          }
          labels={{
            longTitle: t("mobile.live.longSearchTitle", { s: searchSecs }),
            longBody: t("mobile.live.longSearchBody"),
            invite: t("mobile.live.invite"),
            stop: t("btn.stop"),
            aloneTitle: t("friends.aloneInviteTitle"),
            aloneBody: t("friends.aloneInviteBody"),
            yourCode: t("mobile.friends.yourCode"),
            copyLink: t("mobile.live.copyLink"),
            shareInvite: t("mobile.friends.shareInvite"),
          }}
          onInviteShare={() => shareInvite("long_search")}
          onStop={stop}
          onCopyLink={() => {
            const share = friendInviteShareMessage(
              hubBase(),
              friendCode || "……",
              "ruletka"
            );
            Clipboard.setStringAsync(share.url || share.message).catch(
              () => {}
            );
            showToastRef.current(t("mobile.friends.codeCopied"));
          }}
          onShareInvite={() => shareInvite("alone")}
        />

        <LiveChatOverlay
          visible={uiPhase === "matched" && (chat.length > 0 || peerTyping)}
          // No "Say hi in chat…" — that corner is the call timer on partner video
          showEmptyHint={false}
          chat={chat}
          peerTyping={peerTyping}
          scrollRef={chatScrollRef}
          sayHiLabel=""
          typingLabel={t("mobile.chat.typing")}
          youLabels={[
            t("mobile.chat.you") || "you",
            t("mobile.chat.youP2p") || "you",
            "you",
          ]}
          style={isBrowserLayout ? styles.chatOverlayBrowser : undefined}
          emptyHintStyle={
            isBrowserLayout ? styles.chatEmptyHintBrowser : undefined
          }
          onCopyLine={(body) => {
            void Clipboard.setStringAsync(body).then(() => {
              showToastRef.current(t("mobile.chat.copied"));
              hapticLight();
            });
          }}
        />

        <LiveDebateChrome
          debate={debate}
          debateISpeak={debateISpeak}
          debateUrgent={debateUrgent}
          debateRound={debateRound}
          debateTimerText={debateTimerText}
          debateProgress={debateProgress}
          partnerName={partner}
          dcOpen={dcOpen}
          composeOpen={debateComposeOpen}
          topicDraft={debateTopicDraft}
          turnSecs={debateTurnSecs}
          onPass={() => debateRef.current?.passTurn()}
          onEnd={() =>
            debateRef.current?.end({ notify: true, reason: "user" })
          }
          onDeclineIncoming={() => debateRef.current?.declineIncoming()}
          onAcceptIncoming={() => debateRef.current?.acceptIncoming()}
          onCloseCompose={() => setDebateComposeOpen(false)}
          onSendInvite={sendDebateInvite}
          onTopicChange={setDebateTopicDraft}
          onTurnSecs={setDebateTurnSecs}
          labels={{
            badge: t("debate.badge"),
            round: (n) => t("debate.round", { n }),
            yourTurn: (n) => t("debate.yourTurnRoundShort", { n }),
            theirTurn: (n, name) =>
              t("debate.theirTurnRoundShort", { n, name }),
            pass: t("debate.pass"),
            waitTurn: t("debate.waitTurn"),
            end: t("debate.end"),
            incomingTitle: t("debate.incomingTitle"),
            incomingBody: (n, s) => t("debate.incomingBody", { n, s }),
            incomingMeta: (s) => t("debate.incomingMeta", { s }),
            decline: t("debate.decline"),
            accept: t("debate.accept"),
            composeTitle: t("debate.composeTitle"),
            composeHint: t("debate.composeHint"),
            turnLength: t("debate.turnLength"),
            turnSecondsOption: (s) => t("debate.turnSecondsOption", { s }),
            topicLabel: t("debate.topicLabel"),
            topicPlaceholder: t("debate.topicPlaceholder"),
            cancel: t("mobile.common.cancel"),
            sendInvite: t("debate.sendInvite"),
            waitingAccept: t("debate.waitingAccept"),
            needP2p: t("debate.needP2p"),
          }}
        />

        {statusFlash ? (
          <View style={styles.statusFlash} pointerEvents="none">
            <Text style={styles.statusFlashText}>{statusFlash}</Text>
          </View>
        ) : null}
      </View>

      {/*
        ONLY partner identity + mute/blur status at top mid-match.
        Root-level absolute sibling of stage (not nested under RTCView) —
        sits just under the system status bar. Sound warnings (theyMutedMe /
        partnerMuted / optional blur) stack under the identity strip — NOT
        between timer and Stop bar. Single mute surface (no stage duplicates).
      */}
      {uiPhase === "matched" ? (
        <View
          pointerEvents="box-none"
          collapsable={false}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            // Beat SurfaceView punch-through so mute text stays readable
            elevation: 30,
          }}
        >
          {extraPeers.length < 1 ? (
          <PartnerIdentityDock
            placement="top"
            style={{
              // Parent owns the absolute frame; dock is a column child
              position: "relative",
              top: 0,
              left: 0,
              right: 0,
              // Tight under clock/battery — Pixel 9 status bar ~48; was a full inset gap
              paddingTop: Math.max(insets.top - 10, 0),
            }}
            name={partnerIdName}
            nameFallback={partnerIdNameFallback}
            friendCode={
              partnerIdFriendCode && !isHexIdLike(partnerIdFriendCode)
                ? partnerIdFriendCode
                : ""
            }
            code={partnerIdFriendCode || ""}
            stars={partnerStars}
            trust={partnerTrust}
            displayStars={partnerDisplayStars}
            flag={partnerFlag}
            country={partnerCountry}
            city={partnerCity}
            hideIp={partnerHideIp}
            avatar={partnerAvatar}
            avatarReady={
              hasRemoteMedia || remoteVideoReady || partnerNoCam
            }
            showStars={true}
            onLongPress={copyPartnerIdentity}
            onGiftStar={() => spend("shooting_star", 3)}
          />
          ) : null}
          {reconnectSnap ? (
            <View
              pointerEvents="none"
              accessibilityLiveRegion="polite"
              style={{
                marginHorizontal: 10,
                marginTop: 6,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 11,
                backgroundColor: "rgba(18, 28, 48, 0.92)",
                borderWidth: 1,
                borderColor: "rgba(130, 180, 255, 0.7)",
              }}
            >
              <Text
                style={{
                  color: "#fff4f2",
                  fontWeight: "800",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                {reconnectBanner}
              </Text>
            </View>
          ) : null}
          <LiveStatusBanners
            placement="top"
            theyMutedMe={theyMutedMe}
            partnerMuted={partnerMuted}
            remoteBlurred={remoteBlurred}
            showBlurBanner={false}
            theyMutedLabel={
              t("mobile.live.theyMutedYou") || "They muted you · no sound"
            }
            partnerMutedLabel={
              t("mobile.live.youMutedThem") || "You muted · no sound"
            }
            blurredLabel={t("mobile.live.blurTitle") || "Privacy veil on"}
            unblurLabel={t("mobile.live.unblur") || "Show video"}
            onUnblur={() => {
              hapticLight();
              revealPartnerVideo("banner_unblur");
              showToastRef.current(
                t("mobile.live.partnerVideoOn") || "Partner video shown"
              );
            }}
          />
        </View>
      ) : null}

      {findThirdIncoming ? (
        <View
          pointerEvents="auto"
          style={{
            ...StyleSheet.absoluteFillObject,
            zIndex: 2000,
            elevation: 2000,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "flex-start",
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(12,22,20,0.98)",
              borderRadius: 20,
              padding: 20,
              borderWidth: 1.5,
              borderColor: "rgba(80,220,140,0.55)",
              gap: 8,
            }}
          >
            <Text style={{ color: "#e8eef7", fontSize: 18, fontWeight: "800" }}>
              {t("mobile.party.findThirdTitle")}
            </Text>
            <Text style={{ color: "#c5d0e0", fontSize: 15 }}>
              {findThirdIncoming.from_name || "Partner"}
            </Text>
            <Text style={{ color: "#9ec5ff", fontSize: 13 }}>
              {t("mobile.party.findThirdBody")}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TapPressable
                style={{
                  flex: 1,
                  backgroundColor: "#3a2230",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                onPressIn={() => {
                  try {
                    hub.findThirdRespond(false);
                  } catch {
                    /* ignore */
                  }
                  clearFindThirdIncoming();
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {t("friends.decline")}
                </Text>
              </TapPressable>
              <TapPressable
                style={{
                  flex: 1,
                  backgroundColor: "#2d9f6f",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                onPressIn={() => {
                  try {
                    hub.findThirdRespond(true);
                  } catch {
                    /* ignore */
                  }
                  clearFindThirdIncoming();
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {t("mobile.party.findThirdAccept")}
                </Text>
              </TapPressable>
            </View>
          </View>
        </View>
      ) : null}

      <View
        style={
          isBrowserLayout
            ? [
                styles.browserDock,
                { paddingBottom: Math.max(insets.bottom, 10) },
              ]
            : [styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]
        }
      >
        {/* Call timer is on partner video (bottom-left), not above Stop bar */}
        <LiveBottomBar
          phase={uiPhase}
          hideIdleStart={!friendsOnly}
          searchArmed={searchArmed}
          friendsOnly={friendsOnly}
          isFriendCall={isFriendCall}
          stayRemSecs={stayRemSecs}
          nextGraceRemSecs={Math.max(
            0,
            Math.ceil((nextGraceUntilRef.current - nowTick) / 1000)
          )}
          micOn={micOn}
          camOn={camOn}
          hasLocal={!!localStream}
          partnerMuted={partnerMuted}
          remoteBlurred={remoteBlurred}
          moreOpen={moreOpen}
          debateActive={debate.active}
          debateISpeak={debateISpeak}
          labels={{
            start: t("btn.start"),
            next: t("btn.next"),
            nextHint:
              t("swipe.hint") ||
              "Skip to next · swipe partner video left or right",
            stayNext: (s) => t("mobile.live.stayNext", { s }),
            stayLock: (s) => t("mobile.live.stayLock", { s }),
            nextGrace: (s) => t("mobile.live.nextGraceBtn", { s }),
            stop: t("btn.stop"),
            hangup: t("friends.hangup"),
            report: `⚑ ${t("mobile.live.reportFab") || t("mobile.live.report") || "Report"}`,
            micOn: t("mobile.live.micOn"),
            micOff: t("mobile.live.micOff"),
            camOn: t("mobile.live.camOn"),
            camOff: t("mobile.live.camOff"),
            camOffHint: t("mobile.live.camOffHint"),
            youMutedBadge: t("debate.youMutedBadge"),
            flipCam: t("btn.flipCam"),
            partnerMuteShort: t("mobile.live.partnerMuteShort"),
            partnerUnmuteShort: t("mobile.live.partnerUnmuteShort"),
            blurShort: t("mobile.live.blurShort") || "Blur partner",
            unblurShort: t("mobile.live.unblurShort") || "Show video",
            more: t("mobile.live.more"),
            cancel: t("mobile.common.cancel"),
            invite: t("mobile.live.invite"),
            friends: t("mobile.nav.friends"),
            friendsMenuTitle: t("mobile.nav.friends"),
            friendsOnlyHint: t("mobile.live.friendsOnlyHint"),
            settings: t("mobile.nav.settings") || "Settings",
          }}
          onStart={() => {
            setSearchArmed(true);
            start();
          }}
          onNext={next}
          onStop={stop}
          onReport={() => {
            hapticLight();
            setMoreOpen(false);
            void openReport();
          }}
          onToggleMic={toggleMic}
          onFlipCam={() => {
            hapticLight();
            void mediaRef.current?.flipCamera().then(() => {
              showToastRef.current(t("mobile.live.camFlipped"));
            });
          }}
          onTogglePartnerMute={togglePartnerMute}
          onToggleBlur={togglePartnerBlur}
          onToggleMore={() => {
            hapticLight();
            setActionSlot("primary");
            actionSlotRef.current = "primary";
            setMoreOpen((v) => !v);
          }}
          onInvite={() => shareInvite("live")}
          onOpenFriends={() => {
            hapticLight();
            router.push("/friends");
          }}
          onOpenSettings={() => {
            hapticLight();
            setMoreOpen(false);
            router.push("/settings");
          }}
        />
        {logUnlocked ? (
          <Pressable onPress={() => setShowLog((v) => !v)}>
            <Text style={styles.logToggle}>
              {showLog ? t("mobile.live.hideLog") : t("mobile.live.showLog")}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {uiPhase === "matched" && moreOpen ? (
          <LiveMoreSheet
            onClose={() => setMoreOpen(false)}
            actionSlot={actionSlot}
            selectedName={
              actionSlot === "extra1"
                ? extraTileChrome[1]?.name ||
                  extraPeers[1]?.name ||
                  t("mobile.live.actionsFor", {
                    name: t("mobile.live.peer3") || "…",
                  })
                : actionSlot === "extra0"
                  ? extraTileChrome[0]?.name ||
                    extraPeers[0]?.name ||
                    t("mobile.live.actionsFor", {
                      name: t("mobile.live.peer2") || "…",
                    })
                  : partnerIdName ||
                    t("mobile.live.partnerActions") ||
                    "Partner actions"
            }
            gifts={GIFTS}
            stars={stars}
            starReady={starReady}
            starProgress={starProgress}
            needMin={needMin}
            elapsedSecs={elapsedSecs}
            giftsTitle={t("mobile.live.giftsTitle") || "Gifts"}
            onSpend={(id, cost) => {
              spend(id, cost);
              if (id === "please_stay") setMoreOpen(false);
            }}
            onCantAfford={(cost, have) =>
              showToastRef.current(
                t("mobile.live.needStars", { cost, stars: have }) ||
                  `Need ${cost}★`
              )
            }
            chatDraft={chatDraft}
            onChatDraftChange={onChatDraftChange}
            onSendChat={sendChat}
            isFriendCall={isFriendCall}
            remoteBlurred={remoteBlurred}
            extraPeerCount={extraPeers.length}
            matchMode={matchMode}
            findThirdPending={findThirdPending}
            dataSaverOn={dataSaverOn}
            earpiece={earpiece}
            debateActive={debate.active}
            debatePending={String(debate.pending || "")}
            dcOpen={dcOpen}
            canAddFriend={canAddFriend}
            labels={{
              partnerUnmute: t("mobile.live.partnerUnmute"),
              partnerMute: t("mobile.live.partnerMute"),
              unblur: t("mobile.live.unblur"),
              reblur: t("mobile.live.reblur"),
              browseTogether: t("mobile.party.browseTogether"),
              findThirdCancel: t("mobile.party.findThirdCancel"),
              findThird: t("mobile.party.findThird"),
              inviteFriend: t("mobile.party.inviteFriend"),
              inviteFourth:
                t("mobile.party.inviteFourth") || "Invite a friend (4th)",
              flipCam: t("btn.flipCam"),
              dataSaverOn: t("mobile.settings.dataSaverOn"),
              dataSaver: t("mobile.settings.dataSaver"),
              layoutNative:
                t("mobile.settings.liveLayoutUseNative") ||
                "Use native call layout",
              layoutBrowser:
                t("mobile.settings.liveLayoutUseBrowser") ||
                "Use browser-style layout",
              speakerOn: t("mobile.live.speakerOn"),
              earpieceOn: t("mobile.live.earpieceOn"),
              debateEnd: t("debate.end"),
              debateCancelInvite: t("debate.cancelInvite"),
              debateInvite: t("debate.invite"),
              debateNeedP2p: t("debate.needP2p"),
              addFriend: t("mobile.live.addFriend"),
              report: t("mobile.live.blockReport"),
              send: t("mobile.common.send") || "Send",
              chatPlaceholder: t("mobile.chat.placeholder") || "Message…",
              cancel: t("mobile.common.cancel") || "Close",
              pleaseStay: `${
                t("stars.pleaseStayBtn") !== "stars.pleaseStayBtn"
                  ? t("stars.pleaseStayBtn")
                  : "Please stay"
              } · 30★`,
            }}
            onBrowseTogether={() => {
              setMoreOpen(false);
              browseTogether();
            }}
            onFindThirdToggle={() => {
              setMoreOpen(false);
              if (findThirdPending) cancelFindThird();
              else findThirdInvite();
            }}
            onInviteFriend={() => {
              setMoreOpen(false);
              try {
                router.push("/friends");
              } catch {
                /* ignore */
              }
            }}
            onToggleDataSaver={() => {
              loadMatchPrefs().then(async (prefs) => {
                const next = !prefs.dataSaver;
                await saveMatchPrefs({ ...prefs, dataSaver: next });
                mediaRef.current?.setDataSaver(next);
                media2Ref.current?.setDataSaver(next);
                media3Ref.current?.setDataSaver(next);
                setDataSaverOn(next);
                await mediaRef.current?.reapplyLocalVideoConstraints();
                showToastRef.current(
                  next
                    ? t("mobile.settings.dataSaverOn")
                    : t("mobile.settings.dataSaverOff")
                );
              });
              setMoreOpen(false);
            }}
            onToggleEarpiece={async () => {
              const next = !earpiece;
              setEarpiece(next);
              try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Audio } = require("expo-av") as {
                  Audio: {
                    setAudioModeAsync: (m: object) => Promise<void>;
                    InterruptionModeAndroid: { DuckOthers: number };
                    InterruptionModeIOS: { MixWithOthers: number };
                  };
                };
                await Audio.setAudioModeAsync({
                  allowsRecordingIOS: true,
                  playsInSilentModeIOS: true,
                  shouldDuckAndroid: true,
                  playThroughEarpieceAndroid: next,
                  interruptionModeAndroid:
                    Audio.InterruptionModeAndroid.DuckOthers,
                  interruptionModeIOS: Audio.InterruptionModeIOS.MixWithOthers,
                });
                showToastRef.current(
                  next
                    ? t("mobile.live.earpieceOn")
                    : t("mobile.live.speakerOn")
                );
              } catch {
                void setAudioSession("call");
              }
              setMoreOpen(false);
            }}
            onDebate={() => {
              setMoreOpen(false);
              onDebateInvitePress();
            }}
            onAddFriend={() => {
              setMoreOpen(false);
              addPartnerFriend();
            }}
            onReport={() => {
              setMoreOpen(false);
              openReport();
            }}
          />
        ) : null}

      <ReportSheet
        visible={reportOpen}
        partnerLabel={partnerIdName || partnerIdNameFallback || "…"}
        screenshotUri={reportShotUri}
        capturing={reportCapturing}
        busy={reportBusy}
        t={t}
        onCancel={closeReport}
        onBlockOnly={doBlockOnly}
        onSubmit={doReport}
      />

      {showLog && logUnlocked ? (
        <View style={styles.log}>
          {log.map((line, i) => (
            <Text key={`${i}-${line.slice(0, 16)}`} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <StarGiftPopup
        visible={!!starGiftPop}
        title={starGiftPop?.title || ""}
        sub={starGiftPop?.sub}
      />
      <DebateIncomingOverlay
        visible={debate.pending === "in"}
        partnerName={partnerIdName || partnerIdNameFallback || "Partner"}
        turnSecs={debate.composeTurnSecs || 30}
        topic={debate.topic || ""}
        onDecline={() => debateRef.current?.declineIncoming()}
        onAccept={() => debateRef.current?.acceptIncoming()}
        labels={{
          incomingTitle: t("debate.incomingTitle"),
          incomingBody: (n, s) => t("debate.incomingBody", { n, s }),
          incomingMeta: (s) => t("debate.incomingMeta", { s }),
          decline: t("debate.decline"),
          accept: t("debate.accept"),
        }}
      />

    </KeyboardAvoidingView>
  );
}

