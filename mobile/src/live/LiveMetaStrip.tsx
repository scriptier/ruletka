/**
 * Live meta line: stars · online · wait · path · quality + queue wait line.
 */
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { liveStyles as styles } from "./liveStyles";

export type LiveMetaStripProps = {
  phase: string;
  connected: boolean;
  metaLine: string;
  waitLine: string | null;
  searchTimerLine: string | null;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function LiveMetaStrip(props: LiveMetaStripProps) {
  const {
    connected,
    metaLine,
    waitLine,
    searchTimerLine,
    onPress,
    onLongPress,
    accessibilityLabel,
    style,
  } = props;

  return (
    <View
      style={style}
      accessibilityLiveRegion="polite"
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={600}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text
          style={[styles.meta, !connected && styles.metaOffline]}
          importantForAccessibility="no"
        >
          {metaLine}
        </Text>
      </Pressable>
      {waitLine ? (
        <Text style={styles.waitLine} accessibilityRole="text">
          {waitLine}
        </Text>
      ) : null}
      {searchTimerLine ? (
        <Text style={styles.searchTimerLine} accessibilityRole="text">
          {searchTimerLine}
        </Text>
      ) : null}
    </View>
  );
}
