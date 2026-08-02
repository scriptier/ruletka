import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
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
  LANG_LABELS,
  SUPPORTED_LANGS,
  useI18n,
  useT,
  type LangCode,
} from "../src/i18n";
import {
  buildPlainProfile,
  decryptProfile,
  encryptProfile,
  isEncryptedProfile,
  shareProfileJson,
} from "../src/identity/profileBackup";
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
  const { friendCode, stars } = useHub();
  const t = useT();
  const { pref, setPref, lang } = useI18n();
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
      Alert.alert(
        t("settings.exportPwWeak"),
        t("settings.exportPwTooWeak")
      );
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
      Alert.alert(t("settings.exportDone"), t("settings.exportStarsNote"));
    } catch (e) {
      Alert.alert(t("settings.exportFail"), String(e));
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
          Alert.alert(t("settings.importFail"), t("settings.exportPwTooWeak"));
          setBusy(false);
          return;
        }
        raw = await decryptProfile(raw, importPw);
      }
      const uid = raw?.identity?.user_id || raw?.user_id;
      if (!uid || String(uid).length < 8) {
        throw new Error(t("settings.importBad"));
      }
      const newName = String(raw?.identity?.name || raw?.name || "anon").slice(
        0,
        32
      );
      Alert.alert(
        t("settings.importUser"),
        t("settings.importConfirm", {
          id: String(uid).slice(0, 12),
          cur: identity.user_id.slice(0, 12),
        }),
        [
          {
            text: t("mobile.common.cancel"),
            style: "cancel",
            onPress: () => setBusy(false),
          },
          {
            text: t("settings.importUser"),
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
                  t("settings.importDoneStarsHub"),
                  t("settings.importDone")
                );
              } catch (e) {
                Alert.alert(t("settings.importFail"), String(e));
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(t("settings.importFail"), String(e));
      setBusy(false);
    }
  }

  if (!prefs) {
    return (
      <View style={styles.root}>
        <Text style={styles.meta}>{t("mobile.common.loading")}</Text>
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
      <Text style={styles.h}>{t("mobile.settings.displayName")}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={32}
        placeholder="anon"
        placeholderTextColor="#6b7a90"
      />

      <Text style={styles.h}>{t("mobile.lang")}</Text>
      <View style={styles.row}>
        <Chip
          label={t("mobile.lang.system")}
          active={!pref}
          onPress={() => setPref("")}
        />
        {SUPPORTED_LANGS.map((code) => (
          <Chip
            key={code}
            label={LANG_LABELS[code as LangCode]}
            active={pref === code}
            onPress={() => setPref(code)}
          />
        ))}
      </View>
      <Text style={styles.hint}>
        {pref
          ? LANG_LABELS[pref as LangCode] || pref
          : `${t("mobile.lang.auto")} → ${LANG_LABELS[lang]}`}
      </Text>

      <Text style={styles.h}>{t("mobile.settings.iAm")}</Text>
      <View style={styles.row}>
        {(
          [
            ["", t("mobile.settings.genderUnset")],
            ["man", t("mobile.settings.genderMan")],
            ["woman", t("mobile.settings.genderWoman")],
            ["other", t("mobile.settings.genderOther")],
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

      <Text style={styles.h}>{t("prefs.looking")}</Text>
      <View style={styles.row}>
        {(
          [
            ["any", t("mobile.settings.lookingAnyone")],
            ["man", t("mobile.settings.lookingMen")],
            ["woman", t("mobile.settings.lookingWomen")],
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

      <Text style={styles.h}>{t("settings.hideIp")}</Text>
      <View style={styles.row}>
        <Chip
          label={t("mobile.settings.hideIpOff")}
          active={!prefs.hideIp}
          onPress={() => setPrefs({ ...prefs, hideIp: false })}
        />
        <Chip
          label={t("mobile.settings.hideIpOn")}
          active={prefs.hideIp}
          onPress={() => setPrefs({ ...prefs, hideIp: true })}
        />
      </View>
      <Text style={styles.hint}>{t("settings.hideIpHint")}</Text>

      <Pressable style={styles.cta} onPress={save} disabled={busy}>
        <Text style={styles.ctaText}>
          {saved ? t("mobile.settings.saved") : t("mobile.settings.save")}
        </Text>
      </Pressable>

      <Text style={styles.section}>{t("mobile.settings.backup")}</Text>
      <Text style={styles.hint}>
        {t("mobile.settings.backupHint", { stars })}
      </Text>
      <TextInput
        style={styles.input}
        value={exportPw}
        onChangeText={setExportPw}
        secureTextEntry
        placeholder={t("mobile.settings.exportPw")}
        placeholderTextColor="#6b7a90"
      />
      <Pressable
        style={styles.secondary}
        onPress={exportBackup}
        disabled={busy}
      >
        <Text style={styles.secondaryText}>{t("mobile.settings.exportBtn")}</Text>
      </Pressable>

      <TextInput
        style={styles.input}
        value={importPw}
        onChangeText={setImportPw}
        secureTextEntry
        placeholder={t("mobile.settings.importPw")}
        placeholderTextColor="#6b7a90"
      />
      <Pressable
        style={styles.secondary}
        onPress={importBackup}
        disabled={busy}
      >
        <Text style={styles.secondaryText}>{t("mobile.settings.importBtn")}</Text>
      </Pressable>

      <Text style={styles.section}>{t("mobile.settings.legal")}</Text>
      <Text style={styles.hint}>{t("mobile.settings.legalHint")}</Text>
      {(
        [
          [t("nav.safety"), "/safety.html"],
          [t("nav.community"), "/community.html"],
          [t("nav.privacy"), "/legal/privacy.html"],
          [t("nav.terms"), "/legal/terms.html"],
          [t("nav.eula"), "/legal/eula.html"],
        ] as const
      ).map(([label, path]) => (
        <Pressable
          key={path}
          style={styles.linkRow}
          onPress={() => {
            const url = `${hubBase()}${path}`;
            Linking.openURL(url).catch(() => Alert.alert(label, url));
          }}
        >
          <Text style={styles.linkText}>{label}</Text>
          <Text style={styles.linkChevron}>↗</Text>
        </Pressable>
      ))}

      <Text style={styles.meta}>
        {t("mobile.settings.userMeta", {
          id: identity.user_id.slice(0, 12),
          hub: hubBase(),
        })}
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
