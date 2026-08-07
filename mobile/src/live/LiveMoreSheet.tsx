/**
 * Live "More" action sheet (mute partner, blur, party, cam, data saver, debate, report).
 */
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { liveStyles as styles } from "./liveStyles";

export type LiveMoreSheetProps = {
  partnerMuted: boolean;
  isFriendCall: boolean;
  remoteBlurred: boolean;
  extraPeerCount: number;
  matchMode: string;
  findThirdPending: boolean;
  dataSaverOn: boolean;
  earpiece: boolean;
  debateActive: boolean;
  debatePending: string;
  dcOpen: boolean;
  canAddFriend: boolean;
  labels: {
    partnerUnmute: string;
    partnerMute: string;
    unblur: string;
    reblur: string;
    browseTogether: string;
    findThirdCancel: string;
    findThird: string;
    inviteFriend: string;
    flipCam: string;
    dataSaverOn: string;
    dataSaver: string;
    speakerOn: string;
    earpieceOn: string;
    debateEnd: string;
    debateCancelInvite: string;
    debateInvite: string;
    debateNeedP2p: string;
    addFriend: string;
    report: string;
  };
  onPartnerMute: () => void;
  onToggleBlur: () => void;
  onBrowseTogether: () => void;
  onFindThirdToggle: () => void;
  onInviteFriend: () => void;
  onFlipCam: () => void;
  onToggleDataSaver: () => void;
  onToggleEarpiece: () => void;
  onDebate: () => void;
  onAddFriend: () => void;
  onReport: () => void;
  style?: StyleProp<ViewStyle>;
};

export function LiveMoreSheet(props: LiveMoreSheetProps) {
  const {
    partnerMuted,
    isFriendCall,
    remoteBlurred,
    extraPeerCount,
    matchMode,
    findThirdPending,
    dataSaverOn,
    earpiece,
    debateActive,
    debatePending,
    dcOpen,
    canAddFriend,
    labels: L,
    onPartnerMute,
    onToggleBlur,
    onBrowseTogether,
    onFindThirdToggle,
    onInviteFriend,
    onFlipCam,
    onToggleDataSaver,
    onToggleEarpiece,
    onDebate,
    onAddFriend,
    onReport,
  } = props;

  return (
    <View style={styles.moreSheet}>
      <Pressable style={styles.moreRow} onPress={onPartnerMute}>
        <Text style={styles.moreRowText}>
          {partnerMuted ? L.partnerUnmute : L.partnerMute}
        </Text>
      </Pressable>
      {!isFriendCall ? (
        <Pressable style={styles.moreRow} onPress={onToggleBlur}>
          <Text style={styles.moreRowText}>
            {remoteBlurred ? L.unblur : L.reblur}
          </Text>
        </Pressable>
      ) : null}
      {isFriendCall && extraPeerCount === 0 ? (
        <Pressable style={styles.moreRow} onPress={onBrowseTogether}>
          <Text style={styles.moreRowText}>{L.browseTogether}</Text>
        </Pressable>
      ) : null}
      {!isFriendCall &&
      matchMode !== "party_browse" &&
      extraPeerCount === 0 ? (
        <Pressable style={styles.moreRow} onPress={onFindThirdToggle}>
          <Text style={styles.moreRowText}>
            {findThirdPending ? L.findThirdCancel : L.findThird}
          </Text>
        </Pressable>
      ) : null}
      {extraPeerCount === 0 ? (
        <Pressable style={styles.moreRow} onPress={onInviteFriend}>
          <Text style={styles.moreRowText}>{L.inviteFriend}</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.moreRow} onPress={onFlipCam}>
        <Text style={styles.moreRowText}>{L.flipCam}</Text>
      </Pressable>
      <Pressable style={styles.moreRow} onPress={onToggleDataSaver}>
        <Text style={styles.moreRowText}>
          {dataSaverOn ? L.dataSaverOn : L.dataSaver}
        </Text>
      </Pressable>
      <Pressable style={styles.moreRow} onPress={onToggleEarpiece}>
        <Text style={styles.moreRowText}>
          {earpiece ? L.speakerOn : L.earpieceOn}
        </Text>
      </Pressable>
      <Pressable style={styles.moreRow} onPress={onDebate}>
        <Text style={styles.moreRowText}>
          {debateActive
            ? L.debateEnd
            : debatePending === "out"
              ? L.debateCancelInvite
              : L.debateInvite}
          {!dcOpen && !debateActive && !debatePending
            ? ` · ${L.debateNeedP2p}`
            : ""}
        </Text>
      </Pressable>
      {canAddFriend ? (
        <Pressable style={styles.moreRow} onPress={onAddFriend}>
          <Text style={styles.moreRowText}>{L.addFriend}</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.moreRow, styles.moreRowDanger]}
        onPress={onReport}
      >
        <Text style={styles.moreRowText}>{L.report}</Text>
      </Pressable>
    </View>
  );
}
