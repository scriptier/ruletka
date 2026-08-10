/**
 * Android-safe partner privacy veil.
 *
 * RTCView is a SurfaceView — RN views only cover it when zOrder is 0.
 * Never rely on unmounting video (that left a pure black hole). Keep partner
 * video mounted at zOrder 0 and paint this fully opaque mosaic on top.
 */
import { memo, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type PartnerBlurVeilProps = {
  style?: StyleProp<ViewStyle>;
  /** Compact pip-sized cover (no card). */
  compact?: boolean;
  title?: string;
  partnerLabel?: string;
  body?: string;
  buttonLabel?: string;
  hint?: string;
  ready?: boolean;
  onPress?: () => void;
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bright frosted palette — must never read as pure black on OLED. */
function cellColor(seed: number, i: number): string {
  const palette = [
    "#6b5a78",
    "#4a6a8c",
    "#8a6e5c",
    "#3d5678",
    "#5c7a9a",
    "#6a5570",
    "#3e7880",
    "#7a6080",
    "#4a6088",
    "#9a7a6a",
    "#5570a0",
    "#706090",
  ];
  return palette[(seed + i * 17) % palette.length]!;
}

export const PartnerBlurVeil = memo(function PartnerBlurVeil(
  props: PartnerBlurVeilProps
) {
  const {
    style,
    compact,
    title,
    partnerLabel,
    body,
    buttonLabel,
    hint,
    ready,
    onPress,
  } = props;

  // Percentage-positioned cells (flex rows often collapsed to 0 height on some
  // Android absoluteFill parents → pure black stage).
  const cells = useMemo(() => {
    const seed = hashSeed(partnerLabel || title || "veil");
    const cols = compact ? 5 : 8;
    const rows = compact ? 7 : 12;
    const out: {
      key: string;
      color: string;
      left: `${number}%`;
      top: `${number}%`;
      width: `${number}%`;
      height: `${number}%`;
    }[] = [];
    const cw = 100 / cols;
    const rh = 100 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        // Slight jitter so it reads as blur, not a perfect grid
        const jx = ((seed >> (i % 8)) & 3) * 0.15;
        const jy = ((seed >> ((i + 3) % 8)) & 3) * 0.12;
        out.push({
          key: `${r}-${c}`,
          color: cellColor(seed, i),
          left: `${c * cw - jx}%` as `${number}%`,
          top: `${r * rh - jy}%` as `${number}%`,
          width: `${cw + 0.8}%` as `${number}%`,
          height: `${rh + 0.8}%` as `${number}%`,
        });
      }
    }
    return out;
  }, [partnerLabel, title, compact]);

  const a11yLabel = [title, partnerLabel, buttonLabel || "Show video"]
    .filter(Boolean)
    .join(". ");

  const content = (
    <View
      style={[
        styles.root,
        styles.rootFill,
        compact && styles.rootCompact,
        style,
      ]}
      collapsable={false}
      pointerEvents={onPress ? "box-none" : "auto"}
      accessible={!onPress}
      accessibilityRole={onPress ? undefined : "image"}
      accessibilityLabel={onPress ? undefined : a11yLabel}
    >
      {/* Opaque base — never transparent (transparent = black hole over stage) */}
      <View style={styles.base} pointerEvents="none" collapsable={false} />
      <View style={styles.grid} pointerEvents="none" collapsable={false}>
        {cells.map((cell) => (
          <View
            key={cell.key}
            collapsable={false}
            style={[
              styles.gridCell,
              {
                backgroundColor: cell.color,
                left: cell.left,
                top: cell.top,
                width: cell.width,
                height: cell.height,
              },
            ]}
          />
        ))}
      </View>
      <View style={[styles.blob, styles.blobA]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobB]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobC]} pointerEvents="none" />
      <View style={styles.frost} pointerEvents="none" />
      <View style={styles.frostEdge} pointerEvents="none" />

      {!compact ? (
        <View style={styles.card} pointerEvents="none" collapsable={false}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {partnerLabel ? (
            <Text style={styles.partner} numberOfLines={1}>
              {partnerLabel}
            </Text>
          ) : null}
          {body ? <Text style={styles.body}>{body}</Text> : null}
          {buttonLabel ? (
            <View style={[styles.btn, ready && styles.btnReady]}>
              <Text style={styles.btnText}>{buttonLabel}</Text>
            </View>
          ) : null}
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      ) : (
        <View style={styles.pipBadge} pointerEvents="none">
          <Text style={styles.pipBadgeText}>
            {title || buttonLabel || "blur"}
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        style={[
          styles.press,
          styles.rootFill,
          compact && styles.pressCompact,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={hint}
        collapsable={false}
      >
        {content}
      </Pressable>
    );
  }
  return content;
});

const styles = StyleSheet.create({
  press: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  pressCompact: {
    ...StyleSheet.absoluteFillObject,
  },
  root: {
    ...StyleSheet.absoluteFillObject,
    // Modal parent uses flex:1 — also fill with flex when not absolute-sized
    flex: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    // Solid mid-tone — never #000 (OLED reads that as "broken camera")
    backgroundColor: "#5a6a88",
    // Above residual SurfaceView holes on some Android OEMs
    zIndex: 40,
    elevation: 24,
  },
  // absoluteFill without flex can collapse inside Modal on some devices
  rootFill: {
    flex: 1,
    width: "100%",
    height: "100%",
    zIndex: 40,
    elevation: 24,
  },
  rootCompact: {
    paddingHorizontal: 0,
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#45536c",
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridCell: {
    position: "absolute",
    borderRadius: 4,
    opacity: 0.95,
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
  },
  blobA: {
    width: "75%",
    height: "48%",
    top: "6%",
    left: "2%",
    backgroundColor: "rgba(160, 180, 230, 0.45)",
  },
  blobB: {
    width: "60%",
    height: "42%",
    bottom: "10%",
    right: "-4%",
    backgroundColor: "rgba(220, 150, 170, 0.38)",
  },
  blobC: {
    width: "45%",
    height: "32%",
    top: "38%",
    left: "28%",
    backgroundColor: "rgba(120, 200, 210, 0.35)",
  },
  frost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(50, 62, 88, 0.35)",
  },
  frostEdge: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  card: {
    zIndex: 4,
    elevation: 4,
    maxWidth: 320,
    width: "100%",
    alignItems: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: "rgba(18, 24, 38, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  title: {
    color: "#f0f4fc",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  partner: {
    color: "#d0e0ff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: "#c4d0e4",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  btn: {
    marginTop: 8,
    backgroundColor: "#3d7eff",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  btnReady: {
    backgroundColor: "#2d9f6f",
    borderWidth: 2,
    borderColor: "#6dffb8",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  hint: {
    color: "#a8b6cc",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  pipBadge: {
    position: "absolute",
    bottom: 6,
    alignSelf: "center",
    backgroundColor: "rgba(20, 28, 44, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pipBadgeText: {
    color: "#e0e8f8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
