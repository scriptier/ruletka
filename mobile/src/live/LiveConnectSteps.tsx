/**
 * Compact step chips under stage header: Queue → Connect → Video.
 */
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import {
  computeConnectSteps,
  type ConnectStepState,
} from "./connectSteps";
import { liveStyles as styles } from "./liveStyles";

export type LiveConnectStepsProps = {
  phase: string;
  queueAcked: boolean;
  connectedHub: boolean;
  conn: string;
  hasRemoteVideo: boolean;
  awaitingRemoteVideo: boolean;
  labels: {
    queue: string;
    media: string;
    video: string;
  };
  style?: StyleProp<ViewStyle>;
};

function chipStyle(state: ConnectStepState) {
  if (state === "done") return styles.stepChipDone;
  if (state === "active") return styles.stepChipActive;
  return styles.stepChipTodo;
}

function chipTextStyle(state: ConnectStepState) {
  if (state === "done") return styles.stepChipTextDone;
  if (state === "active") return styles.stepChipTextActive;
  return styles.stepChipTextTodo;
}

export function LiveConnectSteps(props: LiveConnectStepsProps) {
  const {
    phase,
    queueAcked,
    connectedHub,
    conn,
    hasRemoteVideo,
    awaitingRemoteVideo,
    labels,
    style,
  } = props;

  if (phase !== "search" && phase !== "matched") return null;

  const snap = computeConnectSteps({
    phase,
    queueAcked,
    connectedHub,
    conn,
    hasRemoteVideo,
    awaitingRemoteVideo,
  });

  // Hide when fully live — less chrome during good calls
  if (snap.stage === "live") return null;

  const steps: Array<{ id: "queue" | "media" | "video"; label: string }> = [
    { id: "queue", label: labels.queue },
    { id: "media", label: labels.media },
    { id: "video", label: labels.video },
  ];

  return (
    <View style={[styles.stepRow, style]} accessibilityRole="summary">
      {steps.map((s, i) => {
        const st = snap[s.id];
        return (
          <View key={s.id} style={styles.stepItem}>
            {i > 0 ? (
              <Text style={styles.stepSep} importantForAccessibility="no" accessibilityElementsHidden>
                ›
              </Text>
            ) : null}
            <View
              style={[styles.stepChip, chipStyle(st)]}
              accessible
              accessibilityRole="text"
              accessibilityLabel={s.label}
              accessibilityState={{ selected: st === "active", disabled: st === "todo" }}
            >
              <Text style={[styles.stepChipText, chipTextStyle(st)]}>
                {s.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
