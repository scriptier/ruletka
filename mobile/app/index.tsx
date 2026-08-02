import { Link, Redirect } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { hubBase } from "../src/config";
import { useApp } from "./_layout";

export default function HomeScreen() {
  const { identity, rulesOk } = useApp();

  if (!rulesOk) {
    return <Redirect href="/rules" />;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>ruletka</Text>
      <Text style={styles.tag}>Peer-to-peer video · 18+ · no classic account</Text>
      <Text style={styles.meta}>
        User · {identity.user_id.slice(0, 8)}… · hub {hubBase()}
      </Text>

      <Link href="/live" asChild>
        <Pressable style={styles.cta}>
          <Text style={styles.ctaText}>Start chatting</Text>
        </Pressable>
      </Link>

      <Link href="/settings" asChild>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Match prefs &amp; name</Text>
        </Pressable>
      </Link>

      <Text style={styles.note}>
        Phase 1: stranger loop + prefs + report/block. A/V needs a native build
        (expo prebuild + react-native-webrtc).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
  brand: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tag: { color: "#9aa8bc", fontSize: 15, lineHeight: 22 },
  meta: { color: "#6b7a90", fontSize: 12, marginBottom: 12 },
  cta: {
    backgroundColor: "#ff2d55",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  secondary: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
  },
  secondaryText: { color: "#c5d0e0", fontWeight: "600", fontSize: 15 },
  note: { color: "#6b7a90", fontSize: 12, lineHeight: 18, marginTop: 16 },
});
