import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { childSafetyUrl, safetyToolsUrl, termsUrl } from "../src/config";
import { rulesAccepted, setRulesAccepted } from "../src/identity/store";
import { useT } from "../src/i18n";
import { PermissionRationaleCard } from "../src/permissions/PermissionRationale";
import {
  ensureMediaPermissions,
  hasMediaPermissions,
} from "../src/permissions/media";
import { useApp } from "./_layout";

type Step = "age" | "perm";

export default function RulesScreen() {
  const { refreshRules, rulesOk } = useApp();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("age");

  // Already accepted rules (or re-landed after grant): leave without more prompts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = rulesOk || (await rulesAccepted());
        if (!ok || cancelled) return;
        const hasMedia = await hasMediaPermissions();
        if (cancelled) return;
        if (hasMedia) {
          await refreshRules();
          router.replace("/");
          return;
        }
        // Rules done, media still missing — go straight to perm step (no age again)
        setStep("perm");
      } catch {
        /* stay on age gate */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rulesOk, refreshRules]);

  async function finishOnboarding(requestPerms: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await setRulesAccepted();
      await refreshRules();

      if (requestPerms) {
        // Silent if OS already granted (re-install / second open)
        if (!(await hasMediaPermissions())) {
          await ensureMediaPermissions({
            rationaleTitle: t("mobile.perm.title"),
            rationaleMessage: t("mobile.perm.message"),
          });
        }
      }

      router.replace("/");
    } catch {
      try {
        await refreshRules();
        router.replace("/");
      } catch {
        setBusy(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function declineUnder18() {
    if (Platform.OS === "android") {
      BackHandler.exitApp();
    } else {
      Linking.openURL(childSafetyUrl()).catch(() => {});
    }
  }

  if (step === "perm") {
    return (
      <ScrollView contentContainerStyle={styles.root}>
        <View accessibilityLiveRegion="polite" accessible={false}>
          <PermissionRationaleCard
            busy={busy}
            onContinue={() => finishOnboarding(true)}
            onNotNow={() => finishOnboarding(false)}
          />
        </View>
        <Text style={styles.hint}>{t("mobile.perm.canRetry")}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.badge}>{t("mobile.rules.badge")}</Text>
      <Text style={styles.h1}>{t("rules.ageGateTitle")}</Text>
      <Text style={styles.p}>{t("rules.age")}</Text>
      <Text style={styles.p}>{t("rules.agreeLead")}</Text>
      <Pressable
        onPress={() => Linking.openURL(termsUrl()).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={t("mobile.rules.fullRules")}
      >
        <Text style={styles.link} importantForAccessibility="no">
          {t("mobile.rules.fullRules")}
        </Text>
      </Pressable>
      <Text style={styles.p}>{t("mobile.perm.message")}</Text>
      <Pressable
        style={[styles.cta, busy && styles.ctaBusy]}
        onPress={() => finishOnboarding(true)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.rules.continue18")}
        accessibilityState={{ disabled: busy, busy }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText} importantForAccessibility="no">
            {t("mobile.rules.continue18")}
          </Text>
        )}
      </Pressable>
      <Pressable
        style={styles.ghost}
        onPress={() => finishOnboarding(false)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.perm.notNow")}
        accessibilityState={{ disabled: busy }}
      >
        <Text style={styles.ghostText} importantForAccessibility="no">
          {t("mobile.perm.notNow")}
        </Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={declineUnder18}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.rules.under18")}
        accessibilityState={{ disabled: busy }}
      >
        <Text style={styles.secondaryText} importantForAccessibility="no">
          {t("mobile.rules.under18")}
        </Text>
      </Pressable>
      <Pressable
        onPress={() =>
          Linking.openURL(safetyToolsUrl()).catch(() => {})
        }
        accessibilityRole="link"
        accessibilityLabel={t("mobile.safety.openPage")}
      >
        <Text style={styles.link} importantForAccessibility="no">
          {t("mobile.safety.openPage")}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => Linking.openURL(childSafetyUrl()).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={t("mobile.safety.childStandards")}
      >
        <Text style={styles.link} importantForAccessibility="no">
          {t("mobile.safety.childStandards")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 24, gap: 14 },
  badge: {
    color: "#ff8fab",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  h1: { color: "#fff", fontSize: 24, fontWeight: "800" },
  p: { color: "#c5d0e0", fontSize: 15, lineHeight: 22 },
  hint: { color: "#8a96a8", fontSize: 13, lineHeight: 18 },
  cta: {
    marginTop: 12,
    backgroundColor: "#ff2d55",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondary: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  secondaryText: { color: "#c5d0e0", fontWeight: "600" },
  ghost: {
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostText: { color: "#9aa8bc", fontWeight: "600", fontSize: 14 },
  link: {
    color: "#9ec5ff",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "600",
  },
});
