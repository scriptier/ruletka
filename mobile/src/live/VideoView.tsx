/**
 * Stable RTCView wrapper.
 *
 * Working baseline (cameras linked): zOrder **≥ 1** so remote video paints
 * above the RN window. zOrder **0** sits behind opaque parents and reads as
 * pure black partner stage (self PiP at zOrder 1 still works).
 *
 * Privacy blur unmounts partner RTCView + Modal — never cover a live surface.
 * Do not remount on every layout tick (local cam blink).
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
    return <View style={[styles.videoPlaceholder, style]} />;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCView } = require("react-native-webrtc");
    // Default 1 = media overlay (visible). Cap at 2. Never default 0.
    let zo = zOrder == null ? 1 : zOrder;
    if (zo > 2) zo = 2;
    if (zo < 0) zo = 0;
    // If caller asks for 0 (mute/bars overlay path), keep 0; otherwise prefer ≥1.
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
    backgroundColor: "#12151c",
    alignItems: "center",
    justifyContent: "center",
  },
  rtc: {
    backgroundColor: "transparent",
  },
  stageHint: { color: "#6b7a90", fontSize: 12, fontWeight: "600" },
});
