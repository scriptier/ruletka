/**
 * Live partner-actions window (gifts, chat, party, data saver, debate, report).
 * Floating card over the face — not a bottom tab.
 */
import { Ionicons } from "@expo/vector-icons";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GiftDef } from "../stars/gifts";
import { TapPressable } from "../ui/TapPressable";
import { LiveGiftBar } from "./LiveGiftBar";
import { liveStyles as styles } from "./liveStyles";

export type LiveMoreSheetProps = {
  /** Unused leftover — live.tsx may omit (mute row removed). */
  partnerMuted?: boolean;
  isFriendCall: boolean;
  /** Unused leftover — live.tsx may omit (blur row removed). */
  remoteBlurred?: boolean;
  extraPeerCount: number;
  matchMode: string;
  findThirdPending: boolean;
  dataSaverOn: boolean;
  /** Unused leftover — live.tsx may omit (browser-layout row removed). */
  liveLayout?: string;
  earpiece: boolean;
  debateActive: boolean;
  debatePending: string;
  dcOpen: boolean;
  canAddFriend: boolean;
  labels: {
    browseTogether: string;
    findThirdCancel: string;
    findThird: string;
    inviteFriend: string;
    inviteFourth?: string;
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
    chatPlaceholder?: string;
    send?: string;
    pleaseStay?: string;
    cancel?: string;
  };
  onBrowseTogether: () => void;
  onFindThirdToggle: () => void;
  onInviteFriend: () => void;
  onToggleDataSaver: () => void;
  onToggleEarpiece: () => void;
  onDebate: () => void;
  onAddFriend: () => void;
  onReport: () => void;
  /** Optional leftovers — live.tsx may omit; rows are not rendered. */
  onPartnerMute?: () => void;
  onToggleBlur?: () => void;
  onFlipCam?: () => void;
  onToggleLiveLayout?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Which face this sheet targets. Extra hides pair-only rows. */
  actionSlot?: "primary" | "extra0" | "extra1";
  /** Painted name for the selected conversationalist. */
  selectedName?: string;
  gifts?: GiftDef[];
  stars?: number;
  starReady?: boolean;
  starProgress?: number;
  needMin?: number;
  elapsedSecs?: number;
  giftsTitle?: string;
  onSpend?: (id: string, cost: number) => void;
  onCantAfford?: (cost: number, have: number) => void;
  chatDraft?: string;
  onChatDraftChange?: (text: string) => void;
  onSendChat?: () => void;
  /** Tap scrim / close — required for the floating window. */
  onClose?: () => void;
};

export function LiveMoreSheet(props: LiveMoreSheetProps) {
  const {
    isFriendCall,
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
    onFindThirdToggle,
    onInviteFriend,
    onToggleDataSaver,
    onToggleEarpiece,
    onDebate,
    onAddFriend,
    onReport,
    actionSlot = "primary",
    selectedName,
    gifts,
    stars,
    starReady,
    starProgress,
    needMin,
    elapsedSecs,
    giftsTitle,
    onSpend,
    onCantAfford,
    chatDraft,
    onChatDraftChange,
    onSendChat,
    onClose,
  } = props;
  const isExtraSlot = actionSlot === "extra0" || actionSlot === "extra1";
  const title = String(selectedName || "").trim();
  const showGifts = Array.isArray(gifts) && typeof onSpend === "function";

  // iPhone notch/home-indicator: keep the floating card off the screen edges
  // and give the last scrollable row (Report) breathing room above the
  // gesture bar instead of the fixed 28pt liveStyles padding alone.
  const insets = useSafeAreaInsets();
  const iosStageInset =
    Platform.OS === "ios"
      ? { paddingTop: 28 + insets.top, paddingBottom: 28 + insets.bottom }
      : null;
  const iosScrollInset =
    Platform.OS === "ios" ? { paddingBottom: Math.max(insets.bottom, 12) } : undefined;

  const row = (
    label: string,
    onPress: () => void,
    testID?: string,
    selected?: boolean
  ) => (
    <TapPressable
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
    </TapPressable>
  );

  return (
    <View
      style={styles.moreWindowRoot}
      pointerEvents="box-none"
      accessibilityRole="menu"
    >
      <Pressable
        style={styles.moreWindowScrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={L.cancel || "Close"}
        testID="more-window-scrim"
      />
      <View
        pointerEvents="box-none"
        style={[styles.moreWindowStage, iosStageInset]}
      >
        <View
          style={[styles.moreSheet, styles.moreWindowCard, props.style]}
          testID="more-window-card"
        >
          <View style={styles.moreWindowHead}>
            <Text
              style={styles.moreWindowTitle}
              numberOfLines={1}
              testID="more-selected-name"
              accessibilityRole="header"
            >
              {title || " "}
            </Text>
            <TapPressable
              style={styles.moreWindowClose}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={L.cancel || "Close"}
              testID="more-window-close"
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TapPressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={iosScrollInset}
          >
      {showGifts ? (
        <LiveGiftBar
          gifts={(gifts || []).filter((g) => g.id !== "please_stay")}
          stars={stars ?? 0}
          starReady={!!starReady}
          starProgress={starProgress ?? 0}
          needMin={needMin ?? 0}
          elapsedSecs={elapsedSecs ?? 0}
          giftsTitle={giftsTitle}
          onSpend={onSpend}
          onCantAfford={onCantAfford}
          compact={true}
          showUnlockBar={false}
          unlockLabel=""
          readyLabel=""
        />
      ) : null}
      <View style={styles.chatRow}>
        <TextInput
          style={styles.chatInput}
          value={chatDraft ?? ""}
          onChangeText={onChatDraftChange}
          placeholder={L.chatPlaceholder || ""}
          placeholderTextColor="#6b7a90"
          onSubmitEditing={onSendChat}
          returnKeyType="send"
          accessibilityLabel={L.chatPlaceholder || L.send || "message"}
        />
        <TapPressable
          style={styles.chatSend}
          onPress={onSendChat}
          accessibilityRole="button"
          accessibilityLabel={L.send || "Send"}
          testID="more-chat-send"
        >
          <Text style={styles.chatSendText} importantForAccessibility="no">
            {L.send || "Send"}
          </Text>
        </TapPressable>
      </View>
      {/* extraPeerCount >= 2: no browseTogether (no random 3v1 hunt). */}
      {!isExtraSlot &&
      extraPeerCount === 0 &&
      (matchMode !== "party_browse" || isFriendCall)
        ? row(
            findThirdPending ? L.findThirdCancel : L.findThird,
            onFindThirdToggle,
            undefined,
            findThirdPending
          )
        : null}
      {!isExtraSlot && extraPeerCount < 2
        ? row(
            extraPeerCount === 1
              ? L.inviteFourth || L.inviteFriend || "Invite a friend (4th)"
              : L.inviteFriend,
            onInviteFriend
          )
        : null}
      {!isExtraSlot && L.pleaseStay && typeof onSpend === "function"
        ? row(L.pleaseStay, () => onSpend("please_stay", 30), "more-please-stay")
        : null}
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
      {(
        <TapPressable
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
        </TapPressable>
      )}
      {canAddFriend ? (
        <TapPressable
          style={styles.moreRow}
          onPress={onAddFriend}
          accessibilityRole="menuitem"
          accessibilityLabel={L.addFriend}
        >
          <Text style={styles.moreRowText} importantForAccessibility="no">
            {L.addFriend}
          </Text>
        </TapPressable>
      ) : null}
      <TapPressable
        style={[styles.moreRow, styles.moreRowDanger]}
        onPress={onReport}
        accessibilityRole="menuitem"
        accessibilityLabel={L.report}
      >
        <Text style={styles.moreRowText} importantForAccessibility="no">
          {L.report}
        </Text>
      </TapPressable>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
