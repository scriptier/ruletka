/**
 * Live bottom control rows: Start/Next/Stop + icon mic/cam/flip/friends/more.
 *
 * Start → Next/Stop flips optimistically on press so the bar never
 * stays on "Start" while parent media/hub work is still starting.
 * Secondary row is icon-only (labels stay on accessibility).
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { liveStyles as styles } from "./liveStyles";

const ICON = 22;
const ICON_COLOR = "#fff";

export type LiveBottomBarProps = {
  phase: string;
  friendsOnly: boolean;
  isFriendCall: boolean;
  stayRemSecs: number;
  micOn: boolean;
  camOn: boolean;
  hasLocal: boolean;
  partnerMuted: boolean;
  moreOpen: boolean;
  debateActive: boolean;
  debateISpeak: boolean;
  labels: {
    start: string;
    next: string;
    stayNext: (s: number) => string;
    stayLock: (s: number) => string;
    stop: string;
    hangup: string;
    /** Combined safety: report + block + Next */
    blockReport: string;
    micOn: string;
    micOff: string;
    camOn: string;
    camOff: string;
    /** Partner-facing promise when cam is off (web “Hidden from them”). */
    camOffHint?: string;
    youMutedBadge: string;
    flipCam: string;
    partnerMuteShort: string;
    partnerUnmuteShort: string;
    more: string;
    cancel: string;
    invite: string;
    friends: string;
    friendsMenuTitle: string;
    friendsOnlyHint: string;
  };
  onStart: () => void;
  onNext: () => void;
  onStop: () => void;
  /** Opens report sheet (which also blocks). Only used when matched + stranger. */
  onBlockReport?: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onFlipCam: () => void;
  onTogglePartnerMute: () => void;
  onToggleMore: () => void;
  onInvite: () => void;
  onOpenFriends: () => void;
  style?: StyleProp<ViewStyle>;
};

export function LiveBottomBar(props: LiveBottomBarProps) {
  const {
    phase,
    friendsOnly,
    isFriendCall,
    stayRemSecs,
    micOn,
    camOn,
    hasLocal,
    partnerMuted,
    moreOpen,
    debateActive,
    debateISpeak,
    labels: L,
    onStart,
    onNext,
    onStop,
    onBlockReport,
    onToggleMic,
    onToggleCam,
    onFlipCam,
    onTogglePartnerMute,
    onToggleMore,
    onInvite,
    onOpenFriends,
    style,
  } = props;

  // Immediate Start → Next/Stop; clear once parent phase catches up
  const [pendingSearch, setPendingSearch] = useState(false);
  useEffect(() => {
    if (phase === "search" || phase === "matched" || phase === "error") {
      setPendingSearch(false);
    }
  }, [phase]);

  const barPhase =
    pendingSearch && (phase === "idle" || phase === "error")
      ? "search"
      : phase;

  const showStart =
    (barPhase === "idle" || barPhase === "error") && !friendsOnly;
  const showSearchControls =
    barPhase === "search" || barPhase === "matched";

  const micForcedOff = debateActive && !debateISpeak;
  const micLabel = micForcedOff
    ? L.youMutedBadge
    : micOn
      ? L.micOn
      : L.micOff;

  function openFriendsMenu() {
    Alert.alert(L.friendsMenuTitle, undefined, [
      { text: L.invite, onPress: () => onInvite() },
      { text: L.friends, onPress: () => onOpenFriends() },
      { text: L.cancel, style: "cancel" },
    ]);
  }

  return (
    <View style={style}>
      {friendsOnly && barPhase === "idle" ? (
        <Text style={styles.friendsOnlyHint}>{L.friendsOnlyHint}</Text>
      ) : null}
      <View style={styles.row}>
        {showStart ? (
          <Pressable
            style={styles.btn}
            onPress={() => {
              // Paint Next/Stop this frame — don't wait for hub/media
              setPendingSearch(true);
              onStart();
            }}
            accessibilityRole="button"
            accessibilityLabel={L.start}
            accessibilityState={{ disabled: false }}
            testID="live-start-btn"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
          >
            <Text style={styles.btnText} importantForAccessibility="no">
              {L.start}
            </Text>
          </Pressable>
        ) : null}
        {showSearchControls ? (
          <>
            {!isFriendCall && !friendsOnly ? (
              <Pressable
                style={[
                  styles.btnSecondary,
                  stayRemSecs > 0 && styles.btnStayLocked,
                ]}
                onPress={onNext}
                accessibilityRole="button"
                accessibilityLabel={
                  stayRemSecs > 0 ? L.stayLock(stayRemSecs) : L.next
                }
                testID="live-next-btn"
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.btnText} importantForAccessibility="no">
                  {stayRemSecs > 0 ? L.stayNext(stayRemSecs) : L.next}
                </Text>
              </Pressable>
            ) : null}
            {/* Matched stranger: one safety control (report + block + Next) */}
            {barPhase === "matched" &&
            !isFriendCall &&
            typeof onBlockReport === "function" ? (
              <Pressable
                style={styles.btnDanger}
                onPress={onBlockReport}
                accessibilityRole="button"
                accessibilityLabel={L.blockReport}
                testID="live-block-report-btn"
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                android_ripple={{ color: "rgba(255,255,255,0.12)" }}
              >
                <Text style={styles.btnText} importantForAccessibility="no">
                  {L.blockReport}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.btnGhost}
              onPress={() => {
                setPendingSearch(false);
                onStop();
              }}
              accessibilityRole="button"
              accessibilityLabel={isFriendCall ? L.hangup : L.stop}
              testID="live-stop-btn"
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={styles.btnText} importantForAccessibility="no">
                {isFriendCall ? L.hangup : L.stop}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <View style={styles.row}>
        <Pressable
          style={[
            styles.btnIcon,
            (!micOn || micForcedOff) && styles.btnOff,
          ]}
          onPress={onToggleMic}
          accessibilityRole="button"
          accessibilityLabel={micLabel}
          accessibilityState={{ selected: micOn && !micForcedOff }}
          testID="live-mic-btn"
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          android_ripple={{ color: "rgba(255,255,255,0.12)", borderless: false }}
        >
          <Ionicons
            name={micOn && !micForcedOff ? "mic" : "mic-off"}
            size={ICON}
            color={ICON_COLOR}
            importantForAccessibility="no"
          />
        </Pressable>
        <Pressable
          style={[styles.btnIcon, !camOn && styles.btnOff]}
          onPress={onToggleCam}
          accessibilityRole="button"
          accessibilityLabel={camOn ? L.camOn : L.camOff}
          accessibilityHint={
            !camOn && L.camOffHint ? L.camOffHint : undefined
          }
          accessibilityState={{ selected: camOn }}
          testID="live-cam-btn"
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          android_ripple={{ color: "rgba(255,255,255,0.12)", borderless: false }}
        >
          <Ionicons
            name={camOn ? "videocam" : "videocam-off"}
            size={ICON}
            color={ICON_COLOR}
            importantForAccessibility="no"
          />
        </Pressable>
        {hasLocal ? (
          <Pressable
            style={styles.btnIcon}
            onPress={onFlipCam}
            accessibilityRole="button"
            accessibilityLabel={L.flipCam}
            testID="live-flip-btn"
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            android_ripple={{ color: "rgba(255,255,255,0.12)", borderless: false }}
          >
            <Ionicons
              name="camera-reverse"
              size={ICON}
              color={ICON_COLOR}
              importantForAccessibility="no"
            />
          </Pressable>
        ) : null}
        {phase === "matched" ? (
          <Pressable
            style={[styles.btnIcon, partnerMuted && styles.btnOff]}
            onPress={onTogglePartnerMute}
            accessibilityRole="button"
            accessibilityLabel={
              partnerMuted ? L.partnerUnmuteShort : L.partnerMuteShort
            }
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons
              name={partnerMuted ? "volume-mute" : "volume-high"}
              size={ICON}
              color={ICON_COLOR}
              importantForAccessibility="no"
            />
          </Pressable>
        ) : null}
        {phase === "matched" ? (
          <Pressable
            style={[styles.btnIcon, moreOpen && styles.btnSecondary]}
            onPress={onToggleMore}
            accessibilityRole="button"
            accessibilityLabel={moreOpen ? L.cancel : L.more}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons
              name={moreOpen ? "close" : "ellipsis-horizontal"}
              size={ICON}
              color={ICON_COLOR}
              importantForAccessibility="no"
            />
          </Pressable>
        ) : (
          <Pressable
            style={styles.btnIcon}
            onPress={openFriendsMenu}
            accessibilityRole="button"
            accessibilityLabel={L.friends}
            accessibilityHint={L.invite}
            testID="live-friends-btn"
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            android_ripple={{ color: "rgba(255,255,255,0.12)", borderless: false }}
          >
            <Ionicons
              name="people"
              size={ICON}
              color={ICON_COLOR}
              importantForAccessibility="no"
            />
          </Pressable>
        )}
      </View>
      {!camOn && L.camOffHint ? (
        <Text
          style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: 12,
            textAlign: "center",
            marginTop: 4,
            marginBottom: 2,
          }}
          accessibilityLiveRegion="polite"
        >
          {L.camOffHint}
        </Text>
      ) : null}
    </View>
  );
}
