/**
 * Debate timer chip, incoming invite, compose sheet, pending-out line.
 */
import {
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { DebateSnapshot } from "../media/debate";
import { DEBATE_TURN_CHOICES_S } from "../media/debate";
import { liveStyles as styles } from "./liveStyles";

export type LiveDebateChromeProps = {
  debate: DebateSnapshot;
  debateISpeak: boolean;
  debateUrgent: boolean;
  debateRound: number;
  debateTimerText: string;
  debateProgress: number;
  partnerName: string;
  dcOpen: boolean;
  composeOpen: boolean;
  topicDraft: string;
  turnSecs: number;
  onPass: () => void;
  onEnd: () => void;
  onDeclineIncoming: () => void;
  onAcceptIncoming: () => void;
  onCloseCompose: () => void;
  onSendInvite: () => void;
  onTopicChange: (v: string) => void;
  onTurnSecs: (s: number) => void;
  /** Pre-resolved labels (caller uses t()). */
  labels: {
    badge: string;
    round: (n: number) => string;
    yourTurn: (n: number) => string;
    theirTurn: (n: number, name: string) => string;
    pass: string;
    waitTurn: string;
    end: string;
    incomingTitle: string;
    incomingBody: (name: string, s: number) => string;
    incomingMeta: (s: number) => string;
    decline: string;
    accept: string;
    composeTitle: string;
    composeHint: string;
    turnLength: string;
    turnSecondsOption: (s: number) => string;
    topicLabel: string;
    topicPlaceholder: string;
    cancel: string;
    sendInvite: string;
    waitingAccept: string;
    needP2p: string;
  };
  style?: StyleProp<ViewStyle>;
};

export function LiveDebateChrome(props: LiveDebateChromeProps) {
  const {
    debate,
    debateISpeak,
    debateUrgent,
    debateRound,
    debateTimerText,
    debateProgress,
    partnerName,
    dcOpen,
    composeOpen,
    topicDraft,
    turnSecs,
    onPass,
    onEnd,
    onDeclineIncoming,
    onAcceptIncoming,
    onCloseCompose,
    onSendInvite,
    onTopicChange,
    onTurnSecs,
    labels: L,
  } = props;

  const partner = partnerName || "…";
  const turnS = Math.round(debate.turnMs / 1000);

  return (
    <>
      {debate.active ? (
        <View
          style={[
            styles.debateChip,
            debateISpeak ? styles.debateChipMine : styles.debateChipTheirs,
            debateUrgent && styles.debateChipUrgent,
          ]}
          pointerEvents="box-none"
        >
          {/* Grouped + accessible so the summary label below reaches
              screen readers as one node; Pass/End stay outside so they
              remain individually focusable. */}
          <View
            style={{ gap: 3 }}
            accessible
            accessibilityRole="summary"
            accessibilityLiveRegion="polite"
            accessibilityLabel={[
              L.badge,
              L.round(debateRound),
              debateTimerText,
              debateISpeak
                ? L.yourTurn(debateRound)
                : L.theirTurn(debateRound, partner),
              debate.topic || "",
            ]
              .filter(Boolean)
              .join(". ")}
          >
            <Text style={styles.debateBadge} importantForAccessibility="no">
              {L.badge}
            </Text>
            <Text style={styles.debateRound} importantForAccessibility="no">
              {L.round(debateRound)}
            </Text>
            <Text style={styles.debateTimer} importantForAccessibility="no">
              {debateTimerText}
            </Text>
            <Text
              style={styles.debateTurnLabel}
              numberOfLines={1}
              importantForAccessibility="no"
            >
              {debateISpeak
                ? L.yourTurn(debateRound)
                : L.theirTurn(debateRound, partner)}
            </Text>
            {debate.topic ? (
              <Text
                style={styles.debateTopic}
                numberOfLines={2}
                importantForAccessibility="no"
              >
                {debate.topic}
              </Text>
            ) : null}
            <View
              style={styles.debateProgTrack}
              importantForAccessibility="no"
            >
              <View
                style={[
                  styles.debateProgFill,
                  { width: `${Math.round(debateProgress * 100)}%` },
                ]}
              />
            </View>
          </View>
          {debateISpeak ? (
            <Pressable
              style={styles.debatePassBtn}
              onPress={onPass}
              accessibilityRole="button"
              accessibilityLabel={L.pass}
            >
              <Text style={styles.btnText} importantForAccessibility="no">
                {L.pass}
              </Text>
            </Pressable>
          ) : (
            <Text
              style={styles.debateMutedHint}
              importantForAccessibility="no"
            >
              {L.waitTurn}
            </Text>
          )}
          <Pressable
            style={styles.debateEndBtn}
            onPress={onEnd}
            accessibilityRole="button"
            accessibilityLabel={L.end}
          >
            <Text style={styles.debateEndText} importantForAccessibility="no">
              {L.end}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {debate.pending === "in" ? (
        <View style={styles.debateInviteCard}>
          <View
            style={{ gap: 6 }}
            accessible
            accessibilityRole="summary"
            accessibilityLiveRegion="polite"
            accessibilityLabel={[
              L.incomingTitle,
              L.incomingBody(partner, turnS),
              L.incomingMeta(turnS),
              debate.topic || "",
            ]
              .filter(Boolean)
              .join(". ")}
          >
            <Text
              style={styles.debateInviteTitle}
              accessibilityRole="header"
              importantForAccessibility="no"
            >
              {L.incomingTitle}
            </Text>
            <Text
              style={styles.debateInviteBody}
              importantForAccessibility="no"
            >
              {L.incomingBody(partner, turnS)}
            </Text>
            <Text
              style={styles.debateInviteMeta}
              importantForAccessibility="no"
            >
              {L.incomingMeta(turnS)}
            </Text>
            {debate.topic ? (
              <Text style={styles.debateTopic} importantForAccessibility="no">
                {debate.topic}
              </Text>
            ) : null}
          </View>
          <View style={styles.row}>
            <Pressable
              style={styles.btnGhost}
              onPress={onDeclineIncoming}
              accessibilityRole="button"
              accessibilityLabel={L.decline}
            >
              <Text style={styles.btnText} importantForAccessibility="no">
                {L.decline}
              </Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={onAcceptIncoming}
              accessibilityRole="button"
              accessibilityLabel={L.accept}
            >
              <Text style={styles.btnText} importantForAccessibility="no">
                {L.accept}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {composeOpen ? (
        <View style={styles.debateCompose}>
          <Text style={styles.debateInviteTitle} accessibilityRole="header">
            {L.composeTitle}
          </Text>
          <Text style={styles.debateInviteBody}>{L.composeHint}</Text>
          <Text style={styles.debateComposeLabel}>{L.turnLength}</Text>
          <View style={styles.row}>
            {DEBATE_TURN_CHOICES_S.map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.debateSecChip,
                  turnSecs === s && styles.debateSecChipOn,
                ]}
                onPress={() => onTurnSecs(s)}
                accessibilityRole="button"
                accessibilityLabel={L.turnSecondsOption(s)}
                accessibilityState={{ selected: turnSecs === s }}
              >
                <Text style={styles.btnText} importantForAccessibility="no">
                  {s}s
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.debateComposeLabel}>{L.topicLabel}</Text>
          <TextInput
            style={styles.debateTopicInput}
            value={topicDraft}
            onChangeText={onTopicChange}
            placeholder={L.topicPlaceholder}
            placeholderTextColor="#6b7a90"
            maxLength={80}
            accessibilityLabel={L.topicLabel}
          />
          <View style={styles.row}>
            <Pressable
              style={styles.btnGhost}
              onPress={onCloseCompose}
              accessibilityRole="button"
              accessibilityLabel={L.cancel}
            >
              <Text style={styles.btnText} importantForAccessibility="no">
                {L.cancel}
              </Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={onSendInvite}
              accessibilityRole="button"
              accessibilityLabel={L.sendInvite}
            >
              <Text style={styles.btnText} importantForAccessibility="no">
                {L.sendInvite}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {debate.pending === "out" ? (
        <Text
          style={styles.debateWaiting}
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
        >
          {L.waitingAccept}
          {!dcOpen ? ` · ${L.needP2p}` : ""}
        </Text>
      ) : null}
    </>
  );
}
