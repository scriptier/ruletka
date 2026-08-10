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
  /** "native" | "browser" live chrome */
  liveLayout?: string;
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
    layoutNative: string;
    layoutBrowser: string;
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
  onToggleLiveLayout?: () => void;
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
    liveLayout = "native",
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
    onToggleLiveLayout,
    onToggleEarpiece,
    onDebate,
    onAddFriend,
    onReport,
  } = props;

  const row = (
    label: string,
    onPress: () => void,
    testID?: string,
    selected?: boolean
  ) => (
    <Pressable
      style={styles.moreRow}
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={
        selected === undefined ? undefined : { selected }
      }
      testID={testID}
    >
      <Text style={styles.moreRowText} importantForAccessibility="no">
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.moreSheet} accessibilityRole="menu">
      {row(
        partnerMuted ? L.partnerUnmute : L.partnerMute,
        onPartnerMute,
        "more-partner-mute",
        partnerMuted
      )}
      {typeof onToggleLiveLayout === "function"
        ? row(
            liveLayout === "browser" ? L.layoutNative : L.layoutBrowser,
            onToggleLiveLayout,
            undefined,
            liveLayout === "browser"
          )
        : null}
      {!isFriendCall
        ? row(
            remoteBlurred ? L.unblur : L.reblur,
            onToggleBlur,
            "more-blur",
            remoteBlurred
          )
        : null}
      {isFriendCall && extraPeerCount === 0
        ? row(L.browseTogether, onBrowseTogether)
        : null}
      {!isFriendCall &&
      matchMode !== "party_browse" &&
      extraPeerCount === 0
        ? row(
            findThirdPending ? L.findThirdCancel : L.findThird,
            onFindThirdToggle,
            undefined,
            findThirdPending
          )
        : null}
      {extraPeerCount === 0 ? row(L.inviteFriend, onInviteFriend) : null}
      {row(L.flipCam, onFlipCam)}
      {row(
        dataSaverOn ? L.dataSaverOn : L.dataSaver,
        onToggleDataSaver,
        undefined,
        dataSaverOn
      )}
      {row(
        earpiece ? L.speakerOn : L.earpieceOn,
        onToggleEarpiece,
        undefined,
        earpiece
      )}
      <Pressable
        style={styles.moreRow}
        onPress={onDebate}
        accessibilityRole="menuitem"
        accessibilityLabel={
          debateActive
            ? L.debateEnd
            : debatePending === "out"
              ? L.debateCancelInvite
              : L.debateInvite
        }
        accessibilityState={{ selected: debateActive }}
      >
        <Text style={styles.moreRowText} importantForAccessibility="no">
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
        <Pressable
          style={styles.moreRow}
          onPress={onAddFriend}
          accessibilityRole="menuitem"
          accessibilityLabel={L.addFriend}
        >
          <Text style={styles.moreRowText} importantForAccessibility="no">
            {L.addFriend}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.moreRow, styles.moreRowDanger]}
        onPress={onReport}
        accessibilityRole="menuitem"
        accessibilityLabel={L.report}
      >
        <Text style={styles.moreRowText} importantForAccessibility="no">
          {L.report}
        </Text>
      </Pressable>
    </View>
  );
}
