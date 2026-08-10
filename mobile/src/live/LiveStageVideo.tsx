/**
 * Main stage + PiP. Partner + local both zOrder=1 (media overlay).
 * Partner zOrder=0 often hid under RN stack black.
 */
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import type { MediaStreamLike } from "../media/MediaSession";
import { BarsOverlay } from "../stars/GiftFxOverlay";
import { DraggablePip } from "./DraggablePip";
import { liveStyles as styles } from "./liveStyles";
import { PartnerBlurVeil } from "./PartnerBlurVeil";
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
  /** Partner ★ for linking card / labels */
  partnerStars?: number;
  partnerLoc?: string;
  secondName: string;
  isFriendCall: boolean;
  remoteBlurred: boolean;
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
  };
  onToggleFocusExtra: () => void;
  onRetryConnect: (hard: boolean) => void;
  onReport?: () => void;
  onDoubleTapReblur: () => void;
  onPipHintSeen: () => void;
  onSwapViews: () => void;
  onHaptic: () => void;
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
    partnerStars = 0,
    partnerLoc = "",
    secondName,
    isFriendCall,
    remoteBlurred,
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
  } = props;

  /**
   * Privacy blur (strangers + friends via eye toggle).
   * Android SurfaceView (RTCView zOrder ≥1) paints ABOVE RN Modal on many OEMs.
   * While veiled: UNMOUNT every RTCView (partner + local PiP). MediaSession keeps
   * tracks; full-screen Modal + PartnerBlurVeil own the pixels (no black hole).
   */
  const privacyBlur = !!remoteBlurred;
  // Partner on main stage (normal) vs partner in PiP (swapped)
  const coverMainPartner = privacyBlur && !swapViews;
  const coverPipPartner = privacyBlur && swapViews;
  /** Local self cam also punches through Modal — hide while veil is up. */
  const hideLocalSurface = privacyBlur;
  // Bars / mute / hide need zOrder 0 so RN overlays paint above SurfaceView.
  const partnerBars = partnerFx === "bars";
  const selfBars = selfFx === "bars";
  // Normal layout: main = partner, pip = self. Swapped: main = self, pip = partner.
  const mainBars = (!swapViews && partnerBars) || (swapViews && selfBars);
  const pipBars = (!swapViews && selfBars) || (swapViews && partnerBars);

  const emptyStatus =
    connectElapsedSecs >= 8 && L.tryingRelay
      ? L.tryingRelay
      : connectElapsedSecs >= 3 && L.findingPath
        ? L.findingPath
        : L.linkingCameras || L.connectingPeer;

  const showPartnerMute =
    phase === "matched" && partnerMuted && !!L.partnerMutedBadge;
  const showTheyMutedMe =
    phase === "matched" && theyMutedMe && !!L.theyMutedYouBadge;

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

  /**
   * WORKING baseline (a576143 / human pass): partner **zOrder 1**, self PiP **2**.
   * zOrder 0 = behind RN window → pure black conversationalist on real devices
   * (PiP at 1 still worked — that's how we diagnosed the regression).
   * Only drop to 0 when RN overlays must cover that tile (mute / bars).
   * Privacy blur unmounts partner RTCView (never cover a live surface).
   */
  const mainZOrder =
    mainBars ||
    (showPartnerMute && !swapViews) ||
    (showTheyMutedMe && swapViews) ||
    (!camOn && swapViews)
      ? 0
      : 1;
  const pipZOrder =
    pipBars ||
    (showTheyMutedMe && !swapViews) ||
    (!camOn && !swapViews) ||
    (showPartnerMute && swapViews)
      ? 0
      : 2;

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
              {/* Privacy: never mount remote RTCView while veiled (Android SurfaceView). */}
              {tile.stream && !tile.placeholder && !privacyBlur ? (
                <VideoView
                  stream={tile.stream}
                  streamEpoch={tile.epoch}
                  mirror={tile.mirror}
                  style={styles.remoteFill}
                  zOrder={mainZOrder}
                />
              ) : privacyBlur ? (
                <PartnerBlurVeil
                  compact
                  title={blurVeil?.title}
                  partnerLabel={tile.name || partnerName}
                  buttonLabel={L.unblurShort}
                  style={styles.remoteFill}
                  onPress={() => {
                    onHaptic();
                    blurVeil?.onUnblur();
                  }}
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
              {!privacyBlur ? (
                <Text style={styles.splitLabel} numberOfLines={1}>
                  {tile.name}
                  {idx === 0 ? ` · ${L.focus}` : ""}
                </Text>
              ) : null}
              {showPartnerMute && idx === 0 && !swapViews && !privacyBlur ? (
                <View style={styles.partnerMuteOverlay} pointerEvents="none">
                  <Text style={styles.partnerMuteWatermark}>🔇</Text>
                  <View style={styles.partnerMuteBadge}>
                    <Text style={styles.partnerMuteBadgeText} numberOfLines={1}>
                      {L.partnerMutedBadge}
                    </Text>
                  </View>
                </View>
              ) : null}
              {partnerBars && idx === 0 && !privacyBlur ? (
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
            Partner privacy: UNMOUNT partner RTCView while veiled.
            Covering a live SurfaceView with RN views fails on Android.
            MediaSession keeps the track; we re-attach on unblur.
          */}
          {mainStream && !coverMainPartner && !(hideLocalSurface && swapViews) ? (
            <VideoView
              stream={mainStream}
              streamEpoch={swapViews ? 0 : remoteEpoch}
              mirror={mainMirror}
              style={styles.remoteFill}
              zOrder={mainZOrder}
            />
          ) : coverMainPartner || (hideLocalSurface && swapViews) ? (
            <View
              style={[styles.remoteFill, styles.blurUnderlay]}
              collapsable={false}
              pointerEvents="none"
            />
          ) : (
            <Pressable
              style={[
                styles.remoteFill,
                styles.videoPlaceholder,
                coverMainPartner && styles.blurUnderlay,
              ]}
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
              {phase === "matched" && !coverMainPartner ? (
                <View style={styles.connectCard} collapsable={false}>
                  <View style={styles.connectPulseOuter} pointerEvents="none">
                    <View style={styles.connectPulseInner} />
                  </View>
                  <Text style={styles.splitPlaceholder} numberOfLines={1}>
                    {partnerName || "…"}
                    {partnerStars > 0 ? ` · ★${partnerStars}` : ""}
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
          {/* Soft mosaic privacy veil — partner RTCView unmounted while veiled */}
          {coverMainPartner ? (
            <View
              style={[styles.remoteFill, { zIndex: 50, elevation: 28 }]}
              collapsable={false}
            >
              <PartnerBlurVeil
                title={blurVeil?.title}
                partnerLabel={blurVeil?.partnerLabel || partnerName}
                body={blurVeil?.body}
                buttonLabel={blurVeil?.buttonLabel}
                hint={blurVeil?.hint}
                ready={!!blurVeil?.ready}
                onPress={() => {
                  onHaptic();
                  if (blurVeil?.onUnblur) blurVeil.onUnblur();
                }}
              />
            </View>
          ) : null}
          {/*
            Bars over conversationalist — main RTCView stays zOrder 0 so RN
            can paint BarsOverlay above. While privacy veil is on, partner
            RTCView is unmounted so bars wait until unblur.

          */}
          {mainBars && !coverMainPartner ? (
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
          {!camOn && swapViews && mainStream && L.selfHiddenBadge ? (
            <View style={styles.selfHiddenMain} pointerEvents="none">
              <Text style={styles.selfHiddenBadgeMain} numberOfLines={1}>
                {L.selfHiddenBadge}
              </Text>
            </View>
          ) : null}
          {showPartnerMute && !swapViews && !coverMainPartner ? (
            <View style={styles.partnerMuteOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermark}>🔇</Text>
              <View style={styles.partnerMuteBadge}>
                <Text style={styles.partnerMuteBadgeText} numberOfLines={1}>
                  {L.partnerMutedBadge}
                </Text>
              </View>
            </View>
          ) : null}
          {/* Self on main (swapped): partner muted us — full mute veil on self cam */}
          {showTheyMutedMe && swapViews ? (
            <View style={styles.theyMutedMeOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermark}>🔇</Text>
              <View style={styles.partnerMuteBadge}>
                <Text style={styles.partnerMuteBadgeText} numberOfLines={1}>
                  {L.theyMutedYouBadge}
                </Text>
              </View>
            </View>
          ) : null}
          {phase === "matched" &&
          hasRemote &&
          !swapViews &&
          !coverMainPartner ? (
            <View style={styles.brandWm} pointerEvents="none">
              <Text style={styles.brandWmText}>ruletka</Text>
            </View>
          ) : null}
          {phase === "matched" &&
          hasRemote &&
          !swapViews &&
          !coverMainPartner ? (
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
      {pipStream && !multiRemote && !hideLocalSurface ? (
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
          {/* Partner in PiP while veiled: no RTCView. Self PiP also unmounted while
              privacy Modal is up (SurfaceView would paint above Modal → black). */}
          {coverPipPartner ? (
            <PartnerBlurVeil
              compact
              partnerLabel={partnerName}
              buttonLabel={L.unblurShort}
              style={styles.pipVideo}
              onPress={() => {
                onHaptic();
                blurVeil?.onUnblur();
              }}
            />
          ) : (
            <VideoView
              stream={pipStream}
              streamEpoch={swapViews ? remoteEpoch : 0}
              mirror={pipMirror}
              style={styles.pipVideo}
              zOrder={pipZOrder}
            />
          )}
          {pipBars && !coverPipPartner ? (
            <View style={styles.barsOnPip} pointerEvents="none">
              <BarsOverlay />
            </View>
          ) : null}
          {/* Self in PiP (normal layout): partner muted our audio — must be above SurfaceView */}
          {showTheyMutedMe && !swapViews ? (
            <View style={styles.theyMutedMeOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermarkPip}>🔇</Text>
              <View style={styles.partnerMuteBadgePip}>
                <Text style={styles.partnerMuteBadgeTextPip} numberOfLines={2}>
                  {L.theyMutedYouBadge}
                </Text>
              </View>
            </View>
          ) : null}
          {showPartnerMute && swapViews && !coverPipPartner ? (
            <View style={styles.theyMutedMeOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermarkPip}>🔇</Text>
              <View style={styles.partnerMuteBadgePip}>
                <Text style={styles.partnerMuteBadgeTextPip} numberOfLines={2}>
                  {L.partnerMutedBadge}
                </Text>
              </View>
            </View>
          ) : null}
          {/* Self Hide badge when local is in PiP (normal layout) */}
          {!camOn && !swapViews && L.selfHiddenBadge ? (
            <View style={styles.selfHiddenOverlay} pointerEvents="none">
              <Text style={styles.selfHiddenBadge} numberOfLines={1}>
                {L.selfHiddenBadge}
              </Text>
            </View>
          ) : null}
          {/* When swapped, main is local — badge handled below on main if needed */}
          {!camOn && swapViews && L.selfHiddenBadge ? (
            <View style={styles.selfHiddenOverlay} pointerEvents="none">
              <Text style={styles.selfHiddenBadge} numberOfLines={1}>
                {L.selfHiddenBadge}
              </Text>
            </View>
          ) : null}
        </DraggablePip>
      ) : null}
      {multiRemote && localStream && !hideLocalSurface ? (
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
          <VideoView
            stream={localStream}
            streamEpoch={0}
            mirror
            style={styles.pipVideo}
            zOrder={pipZOrder}
          />
          {showTheyMutedMe ? (
            <View style={styles.theyMutedMeOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermarkPip}>🔇</Text>
              <View style={styles.partnerMuteBadgePip}>
                <Text style={styles.partnerMuteBadgeTextPip} numberOfLines={2}>
                  {L.theyMutedYouBadge}
                </Text>
              </View>
            </View>
          ) : null}
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
