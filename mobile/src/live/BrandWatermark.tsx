/**
 * Match-stage brand mark: full "ruletka.me" starts center (readable),
 * soft-drifts all the way to bottom-middle of the partner (conversationalist)
 * tile, then every 15s does a soft full 360° spin (always ends upright).
 *
 * Cycle (after settle, while matched):
 *   soft spin 360° (~1.3s, scale 1→1.06→1) → hold upright 15s → repeat
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
/** One full 360° revolution — slightly longer for smoother ease */
const SPIN_MS = 1300;
/** Upright rest between spins */
const HOLD_BETWEEN_SPINS_MS = 15_000;
const IDLE_OPACITY = 0.54;
const SPIN_OPACITY = 0.78;
const EDGE_SCALE = 0.72;
const CENTER_SCALE = 1.15;
/** Peak scale mid-spin (PC-feel pulse) */
const SPIN_PEAK_SCALE = 1.06;
/** Approx half-height of pill (for bottom park); refined on mark layout if needed */
const MARK_HALF_H = 22;
/** Gap from bottom edge of partner video — true bottom-middle of conversationalist window */
const BOTTOM_PAD = 14;

/**
 * Distance from vertical center down so the mark center sits near the bottom
 * of the partner tile (all the way down, horizontally middle).
 */
function settleTyForHeight(h: number): number {
  if (h <= 0) return 0;
  // Root justifyContent:center → start at h/2.
  // Target mark center: BOTTOM_PAD + MARK_HALF_H from bottom.
  const targetFromTop = h - BOTTOM_PAD - MARK_HALF_H;
  const startFromTop = h / 2;
  const ty = targetFromTop - startFromTop;
  // Floor so short stages still leave face center
  return Math.max(120, ty);
}

export const BrandWatermark = memo(function BrandWatermark(props: {
  /** Restart animation when match id / effect epoch changes */
  animKey?: string | number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  // Rotation degrees: 0 → 360 per spin, then reset to 0
  const rotate = useRef(new Animated.Value(0)).current;
  const spinBoost = useRef(new Animated.Value(0)).current;
  const settleDistance = useRef(
    new Animated.Value(settleTyForHeight(640))
  ).current;
  const containerH = useRef(0);
  const loopActive = useRef(false);

  const onRootLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h < 1) return;
      if (Math.abs(h - containerH.current) < 2) return;
      containerH.current = h;
      settleDistance.setValue(settleTyForHeight(h));
    },
    [settleDistance]
  );

  useEffect(() => {
    progress.setValue(0);
    rotate.setValue(0);
    spinBoost.setValue(0);
    loopActive.current = true;
    if (containerH.current > 0) {
      settleDistance.setValue(settleTyForHeight(containerH.current));
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

    /** Soft full 360° then rest upright 15s; repeat while matched */
    const runSpinLoop = () => {
      if (!loopActive.current) return;
      rotate.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rotate, {
            toValue: 360,
            duration: SPIN_MS,
            easing: easeInOut,
            useNativeDriver: true,
          }),
          spinPulse(),
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
    };
  }, [props.animKey, progress, rotate, spinBoost, settleDistance]);

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
