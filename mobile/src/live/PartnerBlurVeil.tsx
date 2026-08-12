/**
 * Partner privacy veil (opaque cover over mounted RTCView).
 *
 * LiveStageVideo keeps partner RTCView mounted while remoteBlurred (unmount
 * mid-call crashes WebRTC). This component is the solid fill on the partner
 * tile: #45536c + mosaic + Show video CTA. live.tsx also hosts an opaque
 * Android Modal while veiled so SurfaceView cannot punch through. Palette is
 * mid-tone frosted — never pure #000 (OLED "broken").
 *
 * Layout: absoluteFill parents often give % children 0 size on Android.
 * Measure via onLayout and paint pixel cells; solid BLUR_VEIL_BASE always wins
 * over any transparent `style` prop so a failed grid is still not black.
 * When onLayout is still 0, seed mosaic from window size so cover is never empty.
 */
import { memo, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/** Solid mid-tone — never pure #000 (OLED "broken camera"). */
export const BLUR_VEIL_BASE = "#45536c";

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

type Cell =
  | {
      key: string;
      color: string;
      left: number;
      top: number;
      width: number;
      height: number;
      unit: "px";
    }
  | {
      key: string;
      color: string;
      left: `${number}%`;
      top: `${number}%`;
      width: `${number}%`;
      height: `${number}%`;
      unit: "pct";
    };

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

  // Pixel layout — % width/height of absolute children often resolve to 0 on
  // Android when the parent is only flex-sized / absoluteFill.
  // Seed from window so first paint is never empty (onLayout may lag a frame).
  const [box, setBox] = useState(() => {
    try {
      const { width, height } = Dimensions.get("window");
      return {
        w: Math.max(1, Math.round(width)),
        h: Math.max(1, Math.round(height * (compact ? 0.22 : 0.7))),
      };
    } catch {
      return { w: 360, h: compact ? 120 : 480 };
    }
  });
  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width < 1 || height < 1) return;
    setBox((prev) =>
      prev.w === Math.round(width) && prev.h === Math.round(height)
        ? prev
        : { w: Math.round(width), h: Math.round(height) }
    );
  };

  // Smoke: one line on veil mount / unmount (adb logcat | grep blur)
  useEffect(() => {
    const kind = compact ? "compact" : "full";
    console.log(`[blur] show why=veil_${kind}`);
    return () => {
      console.log(`[blur] hide why=veil_${kind}`);
    };
  }, [compact]);

  const cells = useMemo((): Cell[] => {
    const seed = hashSeed(partnerLabel || title || "veil");
    // Fewer cells = less JS/native view thrash on match (crash/ANR risk at 8×12).
    const cols = compact ? 4 : 5;
    const rows = compact ? 5 : 7;
    const out: Cell[] = [];
    // Prefer measured px; never fall back to % (pct cells often stay 0 on Android)
    const usePx = box.w > 1 && box.h > 1;
    const cw = usePx ? box.w / cols : 100 / cols;
    const rh = usePx ? box.h / rows : 100 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        // Slight jitter so it reads as blur, not a perfect grid
        const jx = ((seed >> (i % 8)) & 3) * (usePx ? 1.2 : 0.15);
        const jy = ((seed >> ((i + 3) % 8)) & 3) * (usePx ? 1.0 : 0.12);
        if (usePx) {
          out.push({
            key: `${r}-${c}`,
            color: cellColor(seed, i),
            left: c * cw - jx,
            top: r * rh - jy,
            width: cw + 2,
            height: rh + 2,
            unit: "px",
          });
        } else {
          out.push({
            key: `${r}-${c}`,
            color: cellColor(seed, i),
            left: `${c * cw - jx}%` as `${number}%`,
            top: `${r * rh - jy}%` as `${number}%`,
            width: `${cw + 0.8}%` as `${number}%`,
            height: `${rh + 0.8}%` as `${number}%`,
            unit: "pct",
          });
        }
      }
    }
    return out;
  }, [partnerLabel, title, compact, box.w, box.h]);

  const a11yLabel = [title, partnerLabel, buttonLabel || "Show video"]
    .filter(Boolean)
    .join(". ");

  const mosaic = (
    <>
      {/* Opaque base — never transparent (transparent = black hole over stage) */}
      <View
        style={styles.base}
        pointerEvents="none"
        collapsable={false}
        removeClippedSubviews={false}
      />
      <View
        style={styles.grid}
        pointerEvents="none"
        collapsable={false}
        removeClippedSubviews={false}
      >
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
    </>
  );

  // Shared fill: caller style (remoteFill / pipVideo) often sets transparent bg —
  // apply it first, then forceOpaque so we never inherit a black hole.
  const fillStyle = [
    styles.root,
    styles.rootFill,
    compact && styles.rootCompact,
    style,
    styles.forceOpaque,
  ];

  if (onPress) {
    return (
      <Pressable
        style={fillStyle}
        onPress={onPress}
        onLayout={onRootLayout}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={hint}
        collapsable={false}
        // Android: mosaic cells must not be culled before first layout
        removeClippedSubviews={false}
        // Whole veil is the hit target (card uses pointerEvents none)
        hitSlop={4}
      >
        {mosaic}
      </Pressable>
    );
  }
  return (
    <View
      style={fillStyle}
      collapsable={false}
      removeClippedSubviews={false}
      pointerEvents="auto"
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      onLayout={onRootLayout}
    >
      {mosaic}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    // Flex fill for Modal / flex parents first; absoluteFill for stage overlays
    flex: 1,
    alignSelf: "stretch",
    width: "100%",
    height: "100%",
    minWidth: 1,
    minHeight: 120,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    // Solid mid-tone — never #000 (OLED reads that as "broken camera")
    backgroundColor: BLUR_VEIL_BASE,
    opacity: 1,
    // Above residual SurfaceView holes on some Android OEMs
    zIndex: 40,
    elevation: 28,
  },
  // absoluteFill so stage overlays cover RTCView; keep flex for Modal hosts
  rootFill: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    alignSelf: "stretch",
    width: "100%",
    height: "100%",
    minWidth: 1,
    minHeight: 120,
    backgroundColor: BLUR_VEIL_BASE,
    opacity: 1,
    zIndex: 40,
    elevation: 28,
  },
  /** Applied last so caller transparent styles cannot punch a black hole. */
  forceOpaque: {
    backgroundColor: BLUR_VEIL_BASE,
    // Never inherit opacity/transparent from parent remoteFill styles
    opacity: 1,
  },
  rootCompact: {
    paddingHorizontal: 0,
    minHeight: 48,
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    // Solid opaque base — if grid cells fail to layout, still not pure black
    backgroundColor: BLUR_VEIL_BASE,
    opacity: 1,
    flex: 1,
    width: "100%",
    height: "100%",
    minWidth: 1,
    minHeight: 1,
    zIndex: 0,
  },
  grid: {
    // Percentage cells need parent with explicit flex:1 / height
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    width: "100%",
    height: "100%",
    minWidth: 1,
    minHeight: 1,
    overflow: "hidden",
  },
  gridCell: {
    position: "absolute",
    borderRadius: 4,
    // Full opacity — semi-transparent cells can look like a black hole over
    // SurfaceView when the base layer fails to composite on some OEMs.
    opacity: 1,
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
