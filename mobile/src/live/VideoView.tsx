/**
 * Stable RTCView wrapper.
 *
 * Android SurfaceView: zOrder ≥ 1 composites ABOVE the entire RN window
 * (PartnerChrome cannot win with elevation). Partner remote stays **0** so RN
 * chrome paints above; self PiP may use **2** when uncovered. zOrder **0** also
 * sits behind opaque RN covers (bars, mute, partner-hide) — pair with a fully
 * opaque cover, never leave bare over a transparent stage.
 *
 * Privacy blur: parent keeps this view mounted while remoteBlurred and covers
 * with PartnerBlurVeil (+ Android Modal). Unmount mid-call crashes WebRTC on
 * some devices. Do not remount on every layout tick (local cam blink).
 */
import { memo, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { MediaStreamLike } from "../media/MediaSession";

export const VideoView = memo(function VideoView(props: {
  stream: MediaStreamLike | null;
  mirror?: boolean;
  style?: StyleProp<ViewStyle>;
  zOrder?: number;
  /** Bump when tracks change so RTCView rebinds (audio-then-video ontrack). */
  streamEpoch?: number;
  /** ignored — kept for call-site compatibility */
  pixelW?: number;
  /** ignored — kept for call-site compatibility */
  pixelH?: number;
}) {
  const { stream, mirror, style, zOrder, streamEpoch } = props;
  const url = useMemo(() => {
    if (!stream) return "";
    try {
      return stream.toURL();
    } catch {
      return "";
    }
  }, [stream, streamEpoch]);

  if (!stream || !url) {
    // Mid-tone placeholder — never pure black (reads as broken camera on OLED)
    return <View style={[styles.videoPlaceholder, style]} />;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCView } = require("react-native-webrtc");
    // Default 1 = media overlay (visible). Cap at 2. Never default 0.
    let zo = zOrder == null ? 1 : zOrder;
    if (zo > 2) zo = 2;
    if (zo < 0) zo = 0;
    // Key includes epoch + zOrder so unblur (0→1 + epoch bump) rebinds cleanly.
    // Do not churn key on layout-only updates.
    return (
      <RTCView
        key={`rtc-${url}-e${streamEpoch ?? 0}-z${zo}`}
        streamURL={url}
        objectFit="cover"
        mirror={!!mirror}
        zOrder={zo}
        style={[styles.rtc, style]}
      />
    );
  } catch {
    return (
      <View style={[styles.videoPlaceholder, style]}>
        <Text style={styles.stageHint}>RTCView unavailable</Text>
      </View>
    );
  }
});

const styles = StyleSheet.create({
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    // Not #000 — empty stage should not look like a privacy black hole
    backgroundColor: "#1a2230",
    alignItems: "center",
    justifyContent: "center",
  },
  rtc: {
    // Transparent so parent blurUnderlay / mosaic shows when zOrder 0
    backgroundColor: "transparent",
  },
  stageHint: { color: "#6b7a90", fontSize: 12, fontWeight: "600" },
});
