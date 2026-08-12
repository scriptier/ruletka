/**
 * ONLY mid-match partner identity surface: name · ★ · location.
 * placement="top" (default for match): root absolute strip under status bar.
 * Do not also mount PartnerChrome / stagePartnerHud for the same fields.
 */
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useI18n, useT } from "../i18n";
import { flagEmoji, formatLocLine } from "../identity/flagTrust";
import { liveStyles as styles } from "./liveStyles";
import {
  displayPartnerStars,
  isPlaceholderPartnerName,
  resolvePartnerDisplayName as resolvePartnerLabel,
} from "./matchPeers";

export type PartnerIdentityDockProps = {
  name?: string;
  nameFallback?: string;
  friendCode?: string;
  stars?: number;
  trust?: number;
  /** Pre-computed max(stars,trust) from parent — preferred when set */
  displayStars?: number;
  flag?: string;
  country?: string;
  city?: string;
  hideIp?: boolean;
  /**
   * "top" — root absolute under status bar (matched default).
   * "row" | "below" — legacy shell only; avoid remounting mid-match.
   */
  placement?: "row" | "below" | "top";
  /** Extra shell style (e.g. { paddingTop: insets.top }) from live.tsx */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onLongPress?: () => void;
};

/** @deprecated Prefer isPlaceholderPartnerName from matchPeers */
export function isPlaceholderName(raw: unknown): boolean {
  return isPlaceholderPartnerName(raw);
}

/**
 * Dock-local resolver: real name → non-hex fallback → friendCode → Partner.
 * Hex peer/user short ids are placeholders (never painted when a better label exists).
 */
export function resolvePartnerDisplayName(
  name: unknown,
  nameFallback: unknown,
  friendCode?: unknown
): string {
  // Do NOT pass nameFallback as peerId — that made 4-char short labels match
  // peer-prefix placeholder checks and collapse to "Partner".
  return resolvePartnerLabel({
    name: name == null ? undefined : String(name),
    shortId: nameFallback == null ? undefined : String(nameFallback),
    friendCode: friendCode == null ? undefined : String(friendCode),
  });
}

export function PartnerIdentityDock(props: PartnerIdentityDockProps) {
  const t = useT();
  const { lang } = useI18n();

  // max(spendable, trust). ★ 0 is valid empty ledger (hub always serializes u64);
  // never invent stars, but never hide the chip either. Real >0 must paint gold.
  const starsNum = Number(props.stars) || 0;
  const trustNum = Number(props.trust) || 0;
  const displayStars =
    props.displayStars != null && Number.isFinite(Number(props.displayStars))
      ? Math.max(0, Math.floor(Number(props.displayStars)))
      : displayPartnerStars(starsNum, trustNum);
  const starsZero = displayStars === 0;

  const name = resolvePartnerDisplayName(
    props.name,
    props.nameFallback,
    props.friendCode
  );
  // Flag is ONLY the stage partnerFlagChip (top-left on video). Never prefix
  // name or loc with 🇨🇦 — dual-flag fail on 2026-08-11 15:01 screenshot.
  const em = flagEmoji(props.flag);
  const nameLine = name; // no flag emoji on name

  const hideIp = !!props.hideIp;
  const flagTrim = props.flag != null ? String(props.flag).trim() : "";
  const countryTrim =
    props.country != null ? String(props.country).trim() : "";
  const cityTrim = props.city != null ? String(props.city).trim() : "";
  // Any geo field from MatchPeer / partner_geo → second line must paint.
  const hasGeoSignal = !!(flagTrim || countryTrim || cityTrim);
  // omitFlag: chip owns the flag visual — loc is "Canada · Calgary" only
  const locRaw = hideIp
    ? ""
    : formatLocLine({
        flag: flagTrim,
        country: countryTrim,
        city: cityTrim,
        lang: lang || "ru",
        hideIp: false,
        omitFlag: true,
      });
  // Fallback without flag emoji/ISO prefix (chip owns the flag)
  const locFallback = (() => {
    if (hideIp || locRaw) return "";
    if (countryTrim) return countryTrim.slice(0, 28);
    if (cityTrim) return cityTrim.slice(0, 28);
    return "";
  })();
  const locPrivate = t("mobile.live.locPrivate") || "Location hidden";
  const locLine = hideIp ? locPrivate : locRaw || locFallback;
  // Second line: hide_ip (private copy) OR any non-empty loc OR raw geo signal.
  const showLoc = hideIp || !!locLine || (!hideIp && hasGeoSignal);
  const locPaint = hideIp
    ? locPrivate
    : locLine || (hasGeoSignal ? locFallback || locRaw : "") || "";

  // Always paint ★ N (incl. 0 dimmed). Never omit the chip mid-match.
  const starsText = `★ ${displayStars}`;
  const starsStyle = starsZero
    ? styles.partnerIdentityDockStarsZero
    : styles.partnerIdentityDockStars;

  const a11yLabel = [
    nameLine,
    em || (flagTrim ? flagTrim.toUpperCase().slice(0, 2) : ""),
    starsText,
    showLoc && locPaint ? locPaint : "",
  ]
    .filter(Boolean)
    .join(", ");

  // Two lines so long names never flex-squeeze location to 0 width:
  //   1) name · ★
  //   2) location (full width under name — required when flag/country/city known)
  const body = (
    <View collapsable={false}>
      <View style={styles.partnerIdentityDockRow} collapsable={false}>
        <Text
          style={[styles.partnerIdentityDockName, { flexShrink: 1, flexGrow: 1 }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {nameLine}
        </Text>
        <Text
          style={[starsStyle, { flexShrink: 0 }]}
          numberOfLines={1}
          testID="live-partner-identity-stars"
        >
          {starsText}
        </Text>
      </View>
      {showLoc ? (
        <Text
          style={[
            hideIp || !locRaw
              ? styles.partnerIdentityDockLocDim
              : styles.partnerIdentityDockLoc,
            { marginTop: 1, width: "100%", flexShrink: 0 },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
          testID="live-partner-identity-loc"
        >
          {/* If flag/country/city state is set, second line MUST paint. */}
          {locPaint ||
            locFallback ||
            countryTrim ||
            cityTrim ||
            (hideIp ? locPrivate : "")}
        </Text>
      ) : null}
    </View>
  );

  const shellBase =
    props.placement === "top"
      ? styles.partnerIdentityTopStrip
      : styles.partnerIdentityDock;

  const shellProps = {
    style: props.style ? [shellBase, props.style] : shellBase,
    testID: props.testID || "live-partner-identity-dock",
    accessibilityRole: "header" as const,
    accessibilityLabel: a11yLabel,
    collapsable: false as const,
    removeClippedSubviews: false as const,
  };

  if (props.onLongPress) {
    return (
      <Pressable
        {...shellProps}
        onLongPress={props.onLongPress}
        accessibilityHint={
          t("mobile.live.partnerLongPress") ||
          "Long-press to copy name · place · ★"
        }
      >
        {body}
      </Pressable>
    );
  }

  return <View {...shellProps}>{body}</View>;
}
