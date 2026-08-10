/**
 * Pre-system permission education (Play best practice).
 * Show this *before* PermissionsAndroid.request so users understand why.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "../i18n";

export function PermissionRationaleCard(props: {
  busy?: boolean;
  onContinue: () => void;
  onNotNow?: () => void;
}) {
  const t = useT();
  const { busy, onContinue, onNotNow } = props;

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>{t("mobile.perm.badge")}</Text>
      <Text style={styles.title}>{t("mobile.perm.screenTitle")}</Text>
      <Text style={styles.body}>{t("mobile.perm.screenBody")}</Text>
      <View style={styles.bullets}>
        <Text style={styles.bullet}>• {t("mobile.perm.bulletCam")}</Text>
        <Text style={styles.bullet}>• {t("mobile.perm.bulletMic")}</Text>
        <Text style={styles.bullet}>• {t("mobile.perm.bulletP2p")}</Text>
        <Text style={styles.bullet}>• {t("mobile.perm.bulletDeny")}</Text>
      </View>
      <Pressable
        style={[styles.cta, busy && styles.ctaBusy]}
        onPress={onContinue}
        disabled={!!busy}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.perm.continue")}
        accessibilityState={{ disabled: !!busy, busy: !!busy }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText} importantForAccessibility="no">
            {t("mobile.perm.continue")}
          </Text>
        )}
      </Pressable>
      {onNotNow ? (
        <Pressable
          style={styles.ghost}
          onPress={onNotNow}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.perm.notNow")}
          accessibilityState={{ disabled: !!busy }}
        >
          <Text style={styles.ghostText} importantForAccessibility="no">
            {t("mobile.perm.notNow")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 4,
  },
  badge: {
    alignSelf: "flex-start",
    color: "#9ec5ff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  body: {
    color: "#c5d0e0",
    fontSize: 15,
    lineHeight: 22,
  },
  bullets: { gap: 6, marginTop: 4 },
  bullet: {
    color: "#a8b4c4",
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    marginTop: 14,
    backgroundColor: "#ff2d55",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  ghost: {
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostText: { color: "#9aa8bc", fontWeight: "600", fontSize: 14 },
});
