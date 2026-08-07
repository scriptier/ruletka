/**
 * Main stage video: split multi-remote tiles, single remote + connecting
 * placeholder, PiP local (or swapped remote).
 */
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import type { MediaStreamLike } from "../media/MediaSession";
import { DraggablePip } from "./DraggablePip";
import { liveStyles as styles } from "./liveStyles";
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
  secondName: string;
  isFriendCall: boolean;
  remoteBlurred: boolean;
  /** You muted their audio — show veil + badge on their window. */
  partnerMuted?: boolean;
  /** They muted your audio on their device — same veil on self (PiP/main). */
  theyMutedMe?: boolean;
  retryBusy: boolean;
  autoRetryCount: number;
  hasTurn: boolean;
  stageW: number;
  stageH: number;
  pipHint: boolean;
  labels: {
    connectingPeer: string;
    /** Optional short status under partner name while empty */
    linkingCameras?: string;
    retryHard: string;
    retrying: string;
    turnReady: string;
    turnLoading: string;
    tapToRetry: string;
    focus: string;
    pipHint: string;
    /** e.g. "You muted · no sound" */
    partnerMutedBadge?: string;
    /** e.g. "They muted you · no sound" */
    theyMutedYouBadge?: string;
  };
  onToggleFocusExtra: () => void;
  onRetryConnect: (hard: boolean) => void;
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
    secondName,
    isFriendCall,
    remoteBlurred,
    partnerMuted = false,
    theyMutedMe = false,
    retryBusy,
    autoRetryCount,
    hasTurn,
    stageW,
    stageH,
    pipHint,
    labels: L,
    onToggleFocusExtra,
    onRetryConnect,
    onDoubleTapReblur,
    onPipHintSeen,
    onSwapViews,
    onHaptic,
  } = props;

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

  return (
    <>
      {multiRemote ? (
        <View style={styles.splitRemote}>
          {[tileA, tileB].map((tile, idx) => (
            <Pressable
              key={idx}
              style={[styles.splitTile, idx === 0 && styles.splitTileFocus]}
              onPress={() => {
                if (extraPeerCount === 0 && !remoteStream2) return;
                onHaptic();
                onToggleFocusExtra();
              }}
            >
              {tile.stream && !tile.placeholder ? (
                <VideoView
                  stream={tile.stream}
                  streamEpoch={tile.epoch}
                  mirror={tile.mirror}
                  style={styles.remoteFill}
                  zOrder={1}
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
              <Text style={styles.splitLabel} numberOfLines={1}>
                {tile.name}
                {idx === 0 ? ` · ${L.focus}` : ""}
              </Text>
              {/* Primary tile mute (focus is partner) */}
              {showPartnerMute && idx === 0 && !swapViews ? (
                <View style={styles.partnerMuteOverlay} pointerEvents="none">
                  <Text style={styles.partnerMuteWatermark}>🔇</Text>
                  <View style={styles.partnerMuteBadge}>
                    <Text style={styles.partnerMuteBadgeText} numberOfLines={1}>
                      {L.partnerMutedBadge}
                    </Text>
                  </View>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.remoteFill} collapsable={false}>
          {mainStream ? (
            <VideoView
              stream={mainStream}
              streamEpoch={swapViews ? 0 : remoteEpoch}
              mirror={mainMirror}
              style={styles.remoteFill}
              zOrder={1}
            />
          ) : (
            <Pressable
              style={[styles.remoteFill, styles.videoPlaceholder]}
              onPress={() => {
                if (phase !== "matched") return;
                onRetryConnect(autoRetryCount >= 1);
              }}
              disabled={phase !== "matched" || retryBusy}
            >
              {phase === "matched" ? (
                <>
                  <Text style={styles.splitPlaceholder}>
                    {partnerName || "…"}
                  </Text>
                  <Text style={styles.splitPlaceholderSub}>
                    {retryBusy
                      ? autoRetryCount >= 2
                        ? L.retryHard
                        : L.retrying
                      : L.linkingCameras || L.connectingPeer}
                  </Text>
                  <Text style={styles.splitPlaceholderTurn}>
                    {hasTurn ? L.turnReady : L.turnLoading}
                  </Text>
                  {!retryBusy ? (
                    <Text style={styles.splitPlaceholderTap}>
                      {L.connectingPeer}
                    </Text>
                  ) : (
                    <Text style={styles.splitPlaceholderTap}>{L.tapToRetry}</Text>
                  )}
                </>
              ) : null}
            </Pressable>
          )}
          {/* You muted them — veil + badge on their window (debate-style).
              Only when partner is the main tile (not after view swap). */}
          {showPartnerMute && !swapViews ? (
            <View style={styles.partnerMuteOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermark}>🔇</Text>
              <View style={styles.partnerMuteBadge}>
                <Text style={styles.partnerMuteBadgeText} numberOfLines={1}>
                  {L.partnerMutedBadge}
                </Text>
              </View>
            </View>
          ) : null}
          {/* Swapped: self is main tile — show they-muted-you veil there */}
          {showTheyMutedMe && swapViews ? (
            <View style={styles.partnerMuteOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermark}>🔇</Text>
              <View style={styles.partnerMuteBadge}>
                <Text style={styles.partnerMuteBadgeText} numberOfLines={1}>
                  {L.theyMutedYouBadge}
                </Text>
              </View>
            </View>
          ) : null}
          {/* Brand watermark on partner feed (ruletka.me) */}
          {phase === "matched" && hasRemote && !swapViews ? (
            <View style={styles.brandWm} pointerEvents="none">
              <Text style={styles.brandWmText}>ruletka.me</Text>
            </View>
          ) : null}
          {/* Touch layer ABOVE RTCView — never wrap SurfaceView in Pressable. */}
          {phase === "matched" &&
          hasRemote &&
          !isFriendCall &&
          !remoteBlurred ? (
            <Pressable
              style={styles.remoteTapLayer}
              onPress={() => {
                const now = Date.now();
                if (now - remoteTapRef.current < 320) {
                  remoteTapRef.current = 0;
                  onDoubleTapReblur();
                } else {
                  remoteTapRef.current = now;
                }
              }}
            />
          ) : null}
        </View>
      )}
      {pipStream && !multiRemote ? (
        <DraggablePip
          stageW={stageW}
          stageH={stageH}
          showHint={pipHint}
          hintText={L.pipHint}
          onHintSeen={onPipHintSeen}
          onDoubleTap={() => {
            if (!hasRemote || !remoteHasVideo) return;
            onHaptic();
            onSwapViews();
          }}
        >
          <VideoView
            stream={pipStream}
            streamEpoch={swapViews ? remoteEpoch : 0}
            mirror={pipMirror}
            style={styles.pipVideo}
            zOrder={2}
          />
          {/* Self in PiP: they muted you — same veil as partner-mute on main */}
          {showTheyMutedMe && !swapViews ? (
            <View style={styles.partnerMuteOverlay} pointerEvents="none">
              <Text style={styles.partnerMuteWatermark}>🔇</Text>
              <View style={styles.partnerMuteBadge}>
                <Text style={styles.partnerMuteBadgeText} numberOfLines={1}>
                  {L.theyMutedYouBadge}
                </Text>
              </View>
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
          <VideoView
            stream={localStream}
            streamEpoch={0}
            mirror
            style={styles.pipVideo}
            zOrder={2}
          />
        </DraggablePip>
      ) : null}
    </>
  );
}
