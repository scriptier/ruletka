import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
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
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import { PartnerChrome } from "../src/identity/PartnerChrome";
import { flagEmoji } from "../src/identity/flagTrust";
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
import { useT } from "../src/i18n";
import { friendInviteShareMessage } from "../src/linking/friendInvite";
import {
  LiveBottomBar,
  LiveChatOverlay,
  LiveConnectSteps,
  LiveConnPill,
  LiveDebateChrome,
  LiveGiftBar,
  LiveMetaStrip,
  LiveMoreSheet,
  LiveQueueHints,
  LiveSearchLabel,
  LiveStageVideo,
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
import { ensureMediaPermissions } from "../src/permissions/media";
import { loadMatchPrefs, saveMatchPrefs } from "../src/prefs/store";
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
  /** Local mute of remote audio (you stop hearing them). */
  const [partnerMuted, setPartnerMuted] = useState(false);
  const partnerMutedRef = useRef(false);
  const [findThirdPending, setFindThirdPending] = useState(false);
  /** Extra match peers (beyond primary) for multi-tile UI. */
  const [extraPeers, setExtraPeers] = useState<PeerPick[]>([]);
  /** When multi: show secondary peer in the top tile (tap to swap focus). */
  const [focusExtra, setFocusExtra] = useState(false);
  const [dataSaverOn, setDataSaverOn] = useState(false);
  /**
   * Stranger safety: keep remote video covered until user unblurs.
   * Friend calls start unblurred.
   */
  const [remoteBlurred, setRemoteBlurred] = useState(false);
  const remoteBlurredRef = useRef(false);
  remoteBlurredRef.current = remoteBlurred;
  const blurStrangersRef = useRef(true);
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
        // Auto-unblur on video; if only audio for 2s, still clear blur veil
        // so user sees black vs "stuck connecting" (tap-to-reveal was opaque).
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
          // Safety blur was covering real video on Android (looked like no cam)
          if (remoteBlurredRef.current && (vt > 0 || at > 0)) {
            // Unblur immediately on video; on audio-only wait briefly
            if (vt > 0) {
              setRemoteBlurred(false);
              setRemoteEpoch((n) => n + 1);
              showToastRef.current(tRef.current("mobile.live.partnerVideoOn"));
            } else {
              setTimeout(() => {
                if (remoteBlurredRef.current && phaseRef.current === "matched") {
                  setRemoteBlurred(false);
                  setRemoteEpoch((n) => n + 1);
                }
              }, 1800);
            }
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
          const vt =
            media.getRemoteStream()?.getVideoTracks?.()?.length ?? 0;
          setAwaitingRemoteVideo(vt === 0);
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
          // Already logged via onConnectionState path below
        } else if (s.startsWith("remote_tracks")) {
          // Audio-only so far — keep waiting indicator, stay "connecting" soft
          const vt =
            media.getRemoteStream()?.getVideoTracks?.()?.length ?? 0;
          if (vt > 0) setAwaitingRemoteVideo(false);
        } else if (s.startsWith("no_remote_video_retry")) {
          setAwaitingRemoteVideo(true);
          setConn("connecting");
          setConnSince((t0) => t0 || Date.now());
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
          if (typ === "chat" || typ === "friend_chat") {
            const body = String(msg.body || "").trim().slice(0, 280);
            if (!body) return;
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
      blurStrangersRef.current =
        prefs.blurStrangers === undefined ? true : !!prefs.blurStrangers;
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

    // Ask cam/mic if still denied (e.g. skipped age gate or denied earlier)
    ensureMediaPermissions()
      .then((perm) => {
        if (!perm.allGranted) {
          log(`media perms cam=${perm.camera} mic=${perm.mic}`);
          setMediaBlocked(true);
        }
        return media.ensureLocalStream();
      })
      .then((s) => {
        if (s) {
          log("local preview ready");
          setMediaBlocked(false);
        } else {
          setMediaBlocked(true);
        }
      })
      .catch((e) => {
        log(`local preview ${e}`);
        setMediaBlocked(true);
      });

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
          // Hub force_relay: arm OR clear. Stuck true after prior matches
          // left phone on TURN-only → slow connect + one-way black video.
          try {
            mediaRef.current?.setForceRelay?.(!!m.force_relay);
            media2Ref.current?.setForceRelay?.(!!m.force_relay);
            if (m.force_relay) {
              log("force_relay from hub (hairpin / long-distance)");
            }
          } catch {
            /* ignore */
          }
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

          // Same partner re-Matched mid-connect — never tear down (hub thrash)
          if (
            wasMatched &&
            prevPrimary &&
            prevPrimary === peer.peerId &&
            prevPrimary !== "legacy"
          ) {
            keepPrimary = true;
            log(
              `matched keep same peer=${peer.peerId.slice(0, 8)} (skip startCall thrash)`
            );
          }

          // SPEED: kick WebRTC the instant we know offerer role — before UI
          // state storm / secondary PC shuffle (those added multi-second lag).
          {
            const hasLiveRemoteEarly = !!(
              remoteStream &&
              (remoteStream.getVideoTracks?.() || []).some(
                (t) => t.readyState === "live"
              )
            );
            const skipEarly =
              keepPrimary &&
              hasLiveRemoteEarly &&
              prevPrimary === peer.peerId &&
              prevPrimary !== "legacy";
            if (!skipEarly && !promoteSecondary) {
              remotePeerId.current = peer.peerId;
              const sess = mediaRef.current || media;
              const t0 = Date.now();
              log(
                `startCall EARLY offerer=${peer.isOfferer ? 1 : 0} fr=${m.force_relay ? 1 : 0}`
              );
              void sess
                .startCall({ isOfferer: !!peer.isOfferer })
                .then(() => log(`startCall early ok +${Date.now() - t0}ms`))
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

          // Labels / meta always refresh
          remotePeerId.current = peer.peerId;
          partnerUserId.current = peer.userId;
          partnerFriendCode.current = peer.friendCode;
          partnerNameRef.current = peer.name;
          setPartnerCode(peer.friendCode);
          if (!keepPrimary) setFriendAdded(false);
          setPartner(peer.name);
          setPartnerStars(peer.stars);
          setPartnerTrust(peer.trust);
          setPartnerFlag(peer.flag);
          setPartnerCountry(peer.country || "");
          setPartnerCity(peer.city || "");
          if (!keepPrimary) setPartnerMuted(false);
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
            nextGraceUntilRef.current = Date.now() + 2200;
          }
          setAlone(false);
          setMoreOpen(false);
          if (extras.length === 0) setFocusExtra(false);
          // Stranger safety blur (not friend 1:1); respect Settings pref
          const isFriendMatch =
            peer.mode === "friend" || String(m.mode || "") === "friend";
          if (!keepPrimary) {
            setRemoteBlurred(
              !isFriendMatch && blurStrangersRef.current !== false
            );
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
            `matched ${peer.name} mode=${peer.mode} offerer=${peer.isOfferer} uid=${peer.userId.slice(0, 8)} code=${peer.friendCode || "-"} ★${peer.stars} trust=${peer.trust} peers=${allPeers.length} keepP=${keepPrimary} keepS=${keepSecondary} turn=${iceHasTurnRef.current}`
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
          // Route multi-peer signals via refs (survives promote swap)
          const primarySess = mediaRef.current || media;
          const secondarySess = media2Ref.current || media2;
          if (
            from &&
            secondaryPeerId.current &&
            from === secondaryPeerId.current
          ) {
            log(
              `signal2 ← ${m.kind} from=${from.slice(0, 8)} len=${String(m.payload || "").length}`
            );
            secondarySess
              .handleRemoteSignal(String(m.kind || ""), String(m.payload || ""))
              .catch((e) => log(`signal2 ${e}`));
            break;
          }
          if (from) remotePeerId.current = from;
          log(
            `signal ← ${m.kind} from=${(m.from_peer || "").slice(0, 8)} len=${String(m.payload || "").length}`
          );
          if (m.kind && m.payload != null) {
            primarySess
              .handleRemoteSignal(m.kind, m.payload)
              .then(() => {
                if (m.kind === "offer" || m.kind === "answer") {
                  log(`signal ${m.kind} applied ok`);
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
          const m = msg as { author?: string; body?: string };
          const body = String(m.body || "").trim().slice(0, 280);
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
          };
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
            setGiftEffect(effectId);
            if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
            const hold = giftFxHoldMs(effectId);
            giftFxTimerRef.current = setTimeout(() => {
              setGiftFlash(null);
              setGiftEffect(null);
            }, hold);
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
          setPartnerMuted(false);
          setFindThirdPending(false);
          setGiftFlash(null);
          setGiftEffect(null);
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
          partnerUserId.current = "";
          partnerFriendCode.current = "";
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
        blurStrangersRef.current =
          prefs.blurStrangers === undefined ? true : !!prefs.blurStrangers;
        void mediaRef.current?.reapplyLocalVideoConstraints();
      });
      // Idle teaser: most recent stranger chat
      if (phaseRef.current === "idle" || phaseRef.current === "error") {
        loadMatchHistory()
          .then((list) => setLastMatchHint(list[0] || null))
          .catch(() => setLastMatchHint(null));
      }
      // Warm camera early so Start → match is snappier
      if (phaseRef.current === "idle" || phaseRef.current === "error") {
        void ensureMediaPermissions().then((p) => {
          if (p.allGranted) {
            void mediaRef.current?.ensureLocalStream();
          }
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

  // Prefetch ICE/TURN on Live focus so first match is cache-hot
  useFocusEffect(
    useCallback(() => {
      hub
        .fetchIceConfig()
        .then((cfg) => {
          mediaRef.current?.setIceConfig(cfg);
          media2Ref.current?.setIceConfig(cfg);
          iceHasTurnRef.current = !!cfg.has_turn;
          // Warm cam early (not full PC until search — saves battery idle on Live)
          void mediaRef.current?.ensureLocalStream().catch(() => {});
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
        return mediaRef.current?.warmConnection();
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
                Alert.alert(t("mobile.friends.notConnected"), String(e));
              }
            },
          },
        ]
      );
    }, 600);
  }

  function copyPartnerCode() {
    const code = partnerFriendCode.current || partnerCode;
    if (!code) {
      showToastRef.current(t("mobile.live.partnerNotReady"));
      return;
    }
    void Clipboard.setStringAsync(code)
      .then(() => {
        showToastRef.current(t("mobile.friends.codeCopied"));
        hapticLight();
      })
      .catch(() => {});
  }

  /**
   * Local rate/review popup after Next/Stop.
   * Only if chat lasted ≥5 minutes (no short-call review spam).
   * Hub rate_prompt is separate (also ≥5 / 15 min server-side).
   */
  function maybeOfferRateAfterChat() {
    if (ratedThisMatchRef.current) return;
    const uid = partnerUserId.current;
    if (!uid) return;
    const started = matchStartedAtRef.current;
    if (!started) return;
    const dur = Math.floor((Date.now() - started) / 1000);
    const MIN_REVIEW_SECS = 5 * 60;
    if (dur < MIN_REVIEW_SECS) return;
    ratedThisMatchRef.current = true;
    offerRateRef.current({
      user_id: uid,
      name: partnerNameRef.current || partner || "Partner",
      duration_secs: dur,
      max_gift: 1,
      early: dur < rateMinSecsRef.current,
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
    // While queueing: warm PC + ICE pool so match→offer is near-instant
    void mediaRef.current?.warmConnection().catch(() => {});
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
      Alert.alert(t("mobile.nav.live"), t("mobile.live.friendsOnlyHint"));
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
      setPartnerMuted(false);
      setFindThirdPending(false);
      setAwaitingRemoteVideo(false);
      secondaryPeerId.current = "";
      remotePeerId.current = "";
      partnerUserId.current = "";
      partnerFriendCode.current = "";
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
          return mediaRef.current?.warmConnection();
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
      showToastRef.current(t("mobile.live.nextGrace"));
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
      media2Ref.current?.closeCall({ keepLocal: true, sendBye: true });
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: true });
      setRemoteStream(null);
      setRemoteStream2(null);
      setPartner("");
      setPartnerStars(0);
      setPartnerTrust(0);
      setPartnerFlag("");
      setPartnerCountry("");
            setPartnerCity("");
      setPartnerMuted(false);
      setFindThirdPending(false);
      setGiftFlash(null);
      setGiftEffect(null);
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
          return mediaRef.current?.warmConnection();
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
      media2Ref.current?.closeCall({ keepLocal: true, sendBye: true });
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: true });
      setRemoteStream(null);
      setRemoteStream2(null);
      setPartner("");
      setPartnerStars(0);
      setPartnerTrust(0);
      setPartnerFlag("");
      setPartnerCountry("");
            setPartnerCity("");
      setPartnerMuted(false);
      setFindThirdPending(false);
      setGiftFlash(null);
      setGiftEffect(null);
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
    const name = partnerNameRef.current || partner || "…";
    // Confirm end for any live match lasting a bit (and always for friend calls)
    const elapsed =
      matchStartedAt > 0
        ? Math.floor((Date.now() - matchStartedAt) / 1000)
        : 0;
    const needConfirm =
      phase === "matched" &&
      (matchMode === "friend" || elapsed >= 15);
    if (needConfirm) {
      Alert.alert(
        matchMode === "friend" ? t("friends.hangup") : t("btn.stop"),
        t("mobile.live.hangupConfirm", { name }),
        [
          { text: t("mobile.common.cancel"), style: "cancel" },
          {
            text:
              matchMode === "friend" ? t("friends.hangup") : t("btn.stop"),
            style: "destructive",
            onPress: () => doStop(),
          },
        ]
      );
      return;
    }
    // Long search — confirm cancel so a mis-tap doesn't kill queue position
    if (phase === "search" && searchSecs >= 25) {
      Alert.alert(
        t("btn.stop"),
        t("mobile.live.stopSearchConfirm"),
        [
          { text: t("mobile.common.cancel"), style: "cancel" },
          {
            text: t("btn.stop"),
            style: "destructive",
            onPress: () => doStop(),
          },
        ]
      );
      return;
    }
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
    const nextOn = !camOn;
    setCamOn(nextOn);
    camOnRef.current = nextOn;
    bgPausedCamRef.current = false;
    mediaRef.current?.setCamEnabled(nextOn);
    media2Ref.current?.setCamEnabled(nextOn);
    hapticLight();
  }

  // Android system back: never dump a live call / search silently
  useEffect(() => {
    const onBack = () => {
      const p = phaseRef.current;
      if (p === "matched") {
        const name = partnerNameRef.current || "…";
        Alert.alert(
          matchModeRef.current === "friend"
            ? t("friends.hangup")
            : t("btn.stop"),
          t("mobile.live.hangupConfirm", { name }),
          [
            { text: t("mobile.common.cancel"), style: "cancel" },
            {
              text:
                matchModeRef.current === "friend"
                  ? t("friends.hangup")
                  : t("btn.stop"),
              style: "destructive",
              onPress: () => doStop(),
            },
          ]
        );
        return true;
      }
      if (p === "search") {
        Alert.alert(
          t("btn.stop"),
          t("mobile.live.stopSearchConfirm"),
          [
            { text: t("mobile.common.cancel"), style: "cancel" },
            {
              text: t("btn.stop"),
              style: "destructive",
              onPress: () => doStop(),
            },
          ]
        );
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

  function togglePartnerMute() {
    const next = !partnerMuted;
    setPartnerMuted(next);
    partnerMutedRef.current = next;
    mediaRef.current?.setRemoteAudioEnabled(!next);
    media2Ref.current?.setRemoteAudioEnabled(!next);
    hapticLight();
  }

  function browseTogether() {
    if (phase !== "matched") return;
    try {
      hub.browseTogether();
      setFindThirdPending(true);
      showToastRef.current(t("mobile.party.browseSent"));
      push("→ browse_together");
    } catch (e) {
      Alert.alert(t("mobile.live.errorTitle"), String(e));
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
      Alert.alert(t("mobile.live.errorTitle"), String(e));
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
      else {
        // stop typing for peer
        mediaRef.current?.sendDataMessage({ type: "typing_stop" });
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

  async function openReport() {
    const uid = partnerUserId.current;
    if (!uid) {
      Alert.alert(t("mobile.live.safetyTitle"), t("mobile.live.partnerNotReady"));
      return;
    }
    reportShotB64.current = null;
    setReportShotUri(null);
    setReportOpen(true);
    setReportCapturing(true);
    try {
      // Capture stage (remote + local PiP) before UI covers it.
      // Android SurfaceView (RTCView) may not always appear in the bitmap —
      // we still allow report without a shot.
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
    const uid = partnerUserId.current;
    if (!uid) return;
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
    const uid = partnerUserId.current;
    if (!uid || reportBusy) return;
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
      if (hard) {
        const startedAt = matchStartedAtRef.current;
        const age = startedAt > 0 ? Date.now() - startedAt : 99999;
        // Hard rebuild does closeCall+startCall — a genuine fresh offer, not a
        // restart. Never fire it before the match's 15s no-duplicate-offer
        // grace (MediaSession iceRestart grace / browser matchMediaGraceAt),
        // whether triggered by auto-retry or the manual Rebuild button.
        if (age < 15000) {
          push(`hard retry skipped — match grace age=${age}`);
          return;
        }
      }
      setRetryBusy(true);
      hapticLight();
      flashStatus(
        hard ? t("mobile.live.retryHard") : t("mobile.live.retrying")
      );
      track(hard ? "hard_retry" : "ice_retry", {
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
          // Soft: stay answerer/offerer as-is. Hard rebuild: phone drives offer.
          forceOfferer: hard,
        },
        { hard }
      );
      if (hard) {
        setRemoteStream(null);
        setRemoteEpoch((n) => n + 1);
        setAwaitingRemoteVideo(true);
        remoteVideoSeenRef.current = false;
        setRemoteVideoReady(false);
        isOffererRef.current = true;
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

  function spend(effect: string, cost: number) {
    const uid = partnerUserId.current;
    if (!uid || phase !== "matched") return;
    if (!guardAction()) return; // debounce double-taps on gift chips
    if (stars < cost) {
      Alert.alert(
        t("mobile.live.needStarsTitle"),
        t("mobile.live.needStars", { cost, stars })
      );
      return;
    }
    try {
      hub.spendStars(uid, effect);
      push(`→ spend ${effect} (−${cost}★)`);
      hapticLight();
      // Local feedback before hub echo
      const gift = GIFTS.find((g) => g.id === effect);
      if (gift) {
        setGiftFlash(`${gift.emoji}`);
        setGiftEffect(effect);
        if (giftFxTimerRef.current) clearTimeout(giftFxTimerRef.current);
        giftFxTimerRef.current = setTimeout(() => {
          setGiftFlash(null);
          setGiftEffect(null);
        }, giftFxHoldMs(effect));
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
      Alert.alert(t("mobile.live.addFriendFail"), t("mobile.live.partnerNotReady"));
      return;
    }
    try {
      hub.addFriend(code);
      setFriendAdded(true);
      push(`→ add_friend ${code}`);
      track("add_friend_match", { via: "live" });
      Alert.alert(
        t("mobile.friends.requestSentTitle"),
        t("mobile.friends.requestSent", { code })
      );
    } catch (e) {
      Alert.alert(t("mobile.friends.notConnected"), String(e));
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
  }, [remoteLive, phase]);

  const showAloneBanner = uiPhase === "search" && alone;
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

  const hasRemoteVideo =
    (remoteStream?.getVideoTracks?.()?.length ?? 0) > 0;

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

  const autoRetryCount = useAutoConnectRetry({
    phase,
    matchStartedAt,
    nowTick,
    hasRemoteVideo,
    onSoft: () => void retryConnection({ hard: false }),
    onHard: () => void retryConnection({ hard: true }),
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

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        ref={stageRef}
        style={styles.stage}
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
          secondName={extraPeers[0]?.name || t("mobile.live.peer2")}
          isFriendCall={isFriendCall}
          remoteBlurred={remoteBlurred}
          partnerMuted={partnerMuted}
          retryBusy={retryBusy}
          autoRetryCount={autoRetryCount}
          hasTurn={iceHasTurnRef.current}
          stageW={stageSize.w}
          stageH={stageSize.h}
          pipHint={pipHint}
          labels={{
            connectingPeer: t("mobile.live.connectingPeer"),
            retryHard: t("mobile.live.retryHard"),
            retrying: t("mobile.live.retrying"),
            turnReady: t("mobile.live.turnReady"),
            turnLoading: t("mobile.live.turnLoading"),
            tapToRetry: t("mobile.live.tapToRetry"),
            focus: t("mobile.live.focus"),
            pipHint: t("mobile.live.pipHint"),
            partnerMutedBadge: t("mobile.live.youMutedThem"),
          }}
          onToggleFocusExtra={() => setFocusExtra((v) => !v)}
          onRetryConnect={(hard) => void retryConnection({ hard })}
          onDoubleTapReblur={() => {
            hapticLight();
            setRemoteBlurred(true);
            showToastRef.current(t("mobile.live.reblurToast"));
          }}
          onPipHintSeen={() => setPipHint(false)}
          onSwapViews={() => setSwapViews((v) => !v)}
          onHaptic={() => hapticLight()}
        />
        <View style={styles.overlay}>
          <Pressable
            onLongPress={() => {
              if (uiPhase === "matched") copyPartnerCode();
            }}
            delayLongPress={400}
          >
            {uiPhase === "matched" ? (
              <PartnerChrome
                name={partner}
                stars={partnerStars}
                trust={partnerTrust}
                flag={partnerFlag}
                country={partnerCountry}
                city={partnerCity}
                muted={partnerMuted}
                isFriend={isFriendCall}
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
              </View>
            )}
          </Pressable>
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
          {uiPhase === "matched" && extraPeers.length > 0 ? (
            <Text style={styles.plusPeersLine}>
              {t("mobile.live.plusPeers", { n: extraPeers.length })}
            </Text>
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
                  {` · ${t("mobile.live.focus")}`}
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
                    {flagEmoji(p.flag) ? `${flagEmoji(p.flag)} ` : ""}
                    {p.name || t("mobile.live.peer2")}
                    {p.stars > 0 ? ` ★${p.stars}` : ""}
                    {` · ${
                      p.role === "friend"
                        ? t("mobile.live.roleFriend")
                        : p.role === "party"
                          ? t("mobile.live.roleParty")
                          : t("mobile.live.role3rd")
                    }`}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {uiPhase === "matched" && stayRemSecs > 0 ? (
            <View style={styles.stayPill}>
              <Text style={styles.stayPillText}>
                {t("mobile.live.stayPill", { s: stayRemSecs })}
              </Text>
            </View>
          ) : null}
          {uiPhase === "matched" && dataSaverOn ? (
            <View style={styles.dataSaverPill}>
              <Text style={styles.dataSaverPillText}>
                {t("mobile.live.dataSaverOn")}
              </Text>
            </View>
          ) : null}
          {uiPhase === "matched" && connLabel ? (
            <LiveConnPill
              conn={conn}
              connLabel={connLabel}
              callTimerText={callTimerText}
              awaitingRemoteVideo={awaitingRemoteVideo}
              connSlow={connSlow}
              linkTier={linkTier}
              linkTierLabel={linkTierLabel}
              linkRtt={linkRtt}
              linkRelay={linkRelay}
              qualityTier={qualityTier}
              showConnRetry={showConnRetry}
              showHardRetry={showHardRetry}
              retryBusy={retryBusy}
              turnBadgeLabel={t("mobile.live.turnBadge")}
              stageWaitVideoLabel={t("mobile.live.stageWaitVideo")}
              stageConnectingLabel={t("mobile.live.stageConnecting")}
              retryPathLabel={t("mobile.live.retryPath")}
              retryingLabel={t("mobile.live.retrying")}
              rebuildPathLabel={t("mobile.live.rebuildPath")}
              retryHardLabel={t("mobile.live.retryHard")}
              onSoftRetry={() => void retryConnection({ hard: false })}
              onHardRetry={() => void retryConnection({ hard: true })}
            />
          ) : null}
          {uiPhase === "matched" &&
          awaitingRemoteVideo &&
          !remoteStream?.getVideoTracks?.()?.length ? (
            <Text style={styles.waitVideoHint}>
              {t("mobile.live.waitVideoHint")}
            </Text>
          ) : null}
          {uiPhase === "matched" &&
          linkTier === "bad" &&
          !awaitingRemoteVideo &&
          matchStartedAt > 0 &&
          nowTick - matchStartedAt > 10_000 ? (
            <Text style={styles.weakLinkHint}>
              {t("mobile.live.weakLinkHint")}
            </Text>
          ) : null}
          {uiPhase === "matched" ? (
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
                  ? t("mobile.live.starReady")
                  : t("mobile.live.starUnlock", {
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

        {uiPhase === "matched" && remoteBlurred && !isFriendCall ? (
          <Pressable
            style={styles.blurOverlay}
            onPress={() => {
              hapticLight();
              setRemoteBlurred(false);
              // Force RTCView rebind after overlay removed (Android SurfaceView)
              setRemoteEpoch((n) => n + 1);
              const vt = remoteStream?.getVideoTracks?.()?.length ?? 0;
              if (vt === 0) {
                showToastRef.current(t("mobile.live.waitVideo"));
              } else {
                // Clean history snap after reveal (on-device only)
                const uid = partnerUserId.current;
                if (uid && stageRef.current) {
                  void (async () => {
                    try {
                      const { loadMatchPrefs } = await import(
                        "../src/prefs/store"
                      );
                      const p = await loadMatchPrefs();
                      if (p.historySnaps === false) return;
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
                }
              }
            }}
          >
            <Text style={styles.blurTitle}>{t("mobile.live.blurTitle")}</Text>
            {partner ? (
              <Text style={styles.blurPartner} numberOfLines={1}>
                {partner}
                {partnerFlag ? ` · ${partnerFlag}` : ""}
              </Text>
            ) : null}
            <Text style={styles.blurBody}>{t("mobile.live.blurBody")}</Text>
            <View
              style={[styles.blurBtn, remoteVideoReady && styles.blurBtnReady]}
            >
              <Text style={styles.blurBtnText}>
                {remoteVideoReady
                  ? t("mobile.live.unblurReady")
                  : t("mobile.live.unblur")}
              </Text>
            </View>
            <Text style={styles.blurHint}>
              {remoteVideoReady
                ? t("mobile.live.blurReadyHint")
                : t("mobile.live.blurHint")}
            </Text>
          </Pressable>
        ) : null}

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
          searchSecs={searchSecs}
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

      {uiPhase === "matched" ? (
        <>
          <LiveGiftBar
            starReady={starReady}
            starProgress={starProgress}
            needMin={needMin}
            elapsedSecs={elapsedSecs}
            stars={stars}
            gifts={GIFTS}
            unlockLabel={t("mobile.live.starUnlock", {
              n: needMin,
              time: `${Math.floor(elapsedSecs / 60)}:${String(
                elapsedSecs % 60
              ).padStart(2, "0")}`,
            })}
            readyLabel={t("mobile.live.starReady")}
            onLockedPress={() => {
              showToastRef.current(
                t("mobile.live.starUnlock", {
                  n: needMin,
                  time: `${Math.floor(elapsedSecs / 60)}:${String(
                    elapsedSecs % 60
                  ).padStart(2, "0")}`,
                })
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
            />
            <Pressable style={styles.chatSend} onPress={sendChat}>
              <Text style={styles.btnText}>{t("mobile.common.send")}</Text>
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

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
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
              <LiveBottomBar
                phase={uiPhase}
                friendsOnly={friendsOnly}
                isFriendCall={isFriendCall}
                stayRemSecs={stayRemSecs}
                micOn={micOn}
                camOn={camOn}
                hasLocal={!!localStream}
                partnerMuted={partnerMuted}
                moreOpen={moreOpen}
                debateActive={debate.active}
                debateISpeak={debateISpeak}
                labels={{
                  start: t("btn.start"),
                  next: t("btn.next"),
                  stayNext: (s) => t("mobile.live.stayNext", { s }),
                  stayLock: (s) => t("mobile.live.stayLock", { s }),
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
            partnerMuted={partnerMuted}
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
              flipCam: t("btn.flipCam"),
              dataSaverOn: t("mobile.settings.dataSaverOn"),
              dataSaver: t("mobile.settings.dataSaver"),
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
            onToggleBlur={() => {
              setRemoteBlurred((v) => !v);
              hapticLight();
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

