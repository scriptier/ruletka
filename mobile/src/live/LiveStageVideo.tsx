/**
 * Main stage + PiP.
 *
 * Android SurfaceView vs RN: RTCView with zOrder ≥ 1 is composited ABOVE the
 * entire RN window — PartnerChrome / styles.overlay elevation cannot win.
 * Partner remote stays zOrder 0 so chrome paints above (stage/rootMatched is
 * transparent so zOrder 0 is not buried under a solid RN slab). Self PiP uses
 * zOrder 2 when uncovered so local preview sits above the partner plane.
 *
 * Privacy: KEEP partner RTCView mounted while remoteBlurred — unmount mid-call
 * crashes react-native-webrtc on some devices. Cover with solid PartnerBlurVeil
 * (zOrder 0 + elevation). live.tsx also opens an opaque Android Modal while
 * veiled so SurfaceView cannot punch through. Self preview stays mounted.
 */
import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { flagEmoji, normalizeFlagCode } from "../identity/flagTrust";
import type { MediaStreamLike } from "../media/MediaSession";
import { BarsOverlay } from "../stars/GiftFxOverlay";
import { BrandLoadingLoop } from "./BrandLoadingLoop";
import { BrandWatermark } from "./BrandWatermark";
import { DraggablePip } from "./DraggablePip";
import { liveStyles as styles } from "./liveStyles";
import { displayPartnerStars } from "./matchPeers";
import { PartnerBlurVeil } from "./PartnerBlurVeil";
import { SwipeSkipOverlay } from "./SwipeSkipOverlay";
import type { LivePhase } from "./phase";
import { pickMultiTiles, pickStageStreams } from "./stageStreams";
import { VideoView } from "./VideoView";

export type LiveStageVideoProps = {
  phase: LivePhase | string;
  localStream: MediaStreamLike | null;
  remoteStream: MediaStreamLike | null;
  remoteStream2: MediaStreamLike | null;
  remoteEpoch: number;
  remoteEpoch2: number;
  extraPeerCount: number;
  swapViews: boolean;
  focusExtra: boolean;
  partnerName: string;
  /**
   * Short peer id/hint when partnerName is empty or "…"
   * (e.g. first 8 of user_id) so the stage HUD never reads blank.
   */
  partnerIdShort?: string;
  /** Partner ★ for linking card / labels */
  partnerStars?: number;
  /** Public trust — ★ chip falls back to this when spendable is 0 */
  partnerTrust?: number;
  partnerLoc?: string;
  /**
   * ISO flag code (e.g. CA) — painted as a separate icon top-left on partner
   * video below the identity name strip (not inlined in the name text).
   */
  partnerFlag?: string;
  /**
   * px from top of stage so flag sits below status bar + name strip
   * (identity dock is root-absolute over the video).
   */
  partnerFlagTopInset?: number;
  /** Match elapsed timer — bottom-left of partner video (replaces "Say hi…"). */
  callTimerText?: string;
  secondName: string;
  isFriendCall: boolean;
  remoteBlurred: boolean;
  /**
   * Partner hid their camera (self_hide / cam off). Show mosaic on partner tile
   * only — never pure black OLED frames. Independent of local privacy veil.
   */
  partnerCamHidden?: boolean;
  /** Local cam hidden from partner (Hide) — show badge on self preview. */
  camOn?: boolean;
  partnerMuted?: boolean;
  theyMutedMe?: boolean;
  retryBusy: boolean;
  autoRetryCount: number;
  hasTurn: boolean;
  stageW: number;
  stageH: number;
  pipHint: boolean;
  connectElapsedSecs?: number;
  /**
   * Gift effect on partner tile (e.g. "bars"). Android SurfaceView sits above
   * RN views — we drop zOrder to 0 and paint bars on the conversationalist tile.
   */
  partnerFx?: string | null;
  /** Gift effect on self cam (when someone barred you). */
  selfFx?: string | null;
  barsCaption?: string;
  /** When set, stage draws the full privacy veil + Unblur card (hides clear RTCView). */
  blurVeil?: {
    title: string;
    body: string;
    buttonLabel: string;
    hint: string;
    partnerLabel?: string;
    ready?: boolean;
    onUnblur: () => void;
  } | null;
  labels: {
    connectingPeer: string;
    linkingCameras?: string;
    findingPath?: string;
    tryingRelay?: string;
    retryHard: string;
    retrying: string;
    turnReady: string;
    turnLoading: string;
    tapToRetry: string;
    retryPath?: string;
    focus: string;
    pipHint: string;
    partnerMutedBadge?: string;
    theyMutedYouBadge?: string;
    longPressReport?: string;
    /** Badge when local cam is Hidden from partner */
    selfHiddenBadge?: string;
    /** Short "Show video" label for the compact blur-veil pip/tile badge. */
    unblurShort?: string;
    /** Partner hid their camera (self_hide) — full card title */
    partnerHiddenTitle?: string;
    /** Partner hide body copy */
    partnerHiddenBody?: string;
    /** Partner hide hint (no local unblur — they must reveal) */
    partnerHiddenHint?: string;
    /** Compact badge when partner is in PiP while hidden */
    partnerHiddenBadge?: string;
    /** Stage HUD pending loc (hub geo race) — never use for hide_ip */
    locPending?: string;
  };
  onToggleFocusExtra: () => void;
  onRetryConnect: (hard: boolean) => void;
  onReport?: () => void;
  onDoubleTapReblur: () => void;
  onPipHintSeen: () => void;
  onSwapViews: () => void;
  onHaptic: () => void;
  /**
   * Swipe left/right on partner main stage → Next (same path as Next button).
   * Default ON via prefs.swipeSkip. Disabled for friend calls / multi-remote /
   * partner-in-PiP / interactive privacy veil (Unblur must stay tappable).
   */
  onSwipeNext?: () => void;
  /** Pref gate (default true). When false, no swipe gesture. */
  swipeSkip?: boolean;
  /** i18n "Next" label while dragging (optional polish). */
  swipeNextLabel?: string;
  /**
   * On-stage partner name/★/loc card (primary identity belt).
   * Default false for non-matched callers; live.tsx must pass true when
   * matched — Android SurfaceView often hides Modal PartnerChrome (second
   * belt). Compact top-right; always paint name / ★ max(stars,trust) / loc.
   */
  showStagePartnerHud?: boolean;
};

export function LiveStageVideo(props: LiveStageVideoProps) {
  const {
    phase,
    localStream,
    remoteStream,
    remoteStream2,
    remoteEpoch,
    remoteEpoch2,
    extraPeerCount,
    swapViews,
    focusExtra,
    partnerName,
    partnerIdShort = "",
    partnerStars = 0,
    partnerTrust = 0,
    partnerLoc = "",
    partnerFlag = "",
    partnerFlagTopInset = 72,
    callTimerText = "",
    secondName,
    isFriendCall,
    remoteBlurred,
    partnerCamHidden = false,
    camOn = true,
    partnerMuted = false,
    theyMutedMe = false,
    retryBusy,
    autoRetryCount,
    connectElapsedSecs = 0,
    stageW,
    stageH,
    pipHint,
    partnerFx = null,
    selfFx = null,
    barsCaption,
    blurVeil = null,
    labels: L,
    onToggleFocusExtra,
    onRetryConnect,
    onReport,
    onDoubleTapReblur,
    onPipHintSeen,
    onSwapViews,
    onHaptic,
    onSwipeNext,
    swipeSkip = true,
    swipeNextLabel,
    showStagePartnerHud = false,
  } = props;

  /**
   * Privacy blur (eye / intro / hold).
   *
   * KEEP partner RTCView mounted while veiled — unmounting SurfaceView mid-call
   * crashes react-native-webrtc on some devices when a stranger connects.
   * Cover with solid PartnerBlurVeil (+ Android fullscreen Modal from live.tsx).
   * Stream always stays in parent state.
   */
  const privacyBlur = !!remoteBlurred;
  // Partner on main stage (normal) vs partner in PiP (swapped)
  const partnerOnMain = !swapViews;
  const partnerOnPip = swapViews;
  /**
   * Partner self-hide (they replaced outbound with black / cam off).
   * Cover partner tile only — never force-cover self PiP. Privacy veil wins
   * when both are on (privacy already covers partner).
   */
  const partnerHideOn = !!partnerCamHidden && !privacyBlur;
  const coverMainPartnerHide = partnerHideOn && partnerOnMain;
  const coverPipPartnerHide = partnerHideOn && partnerOnPip;
  // Partner-facing Show-video CTA only on the tile that shows partner (privacy)
  const coverMainPartner = privacyBlur && partnerOnMain;
  const coverPipPartner = privacyBlur && partnerOnPip;
  // Opaque cover only on partner tile (nuclear / partner-hide) — not self
  const coverMain = coverMainPartner || coverMainPartnerHide;
  const coverPip = coverPipPartner || coverPipPartnerHide;
  // Bars / mute / hide / privacy need zOrder 0 so RN overlays paint above SurfaceView.
  const partnerBars = partnerFx === "bars";
  const selfBars = selfFx === "bars";
  // Normal layout: main = partner, pip = self. Swapped: main = self, pip = partner.
  const mainBars = (!swapViews && partnerBars) || (swapViews && selfBars);
  const pipBars = (!swapViews && selfBars) || (swapViews && partnerBars);

  // Smoke: one line when nuclear veil mounts / unmounts (skip initial false)
  const prevPrivacyBlur = useRef(privacyBlur);
  useEffect(() => {
    if (privacyBlur === prevPrivacyBlur.current) return;
    prevPrivacyBlur.current = privacyBlur;
    if (privacyBlur) {
      console.log(
        `[blur] show why=stage main=${coverMainPartner ? "partner" : "self"} pip=${coverPipPartner ? "partner" : "self"} keepRtc=1`
      );
    } else {
      console.log("[blur] hide why=stage keepRtc=1");
    }
  }, [privacyBlur, coverMainPartner, coverPipPartner]);

  const prevPartnerHide = useRef(partnerHideOn);
  useEffect(() => {
    if (partnerHideOn === prevPartnerHide.current) return;
    prevPartnerHide.current = partnerHideOn;
    console.log(
      `[blur] partner_hide on=${partnerHideOn ? 1 : 0} main=${coverMainPartnerHide ? 1 : 0} pip=${coverPipPartnerHide ? 1 : 0}`
    );
  }, [partnerHideOn, coverMainPartnerHide, coverPipPartnerHide]);

  const emptyStatus =
    connectElapsedSecs >= 8 && L.tryingRelay
      ? L.tryingRelay
      : connectElapsedSecs >= 3 && L.findingPath
        ? L.findingPath
        : L.linkingCameras || L.connectingPeer;

  // Mid-stage mute icon only — no text banners (user 2026-08-11).
  // Show when you muted partner OR they muted you.
  const showPartnerMute =
    phase === "matched" && !!(partnerMuted || theyMutedMe);
  void L.partnerMutedBadge;
  void L.theyMutedYouBadge;

  /** Stage HUD label — never blank (short id / "Partner" if hub name empty). */
  const stagePartnerLabel = (() => {
    const raw = (partnerName || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();
    // Hub sometimes sends the literal "Partner" placeholder — treat as empty
    // so short peer id wins (device smoke: chrome said Partner, dock had hex).
    const empty =
      !raw ||
      raw === "…" ||
      raw === "..." ||
      raw === "?" ||
      raw === "？" ||
      /^partner$/i.test(raw);
    const short = (partnerIdShort || "").trim();
    if (!empty) return raw;
    if (short) return short;
    return "Partner";
  })();
  // max(spendable, trust) — same rule as PartnerChrome / displayPartnerStars
  const stagePartnerStars = displayPartnerStars(
    Number(partnerStars) || 0,
    Number(partnerTrust) || 0
  );

  // Separate flag chip on partner video (hide_ip still shows if hub sent flag).
  const stageFlagCode = normalizeFlagCode(partnerFlag);
  const stageFlagEm = stageFlagCode ? flagEmoji(stageFlagCode) : "";
  const stageFlagLabel = stageFlagEm || stageFlagCode;
  const showStageFlag = !!stageFlagLabel;
  // Sit below PartnerIdentityDock top strip (name · ★ · loc).
  const stageFlagTop = Math.max(
    8,
    Number.isFinite(partnerFlagTopInset) ? partnerFlagTopInset : 72
  );

  const {
    multiRemote,
    hasRemote,
    remoteHasVideo,
    waitingPeer,
    mainStream,
    pipStream,
    mainMirror,
    pipMirror,
  } = pickStageStreams({
    phase,
    localStream,
    remoteStream,
    remoteStream2,
    extraPeerCount,
    swapViews,
  });

  // PC remote-empty parity: brand loop while idle/search with no partner
  const brandLoop =
    !multiRemote && !hasRemote && (phase === "idle" || phase === "search");
  const displayMainStream = brandLoop ? null : mainStream;
  const displayPipStream = brandLoop ? localStream : pipStream;
  // Brand main has no RTC stream; PiP shows local (mirrored) during brandLoop.
  const displayMainMirror = brandLoop ? false : mainMirror;
  const displayPipMirror = brandLoop ? true : pipMirror;

  /**
   * Android SurfaceView (RTCView) zOrder ≥ 1 composites ABOVE all RN views —
   * PartnerChrome / overlay elevation lose once media is live. Partner remote
   * therefore always uses zOrder 0. Self PiP stays 2 when not covered.
   * Partner-hide / bars / mute: covered tiles stay at 0.
   * Matched + swapped (self on main): main also 0 so chrome stays readable.
   */
  const mainShowsPartner = !swapViews;
  const pipShowsPartner = !!swapViews;
  // Partner stays at zOrder 0 so PartnerBlurVeil elevation can cover SurfaceView.
  const mainZOrder =
    coverMainPartnerHide ||
    mainBars ||
    (showPartnerMute && !swapViews) ||
    (!camOn && swapViews) ||
    mainShowsPartner ||
    phase === "matched"
      ? 0
      : 1;
  const pipZOrder =
    coverPipPartnerHide ||
    pipBars ||
    (!camOn && !swapViews) ||
    (showPartnerMute && swapViews) ||
    pipShowsPartner
      ? 0
      : 2;

  /** Always mount when stream exists (unmount-while-veiled = native crash risk). */
  const mountMainVideo = !!displayMainStream;
  const mountPipVideo = !!displayPipStream;

  const { tileA, tileB } = pickMultiTiles({
    focusExtra,
    mainStream,
    remoteStream2,
    remoteEpoch,
    remoteEpoch2,
    swapViews,
    mainMirror,
    partnerName: partnerName || "…",
    secondName,
  });

  const remoteTapRef = useRef(0);
  // Keep PiP always mounted (search→match) — hide/show remount was visible flicker.
  // Privacy covers with PartnerBlurVeil; never unmount partner RTCView while veiled.

  /**
   * Swipe-to-next on partner main stage only.
   * Skip multi-remote split, friend 1v1, partner-in-PiP, and interactive
   * privacy/hide covers so Unblur + veil presses stay intact.
   */
  const swipeActive =
    !!onSwipeNext &&
    swipeSkip !== false &&
    phase === "matched" &&
    !isFriendCall &&
    !multiRemote &&
    partnerOnMain &&
    !!mainStream &&
    !coverMainPartner &&
    !coverMainPartnerHide;

  const handleSwipeCommit = (_dir: -1 | 1) => {
    onHaptic();
    onSwipeNext?.();
  };

  const handleSwipeDoubleTap = () => {
    if (isFriendCall || remoteBlurred) return;
    onDoubleTapReblur();
  };

  const handleSwipeLongPress = () => {
    if (isFriendCall || !onReport) return;
    onReport();
  };

  return (
    <>
      {multiRemote ? (
        <View style={styles.splitRemote}>
          {[tileA, tileB].map((tile, idx) => (
            <Pressable
              key={idx}
              style={[styles.splitTile, idx === 0 && styles.splitTileFocus]}
              accessibilityRole="button"
              accessibilityLabel={
                privacyBlur
                  ? undefined
                  : `${tile.name}${idx === 0 ? ` · ${L.focus}` : ""}`
              }
              onPress={() => {
                if (privacyBlur && blurVeil) {
                  onHaptic();
                  blurVeil.onUnblur();
                  return;
                }
                if (extraPeerCount === 0 && !remoteStream2) return;
                onHaptic();
                onToggleFocusExtra();
              }}
            >
              {/* Keep remote RTCView mounted under veil — unmount mid-call crashes. */}
              {tile.stream && !tile.placeholder ? (
                <VideoView
                  stream={tile.stream}
                  streamEpoch={tile.epoch}
                  mirror={tile.mirror}
                  style={styles.remoteFill}
                  zOrder={
                    (privacyBlur || partnerHideOn) && idx === 0
                      ? 0
                      : mainZOrder
                  }
                />
              ) : (
                <View style={[styles.remoteFill, styles.videoPlaceholder]}>
                  {tile.isExtra || waitingPeer ? (
                    <>
                      <Text style={styles.splitPlaceholder}>{tile.name}</Text>
                      <Text style={styles.splitPlaceholderSub}>
                        {L.connectingPeer}
                      </Text>
                    </>
                  ) : null}
                </View>
              )}
              {privacyBlur ? (
                <PartnerBlurVeil
                  compact
                  title={blurVeil?.title}
                  partnerLabel={tile.name || partnerName}
                  buttonLabel={L.unblurShort}
                  style={[styles.remoteFill, styles.blurUnderlay]}
                  onPress={() => {
                    onHaptic();
                    blurVeil?.onUnblur();
                  }}
                />
              ) : partnerHideOn && idx === 0 ? (
                <PartnerBlurVeil
                  compact
                  title={
                    L.partnerHiddenBadge ||
                    L.partnerHiddenTitle ||
                    "Hidden"
                  }
                  partnerLabel={tile.name || partnerName}
                  style={[styles.remoteFill, styles.blurUnderlay]}
                />
              ) : null}
              {!privacyBlur && !(partnerHideOn && idx === 0) ? (
                <Text style={styles.splitLabel} numberOfLines={1}>
                  {tile.name}
                  {idx === 0 ? ` · ${L.focus}` : ""}
                </Text>
              ) : null}
              {showPartnerMute &&
              idx === 0 &&
              !swapViews &&
              !privacyBlur &&
              !partnerHideOn ? (
                <View style={styles.partnerMuteOverlay} pointerEvents="none">
                  <Text style={styles.partnerMuteWatermark}>🔇</Text>
                </View>
              ) : null}
              {partnerBars && idx === 0 && !privacyBlur && !partnerHideOn ? (
                <View style={styles.barsOnTile} pointerEvents="none">
                  <BarsOverlay />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.remoteFill} collapsable={false}>
          {/*
            Partner privacy: RTCView stays mounted; PartnerBlurVeil covers it.
            Android also gets opaque Modal from live.tsx while veiled.
            When swipeActive, SwipeSkipOverlay wraps stage content for gestures.
          */}
          <SwipeSkipOverlay
            enabled={swipeActive}
            onCommit={handleSwipeCommit}
            onHaptic={onHaptic}
            onDoubleTap={
              swipeActive && !isFriendCall ? handleSwipeDoubleTap : undefined
            }
            onLongPress={
              swipeActive && !isFriendCall && onReport
                ? handleSwipeLongPress
                : undefined
            }
            nextLabel={swipeNextLabel}
            style={styles.remoteFill}
          >
          {mountMainVideo ? (
            <VideoView
              stream={displayMainStream}
              streamEpoch={swapViews ? 0 : remoteEpoch}
              mirror={displayMainMirror}
              style={styles.remoteFill}
              zOrder={mainZOrder}
            />
          ) : brandLoop ? (
            /* PC remote-empty: brand animation full-stage while idle/search. */
            <BrandLoadingLoop active />
          ) : coverMainPartner ? (
            /* No stream yet: solid underlay; veil paints above. */
            <View
              style={[styles.remoteFill, styles.blurUnderlay]}
              collapsable={false}
              pointerEvents="none"
            />
          ) : (
            <Pressable
              style={[styles.remoteFill, styles.videoPlaceholder]}
              accessibilityRole={phase === "matched" ? "button" : undefined}
              accessibilityLabel={
                phase === "matched"
                  ? [
                      partnerName || undefined,
                      partnerLoc || undefined,
                      retryBusy
                        ? autoRetryCount >= 2
                          ? L.retryHard
                          : L.retrying
                        : emptyStatus,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : undefined
              }
              accessibilityHint={
                phase === "matched" && onReport ? L.longPressReport : undefined
              }
              onPress={() => {
                if (phase !== "matched") return;
                if (coverMainPartner && blurVeil) {
                  onHaptic();
                  blurVeil.onUnblur();
                  return;
                }
                onRetryConnect(autoRetryCount >= 1 || connectElapsedSecs >= 15);
              }}
              onLongPress={() => {
                if (phase !== "matched" || !onReport) return;
                onHaptic();
                onReport();
              }}
              delayLongPress={450}
              disabled={phase !== "matched" || retryBusy}
            >
              {phase === "matched" ? (
                <View style={styles.connectCard} collapsable={false}>
                  <View style={styles.connectPulseOuter} pointerEvents="none">
                    <View style={styles.connectPulseInner} />
                  </View>
                  <Text style={styles.splitPlaceholder} numberOfLines={1}>
                    {(partnerName || "").trim() || "Partner"}
                    {stagePartnerStars > 0
                      ? ` · ★${stagePartnerStars}`
                      : ""}
                  </Text>
                  {partnerLoc ? (
                    <Text style={styles.splitPlaceholderSub} numberOfLines={1}>
                      {partnerLoc}
                    </Text>
                  ) : null}
                  <Text style={styles.splitPlaceholderSub}>
                    {retryBusy
                      ? autoRetryCount >= 2
                        ? L.retryHard
                        : L.retrying
                      : emptyStatus}
                    {connectElapsedSecs >= 1
                      ? ` · ${connectElapsedSecs}s`
                      : ""}
                  </Text>
                  {connectElapsedSecs >= 6 && !retryBusy ? (
                    <View style={styles.stageRetryChip}>
                      <Text style={styles.stageRetryChipText}>
                        {L.retryPath || L.tapToRetry}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          )}
          {/*
            Partner tile veil: full Show-video card (privacy) or partner-hide
            copy. Self-on-main is never covered while privacy (self stays live).
          */}
          {coverMain ? (
            <View
              style={[
                styles.remoteFill,
                styles.blurUnderlay,
                // Solid mid-tone always — never transparent over SurfaceView
                { zIndex: 50, elevation: 32, backgroundColor: "#45536c" },
              ]}
              collapsable={false}
              removeClippedSubviews={false}
              pointerEvents="auto"
            >
              {coverMainPartner ? (
                <PartnerBlurVeil
                  title={blurVeil?.title}
                  partnerLabel={blurVeil?.partnerLabel || partnerName}
                  body={blurVeil?.body}
                  buttonLabel={blurVeil?.buttonLabel}
                  hint={blurVeil?.hint}
                  ready={!!blurVeil?.ready}
                  style={[styles.remoteFill, styles.blurUnderlay]}
                  onPress={() => {
                    onHaptic();
                    if (blurVeil?.onUnblur) blurVeil.onUnblur();
                  }}
                />
              ) : (
                <PartnerBlurVeil
                  title={
                    L.partnerHiddenTitle || "Partner hidden"
                  }
                  partnerLabel={stagePartnerLabel}
                  body={
                    L.partnerHiddenBody ||
                    "They hid their camera"
                  }
                  hint={
                    L.partnerHiddenHint ||
                    "Show when they reveal"
                  }
                  style={[styles.remoteFill, styles.blurUnderlay]}
                />
              )}
            </View>
          ) : null}
          {/*
            Bars over conversationalist — main RTCView at zOrder 0 so RN
            paints BarsOverlay above. Skip while privacy veil covers partner.
          */}
          {mainBars && !coverMainPartner && !coverMainPartnerHide ? (
            <View style={styles.barsOnTile} pointerEvents="none">
              <BarsOverlay />
              {barsCaption && !swapViews ? (
                <Text style={styles.barsOnTileCaption} numberOfLines={1}>
                  {barsCaption}
                </Text>
              ) : null}
            </View>
          ) : null}
          {/* Swapped views: local fills main — show Hide badge */}
          {!camOn && swapViews && mountMainVideo && L.selfHiddenBadge ? (
            <View style={styles.selfHiddenMain} pointerEvents="none">
              <Text style={styles.selfHiddenBadgeMain} numberOfLines={1}>
                {L.selfHiddenBadge}
              </Text>
            </View>
          ) : null}
          {showPartnerMute &&
          !swapViews &&
          !coverMainPartner &&
          !coverMainPartnerHide ? (
            <View style={styles.partnerMuteOverlay} pointerEvents="none">
              {/* Center mute icon only — no "You muted · no sound" text chip */}
              <Text style={styles.partnerMuteWatermark}>🔇</Text>
            </View>
          ) : null}
          {phase === "matched" &&
          hasRemote &&
          !swapViews &&
          !coverMainPartner &&
          !coverMainPartnerHide ? (
            <BrandWatermark animKey={remoteEpoch} />
          ) : null}
          </SwipeSkipOverlay>
          {/*
            Partner flag chip — OUTSIDE swipe stack so it does not translate.
            Top-left of partner video, below PartnerIdentityDock name strip.
            hide_ip: still paint when hub sent cosmetic flag. Empty → none.
          */}
          {showStageFlag &&
          phase === "matched" &&
          partnerOnMain &&
          !coverMainPartner &&
          !coverMainPartnerHide ? (
            <View
              style={[styles.partnerFlagChip, { top: stageFlagTop }]}
              pointerEvents="none"
              collapsable={false}
              removeClippedSubviews={false}
              accessibilityLabel={`Flag ${stageFlagCode}`}
              testID="live-partner-flag-chip"
            >
              {stageFlagEm ? (
                <Text style={styles.partnerFlagChipEmoji}>{stageFlagEm}</Text>
              ) : (
                <Text style={styles.partnerFlagChipCode}>{stageFlagCode}</Text>
              )}
            </View>
          ) : null}
          {/* Call timer bottom-left of partner video (replaces "Say hi in chat…") */}
          {phase === "matched" &&
          partnerOnMain &&
          !coverMainPartner &&
          !coverMainPartnerHide &&
          callTimerText ? (
            <View
              style={styles.partnerCallTimerChip}
              pointerEvents="none"
              collapsable={false}
              accessibilityRole="text"
              accessibilityLabel={callTimerText}
              testID="live-partner-call-timer"
            >
              <Text style={styles.partnerCallTimerText}>{callTimerText}</Text>
            </View>
          ) : null}
          {/*
            Primary identity belt — OUTSIDE swipe/veil stack so name/★/loc
            always paints above nuclear mosaic (veil elev 28) and survives
            swipe translate. PartnerChrome Modal is the second belt.
          */}
          {showStagePartnerHud && phase === "matched" && partnerOnMain ? (
            <View
              style={styles.stagePartnerHud}
              pointerEvents="none"
              collapsable={false}
              removeClippedSubviews={false}
            >
              <Text style={styles.stagePartnerHudStars} numberOfLines={1}>
                {`★ ${stagePartnerStars}`}
              </Text>
              <Text
                style={styles.stagePartnerHudName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {stagePartnerLabel}
              </Text>
              {/* Only real/hidden loc — never infinite "Looking up…" (Pixel smoke) */}
              {partnerLoc ? (
                <Text
                  style={
                    /hidden|looking/i.test(partnerLoc)
                      ? styles.stagePartnerHudLocDim
                      : styles.stagePartnerHudLoc
                  }
                  numberOfLines={1}
                >
                  {partnerLoc}
                </Text>
              ) : null}
            </View>
          ) : null}
          {/*
            Fallback double-tap reblur + long-press report when swipe is off
            (pref / friend / swapped / veiled). Swipe path owns these gestures.
          */}
          {!swipeActive &&
          phase === "matched" &&
          hasRemote &&
          !swapViews &&
          !coverMainPartner &&
          !coverMainPartnerHide ? (
            <Pressable
              style={styles.remoteTapLayer}
              accessibilityRole="button"
              accessibilityLabel={partnerName || undefined}
              accessibilityHint={
                !isFriendCall && onReport ? L.longPressReport : undefined
              }
              onPress={() => {
                if (isFriendCall || remoteBlurred) return;
                const now = Date.now();
                if (now - remoteTapRef.current < 320) {
                  remoteTapRef.current = 0;
                  onDoubleTapReblur();
                } else {
                  remoteTapRef.current = now;
                }
              }}
              onLongPress={() => {
                if (isFriendCall || !onReport) return;
                onHaptic();
                onReport();
              }}
              delayLongPress={450}
            />
          ) : null}
        </View>
      )}
      {/*
        PiP: keep stream mounted always (self or partner). Privacy covers partner
        tile with PartnerBlurVeil — never unmount RTCView while veiled.
      */}
      {(mountPipVideo || coverPip) && !multiRemote ? (
        <DraggablePip
          stageW={stageW}
          stageH={stageH}
          showHint={pipHint}
          hintText={L.pipHint}
          onHintSeen={onPipHintSeen}
          onDoubleTap={() => {
            if (!hasRemote || !remoteHasVideo) return;
            if (coverPipPartner && blurVeil) {
              onHaptic();
              blurVeil.onUnblur();
              return;
            }
            onHaptic();
            onSwapViews();
          }}
        >
          {mountPipVideo ? (
            <VideoView
              stream={displayPipStream}
              streamEpoch={swapViews ? remoteEpoch : 0}
              mirror={displayPipMirror}
              style={styles.pipVideo}
              zOrder={pipZOrder}
            />
          ) : (
            <View
              style={[styles.pipVideo, styles.blurUnderlay]}
              collapsable={false}
              pointerEvents="none"
            />
          )}
          {coverPip ? (
            coverPipPartner ? (
              <PartnerBlurVeil
                compact
                partnerLabel={partnerName}
                buttonLabel={L.unblurShort}
                style={[styles.pipVideo, styles.blurUnderlay]}
                onPress={() => {
                  onHaptic();
                  blurVeil?.onUnblur();
                }}
              />
            ) : (
              <PartnerBlurVeil
                compact
                partnerLabel={partnerName}
                title={
                  L.partnerHiddenBadge ||
                  L.partnerHiddenTitle ||
                  "Hidden"
                }
                style={[styles.pipVideo, styles.blurUnderlay]}
              />
            )
          ) : null}
          {pipBars && !coverPipPartner && !coverPipPartnerHide ? (
            <View style={styles.barsOnPip} pointerEvents="none">
              <BarsOverlay />
            </View>
          ) : null}
          {/* Mute icon only on PiP when views swapped */}
          {showPartnerMute &&
          swapViews &&
          !coverPipPartner &&
          !coverPipPartnerHide ? (
            <View style={styles.partnerMuteOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermarkPip}>🔇</Text>
            </View>
          ) : null}
          {/* Compact flag when partner is in PiP (swapped views) */}
          {showStageFlag &&
          partnerOnPip &&
          !coverPipPartner &&
          !coverPipPartnerHide ? (
            <View
              style={styles.partnerFlagChipPip}
              pointerEvents="none"
              collapsable={false}
              accessibilityLabel={`Flag ${stageFlagCode}`}
              testID="live-partner-flag-chip-pip"
            >
              {stageFlagEm ? (
                <Text style={styles.partnerFlagChipEmojiPip}>
                  {stageFlagEm}
                </Text>
              ) : (
                <Text style={styles.partnerFlagChipCodePip}>
                  {stageFlagCode}
                </Text>
              )}
            </View>
          ) : null}
          {/* Compact call timer on partner PiP when views swapped */}
          {phase === "matched" &&
          partnerOnPip &&
          !coverPipPartner &&
          !coverPipPartnerHide &&
          callTimerText ? (
            <View
              style={styles.partnerCallTimerChipPip}
              pointerEvents="none"
              collapsable={false}
              accessibilityRole="text"
              accessibilityLabel={callTimerText}
              testID="live-partner-call-timer-pip"
            >
              <Text style={styles.partnerCallTimerTextPip}>{callTimerText}</Text>
            </View>
          ) : null}
          {/* Self Hide badge only on the surface that shows self (PiP = local when not swapped) */}
          {!camOn && !swapViews && mountPipVideo && L.selfHiddenBadge ? (
            <View style={styles.selfHiddenOverlay} pointerEvents="none">
              <Text style={styles.selfHiddenBadge} numberOfLines={1}>
                {L.selfHiddenBadge}
              </Text>
            </View>
          ) : null}
        </DraggablePip>
      ) : null}
      {multiRemote && localStream ? (
        <DraggablePip
          stageW={stageW}
          stageH={stageH}
          showHint={false}
          hintText=""
          onHintSeen={() => {}}
          onDoubleTap={() => {
            onHaptic();
            onToggleFocusExtra();
          }}
        >
          {/* Self PiP stays mounted during privacy (partner tiles covered). */}
          <VideoView
            stream={localStream}
            streamEpoch={0}
            mirror
            style={styles.pipVideo}
            zOrder={pipZOrder}
          />
          {!camOn && L.selfHiddenBadge ? (
            <View style={styles.selfHiddenOverlay} pointerEvents="none">
              <Text style={styles.selfHiddenBadge} numberOfLines={1}>
                {L.selfHiddenBadge}
              </Text>
            </View>
          ) : null}
        </DraggablePip>
      ) : null}
    </>
  );
}
