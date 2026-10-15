/**
 * 2s centered popup when this user is gifted ★.
 * Root overlay (not Modal) — same lesson as debate invite vs SurfaceView.
 */
import { Text, View } from "react-native";
import { liveStyles as styles } from "./liveStyles";

export type StarGiftPopupProps = {
  visible: boolean;
  title: string;
  sub?: string;
};

export function StarGiftPopup({ visible, title, sub }: StarGiftPopupProps) {
  if (!visible) return null;
  return (
    <View style={styles.starGiftedScreenCover} pointerEvents="none">
      <View style={styles.starGiftedCard}>
        <Text style={styles.starGiftedBurst} importantForAccessibility="no">
          ★
        </Text>
        <Text style={styles.starGiftedTitle} accessibilityRole="header">
          {title}
        </Text>
        {sub ? <Text style={styles.starGiftedSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}
