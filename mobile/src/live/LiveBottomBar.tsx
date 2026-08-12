/**
 * Live bottom control rows: Start/Next/Stop/Report + icon mic/cam/flip/friends/more.
 *
 * Primary bar (matched stranger / search):
 *   Stop (left) · Report (middle, danger, matched stranger only) · Next (right)
 * Friend call: Hangup alone. Idle: Start alone.
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
  /** Fat-finger Next grace after match (seconds left). */
  nextGraceRemSecs?: number;
  micOn: boolean;
  camOn: boolean;
  hasLocal: boolean;
  partnerMuted: boolean;
  /** Partner video privacy veil is up */
  remoteBlurred?: boolean;
  moreOpen: boolean;
  debateActive: boolean;
  debateISpeak: boolean;
  labels: {
    start: string;
    next: string;
    /** a11y: swipe or tap Next */
    nextHint?: string;
    stayNext: (s: number) => string;
    stayLock: (s: number) => string;
    /** Next locked for grace: "Next · 2s" */
    nextGrace?: (s: number) => string;
    stop: string;
    hangup: string;
    /** Report / block (matched stranger). */
    report?: string;
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
    /** Blur / unblur partner video */
    blurShort?: string;
    unblurShort?: string;
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
  /** Opens report sheet (matched stranger). Alias: onBlockReport. */
  onReport?: () => void;
  /** @deprecated use onReport */
  onBlockReport?: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onFlipCam: () => void;
  onTogglePartnerMute: () => void;
  /** Toggle partner privacy veil (strangers only). */
  onToggleBlur?: () => void;
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
    nextGraceRemSecs = 0,
    micOn,
    camOn,
    hasLocal,
    partnerMuted,
    remoteBlurred = false,
    moreOpen,
    debateActive,
    debateISpeak,
    labels: L,
    onStart,
    onNext,
    onStop,
    onReport,
    onBlockReport,
    onToggleMic,
    onToggleCam,
    onFlipCam,
    onTogglePartnerMute,
    onToggleBlur,
    onToggleMore,
    onInvite,
    onOpenFriends,
    style,
  } = props;

  const reportHandler = onReport ?? onBlockReport;

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
  /** Report only when live with a stranger (sheet also blocks). */
  const showReport =
    barPhase === "matched" &&
    !isFriendCall &&
    typeof reportHandler === "function";

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
            {/* Order: Stop · Report · Next (friend call: Hangup only) */}
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
            {showReport ? (
              <Pressable
                style={styles.btnDanger}
                onPress={() => reportHandler?.()}
                accessibilityRole="button"
                accessibilityLabel={L.report || "Report"}
                testID="live-report-btn"
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                android_ripple={{ color: "rgba(255,120,90,0.25)" }}
              >
                <Text style={styles.btnText} importantForAccessibility="no">
                  {L.report || "⚑ Report"}
                </Text>
              </Pressable>
            ) : null}
            {!isFriendCall && !friendsOnly ? (
              <Pressable
                style={[
                  styles.btnNext,
                  (stayRemSecs > 0 || nextGraceRemSecs > 0) &&
                    styles.btnStayLocked,
                ]}
                onPress={onNext}
                accessibilityRole="button"
                accessibilityLabel={
                  stayRemSecs > 0
                    ? L.stayLock(stayRemSecs)
                    : nextGraceRemSecs > 0 && L.nextGrace
                      ? L.nextGrace(nextGraceRemSecs)
                      : L.next
                }
                accessibilityState={{
                  disabled: stayRemSecs > 0 || nextGraceRemSecs > 0,
                }}
                accessibilityHint={
                  L.nextHint || "Skip to next person · or swipe partner video"
                }
                testID="live-next-btn"
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                android_ripple={{ color: "rgba(255,255,255,0.2)" }}
              >
                <Text style={styles.btnText} importantForAccessibility="no">
                  {stayRemSecs > 0
                    ? L.stayNext(stayRemSecs)
                    : nextGraceRemSecs > 0 && L.nextGrace
                      ? L.nextGrace(nextGraceRemSecs)
                      : L.next}
                </Text>
              </Pressable>
            ) : null}
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
          accessibilityState={{
            selected: micOn && !micForcedOff,
            disabled: micForcedOff,
          }}
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
            style={[
              styles.btnIcon,
              partnerMuted && styles.btnMuteOn,
            ]}
            onPress={onTogglePartnerMute}
            accessibilityRole="button"
            accessibilityLabel={
              partnerMuted ? L.partnerUnmuteShort : L.partnerMuteShort
            }
            accessibilityState={{ selected: partnerMuted }}
            testID="live-partner-mute-btn"
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            android_ripple={{ color: "rgba(255,120,90,0.2)", borderless: false }}
          >
            <Ionicons
              name={partnerMuted ? "volume-mute" : "volume-high"}
              size={ICON}
              color={partnerMuted ? "#ffb4a0" : ICON_COLOR}
              importantForAccessibility="no"
            />
          </Pressable>
        ) : null}
        {/* Blur: eye-off = clear video (tap to veil); eye = veiled (tap Show) */}
        {phase === "matched" && typeof onToggleBlur === "function" ? (
          <Pressable
            style={[styles.btnIcon, remoteBlurred && styles.btnBlurOn]}
            onPress={onToggleBlur}
            accessibilityRole="button"
            accessibilityLabel={
              remoteBlurred
                ? L.unblurShort || "Show video"
                : L.blurShort || "Blur partner"
            }
            accessibilityState={{ selected: remoteBlurred }}
            accessibilityHint={
              remoteBlurred
                ? "Shows partner camera"
                : "Hides partner camera behind privacy veil"
            }
            testID="live-blur-btn"
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            android_ripple={{ color: "rgba(100,160,255,0.2)", borderless: false }}
          >
            <Ionicons
              name={remoteBlurred ? "eye" : "eye-off"}
              size={ICON}
              color={remoteBlurred ? "#9fd0ff" : ICON_COLOR}
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
            accessibilityState={{ expanded: moreOpen }}
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
