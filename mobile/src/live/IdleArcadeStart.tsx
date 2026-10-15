/**
 * Idle Start on the brand diamond (PC 617 parity): gold rim, 3D floor, pulse.
 * MUST NOT remount RTCView / MediaSession.
 */
import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { liveStyles as styles } from "./liveStyles";

export function IdleArcadeStart({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  // Notched iPhones (insets.bottom > 0): nudge the pill up so it never
  // reads as sitting on/under the home indicator on the browser-dock
  // (edge-to-edge) stage layout. Same insets.bottom>0 signal LiveBottomBar
  // uses; no-op on Android and on home-button iPhones (insets.bottom===0).
  const insets = useSafeAreaInsets();
  const iosLift =
    Platform.OS === "ios" && insets.bottom > 0
      ? -Math.min(insets.bottom, 20)
      : 0;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const halo = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.72],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.idleArcadeWrap,
        iosLift ? { transform: [{ translateY: iosLift }] } : null,
      ]}
      testID="live-idle-arcade-wrap"
    >
      <View style={styles.idleArcadeFloor} pointerEvents="none" />
      <Animated.View
        pointerEvents="none"
        style={[styles.idleArcadeHalo, { opacity: halo }]}
      />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="live-start-btn"
        style={({ pressed }) => [
          styles.idleArcadeBtn,
          pressed && styles.idleArcadeBtnPressed,
        ]}
      >
        <Text style={styles.idleArcadeText}>{label}</Text>
      </Pressable>
    </View>
  );
}
