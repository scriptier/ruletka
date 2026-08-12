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
      const max = Math.max(120, w * 0.45);
      const clamped = Math.max(-max, Math.min(max, e.translationX));
      translateX.value = clamped;
      const progress = Math.min(
        1,
        Math.abs(clamped) / Math.max(72, w * 0.22)
      );
      opacity.value = 1 - progress * 0.28;
      const nowArmed = progress >= 0.92 ? 1 : 0;
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
      // Mirror web touch thresholds (ui/live.js wirePartnerSwipe)
      const distMin = Math.max(64, w * 0.18);
      const distOk = Math.abs(dx) >= distMin;
      // web: |dx|>=42 && velocity>0.55 px/ms → ~550 px/s
      const flickOk = Math.abs(dx) >= 42 && Math.abs(vx) > 550;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.05;
      const willCommit = horizontal && (distOk || flickOk);
      if (willCommit) {
        const dir = (dx < 0 ? -1 : 1) as -1 | 1;
        committing.value = 1;
        runOnJS(fireHaptic)();
        const target = dir * Math.max(w * 1.15, 420);
        translateX.value = withTiming(target, { duration: 160 }, (fin) => {
          if (fin) {
            runOnJS(finishCommit)(dir);
          }
        });
        opacity.value = withTiming(0.15, { duration: 160 });
        dragging.value = 1;
        armed.value = 1;
      } else {
        translateX.value = withSpring(0, { damping: 22, stiffness: 320 });
        opacity.value = withTiming(1, { duration: 160 });
        armed.value = 0;
        dragging.value = 0;
        armedHapticFired.value = 0;
      }
    })
    .onFinalize((_e, success) => {
      if (!success && !committing.value) {
        translateX.value = withSpring(0, { damping: 22, stiffness: 320 });
        opacity.value = withTiming(1, { duration: 160 });
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

  const longPress = Gesture.LongPress()
    .enabled(enabled && !!onLongPress)
    .minDuration(450)
    .onStart(() => {
      runOnJS(fireLongPress)();
    });

  const composed = Gesture.Simultaneous(
    pan,
    Gesture.Exclusive(doubleTap, longPress)
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: dragging.value * (0.5 + armed.value * 0.5),
  }));

  if (!enabled) {
    return <View style={[styles.fill, style]}>{children}</View>;
  }

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[styles.fill, style, animStyle]}
        collapsable={false}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) widthSV.value = w;
        }}
      >
        {children}
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
    ...StyleSheet.absoluteFillObject,
  },
  hint: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  hintText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.45)",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
