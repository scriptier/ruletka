/**
 * Match-stage brand mark: full "ruletka.me" starts center (readable),
 * soft-drifts to the partner|you seam — mobile web parity:
 *   portrait (tiles stack)   → horizontal seam, ~56% down the stage
 *   landscape (tiles side by side) → vertical seam, stays at mid-height
 * — then glows and does one quick 360° every 20s (always ends upright).
 *
 * Cycle (after settle, while matched):
 *   still → glow (~0.8s) → one quick 360° (~0.7s) → hold 20s → repeat
 */
import { memo, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

const SETTLE_HOLD_MS = 1200;
const SETTLE_MS = 1100;
/** Halo before the spin — still upright */
const GLOW_IN_MS = 450;
const GLOW_HOLD_MS = 350;
/** One quick 360° (parity with PC ~0.7s) */
const SPIN_MS = 700;
/** Upright rest after spin before the next glow+spin */
const HOLD_BETWEEN_SPINS_MS = 20_000;
const IDLE_OPACITY = 0.54;
const SPIN_OPACITY = 0.78;
const EDGE_SCALE = 0.72;
const CENTER_SCALE = 1.15;
/** Peak scale mid-spin (PC-feel pulse) */
const SPIN_PEAK_SCALE = 1.06;
/** Portrait: tiles stack (partner top / you bottom) — seam sits ~56% down (web parity) */
const PORTRAIT_SEAM_FRACTION = 0.56;
/** Landscape: tiles sit side by side — seam is vertical, mark stays at mid-height */
const LANDSCAPE_SEAM_FRACTION = 0.5;

/**
 * Distance from vertical center down so the mark settles on the partner|you
 * seam: near mid-height in landscape (vertical seam), a touch below mid in
 * portrait (horizontal seam between stacked tiles) — mirrors mobile web.
 */
function settleTyForStage(w: number, h: number): number {
  if (h <= 0) return 0;
  const isLandscape = w > h;
  const seamFraction = isLandscape
    ? LANDSCAPE_SEAM_FRACTION
    : PORTRAIT_SEAM_FRACTION;
  // Root justifyContent:center → start at h/2.
  const targetFromTop = h * seamFraction;
  const startFromTop = h / 2;
  return targetFromTop - startFromTop;
}

export const BrandWatermark = memo(function BrandWatermark(props: {
  /** Restart animation when match id / effect epoch changes */
  animKey?: string | number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  // Rotation degrees: 0 → 360 per spin, then reset to 0
  const rotate = useRef(new Animated.Value(0)).current;
  const spinBoost = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const settleDistance = useRef(
    new Animated.Value(settleTyForStage(360, 640))
  ).current;
  const containerW = useRef(0);
  const containerH = useRef(0);
  const loopActive = useRef(false);

  const onRootLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (h < 1) return;
      if (
        Math.abs(h - containerH.current) < 2 &&
        Math.abs(w - containerW.current) < 2
      ) {
        return;
      }
      containerW.current = w;
      containerH.current = h;
      settleDistance.setValue(settleTyForStage(w, h));
    },
    [settleDistance]
  );

  useEffect(() => {
    progress.setValue(0);
    rotate.setValue(0);
    spinBoost.setValue(0);
    glow.setValue(0);
    loopActive.current = true;
    if (containerH.current > 0) {
      settleDistance.setValue(
        settleTyForStage(containerW.current, containerH.current)
      );
    }

    const easeInOut = Easing.inOut(Easing.cubic);

    const settle = Animated.sequence([
      Animated.timing(progress, {
        toValue: 0,
        duration: 1,
        useNativeDriver: true,
      }),
      Animated.delay(SETTLE_HOLD_MS),
      Animated.timing(progress, {
        toValue: 1,
        duration: SETTLE_MS,
        easing: easeInOut,
        useNativeDriver: true,
      }),
    ]);

    const spinPulse = () =>
      Animated.sequence([
        Animated.timing(spinBoost, {
          toValue: 1,
          duration: SPIN_MS / 2,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(spinBoost, {
          toValue: 0,
          duration: SPIN_MS / 2,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

    /** Still → glow → one quick 360° → 20s rest; repeat while matched */
    const runSpinLoop = () => {
      if (!loopActive.current) return;
      rotate.setValue(0);
      glow.setValue(0);
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: GLOW_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(GLOW_HOLD_MS),
        Animated.parallel([
          Animated.timing(rotate, {
            toValue: 360,
            duration: SPIN_MS,
            easing: easeInOut,
            useNativeDriver: true,
          }),
          spinPulse(),
          Animated.timing(glow, {
            toValue: 0,
            duration: SPIN_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(HOLD_BETWEEN_SPINS_MS),
      ]).start(({ finished }) => {
        if (!finished || !loopActive.current) return;
        runSpinLoop();
      });
    };

    settle.start(({ finished }) => {
      if (!finished || !loopActive.current) return;
      runSpinLoop();
    });

    return () => {
      loopActive.current = false;
      settle.stop();
      progress.stopAnimation();
      rotate.stopAnimation();
      spinBoost.stopAnimation();
      glow.stopAnimation();
    };
  }, [props.animKey, progress, rotate, spinBoost, glow, settleDistance]);

  const settleScale = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [CENTER_SCALE, 0.95, EDGE_SCALE],
  });
  const settleOpacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.92, 0.78, IDLE_OPACITY],
  });
  const translateY = Animated.multiply(progress, settleDistance);

  const spinOpacityDelta = spinBoost.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SPIN_OPACITY - IDLE_OPACITY],
  });
  const opacity = Animated.add(settleOpacity, spinOpacityDelta);

  const spinScale = spinBoost.interpolate({
    inputRange: [0, 1],
    outputRange: [1, SPIN_PEAK_SCALE],
  });
  const scale = Animated.multiply(settleScale, spinScale);

  const rotateZ = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      testID="live-brand-wm"
      onLayout={onRootLayout}
    >
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }, { scale }, { rotate: rotateZ }],
        }}
      >
        <View style={styles.markWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glowHalo,
              {
                opacity: glow,
                transform: [
                  {
                    scale: glow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.45],
                    }),
                  },
                ],
              },
            ]}
          />
          <Text style={styles.markText} numberOfLines={1} ellipsizeMode="clip">
            ruletka.me
          </Text>
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    // Above SurfaceView peer video (keep elevated stacking)
    zIndex: 6,
    ...Platform.select({
      android: { elevation: 12 },
      default: {},
    }),
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  markWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "visible",
    position: "relative",
    // Richer glass pill (parity with PC stage-brand-spin depth)
    backgroundColor: "rgba(12, 16, 26, 0.58)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.16)",
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.42,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  glowHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: "rgba(170, 205, 255, 0.28)",
    borderWidth: 1,
    borderColor: "rgba(200, 220, 255, 0.55)",
    shadowColor: "#b8d0ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    ...Platform.select({
      android: { elevation: 10 },
      default: {},
    }),
  },
  markText: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.55,
    includeFontPadding: false,
    // Stronger dual-layer readability over busy video
    textShadowColor: "rgba(0,0,0,0.92)",
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 2 },
  },
});
