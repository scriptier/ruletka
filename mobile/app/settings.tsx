import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { hubBase } from "../src/config";
import { setDisplayName } from "../src/identity/store";
import {
  loadMatchPrefs,
  saveMatchPrefs,
  type LookingFor,
  type MatchPrefs,
  type SoftGender,
} from "../src/prefs/store";
import { useApp } from "./_layout";

function Chip(props: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.chip, props.active && styles.chipOn]}
    >
      <Text style={[styles.chipText, props.active && styles.chipTextOn]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { identity, setIdentityName } = useApp();
  const [name, setName] = useState(identity.name);
  const [prefs, setPrefs] = useState<MatchPrefs | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadMatchPrefs().then(setPrefs);
  }, []);

  async function save() {
    if (!prefs) return;
    await setDisplayName(name);
    setIdentityName(name);
    await saveMatchPrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!prefs) {
    return (
      <View style={styles.root}>
        <Text style={styles.meta}>Loading…</Text>
      </View>
    );
  }

  function setGender(g: SoftGender) {
    setPrefs((p) => (p ? { ...p, gender: g } : p));
  }
  function setLooking(l: LookingFor) {
    setPrefs((p) => (p ? { ...p, looking: l } : p));
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.h}>Display name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={32}
        placeholder="anon"
        placeholderTextColor="#6b7a90"
      />

      <Text style={styles.h}>I am</Text>
      <View style={styles.row}>
        {(
          [
            ["", "Unset"],
            ["man", "Man"],
            ["woman", "Woman"],
            ["other", "Other"],
          ] as [SoftGender, string][]
        ).map(([v, label]) => (
          <Chip
            key={v || "unset"}
            label={label}
            active={prefs.gender === v}
            onPress={() => setGender(v)}
          />
        ))}
      </View>

      <Text style={styles.h}>Looking for</Text>
      <View style={styles.row}>
        {(
          [
            ["any", "Anyone"],
            ["man", "Men"],
            ["woman", "Women"],
          ] as [LookingFor, string][]
        ).map(([v, label]) => (
          <Chip
            key={v}
            label={label}
            active={prefs.looking === v}
            onPress={() => setLooking(v)}
          />
        ))}
      </View>

      <Text style={styles.h}>Hide my IP</Text>
      <View style={styles.row}>
        <Chip
          label="Off (P2P OK)"
          active={!prefs.hideIp}
          onPress={() => setPrefs({ ...prefs, hideIp: false })}
        />
        <Chip
          label="On (TURN only)"
          active={prefs.hideIp}
          onPress={() => setPrefs({ ...prefs, hideIp: true })}
        />
      </View>
      <Text style={styles.hint}>
        Hide IP forces TURN relay so the partner never sees your address.
        Needs hub TURN (ruletka.vip has it). Slightly higher latency.
      </Text>

      <Pressable style={styles.cta} onPress={save}>
        <Text style={styles.ctaText}>{saved ? "Saved ✓" : "Save"}</Text>
      </Pressable>

      <Text style={styles.meta}>
        User {identity.user_id.slice(0, 12)}… · hub {hubBase()}
      </Text>
      <Text style={styles.hint}>
        Soft prefs only — the hub never hard-blocks the whole pool when empty.
        Re-open Live after save so hello/set_prefs pick up changes.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 10 },
  h: { color: "#e8eef7", fontWeight: "700", fontSize: 15, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipOn: {
    borderColor: "rgba(255,45,85,0.55)",
    backgroundColor: "rgba(255,45,85,0.2)",
  },
  chipText: { color: "#9aa8bc", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#fff" },
  cta: {
    marginTop: 16,
    backgroundColor: "#ff2d55",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700" },
  meta: { color: "#6b7a90", fontSize: 11, marginTop: 12 },
  hint: { color: "#6b7a90", fontSize: 12, lineHeight: 18 },
});
