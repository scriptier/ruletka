/**
 * Stage header while searching — one tight line + optional pool meta.
 * Avoids the old 3-line stack under the status bar.
 */
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { liveStyles as styles } from "./liveStyles";

export type LiveSearchLabelProps = {
  queueAcked: boolean;
  alone: boolean;
  waiting: number;
  online: number;
  searchDots: number;
  searchSecs: number;
  connected: boolean;
  lookingLabel: string;
  queueJoiningLabel: string;
  waitLine: string;
  firstInLineLabel: string;
  queueInPoolLabel: string;
  queueConfirmingLabel: string;
  reconnectingLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function LiveSearchLabel(props: LiveSearchLabelProps) {
  const {
    queueAcked,
    alone,
    searchDots,
    searchSecs,
    connected,
    lookingLabel,
    queueJoiningLabel,
    waitLine,
    firstInLineLabel,
    queueInPoolLabel,
    queueConfirmingLabel,
    reconnectingLabel,
    style,
  } = props;

  const title = !queueAcked
    ? queueJoiningLabel
    : `${lookingLabel.replace(/\.+$/, "")}${
        ".".repeat(searchDots) || ""
      }${searchSecs >= 3 ? ` · ${searchSecs}s` : ""}`;

  // Single meta line: pool / first-in-line / confirming (drop third row)
  const meta = !queueAcked
    ? connected
      ? queueConfirmingLabel
      : reconnectingLabel.replace(/^ · /, "")
    : alone
      ? firstInLineLabel
      : waitLine || queueInPoolLabel;

  const a11y = meta ? `${title}. ${meta}` : title;

  return (
    <View
      style={[styles.stageLabelBlock, style]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11y}
    >
      <Text
        style={styles.stageLabel}
        numberOfLines={1}
        importantForAccessibility="no"
      >
        {title}
      </Text>
      {meta ? (
        <Text
          style={styles.stagePool}
          numberOfLines={1}
          importantForAccessibility="no"
        >
          {meta}
        </Text>
      ) : null}
    </View>
  );
}
