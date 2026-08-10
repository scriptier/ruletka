/**
 * Match-time partner identity: name, location, stars — readable over video.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n, useT } from "../i18n";
import {
  flagEmoji,
  formatLocLine,
  normalizeFlagCode,
  trustTier,
  trustTierI18nKey,
} from "./flagTrust";

export function PartnerChrome(props: {
  name: string;
  stars?: number;
  trust?: number;
  flag?: string;
  country?: string;
  city?: string;
  /**
   * Partner enabled Hide-IP (privacy). Only then say "Location hidden".
   * If false/unknown and no geo from hub → "Location unknown" (not privacy).
   */
  hideIp?: boolean;
  /** You muted their audio (local playout off). */
  muted?: boolean;
  /** They muted your audio on their device — always show in top chrome (above SurfaceView). */
  theyMutedMe?: boolean;
  isFriend?: boolean;
  /** Call timer (e.g. 0:42) — folded into the same line when video is live. */
  timer?: string;
  /** Long-press: copy name / location / ★ / friend code. */
  onLongPress?: () => void;
  longPressHint?: string;
}) {
  const t = useT();
  const { lang } = useI18n();
  const stars = Math.max(0, Math.floor(Number(props.stars) || 0));
  const trust = Math.max(0, Math.floor(Number(props.trust) || 0));
  const loc = formatLocLine({
    flag: props.flag,
    country: props.country,
    city: props.city,
    lang: lang || "ru",
  });
  const em = flagEmoji(props.flag);
  const code = normalizeFlagCode(props.flag);
  const tierKey = trustTierI18nKey(trust);
  const tier = trustTier(trust);
  const name = (props.name || "…").trim() || "…";

  const chips: { key: string; label: string; style?: object }[] = [];
  if (props.timer) chips.push({ key: "t", label: props.timer });
  if (props.isFriend) {
    chips.push({ key: "f", label: t("mobile.live.friend") || "Friend" });
  }
  if (props.muted) {
    chips.push({
      key: "m",
      label: t("mobile.live.partnerMuted") || "muted",
      style: styles.chipMuted,
    });
  }
  // Always show stars so reputation is usable mid-chat (not only when ★>0)
  chips.push({
    key: "s",
    label: `★ ${stars}`,
    style: stars > 0 ? styles.chipStars : styles.chipDim,
  });
  if (trust > 0) {
    chips.push({
      key: "tr",
      label: t(tierKey) || `trust ${trust}`,
      style:
        tier === "senior" || tier === "trusted"
          ? styles.chipTrustHi
          : styles.chipTrust,
    });
  }

  const theyMutedLabel =
    t("mobile.live.theyMutedYou") || "They muted you · no sound";

  // Pressable collapses the card into one accessibility node keyed off
  // accessibilityLabel, so screen-reader users only hear what's listed here —
  // include loc/chips (name + everything a sighted user reads on the card),
  // but skip the ticking `timer` chip so focus doesn't get relabeled every second.
  const a11yLabel = [
    name,
    loc || code || null,
    ...chips.filter((c) => c.key !== "t").map((c) => c.label),
  ]
    .filter(Boolean)
    .join(", ");

  const card = (
    <View style={styles.card}>
      <Text style={styles.name} numberOfLines={1}>
        {em ? `${em} ` : ""}
        {name}
      </Text>
      {loc || code ? (
        <Text style={styles.loc} numberOfLines={1}>
          {loc || code}
        </Text>
      ) : (
        <Text style={styles.locDim} numberOfLines={1}>
          {props.hideIp
            ? t("mobile.live.locPrivate") || "Location hidden"
            : // Empty geo is often a hub race — hub now pushes partner_geo; keep soft copy
              t("mobile.live.locPending") ||
                t("mobile.live.locUnknown") ||
                "Looking up location…"}
        </Text>
      )}
      {chips.length ? (
        <View style={styles.chipRow}>
          {chips.map((c) => (
            <View key={c.key} style={[styles.chip, c.style]}>
              <Text style={styles.chipText} numberOfLines={1}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {props.onLongPress && props.longPressHint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {props.longPressHint}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap} accessibilityRole="header">
      {props.onLongPress ? (
        <Pressable
          onLongPress={props.onLongPress}
          delayLongPress={380}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel || props.longPressHint || "Partner"}
          accessibilityHint={props.longPressHint}
        >
          {card}
        </Pressable>
      ) : (
        card
      )}
      {props.theyMutedMe ? (
        <View style={styles.theyMutedPill} accessibilityLiveRegion="polite">
          <Text style={styles.theyMutedText} numberOfLines={1}>
            🔇 {theyMutedLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Compact one-line summary for blur modal / toasts. */
export function formatPartnerSummary(opts: {
  name?: string;
  stars?: number;
  flag?: string;
  country?: string;
  city?: string;
  lang?: string;
}): string {
  const name = (opts.name || "…").trim() || "…";
  const stars = Math.max(0, Math.floor(Number(opts.stars) || 0));
  const loc = formatLocLine({
    flag: opts.flag,
    country: opts.country,
    city: opts.city,
    lang: opts.lang || "ru",
  });
  const bits = [name, `★${stars}`];
  if (loc) bits.push(loc);
  return bits.join(" · ");
}

const styles = StyleSheet.create({
  wrap: { maxWidth: "92%", gap: 6 },
  card: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(6, 10, 18, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    gap: 3,
  },
  name: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.15,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
  loc: {
    color: "#c8d8f0",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  locDim: {
    color: "rgba(180, 195, 215, 0.55)",
    fontSize: 12,
    fontWeight: "500",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  chipStars: {
    backgroundColor: "rgba(245, 180, 40, 0.22)",
    borderColor: "rgba(245, 200, 80, 0.45)",
  },
  chipDim: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  chipTrust: {
    backgroundColor: "rgba(80, 140, 220, 0.22)",
    borderColor: "rgba(120, 170, 255, 0.4)",
  },
  chipTrustHi: {
    backgroundColor: "rgba(60, 180, 120, 0.25)",
    borderColor: "rgba(100, 230, 160, 0.5)",
  },
  chipMuted: {
    backgroundColor: "rgba(180, 60, 40, 0.35)",
    borderColor: "rgba(255, 120, 90, 0.5)",
  },
  chipText: {
    color: "#eef4ff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  theyMutedPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(48, 12, 10, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 120, 90, 0.65)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  theyMutedText: {
    color: "#ffe8e0",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.15,
  },
  hint: {
    color: "rgba(180, 195, 215, 0.55)",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
});
