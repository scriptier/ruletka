import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { hubBase } from "../src/config";
import { useHub } from "../src/hub/HubProvider";
import {
  buildPlainProfile,
  decryptProfile,
  encryptProfile,
  isEncryptedProfile,
  shareProfileJson,
} from "../src/identity/profileBackup";
import { setDisplayName } from "../src/identity/store";
import * as SecureStore from "expo-secure-store";
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
  const { friendCode, stars } = useHub();
  const [name, setName] = useState(identity.name);
  const [prefs, setPrefs] = useState<MatchPrefs | null>(null);
  const [saved, setSaved] = useState(false);
  const [exportPw, setExportPw] = useState("");
  const [importPw, setImportPw] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function exportBackup() {
    if (exportPw.length > 0 && exportPw.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters, or leave empty for plain JSON (not recommended).");
      return;
    }
    setBusy(true);
    try {
      const p = prefs || (await loadMatchPrefs());
      const plain = buildPlainProfile({
        user_id: identity.user_id,
        name: name || identity.name,
        friend_code: friendCode,
        prefs: p as unknown as Record<string, unknown>,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      if (exportPw) {
        const enc = await encryptProfile(plain, exportPw);
        await shareProfileJson(enc, `ruletka-profile-${stamp}.enc.json`);
      } else {
        await shareProfileJson(plain, `ruletka-profile-${stamp}.json`);
      }
      Alert.alert(
        "Backup ready",
        "Stars are not in this file — they stay on the hub for your user id."
      );
    } catch (e) {
      Alert.alert("Export failed", String(e));
    } finally {
      setBusy(false);
    }
  }

  async function importBackup() {
    setBusy(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (pick.canceled || !pick.assets?.[0]?.uri) {
        setBusy(false);
        return;
      }
      const uri = pick.assets[0].uri;
      const text = await FileSystem.readAsStringAsync(uri);
      let raw = JSON.parse(text);
      if (isEncryptedProfile(raw)) {
        if (!importPw) {
          Alert.alert("Password required", "This backup is encrypted.");
          setBusy(false);
          return;
        }
        raw = await decryptProfile(raw, importPw);
      }
      const uid = raw?.identity?.user_id || raw?.user_id;
      if (!uid || String(uid).length < 8) {
        throw new Error("Invalid profile file");
      }
      const newName = String(raw?.identity?.name || raw?.name || "anon").slice(
        0,
        32
      );
      Alert.alert(
        "Replace identity?",
        `Import ${String(uid).slice(0, 12)}… as ${newName}? This device will use that hub identity. Stars load from the hub.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setBusy(false) },
          {
            text: "Import",
            style: "destructive",
            onPress: async () => {
              try {
                await SecureStore.setItemAsync(
                  "ruletka.user_id.v1",
                  String(uid)
                );
                await setDisplayName(newName);
                setIdentityName(newName);
                if (raw.prefs) {
                  await saveMatchPrefs({
                    gender: (raw.prefs.gender as SoftGender) || "",
                    looking: (raw.prefs.looking as LookingFor) || "any",
                    hideIp: !!raw.prefs.hideIp,
                  });
                }
                Alert.alert(
                  "Imported",
                  "Reload the app (kill & reopen) so hub hello uses the new id."
                );
              } catch (e) {
                Alert.alert("Import failed", String(e));
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert("Import failed", String(e));
      setBusy(false);
    }
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
        Hide IP forces TURN relay so the partner never sees your address. Needs
        hub TURN.
      </Text>

      <Pressable style={styles.cta} onPress={save} disabled={busy}>
        <Text style={styles.ctaText}>{saved ? "Saved ✓" : "Save prefs"}</Text>
      </Pressable>

      <Text style={styles.section}>Backup (no account)</Text>
      <Text style={styles.hint}>
        Export identity + prefs. Stars stay on the hub (★ {stars}). Password
        optional but recommended.
      </Text>
      <TextInput
        style={styles.input}
        value={exportPw}
        onChangeText={setExportPw}
        secureTextEntry
        placeholder="Export password (optional)"
        placeholderTextColor="#6b7a90"
      />
      <Pressable
        style={styles.secondary}
        onPress={exportBackup}
        disabled={busy}
      >
        <Text style={styles.secondaryText}>Export backup…</Text>
      </Pressable>

      <TextInput
        style={styles.input}
        value={importPw}
        onChangeText={setImportPw}
        secureTextEntry
        placeholder="Import password if encrypted"
        placeholderTextColor="#6b7a90"
      />
      <Pressable
        style={styles.secondary}
        onPress={importBackup}
        disabled={busy}
      >
        <Text style={styles.secondaryText}>Import backup…</Text>
      </Pressable>

      <Text style={styles.section}>Safety & legal</Text>
      <Text style={styles.hint}>
        Open on the hub site (same policies as web). Required for store review.
      </Text>
      {(
        [
          ["Safety", "/safety.html"],
          ["Community", "/community.html"],
          ["Privacy", "/legal/privacy.html"],
          ["Terms", "/legal/terms.html"],
          ["EULA", "/legal/eula.html"],
        ] as const
      ).map(([label, path]) => (
        <Pressable
          key={path}
          style={styles.linkRow}
          onPress={() => {
            const url = `${hubBase()}${path}`;
            Linking.openURL(url).catch(() =>
              Alert.alert("Could not open", url)
            );
          }}
        >
          <Text style={styles.linkText}>{label}</Text>
          <Text style={styles.linkChevron}>↗</Text>
        </Pressable>
      ))}

      <Text style={styles.meta}>
        User {identity.user_id.slice(0, 12)}… · hub {hubBase()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 10 },
  h: { color: "#e8eef7", fontWeight: "700", fontSize: 15, marginTop: 8 },
  section: {
    color: "#ffe9a0",
    fontWeight: "800",
    fontSize: 16,
    marginTop: 20,
  },
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
  secondary: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  secondaryText: { color: "#c5d0e0", fontWeight: "600" },
  meta: { color: "#6b7a90", fontSize: 11, marginTop: 12, marginBottom: 24 },
  hint: { color: "#6b7a90", fontSize: 12, lineHeight: 18 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  linkText: { color: "#c5d0e0", fontWeight: "600", fontSize: 14 },
  linkChevron: { color: "#6b7a90", fontSize: 14 },
});
