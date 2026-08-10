/**
 * Alone-in-queue invite card + long-search coach card.
 */
import { Pressable, Text, View } from "react-native";
import { liveStyles as styles } from "./liveStyles";

export type LiveQueueHintsProps = {
  showLongSearch: boolean;
  showAlone: boolean;
  friendCode: string;
  inviteUrl: string;
  labels: {
    longTitle: string;
    longBody: string;
    invite: string;
    stop: string;
    aloneTitle: string;
    aloneBody: string;
    yourCode: string;
    copyLink: string;
    shareInvite: string;
  };
  onInviteShare: () => void;
  onStop: () => void;
  onCopyLink: () => void;
  onShareInvite: () => void;
};

export function LiveQueueHints(props: LiveQueueHintsProps) {
  const {
    showLongSearch,
    showAlone,
    friendCode,
    inviteUrl,
    labels: L,
    onInviteShare,
    onStop,
    onCopyLink,
    onShareInvite,
  } = props;

  return (
    <>
      {showLongSearch ? (
        <View style={styles.longSearchCard}>
          <Text style={styles.longSearchTitle} accessibilityRole="header">
            {L.longTitle}
          </Text>
          <Text style={styles.longSearchBody}>{L.longBody}</Text>
          <View style={styles.row}>
            <Pressable
              style={styles.btnGhost}
              onPress={onInviteShare}
              accessibilityRole="button"
              accessibilityLabel={L.invite}
            >
              <Text style={styles.btnText}>{L.invite}</Text>
            </Pressable>
            <Pressable
              style={styles.btnGhost}
              onPress={onStop}
              accessibilityRole="button"
              accessibilityLabel={L.stop}
            >
              <Text style={styles.btnText}>{L.stop}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showAlone ? (
        <View style={styles.aloneCard}>
          <Text style={styles.aloneTitle} accessibilityRole="header">
            {L.aloneTitle}
          </Text>
          <Text style={styles.aloneBody}>{L.aloneBody}</Text>
          {friendCode ? (
            <Text style={styles.aloneCode}>
              {L.yourCode} {friendCode}
            </Text>
          ) : null}
          <Text style={styles.aloneLink} numberOfLines={2}>
            {inviteUrl}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={styles.btnGhost}
              onPress={onCopyLink}
              accessibilityRole="button"
              accessibilityLabel={L.copyLink}
            >
              <Text style={styles.btnText}>{L.copyLink}</Text>
            </Pressable>
            {/* Primary CTA: share invite (fills quiet queue) */}
            <Pressable
              style={[styles.aloneBtnFlex, styles.btn]}
              onPress={onShareInvite}
              accessibilityRole="button"
              accessibilityLabel={L.shareInvite}
            >
              <Text style={styles.btnText}>{L.shareInvite}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );
}
