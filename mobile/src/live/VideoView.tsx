/**
 * Stable RTCView wrapper. Remounting a local-camera RTCView on Android often
 * restarts the camera hardware (visible as blink / torch flash). Keep one
 * instance per stream role and only change layout styles.
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
    // Android: zOrder 0 = behind RN window (hidden by opaque parents).
    // Use ≥1 so remote video is visible above stage background.
    return (
      <RTCView
        key={`${url}-${streamEpoch ?? 0}`}
        streamURL={url}
        objectFit="cover"
        mirror={!!mirror}
        zOrder={zOrder ?? 1}
        style={style}
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
  stageHint: { color: "#6b7a90", fontSize: 12, fontWeight: "600" },
});
