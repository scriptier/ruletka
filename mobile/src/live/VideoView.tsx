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
 *
 * iOS objectFit: RTCVideoView's native setObjectFit: only touches
 * videoContentMode when the incoming value differs from its cached
 * _objectFit — which the native init already sets to Cover. So a view that
 * mounts straight into objectFit="cover" never gets the aspect-fill call and
 * silently renders letterboxed (aspect-fit) instead of filling like Android.
 * Fix: mount at "contain" and flip to "cover" one frame later on the *same*
 * native view (no key change) so the setter observes a real transition.
 * Android's WebRTCView has no such guard, so it always gets "cover" as-is.
 */
import { memo, useEffect, useMemo, useState } from "react";
import {
  Platform,
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

  // Default 1 = media overlay (visible). Cap at 2. Never default 0.
  let zo = zOrder == null ? 1 : zOrder;
  if (zo > 2) zo = 2;
  if (zo < 0) zo = 0;
  // Key includes epoch + zOrder so unblur (0→1 + epoch bump) rebinds cleanly.
  // Do not churn key on layout-only updates.
  const rtcKey = url ? `rtc-${url}-e${streamEpoch ?? 0}-z${zo}` : "";

  const [iosObjectFit, setIosObjectFit] = useState<"contain" | "cover">(
    "contain",
  );
  useEffect(() => {
    if (Platform.OS !== "ios" || !rtcKey) return;
    setIosObjectFit("contain");
    const raf = requestAnimationFrame(() => setIosObjectFit("cover"));
    return () => cancelAnimationFrame(raf);
  }, [rtcKey]);

  if (!stream || !url) {
    // Mid-tone placeholder — never pure black (reads as broken camera on OLED)
    return <View style={[styles.videoPlaceholder, style]} />;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCView } = require("react-native-webrtc");
    return (
      <RTCView
        key={rtcKey}
        streamURL={url}
        objectFit={Platform.OS === "ios" ? iosObjectFit : "cover"}
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
    // SurfaceView needs a real box. Empty style → 0×0 → black 3-way tiles
    // (PiP still painted because its parent is sized).
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  stageHint: { color: "#6b7a90", fontSize: 12, fontWeight: "600" },
});
