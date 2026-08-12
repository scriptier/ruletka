/**
 * Mid-chat gift chips + optional post-chat ★ review unlock progress.
 *
 * Gift effects match web: available in a live match when you can afford them.
 * Unlock bar tracks post-chat ★ rating eligibility only (not gift lock).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useT } from "../i18n";
import type { GiftDef } from "../stars/gifts";
import { liveStyles as styles } from "./liveStyles";

export type LiveGiftBarProps = {
  /** Post-chat ★ review unlock (progress bar only). */
  starReady: boolean;
  starProgress: number;
  needMin: number;
  elapsedSecs: number;
  /** Your spendable ★ balance (always shown next to gift title). */
  stars: number;
  gifts: GiftDef[];
  unlockLabel: string;
  readyLabel: string;
  /** Section title above chips, e.g. "Gifts". */
  giftsTitle?: string;
  /** Who receives gifts — name · location · their ★ (omit in compact). */
  partnerLine?: string;
  /**
   * Slim dock: no partner line, hide unlock bar text, emoji+★ chips only.
   * Frees vertical space so partner face fills more of the stage.
   */
  compact?: boolean;
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
    compact = false,
    onCantAfford,
    onSpend,
  } = props;
  const t = useT();

  const balance = Math.max(0, Math.floor(Number(stars) || 0));
  const cheapest = gifts.length
    ? Math.min(...gifts.map((g) => g.cost))
    : null;
  const allLocked = cheapest !== null && balance < cheapest;

  return (
    <View style={[styles.giftSection, compact && styles.giftSectionCompact]}>
      <View style={styles.giftSectionHead}>
        {giftsTitle ? (
          <Text style={styles.giftSectionTitle} accessibilityRole="header">
            {giftsTitle}
          </Text>
        ) : (
          <View />
        )}
        {/* Always show spendable balance (incl. 0) — high contrast for Android */}
        <View
          style={[
            local.balancePill,
            compact && local.balancePillCompact,
            balance > 0 ? local.balancePillReady : local.balancePillZero,
          ]}
          accessibilityLabel={`${balance} stars`}
          collapsable={false}
        >
          <Text
            style={[
              local.balanceText,
              balance > 0 ? local.balanceTextReady : local.balanceTextZero,
            ]}
          >
            ★{balance}
          </Text>
        </View>
      </View>
      {/* Full mode only — compact skips partner line (chrome owns identity) */}
      {!compact && partnerLine ? (
        <Text
          style={styles.giftPartnerLine}
          numberOfLines={1}
          accessibilityRole="text"
        >
          {partnerLine}
        </Text>
      ) : null}

      {/* Compact: thin unlock track only (no tall copy). Full: track + label. */}
      {!starReady ? (
        <View
          style={[styles.giftUnlockBar, compact && styles.giftUnlockBarCompact]}
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
          {!compact ? (
            <Text
              style={styles.giftUnlockText}
              numberOfLines={1}
              importantForAccessibility="no"
            >
              {unlockLabel}
            </Text>
          ) : null}
        </View>
      ) : !compact ? (
        <Text
          style={styles.giftUnlockReady}
          numberOfLines={1}
          accessibilityLiveRegion="polite"
        >
          {readyLabel}
        </Text>
      ) : null}

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
            contentContainerStyle={[
              styles.giftsRow,
              compact && styles.giftsRowCompact,
            ]}
            style={[styles.giftsScroll, compact && styles.giftsScrollCompact]}
            keyboardShouldPersistTaps="handled"
          >
            {gifts.map((g) => {
              const afford = balance >= g.cost;
              return (
                <Pressable
                  key={g.id}
                  style={[
                    styles.giftChip,
                    compact && styles.giftChipCompact,
                    !afford && styles.giftChipDisabled,
                    afford && styles.giftChipReady,
                  ]}
                  onPress={() => {
                    if (!afford) {
                      onCantAfford?.(g.cost, balance);
                      return;
                    }
                    onSpend(g.id, g.cost);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.emoji || ""} ${g.label}, ${g.cost} stars`}
                  accessibilityState={{ disabled: !afford }}
                >
                  <Text
                    style={[styles.giftEmoji, compact && styles.giftEmojiCompact]}
                    importantForAccessibility="no"
                  >
                    {g.emoji}
                  </Text>
                  {!compact ? (
                    <Text
                      style={styles.giftLabel}
                      numberOfLines={1}
                      importantForAccessibility="no"
                    >
                      {g.label}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.giftCost,
                      compact && styles.giftCostCompact,
                      afford && styles.giftCostReady,
                    ]}
                    importantForAccessibility="no"
                  >
                    {g.cost}★
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {!compact && allLocked ? (
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

/** Local high-contrast spendable ★ pill (over video / dark dock). */
const local = StyleSheet.create({
  balancePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    zIndex: 4,
  },
  balancePillCompact: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    minWidth: 40,
  },
  balancePillReady: {
    backgroundColor: "rgba(48, 34, 4, 0.99)",
    borderColor: "rgba(255, 210, 70, 1)",
  },
  balancePillZero: {
    backgroundColor: "rgba(28, 24, 10, 0.97)",
    borderColor: "rgba(210, 175, 60, 0.7)",
  },
  balanceText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  balanceTextReady: { color: "#ffe566" },
  balanceTextZero: { color: "rgba(255, 228, 140, 0.88)" },
});

