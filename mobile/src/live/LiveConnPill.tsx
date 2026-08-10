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
  /** Progressive: "Finding path…" (~3s+). Falls back to stageConnectingLabel. */
  stageFindingPathLabel?: string;
  /** Progressive: "Trying relay…" (~8s+). */
  stageTryingRelayLabel?: string;
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
    stageFindingPathLabel,
    stageTryingRelayLabel,
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
    connectElapsedSecs >= 1 ? ` · ${connectElapsedSecs}s` : "";

  function linkingLabel(): string {
    if (connectElapsedSecs >= 8 && stageTryingRelayLabel) {
      return stageTryingRelayLabel;
    }
    if (connectElapsedSecs >= 3 && stageFindingPathLabel) {
      return stageFindingPathLabel;
    }
    return stageConnectingLabel;
  }

  const pillText =
    awaitingRemoteVideo && (conn === "connected" || conn === "completed")
      ? `${stageWaitVideoLabel}${elapsedSuffix}`
      : conn === "connecting" || conn === "checking"
        ? `${linkingLabel()}${elapsedSuffix}`
        : connLabel;

  const qualityBits =
    linkTierLabel && conn === "connected" && !awaitingRemoteVideo
      ? [
          linkTierLabel,
          linkRtt > 0 ? `${linkRtt}ms` : "",
          linkRelay ? turnBadgeLabel : "",
          qualityTier ? `q:${qualityTier}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  const statusA11y = [callTimerText, pillText, qualityBits]
    .filter(Boolean)
    .join(". ");

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
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        accessible
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
        accessibilityLabel={statusA11y}
      >
        {callTimerText ? (
          <Text style={styles.connTimer} importantForAccessibility="no">
            {callTimerText}
          </Text>
        ) : null}
        <Text style={styles.connPillText} importantForAccessibility="no">
          {pillText}
        </Text>
        {qualityBits ? (
          <Text style={styles.connQuality} importantForAccessibility="no">
            {qualityBits}
          </Text>
        ) : null}
      </View>
      {showConnRetry ? (
        <Pressable
          style={styles.connRetryBtn}
          onPress={onSoftRetry}
          disabled={retryBusy}
          accessibilityRole="button"
          accessibilityLabel={retryBusy ? retryingLabel : retryPathLabel}
          accessibilityState={{ disabled: retryBusy, busy: retryBusy }}
        >
          <Text style={styles.connRetryText} importantForAccessibility="no">
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
          accessibilityLabel={retryBusy ? retryHardLabel : rebuildPathLabel}
          accessibilityState={{ disabled: retryBusy, busy: retryBusy }}
        >
          <Text style={styles.connRetryText} importantForAccessibility="no">
            {retryBusy ? retryHardLabel : rebuildPathLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
