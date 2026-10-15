/**
 * Instant press: no 130ms delay, Android ripple, light haptic on press-in.
 * Use for live bar / more-sheet / gift chips so taps feel native.
 */
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { hapticLight } from "../feedback/haptics";

const DEFAULT_SLOP = { top: 8, bottom: 8, left: 6, right: 6 };
const DEFAULT_RIPPLE = {
  color: "rgba(255,255,255,0.22)",
  foreground: true,
};

export function TapPressable(
  props: PressableProps & { haptic?: boolean }
) {
  const { haptic = true, onPressIn, style, ...rest } = props;
  return (
    <Pressable
      {...rest}
      unstable_pressDelay={0}
      android_disableSound={false}
      hitSlop={rest.hitSlop ?? DEFAULT_SLOP}
      android_ripple={rest.android_ripple ?? DEFAULT_RIPPLE}
      style={(state) => {
        const base =
          typeof style === "function" ? style(state) : style;
        return [
          base as StyleProp<ViewStyle>,
          state.pressed ? { opacity: 0.84 } : null,
        ];
      }}
      onPressIn={(e) => {
        if (haptic) hapticLight();
        onPressIn?.(e);
      }}
    />
  );
}
