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
 * crashes react-native-webrtc on some devices. Product path is SoftBlurRemote
 * (native VideoSink soft blur) for intro, hold, and eye when native is present.
 * PartnerBlurVeil is fallback only when !softBlurNative (iOS / missing native).
 * Partner hide / advertised no-cam uses NoCamPortrait — not privacy blur.
 */
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { NoCamPortrait } from "./NoCamPortrait";
import type { MediaStreamLike } from "../media/MediaSession";
import {
  BarsOverlay,
  FenceOverlay,
  GiftFxOverlay,
} from "../stars/GiftFxOverlay";
import { BrandLoadingLoop } from "./BrandLoadingLoop";
import { BrandWatermark } from "./BrandWatermark";
import { DraggablePip } from "./DraggablePip";
import { liveStyles as styles } from "./liveStyles";
import { displayPartnerStars } from "./matchPeers";
import { MuteMark } from "./MuteMark";
import { PartnerBlurVeil } from "./PartnerBlurVeil";
import {
  SoftBlurRemote,
  getStreamUrl,
  isSoftBlurNativeAvailable,
} from "./SoftBlurRemote";
import { SwipeSkipOverlay } from "./SwipeSkipOverlay";
import type { LivePhase } from "./phase";
import {
  pickStageChromeLayout,
  pickStageStreams,
  shouldLockFirstRemote,
  shouldShowExtraRemoteTile,
  shouldShowExtraRemoteTile3,
} from "./stageStreams";
import { VideoView } from "./VideoView";
import { flagEmoji } from "../identity/flagTrust";

export type LiveStageVideoProps = {
  phase: LivePhase | string;
  localStream: MediaStreamLike | null;
  remoteStream: MediaStreamLike | null;
  remoteStream2: MediaStreamLike | null;
  /** Third remote (4-way: you + 3 remotes). Optional until media3 binds. */
  remoteStream3?: MediaStreamLike | null;
  remoteEpoch: number;
  remoteEpoch2: number;
  remoteEpoch3?: number;
  extraPeerCount: number;
  /**
   * Find-3rd / party browse: one partner live, still hunting stranger.
   * Phone shows **top = partner · bottom = brand “looking for 3rd”**
   * (horizontal midline — not PC side-by-side columns).
   */
  lookingForThird?: boolean;
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
   * ISO flag code — kept for API parity with live.tsx.
   * Stage no longer paints a flag chip; PartnerIdentityDock owns flag.
   */
  partnerFlag?: string;
  /**
   * Legacy inset for the removed stage flag chip. Dock owns flag placement.
   */
  partnerFlagTopInset?: number;
  /** Match elapsed timer — bottom-left of partner video (replaces "Say hi…"). */
  callTimerText?: string;
  /** Conversationalist friend code — painted on split chrome, not the name. */
  partnerCode?: string;
  secondName: string;
  /** 4-way third remote display name (extraPeers[1]). */
  thirdName?: string;
  /** Optional loc/stars/volume/flag for extra remotes (live.tsx may pass later). */
  secondLoc?: string;
  secondStars?: number;
  secondTrust?: number;
  /** ISO or emoji — ExtraRemoteTile chrome chip, not loc text. */
  secondFlag?: string;
  secondHideIp?: boolean;
  thirdLoc?: string;
  thirdStars?: number;
  thirdTrust?: number;
  thirdFlag?: string;
  secondCode?: string;
  thirdCode?: string;
  partnerVolume?: number;
  secondVolume?: number;
  thirdVolume?: number;
  onPartnerVolume?: () => void;
  onSecondVolume?: () => void;
  onThirdVolume?: () => void;
  /**
   * Optional 2×2 of the same four people. Ignored unless 4 people
   * (stream3 + extraPeerCount>=2). Default stacked column.
   */
  grid2x2?: boolean;
  onToggleGrid2x2?: () => void;
  isFriendCall: boolean;
  remoteBlurred: boolean;
  /**
   * Partner hid their camera (self_hide / cam off). Show mosaic on partner tile
   * only — never pure black OLED frames. Independent of local privacy veil.
   */
  partnerCamHidden?: boolean;
  /** Peer advertised no camera (laptop GUM 0 video tracks). Not "video still linking". */
  partnerNoCam?: boolean;
  /** 3rd/4th advertised no camera — ExtraRemoteTile cylinder, not Almost there. */
  extraNoCam2?: boolean;
  extraNoCam3?: boolean;
  /**
   * ICE + remote media ready. SoftBlur native sink must NOT attach during
   * Linking (second VideoSink on DecodingQueue → SIGABRT). Idle until true.
   */
  mediaReady?: boolean;
  /**
   * Soft live-blur is ON for intro, hold, and eye when native is available.
   * PartnerBlurVeil is fallback only when !softBlurNative. Default true —
   * do not gate on intro.
   */
  allowSoftBlur?: boolean;
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
  /** 3-way: gift overlay on extra0 / extra1 tiles (not full-stage). */
  extraGiftFx0?: string | null;
  extraGiftFx1?: string | null;
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
    /** No-camera tile (broken / missing webcam) */
    noCamTitle?: string;
    noCamSub?: string;
    /** Stage HUD pending loc (hub geo race) — never use for hide_ip */
    locPending?: string;
    /** Find-3rd empty half caption (PC “Ищем третьего…”) */
    lookingForThird?: string;
    /** Empty loc on a remote tile */
    locationHidden?: string;
    grid2x2?: string;
    stackTiles?: string;
  };
  onToggleFocusExtra: () => void;
  /**
   * Tap a conversationalist tile → that person's actions.
   * Extra tiles call extra0/extra1 instead of toggling focus when set.
   */
  onSelectPartner?: (slot: "primary" | "extra0" | "extra1") => void;
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
  /** 3-way: swipe extra0 (3rd person) to drop them, keep the pair. */
  onSwipeDropExtra?: () => void;
  /**
   * Idle Start screen: swipe the brand/top video left or right → Start search.
   */
  onSwipeStart?: () => void;
  /** Pref gate (default true). When false, no swipe gesture. */
  swipeSkip?: boolean;
  /** i18n "Next" label while dragging (optional polish). */
  swipeNextLabel?: string;
  /** i18n "Start" stamp while dragging idle video. */
  swipeStartLabel?: string;
  /**
   * On-stage partner name/★/loc card (primary identity belt).
   * Default false for non-matched callers; live.tsx must pass true when
   * matched — Android SurfaceView often hides Modal PartnerChrome (second
   * belt). Compact top-right; always paint name / ★ max(stars,trust) / loc.
   */
  showStagePartnerHud?: boolean;
};

/** ISO → regional-indicator emoji; already-emoji / short ISO pass through. */
function tileFlagGlyph(raw?: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  return flagEmoji(s) || (s.length <= 4 ? s : "");
}

function locTextWithoutFlag(loc: string, flagGlyph: string): string {
  let text = (loc || "").trim();
  if (!flagGlyph || !text.startsWith(flagGlyph)) return text;
  return text
    .slice(flagGlyph.length)
    .replace(/^\s*[·•.\-]+\s*/, "")
    .trim();
}

function StageTileChrome(props: {
  name: string;
  stars: number;
  loc: string;
  locationHidden: string;
  /** Emoji or ISO — painted beside ★, never baked into loc. */
  flag?: string;
  focused?: boolean;
  focusLabel?: string;
  /** Friend code — dim line under loc. Hidden when it matches name. */
  code?: string;
  /** Only then show “Location hidden”. Empty geo is not hide-IP. */
  hideIp?: boolean;
}) {
  const flagGlyph = tileFlagGlyph(props.flag);
  const loc = locTextWithoutFlag(props.loc, flagGlyph);
  const locText = loc || (props.hideIp ? props.locationHidden : "");
  const locDim = !loc || /hidden|looking/i.test(loc);
  const code = String(props.code || "").trim().toUpperCase();
  const showCode =
    !!code &&
    code.length >= 4 &&
    code !== String(props.name || "").trim().toUpperCase();
  return (
    <View
      style={styles.splitTileChrome}
      pointerEvents="none"
      collapsable={false}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        collapsable={false}
      >
        {flagGlyph ? (
          <Text style={styles.splitTileChromeStars} numberOfLines={1}>
            {flagGlyph}
          </Text>
        ) : null}
        <Text style={styles.splitTileChromeStars} numberOfLines={1}>
          {`★ ${props.stars}`}
        </Text>
      </View>
      <Text style={styles.splitTileChromeName} numberOfLines={1}>
        {props.name}
        {props.focused && props.focusLabel ? ` · ${props.focusLabel}` : ""}
      </Text>
      {locText ? (
      <Text
        style={
          locDim ? styles.splitTileChromeLocDim : styles.splitTileChromeLoc
        }
        numberOfLines={1}
      >
        {locText}
      </Text>
      ) : null}
      {showCode ? (
        <Text style={styles.splitTileChromeLocDim} numberOfLines={1}>
          {code}
        </Text>
      ) : null}
    </View>
  );
}

function ExtraRemoteTile(props: {
  testID: string;
  tileStyle: StyleProp<ViewStyle>;
  stream: MediaStreamLike | null;
  epoch: number;
  name: string;
  stars: number;
  loc: string;
  locationHidden: string;
  flag?: string;
  focused?: boolean;
  focusLabel?: string;
  volume?: number;
  onVolume?: () => void;
  onPress: () => void;
  privacyBlur: boolean;
  mediaReady: boolean;
  allowSoftBlur?: boolean;
  softBlurNative: boolean;
  connectingPeer: string;
  noCamTitle: string;
  noCamSub: string;
  advertisedNoCam?: boolean;
  unblurShort?: string;
  blurVeil: LiveStageVideoProps["blurVeil"];
  onHaptic: () => void;
  giftFx?: string | null;
  hideIp?: boolean;
  code?: string;
}) {
  const {
    stream,
    epoch,
    name,
    privacyBlur,
    mediaReady,
    allowSoftBlur = true,
    softBlurNative,
    blurVeil,
  } = props;
  const tileStreamUrl = getStreamUrl(stream);
  const tileSoftBlur =
    privacyBlur &&
    !!allowSoftBlur &&
    softBlurNative &&
    !!tileStreamUrl &&
    !!stream;
  const tileHasVideo = (stream?.getVideoTracks?.()?.length ?? 0) > 0;
  const tileHasAudio = (stream?.getAudioTracks?.()?.length ?? 0) > 0;
  const tileAudioOnly = !!stream && !tileHasVideo && tileHasAudio;
  const tileNoCam = !!props.advertisedNoCam || tileAudioOnly;
  return (
    <Pressable
      testID={props.testID}
      style={props.tileStyle}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={privacyBlur ? undefined : name}
      onPress={props.onPress}
    >
      {stream && !props.advertisedNoCam ? (
        <VideoView
          stream={stream}
          streamEpoch={epoch}
          mirror={false}
          style={styles.remoteFill}
          zOrder={0}
        />
      ) : tileNoCam ? (
        <NoCamPortrait
          title={props.noCamTitle}
          caption={props.noCamSub}
          label={privacyBlur ? name : undefined}
          style={styles.remoteFill}
        />
      ) : (
        <View style={[styles.remoteFill, styles.videoPlaceholder]}>
          <Text style={styles.splitPlaceholder}>{name}</Text>
          <Text style={styles.splitPlaceholderSub}>{props.connectingPeer}</Text>
        </View>
      )}
      {privacyBlur && softBlurNative ? (
        <View
          style={[styles.remoteFill, styles.softBlurCover]}
          collapsable={false}
          removeClippedSubviews={false}
          pointerEvents="none"
        >
          <SoftBlurRemote
            streamURL={tileStreamUrl}
            active={!!tileSoftBlur}
            style={styles.remoteFill}
          />
        </View>
      ) : privacyBlur && !softBlurNative ? (
        <View
          style={[styles.remoteFill, styles.blurCoverElevated]}
          collapsable={false}
          removeClippedSubviews={false}
          pointerEvents="auto"
        >
          <PartnerBlurVeil
            compact
            title={blurVeil?.title}
            partnerLabel={name}
            buttonLabel={props.unblurShort}
            style={[styles.remoteFill, styles.blurUnderlay]}
            onPress={() => {
              props.onHaptic();
              blurVeil?.onUnblur();
            }}
          />
        </View>
      ) : tileAudioOnly && stream && !props.advertisedNoCam ? (
        <View
          style={[styles.remoteFill, styles.blurCoverElevated]}
          collapsable={false}
          removeClippedSubviews={false}
          pointerEvents="none"
        >
          <NoCamPortrait
            title={props.noCamTitle}
            caption={props.noCamSub}
            label={privacyBlur ? name : undefined}
            style={styles.remoteFill}
          />
        </View>
      ) : null}
      {props.volume === 0 ? (
        <View
          style={[styles.partnerMuteOverlay, styles.extraMuteOverlay]}
          pointerEvents="none"
          collapsable={false}
        >
          <MuteMark compact />
        </View>
      ) : null}
      {/* Chrome after NoCamPortrait so name/★/loc/flag stay readable on cylinder. */}
      {props.giftFx ? (
        <View
          style={styles.remoteFill}
          pointerEvents="none"
          collapsable={false}
        >
          <GiftFxOverlay effect={props.giftFx} label={null} />
        </View>
      ) : null}
      {!privacyBlur ? (
        <StageTileChrome
          name={name}
          stars={props.stars}
          loc={props.loc}
          locationHidden={props.locationHidden}
          flag={props.flag}
          hideIp={!!props.hideIp}
          focused={props.focused}
          focusLabel={props.focusLabel}
          code={props.code}
        />
      ) : null}
    </Pressable>
  );
}

export function LiveStageVideo(props: LiveStageVideoProps) {
  const {
    phase,
    localStream,
    remoteStream,
    remoteStream2,
    remoteStream3 = null,
    remoteEpoch,
    remoteEpoch2,
    remoteEpoch3 = 0,
    extraPeerCount,
    lookingForThird = false,
    swapViews,
    focusExtra,
    partnerName,
    partnerIdShort = "",
    partnerStars = 0,
    partnerTrust = 0,
    partnerLoc = "",
    partnerFlag: _partnerFlag = "",
    partnerFlagTopInset: _partnerFlagTopInset = 72,
    callTimerText = "",
    partnerCode = "",
    secondName,
    thirdName = "",
    secondLoc = "",
    secondStars = 0,
    secondTrust = 0,
    secondFlag = "",
    secondHideIp = false,
    thirdLoc = "",
    thirdStars = 0,
    thirdTrust = 0,
    thirdFlag = "",
    secondCode = "",
    thirdCode = "",
    partnerVolume,
    secondVolume,
    thirdVolume,
    onPartnerVolume,
    onSecondVolume,
    onThirdVolume,
    grid2x2: grid2x2Prop,
    onToggleGrid2x2,
    isFriendCall,
    remoteBlurred,
    partnerCamHidden = false,
    partnerNoCam = false,
    extraNoCam2 = false,
    extraNoCam3 = false,
    mediaReady = false,
    allowSoftBlur = true,
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
    extraGiftFx0 = null,
    extraGiftFx1 = null,
    barsCaption,
    blurVeil = null,
    labels: L,
    onToggleFocusExtra,
    onSelectPartner,
    onRetryConnect,
    onReport,
    onDoubleTapReblur,
    onPipHintSeen,
    onSwapViews,
    onHaptic,
    onSwipeNext,
    onSwipeDropExtra,
    onSwipeStart,
    swipeSkip = true,
    swipeStartLabel,
    swipeNextLabel,
    showStagePartnerHud = false,
  } = props;

  /**
   * Privacy blur (eye / intro / hold).
   *
   * KEEP partner RTCView mounted while veiled — unmounting SurfaceView mid-call
   * crashes react-native-webrtc on some devices when a stranger connects.
   * Product: SoftBlurRemote (native soft video blur) when available; else
   * PartnerBlurVeil mosaic elev stack only if !softBlurNative.
   * Stream always stays in parent state.
   */
  const privacyBlur = !!remoteBlurred;
  // Partner on main stage (normal) vs partner in PiP (swapped)
  const partnerOnMain = !swapViews;
  const partnerOnPip = swapViews;
  /** SoftBlurVideoView registered + product ON. */
  const softBlurNative = isSoftBlurNativeAvailable();
  // Partner-facing Show-video CTA only on the tile that shows partner (privacy)
  const coverMainPartner = privacyBlur && partnerOnMain;
  const coverPipPartner = privacyBlur && partnerOnPip;
  // Bars / mute / hide / privacy need zOrder 0 so RN overlays paint above SurfaceView.
  const partnerBars = partnerFx === "bars" || partnerFx === "fence";
  const selfBars = selfFx === "bars" || selfFx === "fence";
  const mainFxKind = !swapViews ? partnerFx : selfFx;
  const pipFxKind = !swapViews ? selfFx : partnerFx;
  // Normal layout: main = partner, pip = self. Swapped: main = self, pip = partner.
  const mainBars = (!swapViews && partnerBars) || (swapViews && selfBars);
  const pipBars = (!swapViews && selfBars) || (swapViews && partnerBars);

  // Smoke: one line when nuclear veil mounts / unmounts (skip initial false)
  const [localGrid2x2, setLocalGrid2x2] = useState(false);
  const prevPrivacyBlur = useRef(privacyBlur);
  useEffect(() => {
    if (privacyBlur === prevPrivacyBlur.current) return;
    prevPrivacyBlur.current = privacyBlur;
    if (privacyBlur) {
      console.log(
        `[blur] show why=stage main=${coverMainPartner ? "partner" : "self"} pip=${coverPipPartner ? "partner" : "self"} keepRtc=1 softNative=${softBlurNative ? 1 : 0}`
      );
    } else {
      console.log("[blur] hide why=stage keepRtc=1");
    }
  }, [privacyBlur, coverMainPartner, coverPipPartner, softBlurNative]);

  /**
   * splitWide must flip on physical rotate. Parent onLayout can lag;
   * Dimensions change + local onLayout keep stageW/H current. Style wrap
   * only — first VideoView key stays live-first-remote (no remount).
   */
  const [stageSize, setStageSize] = useState({ w: stageW, h: stageH });
  useEffect(() => {
    if (stageW > 0 && stageH > 0) {
      setStageSize((prev) =>
        prev.w === stageW && prev.h === stageH ? prev : { w: stageW, h: stageH }
      );
    }
  }, [stageW, stageH]);
  useEffect(() => {
    const applyWindow = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      setStageSize((prev) => {
        const prevWide = prev.h > 0 && prev.w / prev.h >= 1.15;
        const nextWide = width / height >= 1.15;
        if (prevWide === nextWide && prev.w > 0 && prev.h > 0) return prev;
        return { w: width, h: height };
      });
    };
    const win = Dimensions.get("window");
    applyWindow(win.width, win.height);
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      applyWindow(window.width, window.height);
    });
    return () => {
      sub?.remove?.();
    };
  }, []);
  const onStageLayout = (width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    setStageSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height }
    );
  };
  const layoutW = stageSize.w > 0 ? stageSize.w : stageW;
  const layoutH = stageSize.h > 0 ? stageSize.h : stageH;

  const emptyStatus =
    connectElapsedSecs >= 8 && L.tryingRelay
      ? L.tryingRelay
      : connectElapsedSecs >= 3 && L.findingPath
        ? L.findingPath
        : L.linkingCameras || L.connectingPeer;

  // Mute mark on who muted / who is muted — always the partner tile.
  // theyMutedMe on self PiP hid the corner preview behind the bar (415 FAIL).
  const showMuteOnPartner =
    phase === "matched" && !!(partnerMuted || theyMutedMe);
  const showMuteOnSelf = false;
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

  // Stage flag chip OFF — dual flags with PartnerIdentityDock were a product fail.
  // Dock owns flag; keep props accepted so live.tsx does not thrash.
  void _partnerFlag;
  void _partnerFlagTopInset;

  const {
    hasRemote,
    remoteHasVideo,
    mainStream,
    pipStream,
    mainMirror,
    pipMirror,
  } = pickStageStreams({
    phase,
    localStream,
    remoteStream,
    remoteStream2,
    remoteStream3,
    extraPeerCount,
    swapViews,
  });

  /**
   * Primary cylinder only if this tile advertised no-cam/hide AND the
   * main remote has no video / pictures. 201649Z: leftover partnerNoCam
   * painted NoCamPortrait over a live PC RTCView.
   */
  const paintPrimaryNoCam =
    !remoteHasVideo && (!!partnerNoCam || !!partnerCamHidden);
  /**
   * Partner self-hide / advertised no-cam. Cover partner tile only —
   * never force-cover self PiP. Privacy veil wins when both are on.
   * Extra tiles use advertisedNoCam, not this flag.
   */
  const partnerHideOn = paintPrimaryNoCam && !privacyBlur;
  const coverMainPartnerHide = partnerHideOn && partnerOnMain;
  const coverPipPartnerHide = partnerHideOn && partnerOnPip;
  // Opaque cover only on partner tile (nuclear / partner-hide) — not self
  const coverMain = coverMainPartner || coverMainPartnerHide;
  const coverPip = coverPipPartner || coverPipPartnerHide;

  const prevPartnerHide = useRef(partnerHideOn);
  useEffect(() => {
    if (partnerHideOn === prevPartnerHide.current) return;
    prevPartnerHide.current = partnerHideOn;
    console.log(
      `[blur] partner_hide on=${partnerHideOn ? 1 : 0} main=${coverMainPartnerHide ? 1 : 0} pip=${coverPipPartnerHide ? 1 : 0}`
    );
  }, [partnerHideOn, coverMainPartnerHide, coverPipPartnerHide]);

  // Find-3rd hunting: top=partner · bottom=looking. Must NOT flip multiRemote
  // (that unmounts 1v1 RTCView → partner freezes on phone + PC sees frozen cam).
  // Allow while matched OR while still holding a remote stream (party queue).
  // Any 2nd/3rd remote stream ends hunt (true multi tiles take over).
  const huntingThird =
    !!lookingForThird &&
    !remoteStream2 &&
    !remoteStream3 &&
    extraPeerCount < 1 &&
    (hasRemote || !!remoteStream) &&
    (phase === "matched" || phase === "search" || !!remoteStream);
  // extras>=1 even if remoteStream2 is null: split + connecting extra tile.
  // First VideoView stays mounted (wrap, do not remount). Not 1v1 leftover.
  const extraJoining = extraPeerCount >= 1 && !remoteStream2;
  const showExtraTile2 = shouldShowExtraRemoteTile({
    extraPeerCount,
    remoteStream2,
  });
  const showExtraTile3 = shouldShowExtraRemoteTile3({
    extraPeerCount,
    remoteStream3,
  });
  // extras>=1 even before stream2: lock first RTCView to remoteStream.
  const lockFirstRemote = shouldLockFirstRemote({
    extraPeerCount,
    remoteStream2,
    remoteStream3,
  });
  const multiRemote = !!(remoteStream2 || remoteStream3 || extraJoining);
  // Do NOT infer "no camera" from missing video tracks — a PC cam often
  // lands audio first. Primary cylinder only when advertised no-cam AND
  // !remoteHasVideo. Extra tiles keep advertisedNoCam (laptop cylinder).
  const audioOnlyRemote = paintPrimaryNoCam;

  /**
   * Soft live-blur eligibility (privacy + native + stream URL).
   * Partner stream for 1v1 main / PiP — same toURL() RTCView uses.
   * Multi tiles resolve per-tile below.
   */
  const partnerStreamUrl = getStreamUrl(remoteStream);
  // SoftBlur adds a second VideoSink. Attach only after media is live —
  // Pixel 2026-08-13 SIGABRT DecodingQueue ~2s after "Sink attached" during ICE.
  // Live-frame SoftBlur as soon as we have a stream URL. Waiting on
  // mediaReady left the mosaic Privacy veil (03:47 shot) instead of
  // the face-behind-blur (091900 tg1).
  const softBlurPartner =
    privacyBlur &&
    !!allowSoftBlur &&
    softBlurNative &&
    !!partnerStreamUrl;

  // Aspect only (PiP / chrome). Multi tiles always stack — landscape is not a row.
  const splitWide = layoutW > 0 && layoutH > 0 && layoutW / layoutH >= 1.15;

  // PC remote-empty parity: brand loop while idle/search with no partner
  const brandLoop =
    !multiRemote &&
    !huntingThird &&
    !hasRemote &&
    (phase === "idle" || phase === "search");
  const displayMainStream = brandLoop ? null : mainStream;
  // 3-way: PiP stays you. 4-way hides PiP (local becomes a tile).
  const displayPipStream =
    brandLoop || multiRemote ? localStream : pipStream;
  // A5 multi-tile blur: ExtraRemoteTile SoftBlurRemote (or PartnerBlurVeil if !softBlurNative) + zOrder={0} + blurCoverElevated.
  const displayMainMirror = brandLoop ? false : mainMirror;
  const displayPipMirror = brandLoop || multiRemote ? true : pipMirror;

  /**
   * Android SurfaceView (RTCView) zOrder ≥ 1 composites ABOVE all RN views —
   * PartnerChrome / overlay elevation lose once media is live. Partner remote
   * therefore always uses zOrder 0. Self PiP stays 2 when not covered.
   * Privacy / partner-hide / bars / mute: covered tiles stay at 0 so
   * blurCoverElevated (elev 32) + PartnerBlurVeil can paint above.
   * Multi remote tiles always pass zOrder={0} (never mainZOrder ≥ 1).
   * Matched + swapped (self on main): main also 0 so chrome stays readable.
   */
  const mainShowsPartner = !swapViews;
  const pipShowsPartner = !!swapViews;
  // Partner tile only — never overlay self PiP (zOrder 0 hid it under the bar).
  const mutePartnerOnMain =
    showMuteOnPartner && (lockFirstRemote || !swapViews);
  const mutePartnerOnPip =
    showMuteOnPartner && swapViews && !multiRemote && !lockFirstRemote;
  const muteSelfOnMain = false;
  const muteSelfOnPip = false;
  // Partner / veiled tiles stay at zOrder 0 so RN elevation can cover SurfaceView.
  const mainZOrder =
    coverMain ||
    mainBars ||
    mutePartnerOnMain ||
    muteSelfOnMain ||
    (!camOn && swapViews) ||
    mainShowsPartner ||
    phase === "matched"
      ? 0
      : 1;
  const pipZOrder =
    coverPip ||
    pipBars ||
    (!camOn && !swapViews) ||
    mutePartnerOnPip ||
    muteSelfOnPip ||
    pipShowsPartner
      ? 0
      : 2;

  /** Always mount when stream exists (unmount-while-veiled = native crash risk). */
  const mountMainVideo = !!displayMainStream;
  const mountPipVideo = !!displayPipStream;

  const locationHidden =
    (L.locationHidden || "").trim() || "Location hidden";

  const grid2x2Requested = grid2x2Prop ?? localGrid2x2;
  const stageLayout = pickStageChromeLayout({
    hasRemote,
    remoteStream2,
    remoteStream3,
    extraPeerCount,
    grid2x2: grid2x2Requested,
    splitWide,
    huntingThird,
  });
  // Hunt stays 1v1 full partner (status/toast only). Split only when a
  // 3rd tile exists (multiRemote / extras). wrapping on huntingThird
  // restyled remoteFill → overflow:hidden and tore SurfaceView (400 hunt FAIL).
  const splitStage = multiRemote;
  // Always column for 3-way / 4-way (portrait and landscape). Row split was
  // landscape-only; user wants the same vertical stack when the phone is on its side.
  // Wrap-only restyle — do not remount live-first-remote.
  const useWideSplit = false;
  const outerStageStyle = !splitStage
    ? styles.remoteFill
    : stageLayout.useGrid2x2
      ? styles.splitRemoteGrid2x2
      : useWideSplit
        ? styles.splitRemoteWide
        : styles.splitRemote;
  const firstTileStyle = !splitStage
    ? styles.remoteFill
    : stageLayout.useGrid2x2
        ? styles.splitTileGrid2x2
        : useWideSplit
          ? [styles.splitTileWide, styles.splitTileFocusWide]
          : [styles.splitTile, styles.splitTileFocus];
  const extraTileStyle = (isLast: boolean) =>
    stageLayout.useGrid2x2
      ? styles.splitTileGrid2x2
      : useWideSplit
        ? [styles.splitTileWide, isLast && styles.splitTileWideLast]
        : [styles.splitTile, isLast && styles.splitTileLast];

  const secondStarsShown = displayPartnerStars(
    Number(secondStars) || 0,
    Number(secondTrust) || 0
  );
  const thirdStarsShown = displayPartnerStars(
    Number(thirdStars) || 0,
    Number(thirdTrust) || 0
  );

  const remoteTapRef = useRef(0);
  // Keep PiP always mounted (search→match) — hide/show remount was visible flicker.
  // Privacy: SoftBlur overlay (veil only if !softBlurNative); never unmount partner RTCView.

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
  const swipeExtraActive =
    !!onSwipeDropExtra &&
    swipeSkip !== false &&
    phase === "matched" &&
    !isFriendCall &&
    multiRemote &&
    !!remoteStream2;
  const swipeStartActive =
    !!onSwipeStart &&
    swipeSkip !== false &&
    phase === "idle" &&
    brandLoop;

  const handleSwipeCommit = (_dir: -1 | 1) => {
    onHaptic();
    onSwipeNext?.();
  };

  const handleSwipeStartCommit = (_dir: -1 | 1) => {
    onHaptic();
    onSwipeStart?.();
  };

  const handleSwipeDoubleTap = () => {
    if (isFriendCall || remoteBlurred) return;
    onDoubleTapReblur();
  };

  const handleSwipeLongPress = () => {
    if (isFriendCall || !onReport) return;
    onReport();
  };

  /** Peel privacy first; then select the first conversationalist. */
  const peelOrSelectPrimary = () => {
    if (privacyBlur && blurVeil) {
      onHaptic();
      blurVeil.onUnblur();
      return;
    }
    if (!onSelectPartner) return;
    onHaptic();
    onSelectPartner("primary");
  };

  const peelOrSelectExtra = (slot: "extra0" | "extra1") => {
    if (privacyBlur && blurVeil) {
      onHaptic();
      blurVeil.onUnblur();
      return;
    }
    onHaptic();
    if (onSelectPartner) {
      onSelectPartner(slot);
      return;
    }
    onToggleFocusExtra();
  };

  return (
    <>
      {/*
        1v1 / hunt / 2+ remotes share one tree. First partner VideoView stays
        mounted; extra remotes wrap as siblings. Do not remount on 1v1→3-way.
      */}
      <View
        style={outerStageStyle}
        collapsable={false}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          onStageLayout(width, height);
        }}
      >
        <View
          style={firstTileStyle}
          collapsable={false}
          testID="live-remote-tile-1"
        >
          {/*
            First VideoView is a sibling of SwipeSkipOverlay. Overlay enabled
            flip (1v1 swipe → extras/hunt) used to remount RTCView
            (GestureDetector tree vs plain View). extras>=1 locks
            stream/epoch/mirror so SurfaceView is not torn.
            Rotate / splitWide only restyles the wrap (key stays).
          */}
          {mountMainVideo ? (
            <VideoView
              key="live-first-remote"
              stream={lockFirstRemote ? remoteStream : displayMainStream}
              streamEpoch={
                lockFirstRemote || !swapViews ? remoteEpoch : 0
              }
              mirror={lockFirstRemote ? false : displayMainMirror}
              style={styles.remoteFill}
              zOrder={mainZOrder}
            />
          ) : brandLoop && swipeStartActive ? (
            <SwipeSkipOverlay
              enabled
              onCommit={handleSwipeStartCommit}
              onHaptic={onHaptic}
              nextLabel={swipeStartLabel}
              style={styles.remoteFill}
            >
              <View style={styles.remoteFill} pointerEvents="none">
                <BrandLoadingLoop active />
              </View>
            </SwipeSkipOverlay>
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
                  {/* Name first while ICE/cameras still linking. Dock stays the ★/loc surface. */}
                  {stagePartnerLabel ? (
                    <Text
                      style={styles.connectName}
                      numberOfLines={1}
                      accessibilityRole="header"
                    >
                      {stagePartnerLabel}
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
            Partner tile privacy: SoftBlurRemote when native (intro/hold/eye).
            PartnerBlurVeil only if !softBlurNative. Hide / no-cam = NoCamPortrait.
            Self-on-main is never covered while privacy (self stays live).
          */}
          {softBlurNative && partnerStreamUrl ? (
            <View
              style={
                softBlurPartner
                  ? [styles.remoteFill, styles.softBlurCover]
                  : styles.softBlurIdle
              }
              collapsable={false}
              pointerEvents="none"
            >
              <SoftBlurRemote
                streamURL={partnerStreamUrl}
                active={!!softBlurPartner}
                style={styles.remoteFill}
              />
            </View>
          ) : null}
          {coverMainPartner && !softBlurNative ? (
              <View
                style={[styles.remoteFill, styles.blurCoverElevated]}
                collapsable={false}
                removeClippedSubviews={false}
                pointerEvents="auto"
              >
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
              </View>
          ) : coverMainPartnerHide && !remoteHasVideo ? (
            <View
              style={[styles.remoteFill, styles.blurCoverElevated]}
              collapsable={false}
              removeClippedSubviews={false}
              pointerEvents="none"
            >
              <NoCamPortrait
                title={L.noCamTitle || L.partnerHiddenTitle || "No camera"}
                caption={
                  L.noCamSub ||
                  L.partnerHiddenBody ||
                  "Talking with microphone"
                }
                label={stagePartnerLabel}
                style={styles.remoteFill}
              />
            </View>
          ) : !privacyBlur &&
            !remoteHasVideo &&
            audioOnlyRemote &&
            partnerOnMain ? (
            /* Advertised no-cam and no pictures: cylinder, not black RTCView. */
            <View
              style={[styles.remoteFill, styles.blurCoverElevated]}
              collapsable={false}
              removeClippedSubviews={false}
              pointerEvents="none"
            >
              <NoCamPortrait
                title={L.noCamTitle || L.partnerHiddenTitle || "No camera"}
                caption={
                  L.noCamSub ||
                  L.partnerHiddenBody ||
                  "Talking with microphone"
                }
                label={stagePartnerLabel}
                style={styles.remoteFill}
              />
            </View>
          ) : null}
          {/*
            Bars over conversationalist — main RTCView at zOrder 0 so RN
            paints BarsOverlay above. Skip while privacy veil covers partner.
          */}
          {mainBars && !coverMainPartner && !coverMainPartnerHide ? (
            <View style={styles.barsOnTile} pointerEvents="none">
              {mainFxKind === "fence" ? <FenceOverlay /> : <BarsOverlay />}
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
          {mutePartnerOnMain &&
          !coverMainPartner &&
          !coverMainPartnerHide ? (
            <View
              style={styles.partnerMuteOverlay}
              pointerEvents="none"
              collapsable={false}
            >
              <MuteMark />
            </View>
          ) : null}
          {muteSelfOnMain ? (
            <View
              style={styles.partnerMuteOverlay}
              pointerEvents="none"
              collapsable={false}
            >
              <MuteMark />
            </View>
          ) : null}
          {phase === "matched" &&
          hasRemote &&
          !swapViews &&
          !coverMainPartner &&
          !coverMainPartnerHide ? (
            <BrandWatermark animKey={remoteEpoch} />
          ) : null}
          {swipeActive ? (
            <SwipeSkipOverlay
              enabled
              onCommit={handleSwipeCommit}
              onHaptic={onHaptic}
              onTap={onSelectPartner ? peelOrSelectPrimary : undefined}
              onDoubleTap={
                !isFriendCall ? handleSwipeDoubleTap : undefined
              }
              onLongPress={
                !isFriendCall && onReport
                  ? handleSwipeLongPress
                  : undefined
              }
              nextLabel={swipeNextLabel}
              style={styles.remoteFill}
            >
              <View style={styles.remoteFill} />
            </SwipeSkipOverlay>
          ) : null}
          {/* Stage flag chip removed — PartnerIdentityDock owns flag (no dual flags). */}
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
          {splitStage && !privacyBlur && phase === "matched" ? (
            <StageTileChrome
              name={stagePartnerLabel || partnerName || "Partner"}
              stars={stagePartnerStars}
              loc={partnerLoc || ""}
              locationHidden={locationHidden}
              flag={_partnerFlag}
              code={partnerCode}
            />
          ) : null}
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
                if (isFriendCall) return;
                const now = Date.now();
                if (now - remoteTapRef.current < 320 && !remoteBlurred) {
                  remoteTapRef.current = 0;
                  onDoubleTapReblur();
                  return;
                }
                remoteTapRef.current = now;
                peelOrSelectPrimary();
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
        {/* Hunt: no looking half. First conversationalist stays full until extras. */}
        {showExtraTile2 ? (
          <View
            style={extraTileStyle(!remoteStream3 && !stageLayout.includeLocalTile)}
            collapsable={false}
            testID="live-remote-tile-2-wrap"
          >
          <SwipeSkipOverlay
            enabled={swipeExtraActive}
            onCommit={() => {
              onHaptic();
              onSwipeDropExtra?.();
            }}
            onHaptic={onHaptic}
            nextLabel={swipeNextLabel}
            style={{ width: "100%", height: "100%" }}
          >
          <ExtraRemoteTile
            testID="live-remote-tile-2"
            tileStyle={{
              width: "100%",
              height: "100%",
              position: "relative",
            }}
            stream={remoteStream2}
            epoch={remoteEpoch2}
            name={secondName || "…"}
            stars={secondStarsShown}
            loc={secondLoc}
            locationHidden={locationHidden}
            flag={secondFlag}
            focused={!!focusExtra}
            focusLabel={L.focus}
            volume={secondVolume}
            onVolume={onSecondVolume}
            code={secondCode}
            onPress={() => peelOrSelectExtra("extra0")}
            privacyBlur={privacyBlur}
            mediaReady={mediaReady}
            allowSoftBlur={allowSoftBlur}
            softBlurNative={softBlurNative}
            connectingPeer={L.connectingPeer}
            noCamTitle={L.noCamTitle || "No camera"}
            noCamSub={L.noCamSub || "Talking with microphone"}
            advertisedNoCam={!!extraNoCam2}
            hideIp={!!secondHideIp}
            unblurShort={L.unblurShort}
            blurVeil={blurVeil}
            onHaptic={onHaptic}
            giftFx={extraGiftFx0}
          />
          </SwipeSkipOverlay>
          </View>
        ) : null}
        {showExtraTile3 ? (
          <ExtraRemoteTile
            testID="live-remote-tile-3"
            tileStyle={extraTileStyle(!stageLayout.includeLocalTile)}
            stream={remoteStream3}
            epoch={remoteEpoch3}
            name={thirdName || "…"}
            stars={thirdStarsShown}
            loc={thirdLoc}
            locationHidden={locationHidden}
            flag={thirdFlag}
            volume={thirdVolume}
            onVolume={onThirdVolume}
            code={thirdCode}
            onPress={() => peelOrSelectExtra("extra1")}
            privacyBlur={privacyBlur}
            mediaReady={mediaReady}
            allowSoftBlur={allowSoftBlur}
            softBlurNative={softBlurNative}
            connectingPeer={L.connectingPeer}
            noCamTitle={L.noCamTitle || "No camera"}
            noCamSub={L.noCamSub || "Talking with microphone"}
            advertisedNoCam={!!extraNoCam3}
            unblurShort={L.unblurShort}
            blurVeil={blurVeil}
            onHaptic={onHaptic}
            giftFx={extraGiftFx1}
          />
        ) : null}
        {stageLayout.includeLocalTile ? (
          <View
            style={extraTileStyle(true)}
            collapsable={false}
            testID="live-local-tile"
          >
            {localStream ? (
              <VideoView
                stream={localStream}
                streamEpoch={0}
                mirror
                style={styles.remoteFill}
                zOrder={0}
              />
            ) : (
              <View style={[styles.remoteFill, styles.videoPlaceholder]} />
            )}
            {!camOn && localStream && L.selfHiddenBadge ? (
              <View style={styles.selfHiddenOverlay} pointerEvents="none">
                <Text style={styles.selfHiddenBadge} numberOfLines={1}>
                  {L.selfHiddenBadge}
                </Text>
              </View>
            ) : null}
            {showMuteOnSelf ? (
              <View
                style={styles.partnerMuteOverlay}
                pointerEvents="none"
                collapsable={false}
              >
                <MuteMark compact />
              </View>
            ) : null}
            <Text style={styles.splitLabel} numberOfLines={1}>
              You
            </Text>
          </View>
        ) : null}
      </View>
      {stageLayout.showGrid2x2Toggle ? (
        <Pressable
          style={styles.grid2x2Toggle}
          onPress={() => {
            onHaptic();
            if (onToggleGrid2x2) onToggleGrid2x2();
            else setLocalGrid2x2((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            stageLayout.useGrid2x2
              ? L.stackTiles || "Stack tiles"
              : L.grid2x2 || "2×2 grid"
          }
          testID="live-grid-2x2-toggle"
        >
          <Text style={styles.grid2x2ToggleText}>
            {stageLayout.useGrid2x2
              ? L.stackTiles || "Stack"
              : L.grid2x2 || "2×2"}
          </Text>
        </Pressable>
      ) : null}
      {/*
        PiP: keep stream mounted always (self or partner). Privacy: SoftBlurRemote
        when partner stream + native; PartnerBlurVeil only if !softBlurNative.
        Never unmount partner RTCView while veiled.
        1v1 + 3-way: PiP = you. 4-way: you is a stage tile, hide PiP.
      */}
      {(mountPipVideo || coverPip) && stageLayout.pipYou ? (
        <DraggablePip
          stageW={layoutW}
          stageH={layoutH}
          showHint={pipHint}
          hintText={L.pipHint}
          onHintSeen={onPipHintSeen}
          onDoubleTap={() => {
            if (multiRemote) return;
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
              streamEpoch={swapViews && !multiRemote ? remoteEpoch : 0}
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
          {coverPipPartner && !multiRemote && softBlurNative ? (
              <View
                style={[styles.pipVideo, styles.softBlurCover]}
                collapsable={false}
                removeClippedSubviews={false}
                pointerEvents="none"
              >
                <SoftBlurRemote
                  streamURL={partnerStreamUrl}
                  active={!!softBlurPartner}
                  style={styles.pipVideo}
                />
              </View>
          ) : coverPipPartner && !multiRemote && !softBlurNative ? (
              <View
                style={[styles.pipVideo, styles.blurCoverElevated]}
                collapsable={false}
                removeClippedSubviews={false}
                pointerEvents="auto"
              >
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
              </View>
          ) : coverPipPartnerHide && !multiRemote && !remoteHasVideo ? (
            <View
              style={[styles.pipVideo, styles.blurCoverElevated]}
              collapsable={false}
              removeClippedSubviews={false}
              pointerEvents="none"
            >
              <NoCamPortrait
                title={L.noCamTitle || L.partnerHiddenTitle || "No camera"}
                caption={L.noCamSub || "Talking with microphone"}
                label={partnerName}
                style={styles.pipVideo}
              />
            </View>
          ) : !privacyBlur &&
            !remoteHasVideo &&
            audioOnlyRemote &&
            partnerOnPip &&
            !multiRemote ? (
            <View
              style={[styles.pipVideo, styles.blurCoverElevated]}
              collapsable={false}
              removeClippedSubviews={false}
              pointerEvents="none"
            >
              <NoCamPortrait
                title={L.noCamTitle || L.partnerHiddenTitle || "No camera"}
                caption={L.noCamSub || "Talking with microphone"}
                label={partnerName}
                style={styles.pipVideo}
              />
            </View>
          ) : null}
          {pipBars && !coverPipPartner && !coverPipPartnerHide ? (
            <View style={styles.barsOnPip} pointerEvents="none">
              {pipFxKind === "fence" ? <FenceOverlay /> : <BarsOverlay />}
            </View>
          ) : null}
          {mutePartnerOnPip &&
          !coverPipPartner &&
          !coverPipPartnerHide ? (
            <View
              style={styles.partnerMuteOverlay}
              pointerEvents="none"
              collapsable={false}
            >
              <MuteMark compact />
            </View>
          ) : null}
          {muteSelfOnPip ? (
            <View
              style={styles.partnerMuteOverlay}
              pointerEvents="none"
              collapsable={false}
            >
              <MuteMark compact />
            </View>
          ) : null}
          {/* Stage flag chip PiP removed — PartnerIdentityDock owns flag. */}
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
          {!camOn && (!swapViews || multiRemote) && mountPipVideo && L.selfHiddenBadge ? (
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
