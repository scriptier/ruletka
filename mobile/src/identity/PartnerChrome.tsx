/**
 * Match-time partner chrome: flag · stars · trust tier chip.
 */
import { StyleSheet, Text, View } from "react-native";
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
  muted?: boolean;
  isFriend?: boolean;
}) {
  const t = useT();
  const { lang } = useI18n();
  const trust = Math.max(0, Math.floor(Number(props.trust) || 0));
  const stars = Math.max(0, Math.floor(Number(props.stars) || 0));
  const tier = trustTier(trust);
  const loc = formatLocLine({
    flag: props.flag,
    country: props.country,
    city: props.city,
    lang: lang || "ru",
  });
  const em = flagEmoji(props.flag);
  const code = normalizeFlagCode(props.flag);

  return (
    <View style={styles.wrap}>
      <Text style={styles.name} numberOfLines={1}>
        {em ? `${em} ` : ""}
        {props.name || "…"}
        {props.isFriend ? ` · ${t("mobile.live.friend")}` : ""}
        {props.muted ? ` · ${t("mobile.live.partnerMuted")}` : ""}
      </Text>
      <View style={styles.row}>
        {loc ? (
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {loc}
            </Text>
          </View>
        ) : code ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{code}</Text>
          </View>
        ) : null}
        {stars > 0 ? (
          <View style={[styles.chip, styles.chipStars]}>
            <Text style={styles.chipText}>★{stars}</Text>
          </View>
        ) : null}
        <View
          style={[
            styles.chip,
            tier === "senior" && styles.tierSenior,
            tier === "trusted" && styles.tierTrusted,
            tier === "known" && styles.tierKnown,
            tier === "new" && styles.tierNew,
          ]}
        >
          <Text style={styles.chipText}>
            {t(trustTierI18nKey(trust))}
            {trust > 0 ? ` · ${trust}` : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, maxWidth: "92%" },
  name: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    textShadowColor: "#000",
    textShadowRadius: 6,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  chipStars: {
    borderColor: "rgba(255,200,80,0.45)",
    backgroundColor: "rgba(40,32,8,0.75)",
  },
  chipText: {
    color: "#e8eef7",
    fontSize: 11,
    fontWeight: "700",
  },
  tierNew: {
    borderColor: "rgba(160,170,190,0.35)",
  },
  tierKnown: {
    borderColor: "rgba(100,160,255,0.45)",
    backgroundColor: "rgba(20,36,60,0.75)",
  },
  tierTrusted: {
    borderColor: "rgba(80,220,160,0.55)",
    backgroundColor: "rgba(12,40,32,0.8)",
  },
  tierSenior: {
    borderColor: "rgba(255,180,60,0.65)",
    backgroundColor: "rgba(50,36,8,0.85)",
  },
});
