/**
 * Mute / blur status rows that sit in the bottom chrome (below the stage).
 * Never painted over the partner SurfaceView tile.
 *
 * When full-screen privacy Modal is open, pass showBlurBanner=false (Modal owns
 * unblur) — this only suppresses the blur row. Mute banners are independent of
 * Modal state and always show whenever theyMutedMe/partnerMuted are true.
 */
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

export function LiveStatusBanners(props: {
  theyMutedMe?: boolean;
  partnerMuted?: boolean;
  remoteBlurred?: boolean;
  /** Hide blur row when a full-screen Modal already covers privacy (default true when remoteBlurred). */
  showBlurBanner?: boolean;
  theyMutedLabel: string;
  partnerMutedLabel: string;
  blurredLabel?: string;
  onUnblur?: () => void;
  unblurLabel?: string;
}) {
  const {
    theyMutedMe,
    partnerMuted,
    remoteBlurred,
    showBlurBanner = true,
    theyMutedLabel,
    partnerMutedLabel,
    blurredLabel,
    onUnblur,
    unblurLabel,
  } = props;

  const blurRow = !!(remoteBlurred && showBlurBanner);
  if (!theyMutedMe && !partnerMuted && !blurRow) return null;

  return (
    <View
      style={styles.wrap}
      accessibilityLiveRegion="polite"
      pointerEvents="box-none"
      collapsable={false}
    >
      {theyMutedMe ? (
        <View
          style={[styles.banner, styles.theyMuted]}
          accessibilityRole="alert"
          collapsable={false}
        >
          <Text style={styles.bannerText}>
            <Text importantForAccessibility="no" accessibilityElementsHidden>
              🔇{" "}
            </Text>
            {theyMutedLabel}
          </Text>
        </View>
      ) : null}
      {partnerMuted ? (
        <View
          style={[styles.banner, styles.youMuted]}
          accessibilityRole="alert"
          collapsable={false}
        >
          <Text style={styles.bannerText}>
            <Text importantForAccessibility="no" accessibilityElementsHidden>
              🔇{" "}
            </Text>
            {partnerMutedLabel}
          </Text>
        </View>
      ) : null}
      {blurRow ? (
        <Pressable
          style={[styles.banner, styles.blurred]}
          onPress={onUnblur}
          accessibilityRole="button"
          accessibilityLabel={`${blurredLabel || "Privacy veil on"}${
            unblurLabel ? `. ${unblurLabel}` : ""
          }`}
          collapsable={false}
        >
          <Text style={styles.bannerText}>
            <Text importantForAccessibility="no" accessibilityElementsHidden>
              👁{" "}
            </Text>
            {blurredLabel || "Privacy veil on"}
            {unblurLabel ? ` · ${unblurLabel}` : ""}
          </Text>
        </Pressable>
      ) : null}
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
  theyMuted: {
    backgroundColor: "rgba(90, 18, 14, 0.98)",
    borderColor: "rgba(255, 120, 90, 0.95)",
  },
  youMuted: {
    backgroundColor: "rgba(55, 22, 14, 0.97)",
    borderColor: "rgba(255, 150, 110, 0.8)",
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
});
