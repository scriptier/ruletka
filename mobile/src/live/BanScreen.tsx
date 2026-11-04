/**
 * Full-screen notice when the hub match-bans this user (`banned`).
 * Root overlay (not Modal), same as StarGiftPopup, so it sits above the
 * WebRTC SurfaceView. OK only hides it; the hub keeps refusing spins and
 * sends `banned` again while the ban lasts.
 */
import { Pressable, Text, View } from "react-native";
import type { BanCopy } from "./hubBan";
import { liveStyles as styles } from "./liveStyles";

export type BanScreenProps = {
  copy: BanCopy | null;
  onClose: () => void;
};

export function BanScreen({ copy, onClose }: BanScreenProps) {
  if (!copy) return null;
  return (
    <View style={styles.banScreenCover} accessibilityViewIsModal>
      <View style={styles.banCard} accessibilityRole="alert">
        <Text style={styles.banIcon} importantForAccessibility="no">
          ⛔
        </Text>
        <Text style={styles.banTitle} accessibilityRole="header">
          {copy.title}
        </Text>
        <Text style={styles.banBody}>{copy.body}</Text>
        {copy.until ? <Text style={styles.banUntil}>{copy.until}</Text> : null}
        <Pressable
          style={styles.banOk}
          onPress={onClose}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.banOkText}>{copy.ok}</Text>
        </Pressable>
      </View>
    </View>
  );
}
