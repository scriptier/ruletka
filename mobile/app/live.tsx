import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import Constants from "expo-constants";
import { Redirect, router, useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
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
import {
  formatPartnerSummary,
  PartnerChrome,
} from "../src/identity/PartnerChrome";
import { formatLocLine } from "../src/identity/flagTrust";
import { hubBase, isFriendsOnly } from "../src/config";
import {
  hapticDebateTurn,
  hapticDebateUrgent,
  hapticLight,
  hapticMatch,
  hapticMedium,
} from "../src/feedback/haptics";
import { useHub } from "../src/hub/HubProvider";
import type { MatchPeer, ServerMatched, ServerMsg } from "../src/hub/types";
import { useI18n, useT } from "../src/i18n";
import { friendInviteShareMessage } from "../src/linking/friendInvite";
import {
  LiveBottomBar,
  LiveChatOverlay,
  LiveConnectSteps,
  LiveConnPill,
  PartnerBlurVeil,
  LiveDebateChrome,
  LiveGiftBar,
  LiveMetaStrip,
  LiveMoreSheet,
  LiveQueueHints,
  LiveSearchLabel,
  LiveStageVideo,
  LiveStatusBanners,
  QUEUE_CONFIRM_DELAYS_MS,
  SPIN_KEEPALIVE_MS,
  computeMatchContinuity,
  elapsedSince,
  floorQueueCounts,
  formatCallTimer,
  liveStyles as styles,
  normalizePeer,
  pickPeer,
  pickPrimaryPeerIndex,
  reduceLobbyInfoMsg,
  reduceStatusMsg,
  starNeedMinutes,
  starProgress as starProgressOf,
  useBackgroundMediaPause,
  useSearchPulse,
  type LivePhase,
  type PeerPick,
} from "../src/live";
import {
  DebateSession,
  debateRoundNumber,
  formatDebateTimer,
  idleDebateSnapshot,
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
  playMatchChime,
  playTurnChime,
  playUrgentChime,
  preloadUiSounds,
} from "../src/feedback/sounds";
import * as Clipboard from "expo-clipboard";
import { useApp } from "./_layout";

/**
 * Stranger chats shorter than this auto-requeue (Next) when the partner leaves.
 * Explicit Stop still ends search. Friend calls never auto-search.
 */
/** Partner left before this → auto keep searching (unless bounce under MIN). */
const SHORT_CALL_AUTO_NEXT_SECS = 5 * 60;
/** Don't auto-requeue pure thrash bounces (0–2s) — those never get media and loop. */
const SHORT_CALL_AUTO_NEXT_MIN_SECS = 3;

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
    addMessageListener,
    connected,
    lastError,
    clearLastError,
    friends,
    showToast,
    offerRatePrompt,
    setLiveBusy,
    reconnectHub,
    outboundCall,
  } = useHub();
  const mediaRef = useRef<MediaSession | null>(null);
  /** Second PC for multi-peer (party / 1v2) — shares primary local stream. */
  const media2Ref = useRef<MediaSession | null>(null);
  const debateRef = useRef<DebateSession | null>(null);
  const stageRef = useRef<View>(null);
  const remotePeerId = useRef<string>("");
  const secondaryPeerId = useRef<string>("");
  const partnerUserId = useRef<string>("");
  const partnerFriendCode = useRef<string>("");
  const partnerNameRef = useRef<string>("");
  /** Last known partner ids for report/block (survives thrash rematch empty uid). */
  const lastPartnerIdsRef = useRef<{
    userId: string;
    peerId: string;
    friendCode: string;
    shortId: string;
  }>({ userId: "", peerId: "", friendCode: "", shortId: "" });
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
  const [findThirdPending, setFindThirdPending] = useState(false);
  /** Extra match peers (beyond primary) for multi-tile UI. */
  const [extraPeers, setExtraPeers] = useState<PeerPick[]>([]);
  /** When multi: show secondary peer in the top tile (tap to swap focus). */
  const [focusExtra, setFocusExtra] = useState(false);
  const [dataSaverOn, setDataSaverOn] = useState(false);
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
  /** @deprecated use blurModeRef — kept for any leftover true checks */
  const blurStrangersRef = useRef(true);
  // Default off until prefs load (media-first). Eye toggles mid-call.
  const blurModeRef = useRef<BlurStrangersMode>("off");
  const blurPrefsReadyRef = useRef(false);
  const introUnblurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  /** Intro veil: brief soft cover after partner frames, then auto-reveal. */
  const INTRO_UNBLUR_MS = 2800;

  const clearIntroUnblurTimer = useCallback(() => {
    if (introUnblurTimerRef.current) {
      clearTimeout(introUnblurTimerRef.current);
      introUnblurTimerRef.current = null;
    }
  }, []);

  /**
   * Drop privacy veil. Avoid remount spam (CONNECTIVITY_LOCK: one paint).
   * Only forceRepaint if still no frames after unblur.
   */
  const revealPartnerVideo = useCallback(
    (why: string) => {
      clearIntroUnblurTimer();
      setRemoteBlurred(false);
      remoteBlurredRef.current = false;
      push(`blur off (${why})`);
      // Re-mount partner RTCView after privacy unmount (Android SurfaceView).
      // Always epoch-bump once — no 150/500 remount ladder.
      setRemoteEpoch((n) => n + 1);
      try {
        mediaRef.current?.forceRepaintRemote?.(why);
      } catch {
        /* ignore */
      }
    },
    [clearIntroUnblurTimer, push]
  );

  /** Schedule intro auto-reveal only after partner video is actually painting. */
  const scheduleIntroUnblur = useCallback(() => {
    if (blurModeRef.current !== "intro") return;
    if (!remoteBlurredRef.current) return;
    clearIntroUnblurTimer();
    const tick = (delay: number) => {
      introUnblurTimerRef.current = setTimeout(() => {
        introUnblurTimerRef.current = null;
        if (phaseRef.current !== "matched") return;
        if (!remoteBlurredRef.current) return;
        if (blurModeRef.current !== "intro") return;
        // Do not peel the veil onto a black stage — wait for frames
        const frames =
          !!remoteVideoSeenRef.current ||
          !!mediaRef.current?.hasInboundVideoFrames?.();
        if (!frames) {
          push("blur intro wait frames");
          tick(1200);
          return;
        }
        revealPartnerVideo("intro_auto");
        try {
          showToastRef.current(tRef.current("mobile.live.partnerVideoOn"));
        } catch {
          /* ignore */
        }
      }, delay);
    };
    tick(INTRO_UNBLUR_MS);
  }, [clearIntroUnblurTimer, revealPartnerVideo, push]);

  /**
   * Auto privacy veil for stranger matches (prefs intro/hold).
   * Friends never auto-veil; eye toggle still works for everyone mid-call.
   */
  const applyMatchBlurVeil = useCallback(
    (why: string, opts?: { isFriend?: boolean }) => {
      if (phaseRef.current !== "matched") return;
      const isFriend =
        !!opts?.isFriend || matchModeRef.current === "friend";
      if (isFriend) return;
      const mode = blurModeRef.current || "intro";
      if (mode !== "hold" && mode !== "intro") return;
      if (remoteBlurredRef.current) {
        if (mode === "intro") scheduleIntroUnblur();
        return;
      }
      clearIntroUnblurTimer();
      setRemoteBlurred(true);
      remoteBlurredRef.current = true;
      push(`blur on (${why}) mode=${mode}`);
      if (mode === "intro") scheduleIntroUnblur();
    },
    [clearIntroUnblurTimer, scheduleIntroUnblur, push]
  );

  /** Eye / more-sheet: toggle privacy veil (strangers + friends). */
  const togglePartnerBlur = useCallback(() => {
    hapticLight();
    if (remoteBlurredRef.current) {
      revealPartnerVideo("toggle_unblur");
      showToastRef.current(
        t("mobile.live.partnerVideoOn") || "Partner video shown"
      );
      return;
    }
    clearIntroUnblurTimer();
    setRemoteBlurred(true);
    remoteBlurredRef.current = true;
    push("blur on (toggle)");
    showToastRef.current(
      t("mobile.live.reblurToast") ||
        "Privacy veil — tap Show video when ready"
    );
  }, [clearIntroUnblurTimer, revealPartnerVideo, push, t]);
  const [matchMode, setMatchModeState] = useState("");
  const setMatchMode = useCallback((m: string) => {
    matchModeRef.current = m;
    setMatchModeState(m);
  }, []);
  const [conn, setConn] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStreamLike | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStreamLike | null>(
    null
  );
  const [remoteStream2, setRemoteStream2] = useState<MediaStreamLike | null>(
    null
  );
  const [remoteEpoch, setRemoteEpoch] = useState(0);
  const [remoteEpoch2, setRemoteEpoch2] = useState(0);
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCapturing, setReportCapturing] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportShotUri, setReportShotUri] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [debate, setDebate] = useState<DebateSnapshot>(() => idleDebateSnapshot());
  const [debateComposeOpen, setDebateComposeOpen] = useState(false);
  const [debateTopicDraft, setDebateTopicDraft] = useState("");
  const [debateTurnSecs, setDebateTurnSecs] = useState(30);
  const [dcOpen, setDcOpen] = useState(false);
  const [statusFlash, setStatusFlash] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [connSince, setConnSince] = useState(0);
  const [retryBusy, setRetryBusy] = useState(false);
  const [awaitingRemoteVideo, setAwaitingRemoteVideo] = useState(false);
  /** Adaptive outbound quality label (high|mid|low|min). */
  const [qualityTier, setQualityTier] = useState("");
  const [swapViews, setSwapViews] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 320, h: 480 });
  const [pipHint, setPipHint] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);
  const [earpiece, setEarpiece] = useState(false);
  const lastDebateSpeakerRef = useRef("");
  const lastDebateUrgentRef = useRef(false);
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

  const flashStatus = useCallback((line: string) => {
    setStatusFlash(line);
    push(line);
  }, [push]);

  useEffect(() => {
    if (!statusFlash) return;
    const t = setTimeout(() => setStatusFlash(null), 3200);
    return () => clearTimeout(t);
  }, [statusFlash]);

  // Keep phase/partner name in refs for debate callbacks
  phaseRef.current = phase;
  partnerNameRef.current = partner;
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

  // Friends screen uses liveBusy to switch Call → Invite (join mesh)
  useEffect(() => {
    setLiveBusy(phase === "matched");
    return () => setLiveBusy(false);
  }, [phase, setLiveBusy]);

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
    const log = (line: string) => pushRef.current(line);

    const applyMicDesired = () => {
      if (debateMicLockedRef.current) {
        media.setMicEnabled(false);
        media2.setMicEnabled(false);
      } else {
        media.setMicEnabled(micOnRef.current);
        media2.setMicEnabled(micOnRef.current);
      }
    };

    const debate = new DebateSession({
      send: (msg) => media.sendDataMessage(msg),
      myUserId: () => userIdRef.current || "",
      myName: () => displayNameRef.current || "anon",
      partnerUserId: () => partnerUserId.current || "",
      partnerName: () => partnerNameRef.current || "Partner",
      isMatched: () => phaseRef.current === "matched",
      isDcOpen: () => media.isDataChannelOpen(),
      onStatus: (key) => {
        flashRef.current(resolveDebateStatus(key));
      },
      onMicLock: (lockedMute) => {
        debateMicLockedRef.current = lockedMute;
        applyMicDesired();
      },
      onChange: (snap) => {
        // Haptics on speaker change / urgent last 5s
        if (snap.active) {
          if (
            snap.speakerId &&
            snap.speakerId !== lastDebateSpeakerRef.current
          ) {
            if (lastDebateSpeakerRef.current) {
              hapticDebateTurn();
              void playTurnChime();
            }
            lastDebateSpeakerRef.current = snap.speakerId;
            lastDebateUrgentRef.current = false;
          }
          const urgent = snap.remMs > 0 && snap.remMs <= 5000;
          if (urgent && !lastDebateUrgentRef.current) {
            lastDebateUrgentRef.current = true;
            hapticDebateUrgent();
            void playUrgentChime();
          }
          if (!urgent) lastDebateUrgentRef.current = false;
        } else {
          lastDebateSpeakerRef.current = "";
          lastDebateUrgentRef.current = false;
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
      },
      onRemoteStream: (s) => {
        setRemoteStream(s);
        setRemoteEpoch((n) => n + 1);
        const vt = s.getVideoTracks?.()?.length ?? 0;
        const at = s.getAudioTracks?.()?.length ?? 0;
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
        if (vt > 0 || at > 0) {
          setAwaitingRemoteVideo(vt === 0);
          if (vt > 0) {
            setConn("connected");
            setConnSince(0);
          }
          if (vt > 0 && !remoteVideoSeenRef.current) {
            remoteVideoSeenRef.current = true;
            setRemoteVideoReady(true);
            hapticMatch();
          }
          if (remoteBlurredRef.current && vt > 0) {
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
        // Never flip UI back to "Linking…" if video track already exists
        // (ice_restart / checking after ontrack made connect feel stuck).
        if (liveVt > 0 && !s.startsWith("quality_tier")) {
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
          // Don't re-arm "waiting for video" if we already have a video track
          // (connectionState can fire after ontrack and blank the UI again).
          setAwaitingRemoteVideo(liveVt === 0);
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
          // Visible stopwatch: CONNECT offer=X answer=Y frame=Zms
          log(s);
          try {
            showToastRef.current(s.replace(/^CONNECT\s+/, "Link "));
          } catch {
            /* ignore */
          }
          // Persist for Settings "Last connect" polish
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
          // Audio-only so far — keep waiting indicator, stay "connecting" soft
          if (liveVt > 0) setAwaitingRemoteVideo(false);
        } else if (s.startsWith("no_remote_video_retry")) {
          if (liveVt === 0) {
            setAwaitingRemoteVideo(true);
            setConn("connecting");
            setConnSince((t0) => t0 || Date.now());
          }
        } else if (s === "failed" || s === "disconnected" || s === "closed") {
          setConn(s);
          if (s === "failed" || s === "disconnected") {
            setConnSince((t0) => t0 || Date.now());
          }
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
        log(
          `ice ${s} turn=${iceHasTurnRef.current ? "yes" : "no"}`
        );
        if (s === "failed" || s === "disconnected") {
          log(
            `path hint: if phone↔browser stuck, need TURN (has_turn=${iceHasTurnRef.current})`
          );
        }
      },
      onDataChannel: (open) => {
        setDcOpen(open);
        log(`datachannel ${open ? "open" : "closed"}`);
        // Re-announce mute state when DC opens (muted before channel ready)
        if (open) {
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
            const mutedVal = msg.muted;
            const on =
              mutedVal === true ||
              mutedVal === 1 ||
              mutedVal === "1" ||
              mutedVal === "true";
            applyTheyMutedMeRef.current(on, "p2p_dc");
            return;
          }
          if (typ === "chat" || typ === "friend_chat") {
            const body = String(msg.body || "").trim().slice(0, 280);
            if (!body) return;
            const fromUid = String(msg.user_id || "").trim();
            if (fromUid) notePartnerUserId(fromUid, "chat");
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
    media2.setHandlers({
      onRemoteStream: (s) => {
        setRemoteStream2(s);
        setRemoteEpoch2((n) => n + 1);
        try {
          s.getAudioTracks?.().forEach((tr) => {
            tr.enabled = !partnerMutedRef.current;
          });
        } catch {
          /* ignore */
        }
        const vt = s.getVideoTracks?.()?.length ?? 0;
        const at = s.getAudioTracks?.()?.length ?? 0;
        log(`remote2 stream tracks a=${at} v=${vt}`);
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
      },
      onIceConnectionState: (s) => {
        log(`ice2 ${s}`);
      },
      onError: (e) => {
        log(`media2 ${e.message}`);
      },
    });

    loadMatchPrefs().then((prefs) => {
      media.setHideIp(prefs.hideIp);
      media.setDataSaver(!!prefs.dataSaver);
      media2.setHideIp(prefs.hideIp);
      media2.setDataSaver(!!prefs.dataSaver);
      setDataSaverOn(!!prefs.dataSaver);
      setLiveLayout(
        prefs.liveLayout === "browser" ? "browser" : "native"
      );
      const mode = prefs.blurStrangersMode || "off";
      blurModeRef.current = mode;
      blurStrangersRef.current = mode !== "off";
      blurPrefsReadyRef.current = true;
      log(`blur prefs mode=${mode}`);
      // Prefs arrived after match: apply veil if still stranger-matched
      if (phaseRef.current === "matched" && mode !== "off") {
        applyMatchBlurVeil("prefs_load");
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
          };
          if (m.rate_min_secs != null) {
            const secs = Math.max(60, Math.floor(Number(m.rate_min_secs) || 900));
            setRateMinSecs(secs);
            rateMinSecsRef.current = secs;
          }
          break;
        }
        case "partner_geo": {
          // Late hub geo after match — refresh partner chrome (was "Location unknown")
          const g = msg as {
            peer_id?: string;
            user_id?: string;
            country?: string;
            city?: string;
            flag?: string;
            hide_ip?: boolean;
          };
          const pid = String(g.peer_id || "");
          const primary = remotePeerId.current || "";
          const uid = String(g.user_id || "");
          const isPrimary =
            (pid && primary && pid === primary) ||
            (uid &&
              partnerUserId.current &&
              uid.toLowerCase() === partnerUserId.current.toLowerCase()) ||
            // 1v1: accept if we only have one partner and ids match short form
            (pid && primary && pid.slice(0, 8) === primary.slice(0, 8));
          if (!isPrimary && phaseRef.current === "matched") {
            // Still apply when no peer_id match but we're 1v1 (legacy)
            if (primary && primary !== "legacy" && pid && pid !== primary) {
              log(
                `partner_geo skip pid=${pid.slice(0, 8)} primary=${primary.slice(0, 8)}`
              );
              break;
            }
          }
          if (g.flag != null) setPartnerFlag(String(g.flag || "").toUpperCase());
          if (g.country != null) setPartnerCountry(String(g.country || ""));
          if (g.city != null) setPartnerCity(String(g.city || ""));
          if (g.hide_ip != null) setPartnerHideIp(!!g.hide_ip);
          log(
            `partner_geo ${String(g.flag || "")} ${String(g.country || "")}/${String(g.city || "")} hide=${g.hide_ip ? 1 : 0}`
          );
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
          const leaveDetail =
            /partner hit Next|partner disconnected|party moved on|partner blocked you|restricted due to reports|restricted by operator/i.test(
              detailRaw
            );
          const partnerLeft =
            phaseRef.current === "matched" &&
            !stillChatting &&
            leaveDetail &&
            (hubPhase === "idle" ||
              hubPhase === "waiting" ||
              hubPhase === "matched");
          if (partnerLeft) {
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
              matchModeRef.current !== "friend" &&
              !isFriendsOnly() &&
              chatSecs >= SHORT_CALL_AUTO_NEXT_MIN_SECS &&
              chatSecs < SHORT_CALL_AUTO_NEXT_SECS;
            // Hub already requeues the leaver; only auto-spin the abandoned side
            // when it was a real short chat (not a 0s thrash bounce).
            const requeue = hubRequeue || shortCallAutoNext;
            try {
              media2.closeCall({ keepLocal: true, sendBye: false });
              media.closeCall({ keepLocal: true, sendBye: false });
            } catch {
              /* ignore */
            }
            setRemoteStream(null);
            setRemoteStream2(null);
            setExtraPeers([]);
            setPartner("");
            setPartnerCode("");
            setPartnerStars(0);
            setPartnerTrust(0);
            setPartnerFlag("");
            setPartnerCountry("");
      setPartnerCity("");
      setPartnerHideIp(false);
            setAwaitingRemoteVideo(false);
            setMoreOpen(false);
            remotePeerId.current = "";
            secondaryPeerId.current = "";
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
                shortCallAutoNext && !hubRequeue
                  ? tRef.current("mobile.live.autoNextShort", {
                      name: leftName,
                    })
                  : tRef.current("mobile.live.partnerLeft", { name: leftName })
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
          const m = msg as ServerMatched;
          const rawPeers = (m.peers || []) as MatchPeer[];
          let allPeers = rawPeers.length
            ? rawPeers.map((p) => normalizePeer(p, m))
            : [pickPeer(m)];
          const wasMatched = phaseRef.current === "matched";
          const prevPrimary = remotePeerId.current;
          const prevSecondary = secondaryPeerId.current;
          // Keep continuity: if prior primary still listed, prefer them as tile 0
          const pi = pickPrimaryPeerIndex(
            allPeers.map((p) => p.peerId),
            {
              wasMatched,
              prevPrimary: prevPrimary || "",
              prevSecondary: prevSecondary || "",
            }
          );
          let peer = allPeers[pi] || allPeers[0];
          peer = {
            ...peer,
            mode: String(m.mode || peer.mode || "solo"),
          };
          // Hub force_relay only (same-IP / hide_ip). No belt-arm for every web peer.
          try {
            const plat = String(
              (peer as { platform?: string }).platform ||
                (rawPeers[0] as { platform?: string } | undefined)?.platform ||
                ""
            ).toLowerCase();
            const wantRelay = !!m.force_relay;
            mediaRef.current?.setForceRelay?.(wantRelay);
            media2Ref.current?.setForceRelay?.(wantRelay);
            log(
              `force_relay hub=${m.force_relay ? 1 : 0} peerPlat=${plat || "?"} `
            );
          } catch {
            /* ignore */
          }
          const extras = allPeers.filter((p) => p.peerId !== peer.peerId);
          const second = extras[0] || null;
          let { keepPrimary, keepSecondary, promoteSecondary } =
            computeMatchContinuity({
              wasMatched,
              prevPrimary: prevPrimary || "",
              prevSecondary: prevSecondary || "",
              primaryPeerId: peer.peerId,
              secondaryPeerId: second?.peerId,
              hasMedia2: !!media2Ref.current,
            });

          // Same partner re-Matched — keep only if video is actually live.
          // Keeping a black "connected" PC forever was gifts-OK / cams-dead.
          {
            const hasLiveRemoteEarly = !!(
              remoteStream &&
              (remoteStream.getVideoTracks?.() || []).some(
                (t) => t.readyState === "live"
              )
            );
            if (
              wasMatched &&
              prevPrimary &&
              prevPrimary === peer.peerId &&
              prevPrimary !== "legacy" &&
              hasLiveRemoteEarly
            ) {
              keepPrimary = true;
              log(
                `matched keep same peer=${peer.peerId.slice(0, 8)} (live video)`
              );
            } else if (
              wasMatched &&
              prevPrimary === peer.peerId &&
              !hasLiveRemoteEarly
            ) {
              keepPrimary = false;
              log(
                `matched rebuild peer=${String(peer.peerId).slice(0, 8)} (no live video)`
              );
            }

            // SPEED: kick WebRTC the instant we know offerer role — before UI
            // state storm / secondary PC shuffle (those added multi-second lag).
            const skipEarly =
              keepPrimary &&
              hasLiveRemoteEarly &&
              prevPrimary === peer.peerId &&
              prevPrimary !== "legacy";
            if (!skipEarly && !promoteSecondary) {
              remotePeerId.current = peer.peerId;
              const sess = mediaRef.current || media;
              if (m.force_relay) {
                try {
                  sess.setForceRelay?.(true);
                } catch {
                  /* ignore */
                }
              }
              const t0 = Date.now();
              log(
                `startCall EARLY offerer=${peer.isOfferer ? 1 : 0} fr=${m.force_relay ? 1 : 0}`
              );
              // FAST: if search already prefetched TURN, do not await HTTP ICE.
              // await fetchIceConfig + warmConnection added 200–800ms every match.
              const kick = async () => {
                if (m.force_relay) {
                  try {
                    sess.setForceRelay?.(true);
                  } catch {
                    /* ignore */
                  }
                }
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
                // warmConnection: preferRelay when force_relay so answer reuses TURN PC
                try {
                  const p = sess.warmConnection?.({
                    preferRelay: !!(m.force_relay || iceWarm),
                  });
                  if (p && !iceWarm) {
                    await Promise.race([
                      p,
                      new Promise((r) => setTimeout(r, 200)),
                    ]);
                  } else {
                    void p;
                  }
                  // force_relay: wait briefly for TURN ALLOCATE from search warm
                  if (
                    m.force_relay &&
                    typeof (sess as { waitWarmTurnPrimed?: (n: number) => Promise<boolean> })
                      .waitWarmTurnPrimed === "function"
                  ) {
                    const primed = (
                      sess as { isWarmTurnPrimed?: () => boolean }
                    ).isWarmTurnPrimed?.();
                    if (!primed) {
                      const ok = await (
                        sess as {
                          waitWarmTurnPrimed: (n: number) => Promise<boolean>;
                        }
                      ).waitWarmTurnPrimed(1100);
                      log(`warm TURN prime ${ok ? "ok" : "timeout"} before startCall`);
                    }
                  }
                } catch {
                  /* ignore */
                }
                return sess.startCall({ isOfferer: !!peer.isOfferer });
              };
              void kick()
                .then(() =>
                  log(
                    `startCall early ok +${Date.now() - t0}ms (warm path)`
                  )
                )
                .catch((e) => log(`startCall early FAIL ${e}`));
            }
          }

          if (promoteSecondary) {
            const oldPrimary = mediaRef.current;
            const surviving = media2Ref.current;
            try {
              oldPrimary?.closeCall({ keepLocal: true, sendBye: false });
            } catch {
              /* ignore */
            }
            // Surviving PC becomes primary for all future signals (via refs)
            mediaRef.current = surviving;
            media2Ref.current = oldPrimary;
            // Rebind handlers so streams land on the right React state
            surviving?.setHandlers({
              onLocalStream: (s) => {
                setLocalStream(s);
                setMediaBlocked(false);
              },
              onRemoteStream: (s) => {
                setRemoteStream(s);
                setRemoteEpoch((n) => n + 1);
                const vt = s.getVideoTracks?.()?.length ?? 0;
                if (vt > 0) {
                  setAwaitingRemoteVideo(false);
                  remoteVideoSeenRef.current = true;
                  setRemoteVideoReady(true);
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
                setRemoteStream2(s);
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
            setAwaitingRemoteVideo(
              !(kept?.getVideoTracks?.()?.length)
            );
            if ((kept?.getVideoTracks?.()?.length ?? 0) > 0) {
              setConn("connected");
              setConnSince(0);
            }
            keepPrimary = true; // skip primary startCall — already connected
            showToastRef.current(
              tRef.current("mobile.live.partnerLeftKeep", {
                name: peer.name || "…",
              })
            );
            hapticLight();
            log(
              `promote secondary→primary peer=${peer.peerId.slice(0, 8)} kept_video=${!!kept?.getVideoTracks?.()?.length}`
            );
            track("multi_promote", { kept: kept ? 1 : 0 });
          }

          // Labels / meta always refresh — never wipe a known user_id with empty
          // (thrash re-Matched can briefly omit peers[].user_id → block/report broken)
          remotePeerId.current = peer.peerId || remotePeerId.current;
          if (peer.userId) {
            partnerUserId.current = peer.userId;
          }
          if (peer.friendCode) {
            partnerFriendCode.current = peer.friendCode;
          }
          partnerNameRef.current = peer.name || partnerNameRef.current;
          lastPartnerIdsRef.current = {
            userId: partnerUserId.current || lastPartnerIdsRef.current.userId,
            peerId: remotePeerId.current || lastPartnerIdsRef.current.peerId,
            friendCode:
              partnerFriendCode.current || lastPartnerIdsRef.current.friendCode,
            shortId: String(peer.peerId || "").slice(0, 8) || lastPartnerIdsRef.current.shortId,
          };
          setPartnerCode(partnerFriendCode.current || peer.friendCode);
          if (!keepPrimary) setFriendAdded(false);
          setPartner(peer.name);
          setPartnerStars(peer.stars);
          setPartnerTrust(peer.trust);
          setPartnerFlag(peer.flag);
          setPartnerCountry(peer.country || "");
          setPartnerCity(peer.city || "");
          setPartnerHideIp(!!peer.hideIp);
          if (!keepPrimary) {
            setPartnerMuted(false);
            setTheyMutedMe(false);
          }
          setFindThirdPending(false);
          setExtraPeers(extras);
          setMatchMode(peer.mode);
          setPhase("matched");
          phaseRef.current = "matched";
          searchingRef.current = false;
          queueAckedRef.current = false;
          setQueueAcked(false);
          // Brief grace so Match chime + first look aren't skipped by fat-finger Next
          if (!keepPrimary) {
            // ~2s fat-finger guard so first look isn't Next-skipped
            nextGraceUntilRef.current = Date.now() + 2000;
          }
          setAlone(false);
          setMoreOpen(false);
          if (extras.length === 0) setFocusExtra(false);
          // Privacy veil when Settings intro/hold (default intro). Eye toggles anytime.
          const isFriendMatch =
            peer.mode === "friend" || String(m.mode || "") === "friend";
          if (!keepPrimary) {
            clearIntroUnblurTimer();
            const mode = blurModeRef.current || "off";
            const wantBlur =
              !isFriendMatch && (mode === "hold" || mode === "intro");
            setRemoteBlurred(wantBlur);
            remoteBlurredRef.current = wantBlur;
            log(
              `blur match mode=${mode} veiled=${wantBlur ? 1 : 0} friend=${isFriendMatch ? 1 : 0} prefsReady=${blurPrefsReadyRef.current ? 1 : 0}`
            );
            if (wantBlur && mode === "intro") {
              scheduleIntroUnblur();
            }
          }

          if (!keepPrimary) {
            const started = Date.now();
            setMatchStartedAt(started);
            matchStartedAtRef.current = started;
            ratedThisMatchRef.current = false;
            remoteVideoSeenRef.current = false;
            setRemoteVideoReady(false);
            isOffererRef.current = !!peer.isOfferer;
            setRemoteStream(null);
            setChat([]);
            setDcOpen(false);
            setAwaitingRemoteVideo(true);
            setSwapViews(false);
            setFocusExtra(false);
            setConn("connecting");
            setConnSince(Date.now());
            // Clear any background cam/mic pause so partner sees/hears us
            bgPausedCamRef.current = false;
            bgPausedMicRef.current = false;
            const m1 = mediaRef.current || media;
            const m2 = media2Ref.current || media2;
            if (camOnRef.current) {
              m1.setCamEnabled(true);
              m2.setCamEnabled(true);
              try {
                m1.forceRepaintRemote?.("match_start");
              } catch {
                /* ignore */
              }
            }
            if (micOnRef.current && !debateMicLockedRef.current) {
              m1.setMicEnabled(true);
              m2.setMicEnabled(true);
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
            // Soft re-match (party join / find-3rd / promote) — keep A/V + chat
            log(
              `keep primary PC peer=${peer.peerId.slice(0, 8)} extras=${extras.length} promote=${promoteSecondary ? 1 : 0}`
            );
            if (extras.length === 0) {
              setSwapViews(false);
              setFocusExtra(false);
            }
          }
          void enterCallAudio();
          log(
            `matched ${peer.name} mode=${peer.mode} offerer=${peer.isOfferer} uid=${peer.userId.slice(0, 8)} code=${peer.friendCode || "-"} ★${peer.stars} trust=${peer.trust} loc=${peer.flag || "-"}/${peer.country || "-"}/${peer.city || "-"} hideIp=${peer.hideIp ? 1 : 0} peers=${allPeers.length} keepP=${keepPrimary} keepS=${keepSecondary} turn=${iceHasTurnRef.current}`
          );

          const nPeers = allPeers.length;
          const multi =
            nPeers >= 2 ||
            peer.mode === "party_browse" ||
            String(m.mode || "") === "party_browse";
          const m1 = mediaRef.current || media;
          const m2 = media2Ref.current || media2;
          if (multi) {
            m1.setMultiPeerAudio(true);
            m2.setMultiPeerAudio(true);
            m1.applyFullAudioProcessing().catch(() => {});
          } else {
            m1.setMultiPeerAudio(false);
            m2.setMultiPeerAudio(false);
          }

          // Secondary PC: drop / keep / replace
          if (!second || second.peerId === "legacy") {
            if (prevSecondary && !promoteSecondary) {
              m2.closeCall({ keepLocal: true, sendBye: false });
              setRemoteStream2(null);
              secondaryPeerId.current = "";
              log("secondary PC closed (solo again)");
            } else if (promoteSecondary) {
              secondaryPeerId.current = "";
            }
          } else if (keepSecondary) {
            secondaryPeerId.current = second.peerId;
            log(`keep secondary PC peer=${second.peerId.slice(0, 8)}`);
          } else {
            m2.closeCall({ keepLocal: true, sendBye: false });
            setRemoteStream2(null);
            secondaryPeerId.current = second.peerId;
            const localEarly = m1.getLocalStream();
            if (localEarly) m2.adoptLocalStream(localEarly);
            log(
              `multi-peer secondary ${second.name} role=${second.role} offerer=${second.isOfferer}`
            );
          }

          // ICE: startCall first when cache warm — never block match on HTTP.
          // Background-refresh TURN so next match stays hot.
          const startSecondary = () => {
            if (!second || second.peerId === "legacy" || keepSecondary) {
              return;
            }
            const sess = media2Ref.current || media2;
            const prim = mediaRef.current || media;
            const local = prim.getLocalStream();
            if (local) sess.adoptLocalStream(local);
            sess
              .startCall({ isOfferer: second.isOfferer })
              .then(() => log("startCall2 ok"))
              .catch((e) => log(`startCall2 ${e}`));
          };
          // CRITICAL: only skip startCall if we already have LIVE remote video.
          // keepPrimary alone skipped startCall after a failed rematch →
          // hub "solo matched" with zero offer/answer (black forever).
          const hasLiveRemote = !!(
            remoteStream &&
            (remoteStream.getVideoTracks?.() || []).some(
              (t) => t.readyState === "live"
            )
          );
          const skipStart =
            keepPrimary &&
            hasLiveRemote &&
            prevPrimary === peer.peerId &&
            prevPrimary !== "legacy";

          const startPrimary = (why: string) => {
            if (skipStart) {
              log(`startCall skip keep_live peer=${peer.peerId.slice(0, 8)}`);
              startSecondary();
              return;
            }
            // Early kick already fired startCall (unless promoteSecondary)
            if (why === "matched-immediate" && !promoteSecondary) {
              startSecondary();
              return;
            }
            const sess = mediaRef.current || media;
            const t0 = Date.now();
            log(
              `startCall kick offerer=${peer.isOfferer ? 1 : 0} force_relay=${m.force_relay ? 1 : 0} (${why})`
            );
            sess
              .startCall({ isOfferer: !!peer.isOfferer })
              .then(() => {
                log(`startCall ok (${why}) +${Date.now() - t0}ms`);
                startSecondary();
              })
              .catch((e) => log(`startCall FAIL ${e}`));
          };
          startPrimary("matched-immediate");
          void hubRefLive.current
            .fetchIceConfig()
            .then((cfg) => {
              (mediaRef.current || media).setIceConfig(cfg);
              (media2Ref.current || media2).setIceConfig(cfg);
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
          // App-level control plane over hub (works when P2P datachannel is down)
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
          // Route multi-peer signals via refs (survives promote swap)
          const primarySess = mediaRef.current || media;
          const secondarySess = media2Ref.current || media2;
          if (
            from &&
            secondaryPeerId.current &&
            from === secondaryPeerId.current
          ) {
            log(
              `signal2 ← ${kind} from=${from.slice(0, 8)} len=${String(m.payload || "").length}`
            );
            secondarySess
              .handleRemoteSignal(kind, String(m.payload || ""))
              .catch((e) => log(`signal2 ${e}`));
            break;
          }
          if (from) remotePeerId.current = from;
          log(
            `signal ← ${kind} from=${(m.from_peer || "").slice(0, 8)} len=${String(m.payload || "").length}`
          );
          if (kind && m.payload != null) {
            primarySess
              .handleRemoteSignal(kind, m.payload)
              .then(() => {
                if (kind === "offer" || kind === "answer") {
                  log(`signal ${kind} applied ok`);
                }
              })
              .catch((e) => log(`handle ${e}`));
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
            void playGiftChime();
            hapticMatch();
          }
          break;
        }
        case "call_ended": {
          // Friend hangup → idle. Short stranger call → auto-search next.
          const wasMatched = phaseRef.current === "matched";
          const leftName = partnerNameRef.current || "Partner";
          const started = matchStartedAtRef.current;
          const mode = matchModeRef.current || "";
          const dur = started
            ? Math.floor((Date.now() - started) / 1000)
            : 0;
          const autoNext =
            wasMatched &&
            mode !== "friend" &&
            !isFriendsOnly() &&
            dur >= SHORT_CALL_AUTO_NEXT_MIN_SECS &&
            dur < SHORT_CALL_AUTO_NEXT_SECS;
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
                ? tRef.current("mobile.live.autoNextShort", { name: leftName })
                : tRef.current("mobile.live.partnerLeft", { name: leftName })
            );
            hapticLight();
          }
          debate.reset();
          setDebateComposeOpen(false);
          setDcOpen(false);
          media2.closeCall({ keepLocal: true, sendBye: false });
          setRemoteStream2(null);
          secondaryPeerId.current = "";
          setExtraPeers([]);
          setPartnerStars(0);
          setPartnerTrust(0);
          setPartnerFlag("");
          setPartnerCountry("");
      setPartnerCity("");
      setPartnerHideIp(false);
          setPartnerMuted(false);
          setTheyMutedMe(false);
          setFindThirdPending(false);
          setGiftFlash(null);
          setGiftEffect(null);
          setPartnerFx(null);
          setSelfFx(null);
          setRemoteBlurred(false);
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
          break;
        }
        default:
          break;
      }
    });

    return () => {
      clearInterval(iceRefresh);
      unsub();
      debate.reset();
      debateRef.current = null;
      // Secondary shares primary local tracks — never stop tracks here
      media2.closeCall({ keepLocal: true, sendBye: false });
      media2Ref.current = null;
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
        mediaRef.current?.setHideIp(prefs.hideIp);
        mediaRef.current?.setDataSaver(!!prefs.dataSaver);
        media2Ref.current?.setDataSaver(!!prefs.dataSaver);
        setDataSaverOn(!!prefs.dataSaver);
        const mode = prefs.blurStrangersMode || "off";
        blurModeRef.current = mode;
        blurStrangersRef.current = mode !== "off";
        blurPrefsReadyRef.current = true;
        // Returning from Settings mid-call: apply new mode
        if (phaseRef.current === "matched") {
          if (mode === "hold" || mode === "intro") {
            applyMatchBlurVeil("settings_focus");
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
  // preferRelay: Play↔browser almost always force_relay — warm TURN PC early.
  useFocusEffect(
    useCallback(() => {
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          media2Ref.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          void mediaRef.current?.ensureLocalStream().catch(() => {});
          void mediaRef.current
            ?.warmConnection({ preferRelay: !!cfg.has_turn })
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
          preferRelay: iceHasTurnRef.current,
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
      name: partnerNameRef.current || partner || "Partner",
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
        name: partnerNameRef.current || partner || "…",
        time,
      })
    );
  }

  /** After a decent stranger chat, offer to add them by friend code. */
  function maybeOfferAddFriend() {
    const code = (
      partnerFriendCode.current ||
      partnerCode ||
      ""
    )
      .trim()
      .toUpperCase();
    if (!code || code.length < 4) return;
    if (matchModeRef.current === "friend") return;
    if (friendAdded) return;
    const uid = partnerUserId.current;
    if (uid && friends.some((f) => f.user_id === uid)) return;
    const started = matchStartedAtRef.current;
    if (!started) return;
    const dur = Math.floor((Date.now() - started) / 1000);
    if (dur < 45) return;
    const name = partnerNameRef.current || partner || "…";
    setTimeout(() => {
      Alert.alert(
        t("mobile.live.addFriend"),
        t("mobile.live.addFriendAfter", { name, code }),
        [
          { text: t("mobile.common.skip"), style: "cancel" },
          {
            text: t("mobile.live.addFriend"),
            onPress: () => {
              try {
                hub.addFriend(code);
                setFriendAdded(true);
                showToastRef.current(
                  t("mobile.friends.requestSent", { code })
                );
              } catch (e) {
                showToastRef.current(
                  t("mobile.friends.notConnected") +
                    (e ? `: ${String(e).slice(0, 60)}` : "")
                );
              }
            },
          },
        ]
      );
    }, 600);
  }

  function copyPartnerCode() {
    copyPartnerIdentity();
  }

  /** Copy name · location · ★ · friend code for paste / share. */
  function copyPartnerIdentity() {
    const name = (partnerNameRef.current || partner || "").trim();
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
    });
    const lines = [
      name || null,
      loc || null,
      `★ ${Math.max(0, partnerStars)}`,
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
      name: partnerNameRef.current || partner || "Partner",
      duration_secs: dur,
      max_gift: 1,
      early: need < 15 * 60,
    });
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
      ?.warmConnection({ preferRelay: iceHasTurnRef.current })
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

  function start() {
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
      setExtraPeers([]);
      setPartner("");
      setPartnerCode("");
      setPartnerStars(0);
      setPartnerTrust(0);
      setPartnerFlag("");
      setPartnerCountry("");
      setPartnerCity("");
      setPartnerHideIp(false);
      setPartnerMuted(false);
      setTheyMutedMe(false);
      setFindThirdPending(false);
      setAwaitingRemoteVideo(false);
      secondaryPeerId.current = "";
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
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: false });
      // Prefetch TURN + warm PC while searching (match path hits cache + pre-gather)
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          media2Ref.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          push(`ICE prefetch has_turn=${cfg.has_turn}`);
          return mediaRef.current?.warmConnection({
            preferRelay: !!cfg.has_turn,
          });
        })
        .catch(() => {});
      if (!connected) {
        reconnectHub();
        push("→ spin deferred (reconnecting hub)");
        showToastRef.current(t("mobile.settings.hubReconnecting"));
      } else {
        sendSpin("start");
      }
      track("start_match", { via: "start" });
    } catch (e) {
      push(String(e));
      // Keep search UI so user never stuck on Start after pressing it
      if (phaseRef.current !== "search") enterSearchUi({ toast: false });
    }
  }

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
    try {
      recordMatchToHistory();
      toastMatchEnded();
      maybeOfferAddFriend();
      maybeOfferRateAfterChat();
      void leaveCallAudio();
      resetDebateUi();
      hapticLight();
      stayUntilRef.current = 0;
      setStayRemSecs(0);
      try {
        if (iceHasTurnRef.current) {
          mediaRef.current?.setForceRelay?.(true);
          media2Ref.current?.setForceRelay?.(true);
        }
      } catch {
        /* ignore */
      }
      media2Ref.current?.closeCall({ keepLocal: true, sendBye: true });
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: true });
      // Next = immediate re-search; warm while queueing so 2nd match isn't cold
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          if (cfg.has_turn) {
            try {
              mediaRef.current?.setForceRelay?.(true);
            } catch {
              /* ignore */
            }
          }
          return mediaRef.current?.warmConnection({
            preferRelay: !!cfg.has_turn,
          });
        })
        .catch(() => {});
      setRemoteStream(null);
      setRemoteStream2(null);
      setPartner("");
      setPartnerStars(0);
      setPartnerTrust(0);
      setPartnerFlag("");
      setPartnerCountry("");
      setPartnerCity("");
      setPartnerHideIp(false);
      setPartnerMuted(false);
      setTheyMutedMe(false);
      setFindThirdPending(false);
      setGiftFlash(null);
      setGiftEffect(null);
      setPartnerFx(null);
      setSelfFx(null);
      setFocusExtra(false);
      setRemoteBlurred(false);
      stayUntilRef.current = 0;
      setStayRemSecs(0);
      setExtraPeers([]);
      setChat([]);
      setAwaitingRemoteVideo(false);
      setMoreOpen(false);
      remotePeerId.current = "";
      secondaryPeerId.current = "";
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
          iceHasTurnRef.current = !!cfg.has_turn;
          return mediaRef.current?.warmConnection({
            preferRelay: !!cfg.has_turn,
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

  function doStop() {
    try {
      recordMatchToHistory();
      toastMatchEnded();
      maybeOfferAddFriend();
      maybeOfferRateAfterChat();
      void leaveCallAudio();
      resetDebateUi();
      hapticLight();
      // Prefer relay sticky before close so closeCall_rewarm uses TURN policy
      try {
        if (iceHasTurnRef.current) {
          mediaRef.current?.setForceRelay?.(true);
          media2Ref.current?.setForceRelay?.(true);
        }
      } catch {
        /* ignore */
      }
      media2Ref.current?.closeCall({ keepLocal: true, sendBye: true });
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: true });
      // Re-warm TURN PC for next Start (Stop must not leave a cold path)
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          if (cfg.has_turn) {
            try {
              mediaRef.current?.setForceRelay?.(true);
            } catch {
              /* ignore */
            }
          }
          return mediaRef.current?.warmConnection({
            preferRelay: !!cfg.has_turn,
          });
        })
        .catch(() => {});
      setRemoteStream(null);
      setRemoteStream2(null);
      setPartner("");
      setPartnerStars(0);
      setPartnerTrust(0);
      setPartnerFlag("");
      setPartnerCountry("");
      setPartnerCity("");
      setPartnerHideIp(false);
      setPartnerMuted(false);
      setTheyMutedMe(false);
      setFindThirdPending(false);
      setGiftFlash(null);
      setGiftEffect(null);
      setPartnerFx(null);
      setSelfFx(null);
      setFocusExtra(false);
      setRemoteBlurred(false);
      stayUntilRef.current = 0;
      setStayRemSecs(0);
      setExtraPeers([]);
      setChat([]);
      setAwaitingRemoteVideo(false);
      setMoreOpen(false);
      remotePeerId.current = "";
      secondaryPeerId.current = "";
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
    // Inline badge only (PartnerChrome / stage pill). No Alert.alert —
    // the grey system popup was worse than the “They muted you · no sound” chip.
    if (on) {
      hapticLight();
    }
  }
  applyTheyMutedMeRef.current = applyTheyMutedMe;

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

  function togglePartnerMute() {
    const next = !partnerMuted;
    setPartnerMuted(next);
    partnerMutedRef.current = next;
    mediaRef.current?.setRemoteAudioEnabled(!next);
    media2Ref.current?.setRemoteAudioEnabled(!next);
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
    showToastRef.current(
      next
        ? t("mobile.live.youMutedThemToast") ||
            "Muted — they can't be heard · partner notified"
        : t("mobile.live.youUnmutedThemToast") || "Unmuted — you hear them again"
    );
    if (!ok) {
      push("partner_mute first send failed — hub+p2p retries armed");
    }
  }

  function browseTogether() {
    if (phase !== "matched") return;
    try {
      hub.browseTogether();
      setFindThirdPending(true);
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
    showToastRef.current(t("mobile.toast.findThirdEnded"));
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
   */
  function resolvePartnerTargetId(): string {
    const mine = String(userIdRef.current || "").trim();
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
    // Report Modal stacks above privacy Modal; keep veil (don't force unblur).
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
      void rememberBlock(uid, partnerNameRef.current || partner);
      void pushReportHistory({
        user_id: uid,
        name: partnerNameRef.current || partner || uid.slice(0, 8),
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
      void rememberBlock(uid, partnerNameRef.current || partner);
      void pushReportHistory({
        user_id: uid,
        name: partnerNameRef.current || partner || uid.slice(0, 8),
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
        setAwaitingRemoteVideo(true);
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
      if (gift) {
        setGiftFlash(`${gift.emoji}`);
        // Bars: paint on partner tile immediately (not full-stage under SurfaceView)
        if (effect === "bars") {
          setGiftEffect(null);
          setPartnerFx("bars");
          if (partnerFxTimerRef.current) clearTimeout(partnerFxTimerRef.current);
          partnerFxTimerRef.current = setTimeout(
            () => setPartnerFx(null),
            giftFxHoldMs("bars")
          );
        } else {
          setGiftEffect(effect);
          if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
          giftFxTimerRef.current = setTimeout(() => {
            setGiftFlash(null);
            setGiftEffect(null);
          }, giftFxHoldMs(effect));
        }
        if (effect === "bars") {
          if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
          giftFxTimerRef.current = setTimeout(() => setGiftFlash(null), 2200);
        }
        void playGiftChime();
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
    const code = partnerFriendCode.current || partnerCode;
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
    (remoteStream?.getVideoTracks?.()?.length ?? 0) > 0 ||
    (remoteStream?.getAudioTracks?.()?.length ?? 0) > 0 ||
    (remoteStream2?.getVideoTracks?.()?.length ?? 0) > 0;
  const uiPhase =
    phase === "search"
      ? "search"
      : phase === "matched" || remoteLive
        ? "matched"
        : phase;

  // Heal desync: remote media alive but React phase stuck idle/error
  useEffect(() => {
    if (!remoteLive) return;
    if (phase === "matched" || phase === "search") return;
    setPhase("matched");
    phaseRef.current = "matched";
    searchingRef.current = false;
    // Start clocks so gift/review timers advance even if Matched was missed
    if (!matchStartedAtRef.current) {
      const t0 = Date.now();
      matchStartedAtRef.current = t0;
      setMatchStartedAt(t0);
    }
  }, [remoteLive, phase]);

  // Alone-queue "Invite someone to live" card removed (product: less noise on Android Live).
  const showAloneBanner = false;
  const isFriendCall = matchMode === "friend";
  const alreadyFriends = !!(
    partnerUserId.current &&
    friends.some((f) => f.user_id === partnerUserId.current)
  );
  const canAddFriend =
    uiPhase === "matched" &&
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
  const hasRemoteVideo = (remoteStream?.getVideoTracks?.() || []).some(
    (t) => (t as { readyState?: string }).readyState !== "ended"
  );

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
    hasRemoteVideo,
    connSince,
    now: nowTick,
  });

  const labelKey = connLabelKey(conn, connSlow);
  const connLabel = labelKey ? t(labelKey) : conn;

  const showConnRetry = computeShowConnRetry({
    phase,
    conn,
    connSlow,
    awaitingRemoteVideo,
    hasRemoteVideo,
    matchStartedAt,
    now: nowTick,
  });
  const showHardRetry = computeShowHardRetry({
    phase,
    conn,
    connSlow,
    linkTier,
    awaitingRemoteVideo,
    hasRemoteVideo,
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
    name: partner,
    stars: partnerStars,
    flag: partnerFlag,
    country: partnerCountry,
    city: partnerCity,
    lang: lang || "ru",
  });
  const showPrivacyBlur =
    remoteBlurred && (phase === "matched" || uiPhase === "matched");

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
          remoteEpoch={remoteEpoch}
          remoteEpoch2={remoteEpoch2}
          extraPeerCount={extraPeers.length}
          swapViews={swapViews}
          focusExtra={focusExtra}
          partnerName={partner}
          partnerStars={partnerStars}
          partnerLoc={formatLocLine({
            flag: partnerFlag,
            country: partnerCountry,
            city: partnerCity,
            lang: lang || "ru",
          })}
          secondName={extraPeers[0]?.name || t("mobile.live.peer2")}
          isFriendCall={isFriendCall}
          remoteBlurred={remoteBlurred}
          camOn={camOn}
          partnerMuted={partnerMuted}
          theyMutedMe={theyMutedMe}
          retryBusy={retryBusy}
          autoRetryCount={autoRetryCount}
          hasTurn={iceHasTurnRef.current}
          partnerFx={partnerFx}
          selfFx={selfFx}
          barsCaption={
            partnerFx === "bars"
              ? t("mobile.live.giftBars")
              : selfFx === "bars"
                ? t("mobile.live.giftBars")
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
            partnerMutedBadge: t("mobile.live.youMutedThem"),
            theyMutedYouBadge: t("mobile.live.theyMutedYou"),
            longPressReport: t("mobile.live.longPressReport"),
            selfHiddenBadge:
              t("mobile.live.selfHiddenBadge") || "Hidden from them",
            unblurShort:
              t("mobile.live.unblurShort") || "Show video",
          }}
          onToggleFocusExtra={() => setFocusExtra((v) => !v)}
          onRetryConnect={(hard) => void retryConnection({ hard })}
          onReport={() => {
            hapticLight();
            setMoreOpen(false);
            void openReport();
          }}
          onDoubleTapReblur={() => {
            hapticLight();
            clearIntroUnblurTimer();
            setRemoteBlurred(true);
            remoteBlurredRef.current = true;
            showToastRef.current(
              t("mobile.live.reblurToast") || "Partner blurred again"
            );
          }}
          onPipHintSeen={() => setPipHint(false)}
          onSwapViews={() => setSwapViews((v) => !v)}
          onHaptic={() => hapticLight()}
          blurVeil={
            showPrivacyBlur
              ? {
                  title: t("mobile.live.blurTitle") || "Privacy veil",
                  body:
                    t("mobile.live.blurBodyHold") ||
                    "Partner video is hidden. Tap Show video when ready.",
                  buttonLabel:
                    t("mobile.live.unblurReady") ||
                    t("mobile.live.unblur") ||
                    "Show video",
                  hint:
                    t("mobile.live.blurHint") ||
                    "Double-tap video later to re-cover",
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
        {/* Report only once video is live — less clutter while linking */}
        {uiPhase === "matched" && !isFriendCall && hasRemoteVideo ? (
          <Pressable
            style={[
              styles.stageReportFab,
              { top: Math.max(insets.top, 8) + 2 },
            ]}
            onPress={() => {
              hapticLight();
              setMoreOpen(false);
              void openReport();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.live.reportFab")}
            testID="live-stage-report-fab"
            hitSlop={8}
          >
            <Text style={styles.stageReportFabText}>
              ⚑ {t("mobile.live.reportFab")}
            </Text>
          </Pressable>
        ) : null}
        <View
          style={[
            styles.overlay,
            { paddingTop: Math.max(insets.top, 8) + 2 },
          ]}
        >
          <View>
            {uiPhase === "matched" ? (
              <PartnerChrome
                name={partner}
                stars={partnerStars}
                trust={partnerTrust}
                flag={partnerFlag}
                country={partnerCountry}
                city={partnerCity}
                hideIp={partnerHideIp}
                muted={partnerMuted}
                theyMutedMe={theyMutedMe}
                isFriend={isFriendCall}
                timer={
                  hasRemoteVideo && !awaitingRemoteVideo && callTimerText
                    ? callTimerText
                    : undefined
                }
                onLongPress={copyPartnerIdentity}
                longPressHint={
                  t("mobile.live.partnerLongPress") ||
                  "Long-press to copy name · place · ★"
                }
              />
            ) : uiPhase === "search" ? (
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
          {uiPhase === "matched" && extraPeers.length > 0 ? (
            <View style={styles.peerStrip}>
              <Text style={styles.partyCount}>
                {t("mobile.live.partyOf", { n: 1 + extraPeers.length })}
              </Text>
              <Pressable
                style={[styles.peerChip, !focusExtra && styles.peerChipOn]}
                onPress={() => {
                  hapticLight();
                  setFocusExtra(false);
                }}
              >
                <Text style={styles.peerChipText} numberOfLines={1}>
                  {partner || "…"}
                </Text>
              </Pressable>
              {extraPeers.map((p) => (
                <Pressable
                  key={p.peerId || p.userId || p.name}
                  style={[styles.peerChip, focusExtra && styles.peerChipOn]}
                  onPress={() => {
                    hapticLight();
                    setFocusExtra(true);
                  }}
                >
                  <Text style={styles.peerChipText} numberOfLines={1}>
                    {p.name || t("mobile.live.peer2")}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {/* Build id for smoke (confirm 0.1.210+ installed) */}
          {uiPhase === "matched" || uiPhase === "search" ? (
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
          {/* One slim status line: timer + linking / connected (no duplicate hints) */}
          {uiPhase === "matched" &&
          (!hasRemoteVideo ||
            awaitingRemoteVideo ||
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
              awaitingRemoteVideo={awaitingRemoteVideo || !hasRemoteVideo}
              connSlow={connSlow}
              linkTier={linkTier}
              linkTierLabel=""
              linkRtt={0}
              linkRelay={false}
              qualityTier=""
              showConnRetry={showConnRetry && !hasRemoteVideo}
              showHardRetry={showHardRetry && !hasRemoteVideo}
              retryBusy={retryBusy}
              turnBadgeLabel=""
              stageWaitVideoLabel={t("mobile.live.stageWaitVideo")}
              stageConnectingLabel={t("mobile.live.stageConnecting")}
              stageFindingPathLabel={t("mobile.live.stageFindingPath")}
              stageTryingRelayLabel={t("mobile.live.stageTryingRelay")}
              connectElapsedSecs={
                matchStartedAt > 0 && !hasRemoteVideo
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
          {/* ★ bar only near unlock / ready — not a permanent second header row */}
          {uiPhase === "matched" &&
          hasRemoteVideo &&
          !awaitingRemoteVideo &&
          (starReady || starProgress >= 0.55) ? (
            <View style={styles.starProg}>
              <View style={styles.starProgTrack}>
                <View
                  style={[
                    styles.starProgFill,
                    { width: `${Math.round(starProgress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.starProgLabel}>
                {starReady
                  ? t("mobile.live.starReviewReady")
                  : t("mobile.live.starUnlockReview", {
                      n: needMin,
                      time: `${Math.floor(elapsedSecs / 60)}:${String(elapsedSecs % 60).padStart(2, "0")}`,
                    })}
              </Text>
            </View>
          ) : null}
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

        {giftFlash || giftEffect ? (
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
          showEmptyHint={
            uiPhase === "matched" &&
            chat.length === 0 &&
            !peerTyping &&
            !moreOpen
          }
          chat={chat}
          peerTyping={peerTyping}
          scrollRef={chatScrollRef}
          sayHiLabel={t("mobile.chat.sayHi")}
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

      {/* Native layout: gifts + chat under the stage (classic call UI) */}
      {uiPhase === "matched" && !isBrowserLayout ? (
        <>
          <LiveGiftBar
            starReady={starReady}
            starProgress={starProgress}
            needMin={needMin}
            elapsedSecs={elapsedSecs}
            stars={stars}
            gifts={GIFTS}
            giftsTitle={t("mobile.live.giftsTitle") || "Gifts"}
            partnerLine={
              partner
                ? t("mobile.live.giftsTo", {
                    who: formatPartnerSummary({
                      name: partner,
                      stars: partnerStars,
                      flag: partnerFlag,
                      country: partnerCountry,
                      city: partnerCity,
                      lang: lang || "ru",
                    }),
                  }) ||
                  `To ${formatPartnerSummary({
                    name: partner,
                    stars: partnerStars,
                    flag: partnerFlag,
                    country: partnerCountry,
                    city: partnerCity,
                    lang: lang || "ru",
                  })}`
                : undefined
            }
            unlockLabel={
              t("mobile.live.starUnlockReview", {
                n: needMin,
                time: `${Math.floor(elapsedSecs / 60)}:${String(
                  elapsedSecs % 60
                ).padStart(2, "0")}`,
              }) ||
              t("mobile.live.starUnlock", {
                n: needMin,
                time: `${Math.floor(elapsedSecs / 60)}:${String(
                  elapsedSecs % 60
                ).padStart(2, "0")}`,
              })
            }
            readyLabel={
              t("mobile.live.starReviewReady") || t("mobile.live.starReady")
            }
            onCantAfford={(cost, have) => {
              showToastRef.current(
                t("mobile.live.needStars", { cost, stars: have }) ||
                  `Need ${cost}★ (you have ${have})`
              );
            }}
            onSpend={(id, cost) => spend(id, cost)}
          />
          <View style={styles.chatRow}>
            <TextInput
              style={styles.chatInput}
              value={chatDraft}
              onChangeText={onChatDraftChange}
              placeholder={t("mobile.chat.placeholder")}
              placeholderTextColor="#6b7a90"
              onSubmitEditing={sendChat}
              returnKeyType="send"
              maxLength={CHAT_MAX}
              accessibilityLabel={t("mobile.chat.placeholder")}
            />
            <Pressable
              style={styles.chatSend}
              onPress={sendChat}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.common.send")}
            >
              <Text style={styles.chatSendText}>
                {t("mobile.common.send") || "Send"}
              </Text>
            </Pressable>
          </View>
          {chatDraft.length >= 200 ? (
            <Text style={styles.chatCount}>
              {t("mobile.chat.charsLeft", {
                n: Math.max(0, CHAT_MAX - chatDraft.length),
              })}
            </Text>
          ) : null}
        </>
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
        {/* Browser layout: gifts + chat docked over full-bleed video */}
        {uiPhase === "matched" && isBrowserLayout ? (
          <>
            <View style={styles.browserGifts}>
              <LiveGiftBar
                starReady={starReady}
                starProgress={starProgress}
                needMin={needMin}
                elapsedSecs={elapsedSecs}
                stars={stars}
                gifts={GIFTS}
                giftsTitle={t("mobile.live.giftsTitle") || "Gifts"}
                partnerLine={
                  partner
                    ? t("mobile.live.giftsTo", {
                        who: formatPartnerSummary({
                          name: partner,
                          stars: partnerStars,
                          flag: partnerFlag,
                          country: partnerCountry,
                          city: partnerCity,
                          lang: lang || "ru",
                        }),
                      }) ||
                      `To ${formatPartnerSummary({
                        name: partner,
                        stars: partnerStars,
                        flag: partnerFlag,
                        country: partnerCountry,
                        city: partnerCity,
                        lang: lang || "ru",
                      })}`
                    : undefined
                }
                unlockLabel={
                  t("mobile.live.starUnlockReview", {
                    n: needMin,
                    time: `${Math.floor(elapsedSecs / 60)}:${String(
                      elapsedSecs % 60
                    ).padStart(2, "0")}`,
                  }) ||
                  t("mobile.live.starUnlock", {
                    n: needMin,
                    time: `${Math.floor(elapsedSecs / 60)}:${String(
                      elapsedSecs % 60
                    ).padStart(2, "0")}`,
                  })
                }
                readyLabel={
                  t("mobile.live.starReviewReady") ||
                  t("mobile.live.starReady")
                }
                onCantAfford={(cost, have) => {
                  showToastRef.current(
                    t("mobile.live.needStars", { cost, stars: have }) ||
                      `Need ${cost}★ (you have ${have})`
                  );
                }}
                onSpend={(id, cost) => spend(id, cost)}
              />
            </View>
            <View style={styles.browserChatCompose}>
              <TextInput
                style={styles.browserChatInput}
                value={chatDraft}
                onChangeText={onChatDraftChange}
                placeholder={t("mobile.chat.placeholder")}
                placeholderTextColor="#6b7a90"
                onSubmitEditing={sendChat}
                returnKeyType="send"
                maxLength={CHAT_MAX}
                accessibilityLabel={t("mobile.chat.placeholder")}
              />
              <Pressable
                style={styles.chatSend}
                onPress={sendChat}
                accessibilityRole="button"
                accessibilityLabel={t("mobile.common.send")}
              >
                <Text style={styles.chatSendText}>
                  {t("mobile.common.send") || "Send"}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
        {(() => {
          const q = floorQueueCounts(waiting, online, uiPhase === "search");
          let meta = t("mobile.live.meta", {
            stars,
            online: q.online,
            wait: q.wait,
          });
          if (friendCode) meta += t("mobile.live.metaCode", { code: friendCode });
          if (connected && iceHasTurnRef.current)
            meta += ` · ${t("mobile.live.turnBadge")}`;
          if (uiPhase === "matched" && linkRelay)
            meta += ` · ${t("mobile.live.pathRelay")}`;
          else if (uiPhase === "matched" && conn === "connected")
            meta += ` · ${t("mobile.live.pathDirect")}`;
          if (uiPhase === "matched" && qualityTier)
            meta += ` · ${t("mobile.live.qualityShort", { q: qualityTier })}`;
          if (netPolicy.kind === "cellular")
            meta += ` · ${t("mobile.live.netCell")}`;
          if (!connected || !netPolicy.isConnected)
            meta += ` · ${t("mobile.live.reconnecting").replace(/^ · /, "")}`;
          const waitLine =
            uiPhase === "search"
              ? (queueAcked
                  ? t("mobile.live.waitLine", {
                      wait: Math.max(waiting, 1),
                      online: Math.max(online, 1),
                    })
                  : t("mobile.live.queueJoining")) +
                (!connected
                  ? ` · ${t("mobile.live.reconnecting").replace(/^ · /, "")}`
                  : queueAcked
                    ? ` · ${t("mobile.live.queueLive")}`
                    : "")
              : null;
          return (
            <>
              <LiveMetaStrip
                phase={phase}
                connected={connected}
                metaLine={meta}
                waitLine={waitLine}
                searchTimerLine={
                  phase === "search" && searchSecs >= 8
                    ? t("mobile.live.searchElapsed", { s: searchSecs })
                    : null
                }
                accessibilityLabel={
                  connected
                    ? t("mobile.live.meta", {
                        stars,
                        online: q.online,
                        wait: q.wait,
                      })
                    : t("mobile.home.hubOfflineTap")
                }
                onPress={() => {
                  if (!connected) {
                    reconnectHub();
                    showToastRef.current(t("mobile.settings.hubReconnecting"));
                    return;
                  }
                  if (friendCode) {
                    void Clipboard.setStringAsync(friendCode).then(() => {
                      showToastRef.current(t("mobile.friends.codeCopied"));
                      hapticLight();
                    });
                  }
                }}
                onLongPress={() => {
                  setLogUnlocked(true);
                  setShowLog(true);
                }}
              />
              {uiPhase === "matched" ? (
                <LiveStatusBanners
                  theyMutedMe={theyMutedMe}
                  partnerMuted={partnerMuted}
                  remoteBlurred={remoteBlurred}
                  // Full-screen Modal owns privacy UI — avoid duplicate blur row under bar
                  showBlurBanner={!showPrivacyBlur}
                  theyMutedLabel={
                    t("mobile.live.theyMutedYou") ||
                    "They muted you · no sound"
                  }
                  partnerMutedLabel={
                    t("mobile.live.youMutedThem") || "You muted · no sound"
                  }
                  blurredLabel={
                    t("mobile.live.blurTitle") || "Privacy veil on"
                  }
                  unblurLabel={t("mobile.live.unblur") || "Show video"}
                  onUnblur={() => {
                    hapticLight();
                    revealPartnerVideo("banner_unblur");
                    showToastRef.current(
                      t("mobile.live.partnerVideoOn") || "Partner video shown"
                    );
                  }}
                />
              ) : null}
              <LiveBottomBar
                phase={uiPhase}
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
                  stayNext: (s) => t("mobile.live.stayNext", { s }),
                  stayLock: (s) => t("mobile.live.stayLock", { s }),
                  nextGrace: (s) => t("mobile.live.nextGraceBtn", { s }),
                  stop: t("btn.stop"),
                  hangup: t("friends.hangup"),
                  blockReport: t("mobile.live.blockReport"),
                  micOn: t("mobile.live.micOn"),
                  micOff: t("mobile.live.micOff"),
                  camOn: t("mobile.live.camOn"),
                  camOff: t("mobile.live.camOff"),
                  camOffHint: t("mobile.live.camOffHint"),
                  youMutedBadge: t("debate.youMutedBadge"),
                  flipCam: t("btn.flipCam"),
                  partnerMuteShort: t("mobile.live.partnerMuteShort"),
                  partnerUnmuteShort: t("mobile.live.partnerUnmuteShort"),
                  blurShort:
                    t("mobile.live.blurShort") || "Blur partner",
                  unblurShort:
                    t("mobile.live.unblurShort") || "Show video",
                  more: t("mobile.live.more"),
                  cancel: t("mobile.common.cancel"),
                  invite: t("mobile.live.invite"),
                  friends: t("mobile.nav.friends"),
                  friendsMenuTitle: t("mobile.nav.friends"),
                  friendsOnlyHint: t("mobile.live.friendsOnlyHint"),
                }}
                onStart={start}
                onNext={next}
                onStop={stop}
                onBlockReport={() => {
                  hapticLight();
                  setMoreOpen(false);
                  void openReport();
                }}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
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
                  setMoreOpen((v) => !v);
                }}
                onInvite={() => shareInvite("live")}
                onOpenFriends={() => {
                  hapticLight();
                  router.push("/friends");
                }}
              />
            </>
          );
        })()}
        {uiPhase === "matched" && moreOpen ? (
          <LiveMoreSheet
            style={isBrowserLayout ? styles.moreSheetBrowser : undefined}
            partnerMuted={partnerMuted}
            isFriendCall={isFriendCall}
            remoteBlurred={remoteBlurred}
            extraPeerCount={extraPeers.length}
            matchMode={matchMode}
            findThirdPending={findThirdPending}
            dataSaverOn={dataSaverOn}
            liveLayout={liveLayout}
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
            }}
            onPartnerMute={() => {
              togglePartnerMute();
              setMoreOpen(false);
            }}
            onToggleLiveLayout={() => {
              hapticLight();
              const next: LiveLayoutMode =
                liveLayout === "browser" ? "native" : "browser";
              setLiveLayout(next);
              void loadMatchPrefs().then((p) =>
                saveMatchPrefs({ ...p, liveLayout: next })
              );
              showToastRef.current(
                next === "browser"
                  ? t("mobile.settings.liveLayoutBrowserOn") ||
                      "Browser-style layout"
                  : t("mobile.settings.liveLayoutNativeOn") ||
                      "Native call layout"
              );
              setMoreOpen(false);
            }}
            onToggleBlur={() => {
              togglePartnerBlur();
              setMoreOpen(false);
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
            onFlipCam={() => {
              void mediaRef.current?.flipCamera().then(() => {
                showToastRef.current(t("mobile.live.camFlipped"));
              });
              setMoreOpen(false);
            }}
            onToggleDataSaver={() => {
              loadMatchPrefs().then(async (prefs) => {
                const next = !prefs.dataSaver;
                await saveMatchPrefs({ ...prefs, dataSaver: next });
                mediaRef.current?.setDataSaver(next);
                media2Ref.current?.setDataSaver(next);
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
        {logUnlocked ? (
          <Pressable onPress={() => setShowLog((v) => !v)}>
            <Text style={styles.logToggle}>
              {showLog ? t("mobile.live.hideLog") : t("mobile.live.showLog")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/*
        Full-screen privacy Modal — separate window above any leftover SurfaceView.
        Partner RTCView is also unmounted in LiveStageVideo while veiled.
      */}
      <Modal
        visible={!!showPrivacyBlur}
        animationType="fade"
        transparent={false}
        presentationStyle="fullScreen"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => {
          // Android back: reveal video (do not exit Live)
          revealPartnerVideo("blur_modal_back");
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#3a4a66",
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: 20,
            zIndex: 100,
            elevation: 40,
          }}
          testID="live-blur-fullscreen"
          collapsable={false}
        >
          <View style={{ flex: 1, borderRadius: 20, overflow: "hidden" }} collapsable={false}>
            <PartnerBlurVeil
              title={t("mobile.live.blurTitle") || "Privacy veil"}
              partnerLabel={partnerBlurLine}
              body={
                t("mobile.live.blurBodyHold") ||
                "Partner video is hidden. Tap Show video when ready."
              }
              buttonLabel={
                t("mobile.live.unblurReady") ||
                t("mobile.live.unblur") ||
                "Show video"
              }
              hint={
                theyMutedMe
                  ? t("mobile.live.theyMutedYou") || "They muted you · no sound"
                  : t("mobile.live.blurHint") || undefined
              }
              ready={!!remoteVideoReady || !!hasRemoteVideo}
              onPress={() => {
                hapticLight();
                revealPartnerVideo("blur_modal");
                showToastRef.current(
                  t("mobile.live.partnerVideoOn") || "Partner video shown"
                );
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              marginTop: 12,
              paddingHorizontal: 8,
            }}
          >
            <Pressable
              onPress={() => {
                hapticLight();
                revealPartnerVideo("blur_modal_next");
                next();
              }}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.14)",
                paddingVertical: 14,
                borderRadius: 999,
                alignItems: "center",
              }}
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {t("btn.next") || "Next"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                hapticLight();
                revealPartnerVideo("blur_modal_stop");
                stop();
              }}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,80,90,0.4)",
                paddingVertical: 14,
                borderRadius: 999,
                alignItems: "center",
              }}
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {t("btn.stop") || "Stop"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ReportSheet
        visible={reportOpen}
        partnerLabel={partner || (partnerUserId.current || "").slice(0, 8) || "…"}
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

    </KeyboardAvoidingView>
  );
}

