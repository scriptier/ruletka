import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { setRulesAccepted } from "../src/identity/store";
import { useT } from "../src/i18n";
import { useApp } from "./_layout";

export default function RulesScreen() {
  const { refreshRules } = useApp();
  const t = useT();

  async function accept() {
    await setRulesAccepted();
    await refreshRules();
    router.replace("/");
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.h1}>{t("rules.ageGateTitle")}</Text>
      <Text style={styles.p}>{t("rules.age")}</Text>
      <Text style={styles.p}>
        • {t("rules.respect")}
        {"\n"}• {t("rules.media")}
        {"\n"}• {t("rules.privacy")}
      </Text>
      <Text style={styles.p}>{t("rules.agreeLead")}</Text>
      <Pressable style={styles.cta} onPress={accept}>
        <Text style={styles.ctaText}>{t("rules.ageYes")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 24, gap: 14 },
  h1: { color: "#fff", fontSize: 24, fontWeight: "800" },
  p: { color: "#c5d0e0", fontSize: 15, lineHeight: 22 },
  cta: {
    marginTop: 12,
    backgroundColor: "#ff2d55",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
