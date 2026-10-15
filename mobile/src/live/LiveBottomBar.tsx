/**
 * Live bottom control rows: Start/Next/Stop + icon strip.
 *
 * Primary bar (matched stranger / search): Stop · Next, full width.
 * Self PiP lives on the video above this slab — do not pad the bar for it.
 * Friend call: Hangup alone. Idle: Start alone.
 * Report lives in the partner-actions sheet (tap a face), not this bar.
 *
 * Secondary icons (left → right, full width):
 *   Mic · Flip · partner mute · blur · more · Settings
 * Cam off/on is intentionally omitted (use Settings if needed later).
 *
 * Start → Next/Stop flips optimistically on press so the bar never
 * stays on "Start" while parent media/hub work is still starting.
 * Secondary row is icon-only (labels stay on accessibility).
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Platform,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TapPressable } from "../ui/TapPressable";
import { liveStyles as styles } from "./liveStyles";

const ICON = 22;
const ICON_COLOR = "#fff";
const BAR_ROW = { width: "100%" as const };

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
    /** Settings (far-right icon). */
    settings?: string;
  };
  onStart: () => void;
  onNext: () => void;
  onStop: () => void;
  /** Opens report sheet (matched stranger). Alias: onBlockReport. */
  onReport?: () => void;
  /** @deprecated use onReport */
  onBlockReport?: () => void;
  onToggleMic: () => void;
  /** Kept for callers; cam toggle removed from the bar UI. */
  onToggleCam?: () => void;
  onFlipCam: () => void;
  onTogglePartnerMute: () => void;
  /** Toggle partner privacy veil (strangers only). */
  onToggleBlur?: () => void;
  onToggleMore: () => void;
  onInvite: () => void;
  onOpenFriends: () => void;
  /** Opens Settings screen (far-right icon). */
  onOpenSettings?: () => void;
  /** Idle Start lives on the brand diamond — hide the full-width pink bar. */
  hideIdleStart?: boolean;
  /** Arcade Start already pressed — show Next/Stop immediately. */
  searchArmed?: boolean;
  /** Browser-duo 1v1: Next/Stop live on the partner tile, not this bar. */
  hideSearchControls?: boolean;
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
    // camOn kept on props for callers; bar no longer toggles camera
    camOn: _camOn,
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
    onToggleMic,
    onFlipCam,
    onTogglePartnerMute,
    onToggleBlur,
    onOpenSettings,
    onToggleMore,
    hideIdleStart = false,
    searchArmed = false,
    hideSearchControls = false,
    style,
  } = props;

  // iPhone home indicator: parent already pads the bar's outer edge by
  // insets.bottom, but the icon row (closest to the pill) still wants a
  // few extra points of breathing room so it never reads as "under" it.
  const insets = useSafeAreaInsets();
  const iosHomeIndicatorGap =
    Platform.OS === "ios" && insets.bottom > 0 ? 6 : 0;

  // Landscape iPhone: the notch/Dynamic Island (and the rotated home
  // indicator) land on one side (insets.left xor insets.right). The bar's
  // outer paddingHorizontal comes from parent styles (bar/browserDock) we
  // don't own, so add the missing side room here instead — iOS only,
  // no-op in portrait where these insets are ~0.
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const iosSideStyle =
    Platform.OS === "ios" && isLandscape
      ? {
          paddingLeft: Math.max(insets.left, 0),
          paddingRight: Math.max(insets.right, 0),
        }
      : null;

  // Immediate Start → Next/Stop; clear once parent phase catches up
  const [pendingSearch, setPendingSearch] = useState(false);
  useEffect(() => {
    if (phase === "search" || phase === "matched" || phase === "error") {
      setPendingSearch(false);
    }
  }, [phase]);

  const barPhase =
    (pendingSearch || searchArmed) && (phase === "idle" || phase === "error")
      ? "search"
      : phase;

  const showStart =
    (barPhase === "idle" || barPhase === "error") &&
    !friendsOnly &&
    !hideIdleStart;
  /** Idle (Start not pressed): no Stop/Next. After Start → searchArmed paints them. */
  const idleBeforeStart =
    (phase === "idle" || phase === "error") &&
    !pendingSearch &&
    !searchArmed;
  const showSearchControls =
    !idleBeforeStart &&
    !hideSearchControls &&
    (barPhase === "search" || barPhase === "matched");

  const micForcedOff = debateActive && !debateISpeak;
  const micLabel = micForcedOff
    ? L.youMutedBadge
    : micOn
      ? L.micOn
      : L.micOff;

  return (
    <View style={style}>
      {friendsOnly && barPhase === "idle" ? (
        <Text style={styles.friendsOnlyHint}>{L.friendsOnlyHint}</Text>
      ) : null}
      <View style={[styles.row, BAR_ROW, iosSideStyle]}>
        {showStart ? (
          <TapPressable
            style={styles.btn}
            onPressIn={() => {
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
            <Ionicons
              name="play"
              size={ICON}
              color={ICON_COLOR}
              importantForAccessibility="no"
            />
          </TapPressable>
        ) : null}
        {showSearchControls ? (
          <>
            {/* Order: Stop · Next (friend call: Hangup only). Report is in the sheet. */}
            <View
              style={[
                styles.btnStopFloor,
                isFriendCall || friendsOnly ? { flex: 1 } : null,
              ]}
            >
              <TapPressable
                style={styles.btnStopFace}
                onPressIn={() => {
                  setPendingSearch(false);
                  onStop();
                }}
                accessibilityRole="button"
                accessibilityLabel={isFriendCall ? L.hangup : L.stop}
                testID="live-stop-btn"
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons
                  name={isFriendCall ? "call" : "stop"}
                  size={ICON}
                  color="#ffd0dc"
                  importantForAccessibility="no"
                />
              </TapPressable>
            </View>
            {!isFriendCall && !friendsOnly ? (
              <View style={styles.btnNextFloor}>
                <TapPressable
                  style={[
                    styles.btnNext,
                    (stayRemSecs > 0 || nextGraceRemSecs > 0) &&
                      styles.btnStayLocked,
                  ]}
                  onPressIn={onNext}
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
                  {stayRemSecs > 0 || nextGraceRemSecs > 0 ? (
                    <Text
                      style={styles.btnNextText}
                      importantForAccessibility="no"
                    >
                      {stayRemSecs > 0 ? stayRemSecs : nextGraceRemSecs}
                    </Text>
                  ) : (
                    <Ionicons
                      name="play-skip-forward"
                      size={ICON}
                      color={ICON_COLOR}
                      importantForAccessibility="no"
                    />
                  )}
                </TapPressable>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      <View
        style={[
          styles.row,
          BAR_ROW,
          { alignItems: "center" },
          iosHomeIndicatorGap ? { paddingBottom: iosHomeIndicatorGap } : null,
          iosSideStyle,
        ]}
      >
        <TapPressable
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
          android_ripple={{
            color: "rgba(255,255,255,0.12)",
            borderless: false,
          }}
        >
          <Ionicons
            name={micOn && !micForcedOff ? "mic" : "mic-off"}
            size={ICON}
            color={ICON_COLOR}
            importantForAccessibility="no"
          />
        </TapPressable>
        {hasLocal ? (
          <TapPressable
            style={styles.btnIcon}
            onPress={onFlipCam}
            accessibilityRole="button"
            accessibilityLabel={L.flipCam}
            testID="live-flip-btn"
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            android_ripple={{
              color: "rgba(255,255,255,0.12)",
              borderless: false,
            }}
          >
            <Ionicons
              name="camera-reverse"
              size={ICON}
              color={ICON_COLOR}
              importantForAccessibility="no"
            />
          </TapPressable>
        ) : null}
        {phase === "matched" ? (
          <TapPressable
            style={[styles.btnIcon, partnerMuted && styles.btnMuteOn]}
            onPress={onTogglePartnerMute}
            accessibilityRole="button"
            accessibilityLabel={
              partnerMuted ? L.partnerUnmuteShort : L.partnerMuteShort
            }
            accessibilityState={{ selected: partnerMuted }}
            testID="live-partner-mute-btn"
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            android_ripple={{
              color: "rgba(255,120,90,0.2)",
              borderless: false,
            }}
          >
            <Ionicons
              name={partnerMuted ? "volume-mute" : "volume-high"}
              size={ICON}
              color={partnerMuted ? "#ffb4a0" : ICON_COLOR}
              importantForAccessibility="no"
            />
          </TapPressable>
        ) : null}
        {/* Blur: eye-off = clear (tap to veil); eye = veiled (tap Show) */}
        {phase === "matched" && typeof onToggleBlur === "function" ? (
          <TapPressable
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
            android_ripple={{
              color: "rgba(100,160,255,0.2)",
              borderless: false,
            }}
          >
            <Ionicons
              name={remoteBlurred ? "eye" : "eye-off"}
              size={ICON}
              color={remoteBlurred ? "#9fd0ff" : ICON_COLOR}
              importantForAccessibility="no"
            />
          </TapPressable>
        ) : null}
        {phase === "matched" ? (
          <TapPressable
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
          </TapPressable>
        ) : null}
        {typeof onOpenSettings === "function" ? (
          <TapPressable
            style={styles.btnIcon}
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel={L.settings || "Settings"}
            testID="live-settings-btn"
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            android_ripple={{
              color: "rgba(255,255,255,0.12)",
              borderless: false,
            }}
          >
            <Ionicons
              name="settings-outline"
              size={ICON}
              color={ICON_COLOR}
              importantForAccessibility="no"
            />
          </TapPressable>
        ) : null}
      </View>
    </View>
  );
}
