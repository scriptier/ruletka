import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { setRulesAccepted } from "../src/identity/store";
import { useApp } from "./_layout";

export default function RulesScreen() {
  const { refreshRules } = useApp();

  async function accept() {
    await setRulesAccepted();
    await refreshRules();
    router.replace("/");
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.h1}>You must be 18+</Text>
      <Text style={styles.p}>
        ruletka is peer-to-peer video chat with strangers and friends. There is
        no classic password account — your identity lives on this device until
        you export a backup.
      </Text>
      <Text style={styles.p}>
        • Be respectful. Use Block and Report if needed.{"\n"}
        • Partners can screenshot or record — never share secrets.{"\n"}
        • Video goes browser/app to peer when possible (not uploaded as media
        files to our hub).{"\n"}
        • Matchmaking and chat text go through the hub you connect to.
      </Text>
      <Text style={styles.p}>
        By continuing you confirm you are 18 or older and accept the Terms and
        Privacy Policy on ruletka.vip.
      </Text>
      <Pressable style={styles.cta} onPress={accept}>
        <Text style={styles.ctaText}>I am 18+ · Continue</Text>
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
