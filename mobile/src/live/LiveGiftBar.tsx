/**
 * Mid-chat ★ unlock bar + horizontal gift chips.
 */
import { Pressable, ScrollView, Text, View } from "react-native";
import type { GiftDef } from "../stars/gifts";
import { liveStyles as styles } from "./liveStyles";

export type LiveGiftBarProps = {
  starReady: boolean;
  starProgress: number;
  needMin: number;
  elapsedSecs: number;
  stars: number;
  gifts: GiftDef[];
  unlockLabel: string;
  readyLabel: string;
  onLockedPress: () => void;
  onSpend: (id: string, cost: number) => void;
};

export function LiveGiftBar(props: LiveGiftBarProps) {
  const {
    starReady,
    starProgress,
    stars,
    gifts,
    unlockLabel,
    readyLabel,
    onLockedPress,
    onSpend,
  } = props;

  return (
    <>
      {!starReady ? (
        <View style={styles.giftUnlockBar}>
          <View style={styles.giftUnlockTrack}>
            <View
              style={[
                styles.giftUnlockFill,
                { width: `${Math.round(starProgress * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.giftUnlockText}>{unlockLabel}</Text>
        </View>
      ) : (
        <Text style={styles.giftUnlockReady}>{readyLabel}</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.giftsRow}
        style={styles.giftsScroll}
        keyboardShouldPersistTaps="handled"
      >
        {gifts.map((g) => (
          <Pressable
            key={g.id}
            style={[
              styles.giftChip,
              (stars < g.cost || !starReady) && styles.giftChipDisabled,
            ]}
            onPress={() => {
              if (!starReady) {
                onLockedPress();
                return;
              }
              onSpend(g.id, g.cost);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${g.label} ${g.cost} stars`}
          >
            <Text style={styles.giftEmoji}>{g.emoji}</Text>
            <Text style={styles.giftLabel} numberOfLines={1}>
              {g.label}
            </Text>
            <Text style={styles.giftCost}>{g.cost}★</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}
