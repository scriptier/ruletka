/**
 * Connection quality pill on Live stage (timer + retry / rebuild).
 */
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { liveStyles as styles } from "./liveStyles";

export type LiveConnPillProps = {
  conn: string;
  connLabel: string;
  callTimerText: string;
  awaitingRemoteVideo: boolean;
  connSlow: boolean;
  linkTier: string;
  linkTierLabel: string;
  linkRtt: number;
  linkRelay: boolean;
  qualityTier: string;
  showConnRetry: boolean;
  showHardRetry: boolean;
  retryBusy: boolean;
  turnBadgeLabel: string;
  stageWaitVideoLabel: string;
  stageConnectingLabel: string;
  /** Optional elapsed seconds while linking (shown as " · 3s"). */
  connectElapsedSecs?: number;
  retryPathLabel: string;
  retryingLabel: string;
  rebuildPathLabel: string;
  retryHardLabel: string;
  onSoftRetry: () => void;
  onHardRetry: () => void;
  style?: StyleProp<ViewStyle>;
};

export function LiveConnPill(props: LiveConnPillProps) {
  const {
    conn,
    connLabel,
    callTimerText,
    awaitingRemoteVideo,
    connSlow,
    linkTier,
    linkTierLabel,
    linkRtt,
    linkRelay,
    qualityTier,
    showConnRetry,
    showHardRetry,
    retryBusy,
    turnBadgeLabel,
    stageWaitVideoLabel,
    stageConnectingLabel,
    connectElapsedSecs = 0,
    retryPathLabel,
    retryingLabel,
    rebuildPathLabel,
    retryHardLabel,
    onSoftRetry,
    onHardRetry,
    style,
  } = props;

  const elapsedSuffix =
    connectElapsedSecs >= 2 ? ` · ${connectElapsedSecs}s` : "";

  const pillText =
    awaitingRemoteVideo && (conn === "connected" || conn === "completed")
      ? `${stageWaitVideoLabel}${elapsedSuffix}`
      : conn === "connecting" || conn === "checking"
        ? `${stageConnectingLabel}${elapsedSuffix}`
        : connLabel;

  return (
    <View
      style={[
        styles.connPill,
        conn === "connected" &&
          !awaitingRemoteVideo &&
          linkTier !== "weak" &&
          linkTier !== "bad" &&
          styles.connPillOk,
        (conn === "failed" ||
          conn === "disconnected" ||
          linkTier === "bad") &&
          styles.connPillBad,
        (connSlow || awaitingRemoteVideo || linkTier === "weak") &&
          conn !== "failed" &&
          linkTier !== "bad" &&
          styles.connPillSlow,
        style,
      ]}
    >
      {callTimerText ? (
        <Text style={styles.connTimer}>{callTimerText}</Text>
      ) : null}
      <Text style={styles.connPillText}>{pillText}</Text>
      {linkTierLabel &&
      conn === "connected" &&
      !awaitingRemoteVideo ? (
        <Text style={styles.connQuality}>
          {linkTierLabel}
          {linkRtt > 0 ? ` · ${linkRtt}ms` : ""}
          {linkRelay ? ` · ${turnBadgeLabel}` : ""}
          {qualityTier ? ` · q:${qualityTier}` : ""}
        </Text>
      ) : null}
      {showConnRetry ? (
        <Pressable
          style={styles.connRetryBtn}
          onPress={onSoftRetry}
          disabled={retryBusy}
          accessibilityRole="button"
          accessibilityLabel={retryPathLabel}
        >
          <Text style={styles.connRetryText}>
            {retryBusy ? retryingLabel : retryPathLabel}
          </Text>
        </Pressable>
      ) : null}
      {showHardRetry ? (
        <Pressable
          style={[styles.connRetryBtn, styles.connHardBtn]}
          onPress={onHardRetry}
          disabled={retryBusy}
          accessibilityRole="button"
          accessibilityLabel={rebuildPathLabel}
        >
          <Text style={styles.connRetryText}>
            {retryBusy ? retryHardLabel : rebuildPathLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
