/**
 * ONLY mid-match partner identity surface: photo · name · ★ · location.
 * placement="top" (default for match): root absolute strip under status bar.
 * Do not also mount PartnerChrome / stagePartnerHud for the same fields.
 */
import { useEffect, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { avatarColor, isAvatarUri } from "../friends/CallPeerAvatar";
import { useI18n, useT } from "../i18n";
import { flagEmoji, formatLocLine } from "../identity/flagTrust";
import { liveStyles as styles } from "./liveStyles";
import {
  displayPartnerStars,
  formatPraisedBy,
  isPlaceholderPartnerName,
  resolvePartnerDisplayName as resolvePartnerLabel,
} from "./matchPeers";

export type PartnerIdentityDockProps = {
  name?: string;
  nameFallback?: string;
  friendCode?: string;
  stars?: number;
  trust?: number;
  /** Unique praisers (hub trust_gifters). >0 paints "praised by N". */
  trustGifters?: number;
  /** Pre-computed partner ★ (trust/rep) from parent — preferred when set */
  displayStars?: number;
  flag?: string;
  country?: string;
  city?: string;
  hideIp?: boolean;
  /** Partner photo (data URL / https / file). Empty / invalid → letter. */
  avatar?: string;
  /**
   * Decode the photo only after first live audio/frame so Image work does not
   * jank the first second of a match. Name · flag · loc · ★ always paint.
   * Default true (call cards / tests). Live match passes false until media.
   */
  avatarReady?: boolean;
  /**
   * "top" — root absolute under status bar (matched default).
   * "row" | "below" — legacy shell only; avoid remounting mid-match.
   */
  placement?: "row" | "below" | "top";
  /**
   * Friend code painted as its own dim line (not the name). Shown even when
   * hex-looking — that's the add-friend code. Hidden when it matches the name.
   */
  code?: string;
  /** Extra shell style (e.g. { paddingTop: insets.top }) from live.tsx */
  style?: StyleProp<ViewStyle>;
  /**
   * Paint the top-right ★ N chip. Default true so 1v1 callers stay unchanged.
   * 3-way dock (p-live) passes false — tile chrome already has stars.
   */
  showStars?: boolean;
  testID?: string;
  onLongPress?: () => void;
  /** Tap their ★ / identity to send ★1 (costs 3). */
  onGiftStar?: () => void;
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

/** 32px circle next to the dock name. Photo when URI valid; else letter. */
function DockAvatar(props: { uri?: string; name: string; ready?: boolean }) {
  const raw = isAvatarUri(props.uri) ? String(props.uri).trim() : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [raw]);
  const letter = (props.name || "?").trim().slice(0, 1).toUpperCase() || "?";
  const bg = avatarColor(props.name || letter);
  // Linking: letter first. Mount Image only after audio/frame (avatarReady).
  const show = !!raw && !failed && props.ready !== false;
  return (
    <View
      style={[
        styles.partnerIdentityDockAvatar,
        { backgroundColor: show ? "#0c121c" : bg },
      ]}
      importantForAccessibility="no"
      testID="live-partner-identity-avatar"
    >
      {show ? (
        <Image
          source={{ uri: raw }}
          style={styles.partnerIdentityDockAvatarImg}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.partnerIdentityDockAvatarLetter}>{letter}</Text>
      )}
    </View>
  );
}

export function PartnerIdentityDock(props: PartnerIdentityDockProps) {
  const t = useT();
  const { lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  // Partner ★ = trust (rep). Wallet is yours only. ★0 is a valid empty score.
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
  // Dock owns the single flag visual (stage partnerFlagChip removed — dual-flag
  // fail was dock+stage). Flag emoji on name row only; loc omits flag emoji.
  const em = flagEmoji(props.flag);
  const nameLine = name;

  const hideIp = !!props.hideIp;
  const flagTrim = props.flag != null ? String(props.flag).trim() : "";
  const countryTrim =
    props.country != null ? String(props.country).trim() : "";
  const cityTrim = props.city != null ? String(props.city).trim() : "";
  // Any geo field from MatchPeer / partner_geo → second line must paint.
  const hasGeoSignal = !!(flagTrim || countryTrim || cityTrim);
  // omitFlag: flag already on name row — loc is "Canada · Calgary" only
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
  // Fallback without second flag emoji on loc line
  const locFallback = (() => {
    if (hideIp || locRaw) return "";
    if (countryTrim) return countryTrim.slice(0, 28);
    if (cityTrim) return cityTrim.slice(0, 28);
    return "";
  })();
  const locPrivate = t("mobile.live.locPrivate") || "Location hidden";
  const locLine = hideIp ? locPrivate : locRaw || locFallback;
  const codeRaw = String(props.code || "").trim().toUpperCase();
  const showCode =
    !!codeRaw &&
    codeRaw.length >= 4 &&
    codeRaw !== name.toUpperCase();
  const trustGifters = Math.max(
    0,
    Math.floor(Number(props.trustGifters) || 0)
  );
  let praisedLine = "";
  if (trustGifters > 0) {
    const praisedKey = "mobile.live.praisedBy";
    const raw = t(praisedKey, { n: trustGifters });
    praisedLine =
      !raw || raw === praisedKey ? formatPraisedBy(trustGifters) : raw;
  }
  // Second line: hide_ip (private copy) OR any non-empty loc OR raw geo signal.
  const showLoc = hideIp || !!locLine || (!hideIp && hasGeoSignal);
  const locPaint = hideIp
    ? locPrivate
    : locLine || (hasGeoSignal ? locFallback || locRaw : "") || "";

  // Default true: omit showStars and 1v1 still paints ★ N (incl. 0 dimmed).
  const showStars = props.showStars !== false;
  const starsText = `★ ${displayStars}`;
  const starsStyle = starsZero
    ? styles.partnerIdentityDockStarsZero
    : styles.partnerIdentityDockStars;

  const a11yLabel = [
    nameLine,
    em || (flagTrim ? flagTrim.toUpperCase().slice(0, 2) : ""),
    showStars ? starsText : "",
    showLoc && locPaint ? locPaint : "",
    showCode ? codeRaw : "",
  ]
    .filter(Boolean)
    .join(", ");

  // Two lines so long names never flex-squeeze location to 0 width:
  //   1) 🇨🇦 name · ★  (flag only here — not also on loc)
  //   2) location (full width under name — required when flag/country/city known)
  const body = (
    <View collapsable={false}>
      <View style={styles.partnerIdentityDockRow} collapsable={false}>
        <DockAvatar
          uri={props.avatar}
          name={name}
          ready={props.avatarReady}
        />
        {em ? (
          <Text
            style={[styles.partnerIdentityDockName, { flexShrink: 0, marginRight: 4 }]}
            numberOfLines={1}
            importantForAccessibility="no"
            testID="live-partner-identity-flag"
          >
            {em}
          </Text>
        ) : null}
        <Text
          style={[styles.partnerIdentityDockName, { flexShrink: 1, flexGrow: 1 }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {nameLine}
        </Text>
        {showStars ? (
          props.onGiftStar ? (
            <Pressable
              onPress={props.onGiftStar}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t("stars.giftShootingStarHint") || "Send ★1 · 3★"}
              testID="live-partner-identity-stars"
            >
              <Text style={[starsStyle, { flexShrink: 0 }]} numberOfLines={1}>
                {starsText}
              </Text>
            </Pressable>
          ) : (
            <Text
              style={[starsStyle, { flexShrink: 0 }]}
              numberOfLines={1}
              testID="live-partner-identity-stars"
            >
              {starsText}
            </Text>
          )
        ) : null}
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
      {showCode ? (
        <Text
          style={[
            styles.partnerIdentityDockCode,
            { marginTop: 1, width: "100%", flexShrink: 0 },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
          testID="live-partner-identity-code"
        >
          {codeRaw}
        </Text>
      ) : null}
      {praisedLine ? (
        <Text
          style={[
            styles.partnerIdentityDockLocDim,
            { marginTop: 1, width: "100%", flexShrink: 0 },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
          testID="live-partner-identity-praised"
        >
          {praisedLine}
        </Text>
      ) : null}
    </View>
  );

  const shellBase =
    props.placement === "top"
      ? styles.partnerIdentityTopStrip
      : styles.partnerIdentityDock;

  // live.tsx's inline paddingTop (insets.top - 10) is tuned for Android's
  // status bar. On iPhone that sits the name/★/loc under the notch/Dynamic
  // Island and behind the transient camera-in-use / volume HUD. Floor it
  // to the real top inset plus a small buffer, iOS only — Android untouched.
  // In landscape the notch/Dynamic Island moves to one side (insets.left or
  // insets.right, never both) and insets.top drops to ~0 — add matching
  // horizontal room instead so the row never sits under the sensor housing
  // or the rotated status/home-indicator strip. partnerIdentityTopStrip's
  // base paddingHorizontal is 12 — extend it, never replace it below that.
  const isLandscape = winW > winH;
  const iosTopStyle =
    Platform.OS === "ios" && props.placement === "top"
      ? {
          paddingTop: isLandscape
            ? Math.max(insets.top, 8) + 4
            : Math.max(insets.top, 44) + 6,
          paddingLeft: 12 + Math.max(insets.left, 0),
          paddingRight: 12 + Math.max(insets.right, 0),
        }
      : null;

  const shellProps = {
    style: [shellBase, props.style, iosTopStyle].filter(Boolean) as StyleProp<ViewStyle>[],
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
