/**
 * Transparent partner-stage swipe → Next (skip).
 *
 * Android SurfaceView (RTCView) does not receive RN gestures well — this
 * GestureDetector wraps the partner main stage and drives reanimated
 * translate/opacity. Thresholds mirror web `wirePartnerSwipe` (ui/live.js).
 * Locks (please_stay / nextGrace) live in next() — just call onCommit.
 */
import { useCallback, useEffect, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export type SwipeSkipOverlayProps = {
  /** When false, children render plain (no pan / no translate). */
  enabled: boolean;
  /** Called after fly-off commit. dir -1 = left, 1 = right. */
  onCommit: (dir: -1 | 1) => void;
  /** Armed threshold tick + commit pulse. */
  onHaptic?: () => void;
  /** Double-tap reblur (optional — replaces Pressable remoteTapLayer). */
  onDoubleTap?: () => void;
  /** Single tap (optional — partner actions). Double-tap still wins. */
  onTap?: () => void;
  /** Long-press report (optional). */
  onLongPress?: () => void;
  /** Label shown while dragging (e.g. i18n swipe.next). */
  nextLabel?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function SwipeSkipOverlay(props: SwipeSkipOverlayProps) {
  const {
    enabled,
    onCommit,
    onHaptic,
    onDoubleTap,
    onTap,
    onLongPress,
    nextLabel,
    style,
    children,
  } = props;

  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const armed = useSharedValue(0);
  const dragging = useSharedValue(0);
  const widthSV = useSharedValue(320);
  const armedHapticFired = useSharedValue(0);
  const committing = useSharedValue(0);

  const fireHaptic = useCallback(() => {
    try {
      onHaptic?.();
    } catch {
      /* ignore */
    }
  }, [onHaptic]);

  const fireDoubleTap = useCallback(() => {
    try {
      onDoubleTap?.();
    } catch {
      /* ignore */
    }
  }, [onDoubleTap]);

  const fireTap = useCallback(() => {
    try {
      onTap?.();
    } catch {
      /* ignore */
    }
  }, [onTap]);

  const fireLongPress = useCallback(() => {
    try {
      onHaptic?.();
      onLongPress?.();
    } catch {
      /* ignore */
    }
  }, [onHaptic, onLongPress]);

  const finishCommit = useCallback(
    (dir: -1 | 1) => {
      try {
        onCommit(dir);
      } catch {
        /* ignore */
      }
      // Reset so the next partner stage starts centered
      translateX.value = 0;
      opacity.value = 1;
      armed.value = 0;
      dragging.value = 0;
      armedHapticFired.value = 0;
      committing.value = 0;
    },
    [
      onCommit,
      armed,
      armedHapticFired,
      committing,
      dragging,
      opacity,
      translateX,
    ]
  );

  // Reset visual if parent disables mid-gesture (phase change, friend call)
  useEffect(() => {
    if (!enabled) {
      translateX.value = 0;
      opacity.value = 1;
      armed.value = 0;
      dragging.value = 0;
      armedHapticFired.value = 0;
      committing.value = 0;
    }
  }, [
    enabled,
    armed,
    armedHapticFired,
    committing,
    dragging,
    opacity,
    translateX,
  ]);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-24, 24])
    .failOffsetY([-40, 40])
    .onBegin(() => {
      if (committing.value) return;
      armedHapticFired.value = 0;
    })
    .onUpdate((e) => {
      if (committing.value) return;
      const w = widthSV.value;
      const max = Math.max(160, w * 0.72);
      const raw = e.translationX;
      const over = Math.abs(raw) > max;
      const clamped = over
        ? Math.sign(raw) * (max + (Math.abs(raw) - max) * 0.22)
        : raw;
      translateX.value = clamped;
      const progress = Math.min(
        1,
        Math.abs(clamped) / Math.max(64, w * 0.2)
      );
      opacity.value = 1 - progress * 0.12;
      const nowArmed = progress >= 0.88 ? 1 : 0;
      dragging.value = 1;
      if (nowArmed === 1 && armedHapticFired.value === 0) {
        armedHapticFired.value = 1;
        runOnJS(fireHaptic)();
      } else if (nowArmed === 0) {
        armedHapticFired.value = 0;
      }
      armed.value = nowArmed;
    })
    .onEnd((e) => {
      if (committing.value) return;
      const w = widthSV.value;
      const dx = e.translationX;
      const dy = e.translationY;
      const vx = e.velocityX; // px/s
      const distMin = Math.max(64, w * 0.18);
      const distOk = Math.abs(dx) >= distMin;
      const flickOk = Math.abs(dx) >= 42 && Math.abs(vx) > 550;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.05;
      const willCommit = horizontal && (distOk || flickOk);
      if (willCommit) {
        const dir = (dx < 0 ? -1 : 1) as -1 | 1;
        committing.value = 1;
        runOnJS(fireHaptic)();
        const boost = Math.min(280, Math.abs(vx) * 0.18);
        const target = dir * (Math.max(w * 1.28, 460) + boost);
        translateX.value = withTiming(
          target,
          { duration: 300, easing: Easing.out(Easing.cubic) },
          (fin) => {
            if (fin) {
              runOnJS(finishCommit)(dir);
            }
          }
        );
        opacity.value = withTiming(0, {
          duration: 260,
          easing: Easing.out(Easing.quad),
        });
        dragging.value = 1;
        armed.value = 1;
      } else {
        translateX.value = withSpring(0, {
          damping: 13,
          stiffness: 320,
          mass: 0.7,
        });
        opacity.value = withTiming(1, { duration: 180 });
        armed.value = 0;
        dragging.value = 0;
        armedHapticFired.value = 0;
      }
    })
    .onFinalize((_e, success) => {
      if (!success && !committing.value) {
        translateX.value = withSpring(0, {
          damping: 13,
          stiffness: 320,
          mass: 0.7,
        });
        opacity.value = withTiming(1, { duration: 180 });
        armed.value = 0;
        dragging.value = 0;
        armedHapticFired.value = 0;
      }
    });

  const doubleTap = Gesture.Tap()
    .enabled(enabled && !!onDoubleTap)
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      runOnJS(fireDoubleTap)();
    });

  const singleTap = Gesture.Tap()
    .enabled(enabled && !!onTap)
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(fireTap)();
    });

  const longPress = Gesture.LongPress()
    .enabled(enabled && !!onLongPress)
    .minDuration(450)
    .onStart(() => {
      runOnJS(fireLongPress)();
    });

  const composed = Gesture.Simultaneous(
    pan,
    Gesture.Exclusive(doubleTap, singleTap, longPress)
  );

  const animStyle = useAnimatedStyle(() => {
    const w = Math.max(1, widthSV.value);
    const progress = Math.min(
      1,
      Math.abs(translateX.value) / Math.max(64, w * 0.2)
    );
    const rot = interpolate(translateX.value, [-w, 0, w], [-18, 0, 18]);
    const lift = dragging.value ? 1.03 : 1;
    const shrink = 1 - progress * 0.04;
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rot}deg` },
        { scale: lift * shrink },
      ],
      opacity: opacity.value,
    };
  });

  const washStyle = useAnimatedStyle(() => {
    const w = Math.max(1, widthSV.value);
    const progress = Math.min(
      1,
      Math.abs(translateX.value) / Math.max(64, w * 0.2)
    );
    const left = translateX.value < 0;
    return {
      opacity: dragging.value * progress * 0.42,
      backgroundColor: left
        ? "rgba(255, 70, 110, 0.38)"
        : "rgba(55, 140, 255, 0.38)",
    };
  });

  const hintStyle = useAnimatedStyle(() => {
    const w = Math.max(1, widthSV.value);
    const progress = Math.min(
      1,
      Math.abs(translateX.value) / Math.max(64, w * 0.2)
    );
    const left = translateX.value < 0;
    const pop = 0.82 + progress * 0.38 + armed.value * 0.12;
    return {
      opacity: dragging.value * Math.min(1, 0.25 + progress * 1.15),
      transform: [
        { rotate: `${left ? -18 : 18}deg` },
        { scale: pop },
        { translateX: left ? -36 : 36 },
        { translateY: interpolate(progress, [0, 1], [8, -6]) },
      ],
    };
  });

  // Parent-sized wrap — never StyleSheet.absoluteFillObject. Extra-tile
  // callers pass height 50%; leftover top/left/right/bottom:0 from
  // absoluteFill would stretch the 3rd over the whole stage.
  const wrap = style ? [style] : [styles.fill];

  if (!enabled) {
    return <View style={wrap}>{children}</View>;
  }

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[wrap, animStyle]}
        collapsable={false}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) widthSV.value = w;
        }}
      >
        {children}
        <Animated.View
          style={[styles.wash, washStyle]}
          pointerEvents="none"
        />
        {nextLabel ? (
          <Animated.View style={[styles.hint, hintStyle]} pointerEvents="none">
            <Text style={styles.hintText} numberOfLines={1}>
              {nextLabel}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: "100%",
    height: "100%",
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  hint: {
    position: "absolute",
    top: "38%",
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  hintText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 2.2,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 3.5,
    borderColor: "rgba(255,255,255,0.92)",
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
});
