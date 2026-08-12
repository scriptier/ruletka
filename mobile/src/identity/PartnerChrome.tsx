/**
 * Match-time partner identity — compact top-right chrome.
 * Single slim card so partner face/head stays visible.
 * Layout: one row ★ · flag Name; loc only when known (no pending line).
 * elevation 32+ so Android does not wash the chip under stage neighbors.
 * pointerEvents box-none on wrap — does not block stage taps outside card.
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

function cleanChromeName(raw: unknown): string {
  return String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function isChromePlaceholderName(raw: unknown): boolean {
  const s = cleanChromeName(raw);
  return (
    !s ||
    s === "\u2026" ||
    s === "..." ||
    s === "?" ||
    s === "\uFF1F" ||
    /^partner$/i.test(s)
  );
}

/** name → nameFallback → friendCode → "Partner". Never blank. */
function resolveChromeDisplayName(
  name: unknown,
  nameFallback?: unknown,
  friendCode?: unknown
): string {
  const rawName = cleanChromeName(name);
  if (!isChromePlaceholderName(rawName)) return rawName;
  const fallback = cleanChromeName(nameFallback);
  if (fallback && !isChromePlaceholderName(fallback)) return fallback;
  const code = cleanChromeName(friendCode).toUpperCase();
  if (code) return code;
  if (fallback) return fallback;
  return "Partner";
}

export function PartnerChrome(props: {
  name: string;
  /** Fallback when name empty/placeholder — short id / peer slice */
  nameFallback?: string;
  /** Partner friend code — name fallback when name + shortId empty */
  friendCode?: string;
  stars?: number;
  trust?: number;
  flag?: string;
  country?: string;
  city?: string;
  /**
   * Partner enabled Hide-IP (privacy). Only then say "Location hidden".
   * If false/unknown and no geo from hub → omit loc line (not a tall pending).
   */
  hideIp?: boolean;
  /** You muted their audio (local playout off). */
  muted?: boolean;
  /**
   * @deprecated UI lives in LiveStatusBanners only (one banner). Kept so call
   * sites can still pass the prop without a second on-screen duplicate.
   */
  theyMutedMe?: boolean;
  isFriend?: boolean;
  /**
   * Optional call timer (e.g. 0:42). Only rendered when set — live.tsx leaves
   * this unset so the timer can live in the bottom bar instead.
   */
  timer?: string;
  /** Long-press: copy name / location / ★ / friend code. */
  onLongPress?: () => void;
  /** a11y hint only — not painted on screen (kept face clear). */
  longPressHint?: string;
  /**
   * Compact chrome: skip trust/friend/muted chip row (default true).
   * Mute state lives in top LiveStatusBanners (under PartnerIdentityDock).
   */
  compact?: boolean;
}) {
  const t = useT();
  const { lang } = useI18n();
  const compact = props.compact !== false;
  const stars = Math.max(0, Math.floor(Number(props.stars) || 0));
  const trust = Math.max(0, Math.floor(Number(props.trust) || 0));
  // Visible ★ chip: always max(spendable, trust). Hub often sends trust as
  // social_health while spendable balance is 0 — never paint ★0 in that case.
  // Real spendable stays in a11y when different. Always paint chip (incl. ★0).
  const displayStars = Math.max(stars, trust);
  const starsFromTrust = stars === 0 && trust > 0;
  // hide_ip → empty loc from formatLocLine; we show short "hidden" only then.
  // Real geo: flag ISO alone must beat empty (partner_geo may still be racing).
  const loc = formatLocLine({
    flag: props.flag,
    country: props.country,
    city: props.city,
    lang: lang || "ru",
    hideIp: !!props.hideIp,
  });
  const em = flagEmoji(props.flag);
  const code = normalizeFlagCode(props.flag);
  // Known loc only — never paint "Looking up…" (tall, covers face).
  const locLine = props.hideIp
    ? t("mobile.live.locPrivate") || "Location hidden"
    : loc || code || "";
  const showLoc = !!locLine;
  const tierKey = trustTierI18nKey(trust);
  const tier = trustTier(trust);
  // name OR shortId OR friendCode — never blank mid-match
  const name = resolveChromeDisplayName(
    props.name,
    props.nameFallback,
    props.friendCode
  );

  // Extra chips only when not compact (legacy). Timer / friend / muted / trust.
  const chips: {
    key: string;
    label: string;
    style?: object;
    textStyle?: object;
  }[] = [];
  if (props.timer) chips.push({ key: "t", label: props.timer });
  if (!compact) {
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
    if (trust > 0) {
      const trustProminent = stars === 0;
      const tierLabel = t(tierKey) || (tier === "new" ? "new" : tier);
      chips.push({
        key: "tr",
        label: trustProminent ? `${tierLabel} · ${trust}` : tierLabel,
        style: trustProminent
          ? styles.chipTrustGold
          : tier === "senior" || tier === "trusted"
            ? styles.chipTrustHi
            : styles.chipTrust,
        textStyle: trustProminent ? styles.chipTrustGoldText : undefined,
      });
    }
  }

  void props.theyMutedMe;
  const a11yLabel = [
    name,
    showLoc ? locLine : null,
    starsFromTrust
      ? `★ ${displayStars} (${t("mobile.live.tierKnown") || "status"}; spendable ${stars})`
      : `★ ${displayStars}`,
    ...chips.filter((c) => c.key !== "t").map((c) => c.label),
  ]
    .filter(Boolean)
    .join(", ");

  const starsChipStyle =
    displayStars > 0 ? styles.chipStars : styles.chipStarsZero;
  const starsTextStyle =
    displayStars > 0 ? styles.chipStarsText : styles.chipStarsTextZero;

  // One compact row: ★ chip (always) + flag Name — ★0 dimmed but large gold
  const card = (
    <View style={styles.card} collapsable={false} pointerEvents="auto">
      <View style={styles.mainRow} collapsable={false}>
        <View style={[styles.chip, starsChipStyle]} collapsable={false}>
          <Text style={[styles.chipText, starsTextStyle]} numberOfLines={1}>
            {`★ ${displayStars}`}
          </Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {em ? `${em} ` : ""}
          {name}
        </Text>
      </View>
      {showLoc ? (
        <Text style={styles.loc} numberOfLines={1}>
          {locLine}
        </Text>
      ) : null}
      {chips.length ? (
        <View style={styles.chipRow} collapsable={false}>
          {chips.map((c) => (
            <View
              key={c.key}
              style={[styles.chip, c.style]}
              collapsable={false}
            >
              <Text
                style={[styles.chipText, c.textStyle]}
                numberOfLines={1}
              >
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      style={styles.wrap}
      accessibilityRole="header"
      collapsable={false}
      // box-none: wrap does not block stage taps; card/Pressable still receive long-press
      pointerEvents="box-none"
      removeClippedSubviews={false}
    >
      {props.onLongPress ? (
        <Pressable
          onLongPress={props.onLongPress}
          delayLongPress={380}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel || props.longPressHint || "Partner"}
          accessibilityHint={
            props.longPressHint ||
            t("mobile.live.partnerLongPress") ||
            "Long-press to copy"
          }
          collapsable={false}
          pointerEvents="auto"
        >
          {card}
        </Pressable>
      ) : (
        card
      )}
    </View>
  );
}

/** Compact one-line summary for blur modal / toasts. */
export function formatPartnerSummary(opts: {
  name?: string;
  stars?: number;
  /** Public trust — used for ★ display when spendable is 0. */
  trust?: number;
  flag?: string;
  country?: string;
  city?: string;
  lang?: string;
  hideIp?: boolean;
}): string {
  const name =
    (opts.name || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim() || "Partner";
  const stars = Math.max(0, Math.floor(Number(opts.stars) || 0));
  const trust = Math.max(0, Math.floor(Number(opts.trust) || 0));
  const displayStars = Math.max(stars, trust);
  const loc = formatLocLine({
    flag: opts.flag,
    country: opts.country,
    city: opts.city,
    lang: opts.lang || "ru",
    hideIp: !!opts.hideIp,
  });
  const bits = [name, `★${displayStars}`];
  if (loc) bits.push(loc);
  else if (opts.hideIp) bits.push("hidden");
  return bits.join(" · ");
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: "55%",
    gap: 0,
    alignSelf: "flex-end",
    alignItems: "flex-end",
    zIndex: 100,
    elevation: 40,
  },
  card: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
    maxWidth: "100%",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    // Opaque enough that SurfaceView neighbors cannot wash the chip
    backgroundColor: "rgba(4, 8, 16, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    gap: 2,
    elevation: 40,
    zIndex: 100,
  },
  /** ★ + name on one tight row — less vertical cover over the head */
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    maxWidth: "100%",
  },
  name: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.15,
    lineHeight: 18,
    textAlign: "right",
    flexShrink: 1,
    includeFontPadding: false,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  loc: {
    color: "#c8d8ec",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.05,
    textAlign: "right",
    maxWidth: "100%",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 2,
  },
  chip: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  chipStars: {
    backgroundColor: "rgba(48, 34, 4, 0.95)",
    borderColor: "rgba(255, 210, 70, 0.95)",
    borderWidth: 1.2,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  /** ★0 still painted — dimmed gold, large enough to read mid-match */
  chipStarsZero: {
    backgroundColor: "rgba(28, 24, 10, 0.94)",
    borderColor: "rgba(210, 175, 60, 0.7)",
    borderWidth: 1.2,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  chipTrust: {
    backgroundColor: "rgba(40, 90, 160, 0.88)",
    borderColor: "rgba(140, 190, 255, 0.85)",
  },
  chipTrustHi: {
    backgroundColor: "rgba(30, 120, 80, 0.9)",
    borderColor: "rgba(100, 230, 160, 0.85)",
  },
  chipTrustGold: {
    backgroundColor: "rgba(48, 36, 6, 0.96)",
    borderColor: "rgba(255, 200, 80, 0.9)",
    borderWidth: 1.2,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  chipTrustGoldText: {
    color: "#ffe9a0",
    fontWeight: "800",
  },
  chipMuted: {
    backgroundColor: "rgba(120, 40, 40, 0.9)",
    borderColor: "rgba(255, 140, 120, 0.8)",
  },
  chipText: {
    color: "#f2f5fa",
    fontSize: 12,
    fontWeight: "700",
    includeFontPadding: false,
  },
  chipStarsText: {
    color: "#ffe566",
    fontSize: 14,
    fontWeight: "800",
  },
  chipStarsTextZero: {
    color: "rgba(255, 210, 80, 0.78)",
    fontSize: 14,
    fontWeight: "800",
  },
});
