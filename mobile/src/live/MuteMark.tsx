/**
 * Mid-tile mute mark: speaker + red prohibition (21-03 crop / mute-speaker.svg).
 * Ionicons stand-in — app has no react-native-svg.
 */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

const SPEAKER = "#e8e8e8";
const BAN = "#e45b4c";
const DEFAULT_SIZE = 56;
const COMPACT_SIZE = 32;

export type MuteMarkProps = {
  size?: number;
  /** PiP / extra tile — smaller default when `size` is omitted. */
  compact?: boolean;
};

export function MuteMark({ size, compact = false }: MuteMarkProps) {
  const dim = size ?? (compact ? COMPACT_SIZE : DEFAULT_SIZE);
  const speaker = Math.round(dim * 0.56);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.wrap, { width: dim, height: dim }]}
    >
      <Ionicons
        name="volume-medium"
        size={speaker}
        color={SPEAKER}
        style={styles.speaker}
      />
      <Ionicons name="ban" size={dim} color={BAN} style={styles.ban} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  speaker: {
    position: "absolute",
    opacity: 0.95,
  },
  ban: {
    position: "absolute",
  },
});
