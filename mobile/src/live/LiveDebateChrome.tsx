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
          <Text style={styles.debateBadge}>{L.badge}</Text>
          <Text style={styles.debateRound}>{L.round(debateRound)}</Text>
          <Text style={styles.debateTimer}>{debateTimerText}</Text>
          <Text style={styles.debateTurnLabel} numberOfLines={1}>
            {debateISpeak
              ? L.yourTurn(debateRound)
              : L.theirTurn(debateRound, partner)}
          </Text>
          {debate.topic ? (
            <Text style={styles.debateTopic} numberOfLines={2}>
              {debate.topic}
            </Text>
          ) : null}
          <View style={styles.debateProgTrack}>
            <View
              style={[
                styles.debateProgFill,
                { width: `${Math.round(debateProgress * 100)}%` },
              ]}
            />
          </View>
          {debateISpeak ? (
            <Pressable style={styles.debatePassBtn} onPress={onPass}>
              <Text style={styles.btnText}>{L.pass}</Text>
            </Pressable>
          ) : (
            <Text style={styles.debateMutedHint}>{L.waitTurn}</Text>
          )}
          <Pressable style={styles.debateEndBtn} onPress={onEnd}>
            <Text style={styles.debateEndText}>{L.end}</Text>
          </Pressable>
        </View>
      ) : null}

      {debate.pending === "in" ? (
        <View style={styles.debateInviteCard}>
          <Text style={styles.debateInviteTitle}>{L.incomingTitle}</Text>
          <Text style={styles.debateInviteBody}>
            {L.incomingBody(partner, turnS)}
          </Text>
          <Text style={styles.debateInviteMeta}>{L.incomingMeta(turnS)}</Text>
          {debate.topic ? (
            <Text style={styles.debateTopic}>{debate.topic}</Text>
          ) : null}
          <View style={styles.row}>
            <Pressable style={styles.btnGhost} onPress={onDeclineIncoming}>
              <Text style={styles.btnText}>{L.decline}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onAcceptIncoming}>
              <Text style={styles.btnText}>{L.accept}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {composeOpen ? (
        <View style={styles.debateCompose}>
          <Text style={styles.debateInviteTitle}>{L.composeTitle}</Text>
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
              >
                <Text style={styles.btnText}>{s}s</Text>
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
          />
          <View style={styles.row}>
            <Pressable style={styles.btnGhost} onPress={onCloseCompose}>
              <Text style={styles.btnText}>{L.cancel}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onSendInvite}>
              <Text style={styles.btnText}>{L.sendInvite}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {debate.pending === "out" ? (
        <Text style={styles.debateWaiting}>
          {L.waitingAccept}
          {!dcOpen ? ` · ${L.needP2p}` : ""}
        </Text>
      ) : null}
    </>
  );
}
