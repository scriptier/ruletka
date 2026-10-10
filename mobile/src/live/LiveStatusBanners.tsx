/**
 * Privacy blur banner only (top strip under identity dock).
 * Mute text banners ("They muted you" / "You muted · no sound") removed —
 * mute state is the mid-stage icon only (user 2026-08-11 Android screenshot).
 * Mute-related props are accepted (void) so live.tsx can keep passing them.
 */
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function LiveStatusBanners(props: {
  /**
   * @deprecated Mute text removed — mid-stage mute icon only.
   * Kept optional so callers can still pass without a second text surface.
   */
  theyMutedMe?: boolean;
  /**
   * @deprecated Mute text removed — mid-stage mute icon only.
   * Kept optional so callers can still pass without a second text surface.
   */
  partnerMuted?: boolean;
  remoteBlurred?: boolean;
  /** Hide blur row when a full-screen Modal already covers privacy (default true when remoteBlurred). */
  showBlurBanner?: boolean;
  /**
   * top = under PartnerIdentityDock top strip (default for match UI).
   * bottom = compact chips above control dock (legacy).
   * default = slightly larger banners without strip chrome.
   */
  placement?: "default" | "bottom" | "top";
  /**
   * @deprecated Mute text removed. Optional void — live.tsx may still pass i18n strings.
   */
  theyMutedLabel?: string;
  /**
   * @deprecated Mute text removed. Optional void — live.tsx may still pass i18n strings.
   */
  partnerMutedLabel?: string;
  blurredLabel?: string;
  onUnblur?: () => void;
  unblurLabel?: string;
}) {
  const {
    remoteBlurred,
    showBlurBanner = true,
    placement = "default",
    blurredLabel,
    onUnblur,
    unblurLabel,
  } = props;

  // Mute text rows intentionally not rendered (theyMutedMe / partnerMuted).
  void props.theyMutedMe;
  void props.partnerMuted;
  void props.theyMutedLabel;
  void props.partnerMutedLabel;

  const blurRow = !!(remoteBlurred && showBlurBanner);
  if (!blurRow) return null;

  const bottom = placement === "bottom";
  const top = placement === "top";

  // iPhone notch / home indicator: this banner can land as the outermost
  // element on either edge depending on caller layout, so it carries its
  // own safe-area gap instead of assuming a parent already padded it
  // (same pattern as PartnerIdentityDock / LiveBottomBar).
  const insets = useSafeAreaInsets();
  const iosEdgeGap =
    Platform.OS === "ios"
      ? bottom
        ? { marginBottom: insets.bottom }
        : top
          ? { marginTop: Math.max(insets.top - 6, 0) }
          : null
      : null;

  return (
    <View
      style={[
        styles.wrap,
        bottom && styles.wrapBottom,
        top && styles.wrapTop,
        iosEdgeGap,
      ]}
      accessibilityLiveRegion="polite"
      pointerEvents="box-none"
      collapsable={false}
    >
      <Pressable
        style={[
          styles.banner,
          bottom && styles.bannerBottom,
          top && styles.bannerTop,
          styles.blurred,
        ]}
        onPress={onUnblur}
        accessibilityRole="button"
        accessibilityLabel={`${blurredLabel || "Privacy veil on"}${
          unblurLabel ? `. ${unblurLabel}` : ""
        }`}
        collapsable={false}
      >
        <Text
          style={[
            styles.bannerText,
            bottom && styles.bannerTextBottom,
            top && styles.bannerTextTop,
          ]}
        >
          <Text importantForAccessibility="no" accessibilityElementsHidden>
            👁{" "}
          </Text>
          {blurredLabel || "Privacy veil on"}
          {unblurLabel ? ` · ${unblurLabel}` : ""}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 6,
    zIndex: 20,
    ...Platform.select({
      android: { elevation: 8 },
      default: {},
    }),
  },
  /** Tighter stack above bottom control rows (legacy) */
  wrapBottom: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 2,
    gap: 4,
  },
  /**
   * Full-width strip under PartnerIdentityDock top strip.
   * High elevation so Android SurfaceView does not cover the blur banner.
   */
  wrapTop: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 5,
    zIndex: 62,
    ...Platform.select({
      android: { elevation: 32 },
      ios: {
        // Keep readable over video when not using elevation
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      default: {},
    }),
  },
  banner: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      default: {},
    }),
  },
  bannerBottom: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  /** Top strip: full-width readable alert, not a tiny bottom chip */
  bannerTop: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 2,
    width: "100%",
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      default: {},
    }),
  },
  blurred: {
    backgroundColor: "rgba(28, 48, 88, 0.97)",
    borderColor: "rgba(130, 180, 255, 0.9)",
  },
  bannerText: {
    color: "#fff4f2",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  bannerTextBottom: {
    fontSize: 13,
  },
  bannerTextTop: {
    fontSize: 14,
    letterSpacing: 0.15,
  },
});
