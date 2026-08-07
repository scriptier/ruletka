/**
 * Stage header while searching (Looking… / Joining queue / wait pool).
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
    waiting,
    online,
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

  const ackLine = queueAcked
    ? alone
      ? firstInLineLabel
      : queueInPoolLabel
    : connected
      ? queueConfirmingLabel
      : reconnectingLabel.replace(/^ · /, "");

  return (
    <View style={[styles.stageLabelBlock, style]}>
      <Text style={styles.stageLabel}>{title}</Text>
      <Text style={styles.stagePool}>{waitLine}</Text>
      <Text style={styles.stageQueueAck}>{ackLine}</Text>
    </View>
  );
}
