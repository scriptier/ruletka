/**
 * Mid-chat gift chips + optional post-chat ★ review unlock progress.
 *
 * Gift effects match web: available in a live match when you can afford them.
 * Unlock bar tracks post-chat ★ rating eligibility only (not gift lock).
 */
import { Pressable, ScrollView, Text, View } from "react-native";
import type { GiftDef } from "../stars/gifts";
import { liveStyles as styles } from "./liveStyles";

export type LiveGiftBarProps = {
  /** Post-chat ★ review unlock (progress bar only). */
  starReady: boolean;
  starProgress: number;
  needMin: number;
  elapsedSecs: number;
  stars: number;
  gifts: GiftDef[];
  unlockLabel: string;
  readyLabel: string;
  /** Section title above chips, e.g. "Gifts". */
  giftsTitle?: string;
  /** Called when user taps a gift they cannot afford. */
  onCantAfford?: (cost: number, have: number) => void;
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
    giftsTitle,
    onCantAfford,
    onSpend,
  } = props;

  return (
    <View style={styles.giftSection}>
      <View style={styles.giftSectionHead}>
        {giftsTitle ? (
          <Text style={styles.giftSectionTitle}>{giftsTitle}</Text>
        ) : (
          <View />
        )}
        <Text style={styles.giftBalance} accessibilityLabel={`${stars} stars`}>
          ★{stars}
        </Text>
      </View>

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
          <Text style={styles.giftUnlockText} numberOfLines={1}>
            {unlockLabel}
          </Text>
        </View>
      ) : (
        <Text style={styles.giftUnlockReady} numberOfLines={1}>
          {readyLabel}
        </Text>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.giftsRow}
        style={styles.giftsScroll}
        keyboardShouldPersistTaps="handled"
      >
        {gifts.map((g) => {
          const afford = stars >= g.cost;
          return (
            <Pressable
              key={g.id}
              style={[
                styles.giftChip,
                !afford && styles.giftChipDisabled,
                afford && styles.giftChipReady,
              ]}
              onPress={() => {
                if (!afford) {
                  onCantAfford?.(g.cost, stars);
                  return;
                }
                onSpend(g.id, g.cost);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${g.label} ${g.cost} stars`}
              accessibilityState={{ disabled: !afford }}
            >
              <Text style={styles.giftEmoji}>{g.emoji}</Text>
              <Text style={styles.giftLabel} numberOfLines={1}>
                {g.label}
              </Text>
              <Text
                style={[styles.giftCost, afford && styles.giftCostReady]}
              >
                {g.cost}★
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
