import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { isFriendsOnly } from "../config";
import { hapticLight } from "../feedback/haptics";
import { LanguagePickerModal } from "../i18n/LanguagePickerModal";
import { useI18n } from "../i18n";

/** Home stack header: language (opens a full list) and a visible Start. */
export function HomeHeaderActions() {
  const { lang, t } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
  const friendsOnly = isFriendsOnly();
  const code = String(lang || "en").slice(0, 2).toUpperCase();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => setLangOpen(true)}
        style={styles.lang}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.lang")}
        hitSlop={6}
      >
        <Text style={styles.langText}>{code}</Text>
      </Pressable>
      {friendsOnly ? null : (
        <Pressable
          onPress={() => {
            hapticLight();
            router.push({ pathname: "/live", params: { autostart: "1" } });
          }}
          style={styles.start}
          accessibilityRole="button"
          accessibilityLabel={t("btn.start")}
          hitSlop={6}
        >
          <Text style={styles.startText}>{t("btn.start")}</Text>
        </Pressable>
      )}
      <LanguagePickerModal visible={langOpen} onClose={() => setLangOpen(false)} />
    </View>
  );
}

const styles = {
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginRight: 4,
  },
  lang: {
    minWidth: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center" as const,
  },
  langText: { color: "#e8eef7", fontWeight: "700" as const, fontSize: 13 },
  start: {
    backgroundColor: "#ff2d55",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  startText: { color: "#fff", fontWeight: "800" as const, fontSize: 14 },
};
