/**
 * RN wrapper for native SoftBlurVideoView (BLUR-F2).
 *
 * PRODUCT: Soft live-blur is ON — LiveStageVideo prefers SoftBlurRemote over
 * the old solid PartnerBlurVeil mosaic. Veil remains fallback when native is
 * missing / iOS / empty streamURL. iOS has no native VideoSink pixel-blur
 * (isSoftBlurNativeAvailable() is Android-only by design), so PartnerBlurVeil
 * itself renders a translucent soft-blur look on iOS (tinted base + blobs,
 * no hard mosaic grid) instead of Android's opaque quilt — see PartnerBlurVeil.tsx.
 *
 * Native samples remote WebRTC frames via VideoSink, downscales, soft-blurs,
 * and paints an ImageView overlay. streamURL is MediaStream.toURL() (same as
 * RTCView); native resolves via WebRTCModule.getStreamForReactTag.
 *
 * Crash guards: SoftBlurVideoView detach/retain (0.1.372+). Modal must stay
 * transparent (no absoluteFill PartnerBlurVeil) or soft blur is covered.
 */
import { memo, type ComponentType } from "react";
import {
  Platform,
  requireNativeComponent,
  UIManager,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import type { MediaStreamLike } from "../media/MediaSession";

/** Native view manager name from SoftBlurVideoViewManager (BLUR-F2). */
export const SOFT_BLUR_NATIVE_NAME = "SoftBlurVideoView";

/**
 * Product switch: soft live-blur (SoftBlurVideoView) ON.
 * isSoftBlurNativeAvailable() requires this flag + Android + native manager.
 * PartnerBlurVeil only when native unavailable.
 */
export const SOFT_BLUR_PRODUCT_ENABLED = true;

export type SoftBlurRemoteProps = {
  /** react-native-webrtc stream URL (MediaStream.toURL()). Empty = detach. */
  streamURL: string;
  /** When true, native samples + paints soft blur; when false, idle/clear. */
  active: boolean;
  style?: StyleProp<ViewStyle>;
};

type SoftBlurNativeProps = ViewProps & {
  streamURL: string;
  active: boolean;
};

/**
 * Resolve MediaStream → streamURL for SoftBlurRemote / RTCView.
 * Returns "" if stream is null/undefined or toURL() throws.
 */
export function getStreamUrl(
  stream: MediaStreamLike | null | undefined
): string {
  if (!stream) return "";
  try {
    const url = stream.toURL?.();
    return typeof url === "string" ? url : "";
  } catch {
    return "";
  }
}

function readNativeConfig(): unknown {
  try {
    const ui = UIManager as {
      getViewManagerConfig?: (name: string) => unknown;
      hasViewManagerConfig?: (name: string) => boolean;
      [key: string]: unknown;
    };
    if (typeof ui.getViewManagerConfig === "function") {
      return ui.getViewManagerConfig(SOFT_BLUR_NATIVE_NAME);
    }
    if (typeof ui.hasViewManagerConfig === "function") {
      return ui.hasViewManagerConfig(SOFT_BLUR_NATIVE_NAME) ? {} : null;
    }
    // Older RN: managers appear as keys on UIManager
    return ui[SOFT_BLUR_NATIVE_NAME] ?? null;
  } catch {
    return null;
  }
}

/**
 * True when product soft-blur is ON, Platform is Android, and SoftBlurVideoView
 * is registered. False → LiveStageVideo uses PartnerBlurVeil fallback.
 */
export function isSoftBlurNativeAvailable(): boolean {
  if (!SOFT_BLUR_PRODUCT_ENABLED) return false;
  if (Platform.OS !== "android") return false;
  return readNativeConfig() != null;
}

let SoftBlurNative: ComponentType<SoftBlurNativeProps> | null | undefined;

function getSoftBlurNative(): ComponentType<SoftBlurNativeProps> | null {
  if (SoftBlurNative !== undefined) return SoftBlurNative;
  if (!isSoftBlurNativeAvailable()) {
    SoftBlurNative = null;
    return null;
  }
  try {
    SoftBlurNative =
      requireNativeComponent<SoftBlurNativeProps>(SOFT_BLUR_NATIVE_NAME);
  } catch {
    SoftBlurNative = null;
  }
  return SoftBlurNative;
}

/**
 * Soft live-blur overlay for a remote WebRTC stream.
 * Renders null when native SoftBlurVideoView is missing or streamURL is empty.
 */
export const SoftBlurRemote = memo(function SoftBlurRemote(
  props: SoftBlurRemoteProps
) {
  const { streamURL, active, style } = props;
  const Native = getSoftBlurNative();
  if (!Native) return null;
  if (!streamURL) return null;

  return (
    <Native
      streamURL={streamURL}
      active={!!active}
      style={style}
      // Do not collapse empty SoftBlur under Fabric / layout thrash
      collapsable={false}
      pointerEvents="none"
    />
  );
});
