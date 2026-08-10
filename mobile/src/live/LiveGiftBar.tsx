/**
 * Mid-chat gift chips + optional post-chat ★ review unlock progress.
 *
 * Gift effects match web: available in a live match when you can afford them.
 * Unlock bar tracks post-chat ★ rating eligibility only (not gift lock).
 */
import { Pressable, ScrollView, Text, View } from "react-native";
import { useT } from "../i18n";
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
  /** Who receives gifts — name · location · their ★ */
  partnerLine?: string;
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
    partnerLine,
    onCantAfford,
    onSpend,
  } = props;
  const t = useT();

  const cheapest = gifts.length
    ? Math.min(...gifts.map((g) => g.cost))
    : null;
  const allLocked = cheapest !== null && stars < cheapest;

  return (
    <View style={styles.giftSection}>
      <View style={styles.giftSectionHead}>
        {giftsTitle ? (
          <Text style={styles.giftSectionTitle} accessibilityRole="header">
            {giftsTitle}
          </Text>
        ) : (
          <View />
        )}
        <Text style={styles.giftBalance} accessibilityLabel={`${stars} stars`}>
          ★{stars}
        </Text>
      </View>
      {partnerLine ? (
        <Text
          style={styles.giftPartnerLine}
          numberOfLines={1}
          accessibilityRole="text"
        >
          {partnerLine}
        </Text>
      ) : null}

      {!starReady ? (
        <View
          style={styles.giftUnlockBar}
          accessibilityRole="progressbar"
          accessibilityLabel={unlockLabel}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(starProgress * 100),
          }}
        >
          <View style={styles.giftUnlockTrack} importantForAccessibility="no">
            <View
              style={[
                styles.giftUnlockFill,
                { width: `${Math.round(starProgress * 100)}%` },
              ]}
            />
          </View>
          <Text
            style={styles.giftUnlockText}
            numberOfLines={1}
            importantForAccessibility="no"
          >
            {unlockLabel}
          </Text>
        </View>
      ) : (
        <Text
          style={styles.giftUnlockReady}
          numberOfLines={1}
          accessibilityLiveRegion="polite"
        >
          {readyLabel}
        </Text>
      )}

      {gifts.length === 0 ? (
        <Text
          style={styles.giftUnlockText}
          numberOfLines={1}
          accessibilityRole="text"
        >
          {t("mobile.live.giftsEmpty")}
        </Text>
      ) : (
        <>
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
                  accessibilityLabel={`${g.emoji || ""} ${g.label}, ${g.cost} stars`}
                  accessibilityState={{ disabled: !afford }}
                >
                  <Text style={styles.giftEmoji} importantForAccessibility="no">
                    {g.emoji}
                  </Text>
                  <Text
                    style={styles.giftLabel}
                    numberOfLines={1}
                    importantForAccessibility="no"
                  >
                    {g.label}
                  </Text>
                  <Text
                    style={[styles.giftCost, afford && styles.giftCostReady]}
                    importantForAccessibility="no"
                  >
                    {g.cost}★
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {allLocked ? (
            <Text
              style={styles.giftUnlockText}
              numberOfLines={1}
              accessibilityLiveRegion="polite"
            >
              {t("mobile.live.giftsLocked")}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
