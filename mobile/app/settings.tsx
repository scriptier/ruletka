import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import {
  childSafetyReportMailto,
  childSafetyUrl,
  hubBase,
  isFriendsOnly,
  safetyToolsUrl,
  supportEmail,
} from "../src/config";
import { hapticLight } from "../src/feedback/haptics";
import { useHub } from "../src/hub/HubProvider";
import {
  listCandidateHubs,
  normalizeBase,
  probeHub,
} from "../src/hubs/directory";
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
import { replaceIdentity, setDisplayName } from "../src/identity/store";
import {
  loadMatchPrefs,
  saveMatchPrefs,
  type BlurStrangersMode,
  type LiveLayoutMode,
  type LookingFor,
  type MatchPrefs,
  type SoftGender,
} from "../src/prefs/store";
import {
  forgetBlock,
  resolveBlockedList,
  type BlockedEntry,
} from "../src/safety/blocks";
import { loadMatchThumbsMap } from "../src/calls/matchThumbs";
import {
  clearReportHistory,
  loadReportHistory,
  type ReportHistoryEntry,
} from "../src/safety/reportHistory";
import {
  isSoundEnabled,
  loadSoundPref,
  setSoundPref,
} from "../src/feedback/audioSession";
import OpenOnPcSheet from "../src/pc/OpenOnPcSheet";
import { openBatterySettings } from "../src/push/batteryOptIn";
import {
  pushModuleAvailable,
  tryRegisterPush,
} from "../src/push/register";
import { requestHomePinOnce } from "../src/shortcuts/homePin";
import {
  trustTier,
  trustTierI18nKey,
} from "../src/identity/flagTrust";
import {
  loadLastConnectStats,
  type LastConnectStats,
} from "../src/media/lastConnectStats";
import { useApp } from "./_layout";

function Chip(props: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        props.onPress();
      }}
      style={[styles.chip, props.active && styles.chipOn]}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.active }}
    >
      <Text
        style={[styles.chipText, props.active && styles.chipTextOn]}
        importantForAccessibility="no"
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/** Collapsible card section — keeps long Settings scannable. */
function Section(props: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          hapticLight();
          props.onToggle();
        }}
        style={styles.cardHead}
        accessibilityRole="button"
        accessibilityLabel={props.title}
        accessibilityState={{ expanded: props.open }}
      >
        <View style={styles.cardHeadText} importantForAccessibility="no">
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{props.title}</Text>
            {props.badge ? (
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>{props.badge}</Text>
              </View>
            ) : null}
          </View>
          {props.subtitle ? (
            <Text style={styles.cardSub} numberOfLines={2}>
              {props.subtitle}
            </Text>
          ) : null}
        </View>
        <Text style={styles.cardChevron}>{props.open ? "▾" : "▸"}</Text>
      </Pressable>
      {props.open ? <View style={styles.cardBody}>{props.children}</View> : null}
    </View>
  );
}

type SectionKey =
  | "profile"
  | "match"
  | "alerts"
  | "hub"
  | "mod"
  | "backup"
  | "safety"
  | "about";

const PRIMARY_LANGS: LangCode[] = ["en", "ru", "uk", "de", "es"];

export default function SettingsScreen() {
  const { rulesOk } = useApp();
  if (!rulesOk) return <Redirect href="/rules" />;
  return <SettingsBody />;
}

function SettingsBody() {
  const { identity, setIdentityName, replaceAppIdentity } = useApp();
  const {
    friendCode,
    stars,
    trust,
    trustEffective,
    hub,
    connected,
    blockedIds,
    showToast,
    hubBaseUrl,
    switchHub,
    reconnectHub,
  } = useHub();
  const t = useT();
  const { pref, setPref, lang } = useI18n();
  const [name, setName] = useState(identity.name);
  const [prefs, setPrefs] = useState<MatchPrefs | null>(null);
  const [saved, setSaved] = useState(false);
  const [exportPw, setExportPw] = useState("");
  const [importPw, setImportPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);
  /** On-device match thumbs for blocked rows (blurred in UI). */
  const [blockedThumbs, setBlockedThumbs] = useState<Record<string, string>>(
    {}
  );
  const [reports, setReports] = useState<ReportHistoryEntry[]>([]);
  const [pushStatus, setPushStatus] = useState("");
  const [uiSounds, setUiSounds] = useState(true);
  const [hubRows, setHubRows] = useState<
    { base: string; ok: boolean | null }[]
  >([]);
  const [hubBusy, setHubBusy] = useState(false);
  const [moreLangs, setMoreLangs] = useState(false);
  const [pcSheetOpen, setPcSheetOpen] = useState(false);
  const [lastConnect, setLastConnect] = useState<LastConnectStats | null>(
    null
  );
  const [openSec, setOpenSec] = useState<Record<SectionKey, boolean>>({
    profile: true,
    match: true,
    alerts: false,
    hub: false,
    mod: false,
    backup: false,
    safety: false,
    about: false,
  });

  const toggleSec = useCallback((k: SectionKey) => {
    setOpenSec((s) => ({ ...s, [k]: !s[k] }));
  }, []);

  const tierLabel = useMemo(() => {
    const n = trustEffective || trust;
    const key = trustTierI18nKey(n);
    return t(key === "mobile.live.tierNew" ? "mobile.settings.tierNone" : key);
  }, [t, trust, trustEffective]);

  const langChips = useMemo(() => {
    const primary = PRIMARY_LANGS.filter((c) =>
      (SUPPORTED_LANGS as readonly string[]).includes(c)
    );
    const rest = SUPPORTED_LANGS.filter(
      (c) => !primary.includes(c as LangCode)
    ) as LangCode[];
    // Always show active pref language even if in "more"
    const active = pref as LangCode;
    const showRest =
      moreLangs ||
      (!!active && rest.includes(active)) ||
      (!pref && !primary.includes(lang as LangCode));
    return { primary, rest, showRest };
  }, [moreLangs, pref, lang]);

  useEffect(() => {
    loadMatchPrefs().then(setPrefs);
    loadSoundPref().then(setUiSounds);
  }, []);

  const refreshBlocks = useCallback(() => {
    resolveBlockedList(blockedIds)
      .then(async (list) => {
        setBlocked(list);
        try {
          const ids = list.map((b) => b.user_id).filter(Boolean);
          setBlockedThumbs(await loadMatchThumbsMap(ids));
        } catch {
          setBlockedThumbs({});
        }
      })
      .catch(() => {
        setBlocked([]);
        setBlockedThumbs({});
      });
  }, [blockedIds]);

  const refreshReports = useCallback(() => {
    loadReportHistory().then(setReports).catch(() => setReports([]));
  }, []);

  const refreshHubs = useCallback(async () => {
    setHubBusy(true);
    try {
      const list = await listCandidateHubs(hubBaseUrl || hubBase());
      const rows = await Promise.all(
        list.slice(0, 8).map(async (base) => ({
          base,
          ok: await probeHub(base, 3500),
        }))
      );
      setHubRows(rows);
    } catch {
      setHubRows([]);
    } finally {
      setHubBusy(false);
    }
  }, [hubBaseUrl]);

  useFocusEffect(
    useCallback(() => {
      refreshBlocks();
      refreshReports();
      void refreshHubs();
      void loadLastConnectStats().then(setLastConnect).catch(() => setLastConnect(null));
    }, [refreshBlocks, refreshReports, refreshHubs])
  );

  useEffect(() => {
    refreshBlocks();
  }, [refreshBlocks]);

  function unblock(uid: string) {
    Alert.alert(
      t("mobile.settings.unblockTitle"),
      t("mobile.settings.unblockBody"),
      [
        { text: t("mobile.common.cancel"), style: "cancel" },
        {
          text: t("mobile.settings.unblockBtn"),
          onPress: () => {
            try {
              hub.unblockUser(uid);
              void forgetBlock(uid);
              setBlocked((list) => list.filter((e) => e.user_id !== uid));
            } catch (e) {
              showToast(`${t("mobile.common.offline")}: ${String(e)}`);
            }
          },
        },
      ]
    );
  }

  /** Persist hide-IP immediately + push hub so partners see correct loc privacy. */
  async function setHideIp(on: boolean) {
    if (!prefs) return;
    const next: MatchPrefs = { ...prefs, hideIp: on };
    setPrefs(next);
    try {
      await saveMatchPrefs(next);
      if (connected) {
        try {
          hub.setPrefs({
            gender: next.gender || "",
            looking: next.looking || "any",
            flag: next.flag || "",
            hide_ip: !!on,
          });
        } catch {
          /* offline */
        }
      }
      hapticLight();
      showToast(
        on
          ? t("settings.hideIpOnStatus") || "Location hidden from partners"
          : t("settings.hideIpOffStatus") || "Location visible to partners"
      );
    } catch (e) {
      showToast(`${t("mobile.common.offline")}: ${String(e)}`);
    }
  }

  /** Persist blur mode immediately (no need to tap Save) — soft toast. */
  async function setBlurMode(mode: BlurStrangersMode) {
    if (!prefs) return;
    const next: MatchPrefs = {
      ...prefs,
      blurStrangersMode: mode,
      blurStrangers: mode !== "off",
    };
    setPrefs(next);
    try {
      await saveMatchPrefs(next);
      hapticLight();
      const label =
        mode === "off"
          ? t("mobile.settings.blurModeOff")
          : mode === "intro"
            ? t("mobile.settings.blurModeIntro")
            : t("mobile.settings.blurModeHold");
      showToast(
        t("mobile.settings.blurModeSaved", { mode: label }) ||
          `Privacy veil: ${label}`
      );
    } catch (e) {
      showToast(`${t("mobile.common.offline")}: ${String(e)}`);
    }
  }

  async function save() {
    if (!prefs) return;
    await setDisplayName(name);
    setIdentityName(name);
    await saveMatchPrefs(prefs);
    // Push prefs + name to hub now (not only on next reconnect)
    if (connected) {
      try {
        hub.setPrefs({
          gender: prefs.gender || "",
          looking: prefs.looking || "any",
          flag: prefs.flag || "",
          hide_ip: !!prefs.hideIp,
        });
        hub.hello({
          user_id: identity.user_id,
          name: name || identity.name || "anon",
          gender: prefs.gender || "",
          looking: prefs.looking || "any",
          flag: prefs.flag || "",
          hide_ip: !!prefs.hideIp,
        });
      } catch {
        /* offline */
      }
    }
    hapticLight();
    showToast(t("mobile.settings.saved"));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function buildLabel(): string {
    const ver = Constants.expoConfig?.version || "?";
    const vc = Constants.expoConfig?.android?.versionCode || "";
    return vc ? `ruletka ${ver} (${vc})` : `ruletka ${ver}`;
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
      showToast(
        `${t("settings.exportDone")} — ${t("settings.exportStarsNote")}`
      );
    } catch (e) {
      showToast(`${t("settings.exportFail")}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function importBackup() {
    setBusy(true);
    try {
      // Android often labels .enc.json as octet-stream / text — accept broadly
      const pick = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/*", "application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });
      if (pick.canceled || !pick.assets?.[0]?.uri) {
        setBusy(false);
        return;
      }
      const uri = pick.assets[0].uri;
      let text = await FileSystem.readAsStringAsync(uri);
      // Strip BOM / accidental leading junk from share apps
      text = text.replace(/^\uFEFF/, "").trim();
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error(t("settings.importBad"));
      }
      if (isEncryptedProfile(raw)) {
        const pw = (importPw || "").trim();
        if (!pw) {
          // Was wrongly showing exportPwTooWeak (“use longer password…”)
          showToast(
            `${t("settings.importFail")}: ${t("mobile.settings.importNeedPw")}`
          );
          setBusy(false);
          return;
        }
        try {
          raw = await decryptProfile(raw, pw);
        } catch {
          showToast(
            `${t("settings.importFail")}: ${t("mobile.settings.importWrongPw")}`
          );
          setBusy(false);
          return;
        }
      }
      const profile = raw as {
        identity?: { user_id?: string; name?: string };
        user_id?: string;
        name?: string;
        prefs?: Record<string, unknown>;
      };
      const uid = profile?.identity?.user_id || profile?.user_id;
      if (!uid || String(uid).length < 8) {
        throw new Error(t("settings.importBad"));
      }
      const newName = String(
        profile?.identity?.name || profile?.name || "anon"
      ).slice(0, 32);
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
                if (profile.prefs) {
                  await saveMatchPrefs({
                    gender: (profile.prefs.gender as SoftGender) || "",
                    looking: (profile.prefs.looking as LookingFor) || "any",
                    hideIp: !!profile.prefs.hideIp,
                    notifyFriendCalls:
                      profile.prefs.notifyFriendCalls === undefined
                        ? true
                        : !!profile.prefs.notifyFriendCalls,
                    dataSaver: !!profile.prefs.dataSaver,
                    liveLayout:
                      (profile.prefs as { liveLayout?: string }).liveLayout ===
                      "browser"
                        ? "browser"
                        : "native",
                    blurStrangers:
                      profile.prefs.blurStrangers === undefined
                        ? true
                        : !!profile.prefs.blurStrangers,
                    blurStrangersMode: ((): BlurStrangersMode => {
                      const m = (profile.prefs as { blurStrangersMode?: string })
                        .blurStrangersMode;
                      if (m === "off" || m === "intro" || m === "hold") return m;
                      return profile.prefs.blurStrangers === false
                        ? "off"
                        : "intro";
                    })(),
                    historySnaps:
                      profile.prefs.historySnaps === undefined
                        ? true
                        : !!profile.prefs.historySnaps,
                  });
                }
                const next = await replaceIdentity(String(uid), newName);
                // Remount HubProvider with new user_id (WS reconnect + hello)
                replaceAppIdentity(next);
                setIdentityName(next.name);
                setName(next.name);
                showToast(
                  `${t("settings.importDoneStarsHub")} — ${t(
                    "mobile.settings.importDoneDevice"
                  )}`
                );
              } catch (e) {
                showToast(`${t("settings.importFail")}: ${String(e)}`);
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      showToast(`${t("settings.importFail")}: ${String(e)}`);
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

  const hubHost = (hubBaseUrl || hubBase()).replace(/^https?:\/\//, "");

  return (
    <>
    <ScrollView
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Profile ── */}
      <Section
        title={t("mobile.settings.secProfile")}
        subtitle={
          friendCode
            ? `${t("mobile.friends.yourCode")} ${friendCode}`
            : undefined
        }
        open={openSec.profile}
        onToggle={() => toggleSec("profile")}
        badge={stars > 0 ? `★${stars}` : undefined}
      >
        <Text style={styles.fieldLabel}>{t("mobile.settings.displayName")}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={32}
          placeholder="anon"
          placeholderTextColor="#6b7a90"
          accessibilityLabel={t("mobile.settings.displayName")}
        />
        <Text style={styles.fieldLabel}>{t("mobile.settings.reputation")}</Text>
        <View style={styles.repRow}>
          <View
            style={[
              styles.repChip,
              trustTier(trustEffective || trust) === "senior" &&
                styles.repSenior,
              trustTier(trustEffective || trust) === "trusted" &&
                styles.repTrusted,
              trustTier(trustEffective || trust) === "known" && styles.repKnown,
            ]}
          >
            <Text style={styles.repChipText}>
              {tierLabel}
              {(trustEffective || trust) > 0
                ? ` · ${trustEffective || trust}`
                : ""}
            </Text>
          </View>
          <View style={styles.repStars}>
            <Text style={styles.repChipText}>★{stars}</Text>
          </View>
        </View>
        <Text style={styles.hint}>
          {t("mobile.settings.reputationHint", {
            stars,
            trust: trustEffective || trust,
            tier: tierLabel,
          })}
        </Text>
      </Section>

      {/* ── Match & language ── */}
      <Section
        title={t("mobile.settings.secMatch")}
        subtitle={t("mobile.settings.secMatchSub")}
        open={openSec.match}
        onToggle={() => toggleSec("match")}
      >
        <Text style={styles.fieldLabel}>{t("mobile.lang")}</Text>
        <View style={styles.row}>
          <Chip
            label={t("mobile.lang.system")}
            active={!pref}
            onPress={() => setPref("")}
          />
          {langChips.primary.map((code) => (
            <Chip
              key={code}
              label={LANG_LABELS[code]}
              active={pref === code}
              onPress={() => setPref(code)}
            />
          ))}
          {langChips.showRest
            ? langChips.rest.map((code) => (
                <Chip
                  key={code}
                  label={LANG_LABELS[code]}
                  active={pref === code}
                  onPress={() => setPref(code)}
                />
              ))
            : null}
        </View>
        {!langChips.showRest && langChips.rest.length > 0 ? (
          <Pressable
            onPress={() => setMoreLangs(true)}
            style={styles.moreLangsBtn}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.settings.moreLangs", {
              n: langChips.rest.length,
            })}
          >
            <Text style={styles.moreLangsText} importantForAccessibility="no">
              {t("mobile.settings.moreLangs", { n: langChips.rest.length })}
            </Text>
          </Pressable>
        ) : null}
        <Text style={styles.hint}>
          {pref
            ? LANG_LABELS[pref as LangCode] || pref
            : `${t("mobile.lang.auto")} → ${LANG_LABELS[lang]}`}
        </Text>

        <Text style={styles.fieldLabel}>{t("mobile.settings.iAm")}</Text>
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

        <Text style={styles.fieldLabel}>{t("prefs.looking")}</Text>
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

        <Text style={styles.fieldLabel}>{t("settings.hideIp")}</Text>
        <View style={styles.row}>
          <Chip
            label={t("mobile.settings.hideIpOff")}
            active={!prefs.hideIp}
            onPress={() => void setHideIp(false)}
          />
          <Chip
            label={t("mobile.settings.hideIpOn")}
            active={prefs.hideIp}
            onPress={() => void setHideIp(true)}
          />
        </View>
        <Text style={styles.hint}>{t("settings.hideIpHint")}</Text>

        <Text style={styles.fieldLabel}>{t("mobile.settings.dataSaver")}</Text>
        <View style={styles.row}>
          <Chip
            label={t("mobile.settings.dataSaverOff")}
            active={!prefs.dataSaver}
            onPress={() => setPrefs({ ...prefs, dataSaver: false })}
          />
          <Chip
            label={t("mobile.settings.dataSaverOn")}
            active={prefs.dataSaver}
            onPress={() => setPrefs({ ...prefs, dataSaver: true })}
          />
        </View>

        <Text style={styles.fieldLabel}>
          {t("mobile.settings.liveLayout") || "Live layout"}
        </Text>
        <View style={styles.row}>
          <Chip
            label={t("mobile.settings.liveLayoutNative") || "Native call"}
            active={(prefs.liveLayout || "native") === "native"}
            onPress={() =>
              setPrefs({
                ...prefs,
                liveLayout: "native" as LiveLayoutMode,
              })
            }
          />
          <Chip
            label={t("mobile.settings.liveLayoutBrowser") || "Browser style"}
            active={prefs.liveLayout === "browser"}
            onPress={() =>
              setPrefs({
                ...prefs,
                liveLayout: "browser" as LiveLayoutMode,
              })
            }
          />
        </View>
        <Text style={styles.hint}>
          {t("mobile.settings.liveLayoutHint") ||
            "Native: bottom Start/Next/Stop bar. Browser: full-screen video with controls over the stage (like mobile web)."}
        </Text>

        <Text style={styles.fieldLabel}>
          {t("mobile.settings.lastConnect") || "Last connect"}
        </Text>
        <Text style={styles.hint} selectable>
          {lastConnect?.summary
            ? `${lastConnect.summary}${
                lastConnect.at
                  ? ` · ${new Date(lastConnect.at).toLocaleString()}`
                  : ""
              }`
            : t("mobile.settings.lastConnectEmpty") ||
              "No connect yet — complete a match to see offer / answer / frame times."}
        </Text>
        {lastConnect?.firstFrameMs != null || lastConnect?.offerMs != null ? (
          <Text style={styles.hint}>
            {[
              lastConnect.offerMs != null
                ? `offer ${lastConnect.offerMs}ms`
                : null,
              lastConnect.answerMs != null
                ? `answer ${lastConnect.answerMs}ms`
                : null,
              lastConnect.iceMs != null ? `ice ${lastConnect.iceMs}ms` : null,
              lastConnect.firstFrameMs != null
                ? `frame ${lastConnect.firstFrameMs}ms`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}

        <Text style={styles.fieldLabel}>
          {t("mobile.settings.blurStrangers")}
        </Text>
        <View style={styles.row}>
          <Chip
            label={t("mobile.settings.blurModeOff")}
            active={(prefs.blurStrangersMode || "intro") === "off"}
            onPress={() => {
              void setBlurMode("off");
            }}
          />
          <Chip
            label={t("mobile.settings.blurModeIntro")}
            active={(prefs.blurStrangersMode || "intro") === "intro"}
            onPress={() => {
              void setBlurMode("intro");
            }}
          />
          <Chip
            label={t("mobile.settings.blurModeHold")}
            active={(prefs.blurStrangersMode || "intro") === "hold"}
            onPress={() => {
              void setBlurMode("hold");
            }}
          />
        </View>
        <Text style={styles.hint}>{t("mobile.settings.blurStrangersHint")}</Text>

        <Text style={styles.fieldLabel}>
          {t("mobile.settings.historySnaps")}
        </Text>
        <View style={styles.row}>
          <Chip
            label={t("mobile.settings.historySnapsOn")}
            active={prefs.historySnaps !== false}
            onPress={() => setPrefs({ ...prefs, historySnaps: true })}
          />
          <Chip
            label={t("mobile.settings.historySnapsOff")}
            active={prefs.historySnaps === false}
            onPress={() => setPrefs({ ...prefs, historySnaps: false })}
          />
        </View>
        <Text style={styles.hint}>{t("mobile.settings.historySnapsHint")}</Text>

        <Pressable
          style={styles.cta}
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            saved ? t("mobile.settings.saved") : t("mobile.settings.save")
          }
        >
          <Text style={styles.ctaText}>
            {saved ? t("mobile.settings.saved") : t("mobile.settings.save")}
          </Text>
        </Pressable>
      </Section>

      {/* ── Sounds & alerts ── */}
      <Section
        title={t("mobile.settings.secAlerts")}
        subtitle={t("mobile.settings.secAlertsSub")}
        open={openSec.alerts}
        onToggle={() => toggleSec("alerts")}
      >
        <Text style={styles.fieldLabel}>{t("mobile.settings.uiSounds")}</Text>
        <View style={styles.row}>
          <Chip
            label={t("mobile.settings.uiSoundsOn")}
            active={uiSounds}
            onPress={() => {
              setUiSounds(true);
              void setSoundPref(true);
            }}
          />
          <Chip
            label={t("mobile.settings.uiSoundsOff")}
            active={!uiSounds}
            onPress={() => {
              setUiSounds(false);
              void setSoundPref(false);
            }}
          />
        </View>
        <Text style={styles.hint}>{t("mobile.settings.uiSoundsHint")}</Text>

        <Text style={styles.fieldLabel}>{t("mobile.settings.notifyCalls")}</Text>
        <View style={styles.row}>
          <Chip
            label={t("mobile.settings.notifyOn")}
            active={prefs.notifyFriendCalls}
            onPress={() => setPrefs({ ...prefs, notifyFriendCalls: true })}
          />
          <Chip
            label={t("mobile.settings.notifyOff")}
            active={!prefs.notifyFriendCalls}
            onPress={() => setPrefs({ ...prefs, notifyFriendCalls: false })}
          />
        </View>
        <Text style={styles.hint}>{t("mobile.settings.notifyHint")}</Text>

        {/* One place for offline rings: push + OS notif + battery (Android) */}
        <View style={styles.alertGuide}>
          <Text style={styles.alertGuideTitle}>
            {t("mobile.settings.callAlertsGuideTitle")}
          </Text>
          <Text style={styles.hint}>{t("mobile.settings.pushBatteryTip")}</Text>
          {pushModuleAvailable() ? (
            <Pressable
              style={styles.secondary}
              onPress={async () => {
                if (!prefs) return;
                // Turn preference on when user actively registers
                if (!prefs.notifyFriendCalls) {
                  setPrefs({ ...prefs, notifyFriendCalls: true });
                }
                const r = await tryRegisterPush(hub, true);
                if (r.ok) {
                  setPushStatus(t("mobile.settings.pushOk"));
                  showToast(t("mobile.settings.pushOk"));
                } else {
                  const msg = t("mobile.settings.pushFail", {
                    reason: r.reason,
                  });
                  setPushStatus(msg);
                  showToast(msg);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.settings.pushRegister")}
            >
              <Text style={styles.secondaryText} importantForAccessibility="no">
                {t("mobile.settings.pushRegister")}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.metaInline}>
              {t("mobile.settings.pushUnavailable")}
            </Text>
          )}
          <Pressable
            style={styles.secondary}
            onPress={() => {
              void Linking.openSettings().catch(() => {});
            }}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.settings.openNotifSettings")}
          >
            <Text style={styles.secondaryText} importantForAccessibility="no">
              {t("mobile.settings.openNotifSettings")}
            </Text>
          </Pressable>
          {Platform.OS === "android" ? (
            <Pressable
              style={styles.secondary}
              onPress={() => {
                void openBatterySettings().then((ok) => {
                  if (ok) {
                    showToast(t("mobile.settings.batteryOpened"));
                  }
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.settings.openBattery")}
            >
              <Text style={styles.secondaryText} importantForAccessibility="no">
                {t("mobile.settings.openBattery")}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {pushStatus ? (
          <Text style={styles.metaInline}>{pushStatus}</Text>
        ) : null}
        <Pressable
          style={styles.cta}
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            saved ? t("mobile.settings.saved") : t("mobile.settings.save")
          }
        >
          <Text style={styles.ctaText}>
            {saved ? t("mobile.settings.saved") : t("mobile.settings.save")}
          </Text>
        </Pressable>
      </Section>

      {/* ── Hub ── */}
      <Section
        title={t("mobile.settings.hubSection")}
        subtitle={`${hubHost} · ${
          connected
            ? t("mobile.settings.hubOnline")
            : t("mobile.settings.hubOffline")
        }`}
        open={openSec.hub}
        onToggle={() => toggleSec("hub")}
        badge={connected ? "●" : "○"}
      >
      <Text style={styles.hint}>
        {t("mobile.settings.hubHint", {
          hub: hubHost,
          status: connected
            ? t("mobile.settings.hubOnline")
            : t("mobile.settings.hubOffline"),
        })}
      </Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.secondary, styles.hubBtn]}
          onPress={() => {
            reconnectHub();
            showToast(t("mobile.settings.hubReconnecting"));
          }}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.settings.hubReconnect")}
        >
          <Text style={styles.secondaryText} importantForAccessibility="no">
            {t("mobile.settings.hubReconnect")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, styles.hubBtn]}
          onPress={() => void refreshHubs()}
          disabled={hubBusy}
          accessibilityRole="button"
          accessibilityLabel={
            hubBusy
              ? t("mobile.common.loading")
              : t("mobile.settings.hubProbe")
          }
          accessibilityState={{ disabled: hubBusy, busy: hubBusy }}
        >
          <Text style={styles.secondaryText} importantForAccessibility="no">
            {hubBusy
              ? t("mobile.common.loading")
              : t("mobile.settings.hubProbe")}
          </Text>
        </Pressable>
      </View>
      {hubRows.map((row) => {
        const host = row.base.replace(/^https?:\/\//, "");
        const active =
          normalizeBase(hubBaseUrl || hubBase()) === normalizeBase(row.base);
        const health =
          row.ok === true
            ? t("mobile.settings.hubHealthy")
            : row.ok === false
              ? t("mobile.settings.hubDown")
              : t("mobile.common.loading");
        return (
          <Pressable
            key={row.base}
            style={[styles.hubRow, active && styles.hubRowOn]}
            onPress={async () => {
              if (active) return;
              if (row.ok === false) {
                Alert.alert(
                  t("mobile.settings.hubUnhealthyTitle"),
                  t("mobile.settings.hubUnhealthyBody", { hub: host }),
                  [
                    { text: t("mobile.common.cancel"), style: "cancel" },
                    {
                      text: t("mobile.settings.hubUseAnyway"),
                      onPress: async () => {
                        await switchHub(row.base);
                        showToast(
                          t("mobile.toast.hubSwitched", { hub: host })
                        );
                      },
                    },
                  ]
                );
                return;
              }
              await switchHub(row.base);
              showToast(t("mobile.toast.hubSwitched", { hub: host }));
            }}
            accessibilityRole="button"
            accessibilityLabel={`${host}. ${health}${
              active ? `. ${t("mobile.settings.hubActive")}` : ""
            }`}
            accessibilityState={{ selected: active }}
          >
            <Text
              style={styles.hubHost}
              numberOfLines={1}
              importantForAccessibility="no"
            >
              {host}
              {active ? ` · ${t("mobile.settings.hubActive")}` : ""}
            </Text>
            <Text
              style={[
                styles.hubOk,
                row.ok === true && styles.hubOkYes,
                row.ok === false && styles.hubOkNo,
              ]}
              importantForAccessibility="no"
            >
              {health}
            </Text>
          </Pressable>
        );
      })}
      </Section>

      {/* ── Blocked & reports ── */}
      <Section
        title={t("mobile.settings.secMod")}
        subtitle={t("mobile.settings.secModSub", {
          blocked: blocked.length,
          reports: reports.length,
        })}
        open={openSec.mod}
        onToggle={() => toggleSec("mod")}
        badge={
          blocked.length + reports.length > 0
            ? String(blocked.length + reports.length)
            : undefined
        }
      >
        <Text style={styles.fieldLabel}>
          {t("mobile.settings.blockedSection")}
        </Text>
        <Text style={styles.hint}>{t("mobile.settings.blockedHint")}</Text>
        {blocked.length === 0 ? (
          <Text style={styles.metaInline}>
            {t("mobile.settings.blockedEmpty")}
          </Text>
        ) : (
          blocked.map((b) => {
            const thumb = blockedThumbs[b.user_id];
            const letter =
              (b.name || b.user_id || "?").trim().charAt(0).toUpperCase() ||
              "?";
            return (
              <View key={b.user_id} style={styles.blockRow}>
                {thumb ? (
                  <Image
                    source={{ uri: thumb }}
                    style={styles.blockThumbBlur}
                    blurRadius={Platform.OS === "ios" ? 16 : 12}
                    accessibilityLabel={t("mobile.history.thumbOnDevice")}
                  />
                ) : (
                  <View style={styles.blockThumbLetter}>
                    <Text style={styles.blockThumbLetterText}>{letter}</Text>
                  </View>
                )}
                <View style={styles.blockMeta}>
                  <Text style={styles.blockName} numberOfLines={1}>
                    {b.name || b.user_id.slice(0, 8)}
                  </Text>
                  <Text style={styles.blockId}>{b.user_id.slice(0, 12)}…</Text>
                </View>
                <Pressable
                  style={styles.unblockBtn}
                  onPress={() => unblock(b.user_id)}
                >
                  <Text style={styles.unblockText}>
                    {t("mobile.settings.unblockBtn")}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
          {t("mobile.settings.reportHistory")}
        </Text>
        <Text style={styles.hint}>{t("mobile.settings.reportHistoryHint")}</Text>
        {reports.length === 0 ? (
          <Text style={styles.metaInline}>
            {t("mobile.settings.reportHistoryEmpty")}
          </Text>
        ) : (
          <>
            {reports.slice(0, 15).map((r) => (
              <View key={r.id} style={styles.blockRow}>
                <View style={styles.blockMeta}>
                  <Text style={styles.blockName} numberOfLines={1}>
                    {r.kind === "report" ? "⚑ " : "⊘ "}
                    {r.name}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </Text>
                  <Text style={styles.blockId}>
                    {new Date(r.t).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
            <Pressable
              style={styles.secondary}
              onPress={() => {
                clearReportHistory().then(() => setReports([]));
              }}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>
                {t("mobile.settings.reportHistoryClear")}
              </Text>
            </Pressable>
          </>
        )}
      </Section>

      {/* ── Backup ── */}
      <Section
        title={t("mobile.settings.backup")}
        subtitle={t("mobile.settings.secBackupSub")}
        open={openSec.backup}
        onToggle={() => toggleSec("backup")}
      >
        <Text style={styles.hint}>
          {t("mobile.settings.backupHint", { stars })}
        </Text>
        <Text style={styles.fieldLabel}>{t("mobile.settings.exportBtn")}</Text>
        <TextInput
          style={styles.input}
          value={exportPw}
          onChangeText={setExportPw}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t("mobile.settings.exportPw")}
          placeholderTextColor="#6b7a90"
          accessibilityLabel={t("mobile.settings.exportPw")}
        />
        <Pressable
          style={styles.secondary}
          onPress={exportBackup}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.settings.exportBtn")}
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.secondaryText}>
            {t("mobile.settings.exportBtn")}
          </Text>
        </Pressable>

        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
          {t("mobile.settings.importBtn")}
        </Text>
        <Text style={styles.hint}>{t("mobile.settings.importPwHint")}</Text>
        <TextInput
          style={styles.input}
          value={importPw}
          onChangeText={setImportPw}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t("mobile.settings.importPw")}
          placeholderTextColor="#6b7a90"
          accessibilityLabel={t("mobile.settings.importPw")}
        />
        <Pressable
          style={styles.secondary}
          onPress={importBackup}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.settings.importBtn")}
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.secondaryText}>
            {t("mobile.settings.importBtn")}
          </Text>
        </Pressable>
      </Section>

      {/* ── Safety & legal ── */}
      <Section
        title={t("mobile.settings.secSafety")}
        subtitle={t("mobile.settings.secSafetySub")}
        open={openSec.safety}
        onToggle={() => toggleSec("safety")}
      >
        <View style={styles.safetyCard}>
          <Text style={styles.safetyLine}>• {t("mobile.safety.tip1")}</Text>
          <Text style={styles.safetyLine}>• {t("mobile.safety.tip2")}</Text>
          <Text style={styles.safetyLine}>• {t("mobile.safety.tip3")}</Text>
          <Text style={styles.safetyLine}>• {t("mobile.safety.tip4")}</Text>
          <Text style={styles.safetyLine}>• {t("mobile.safety.tipCsae")}</Text>
        </View>
        {(
          [
            [t("mobile.safety.openPage"), () => safetyToolsUrl()],
            [t("mobile.safety.childStandards"), () => childSafetyUrl()],
            [
              t("mobile.safety.reportChild"),
              () => childSafetyReportMailto(),
              "✉",
            ],
            [
              t("mobile.safety.deleteCta"),
              () => `${hubBase()}/legal/delete.html`,
            ],
            [t("nav.privacy"), () => `${hubBase()}/legal/privacy.html`],
            [t("nav.terms"), () => `${hubBase()}/legal/terms.html`],
            [t("nav.eula"), () => `${hubBase()}/legal/eula.html`],
            [t("nav.community"), () => `${hubBase()}/legal/community.html`],
          ] as [string, () => string, string?][]
        ).map(([label, urlFn, chev]) => (
          <Pressable
            key={label}
            style={styles.linkRow}
            onPress={() => {
              const url = urlFn();
              Linking.openURL(url).catch(() => Alert.alert(label, url));
            }}
            accessibilityRole="link"
            accessibilityLabel={label}
          >
            <Text style={styles.linkText} importantForAccessibility="no">
              {label}
            </Text>
            <Text style={styles.linkChevron} importantForAccessibility="no">
              {chev || "↗"}
            </Text>
          </Pressable>
        ))}
      </Section>

      {/* ── About ── */}
      <Section
        title={t("mobile.settings.about")}
        subtitle={buildLabel()}
        open={openSec.about}
        onToggle={() => toggleSec("about")}
      >
        {Platform.OS === "android" ? (
          <Pressable
            style={styles.linkRow}
            onPress={async () => {
              const r = await requestHomePinOnce({
                force: true,
                shortLabel: t("mobile.shortcut.short"),
                longLabel: t("mobile.shortcut.long"),
              });
              hapticLight();
              if (!r.supported) {
                showToast(t("mobile.settings.pinUnsupported"));
              } else if (r.ok) {
                showToast(t("mobile.settings.pinOk"));
              } else {
                showToast(t("mobile.settings.pinHint"));
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.settings.pinHome")}
          >
            <Text style={styles.linkText} importantForAccessibility="no">
              {t("mobile.settings.pinHome")}
            </Text>
            <Text style={styles.linkChevron} importantForAccessibility="no">
              +
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.linkRow}
          onPress={() => {
            hapticLight();
            setPcSheetOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.settings.openOnPc")}
        >
          <Text style={styles.linkText} importantForAccessibility="no">
            {t("mobile.settings.openOnPc")}
          </Text>
          <Text style={styles.linkChevron} importantForAccessibility="no">
            ↗
          </Text>
        </Pressable>
        <Pressable
          style={styles.linkRow}
          onPress={() => {
            const msg = t("mobile.settings.shareAppBody", {
              url: "https://ruletka.vip",
              code: friendCode || "…",
            });
            Share.share({ message: msg, title: "ruletka" }).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.settings.shareApp")}
        >
          <Text style={styles.linkText} importantForAccessibility="no">
            {t("mobile.settings.shareApp")}
          </Text>
          <Text style={styles.linkChevron} importantForAccessibility="no">
            ↗
          </Text>
        </Pressable>
        <Pressable
          style={styles.linkRow}
          onPress={async () => {
            const em = supportEmail();
            try {
              await Clipboard.setStringAsync(em);
              showToast(t("mobile.settings.supportCopied", { email: em }));
            } catch {
              Linking.openURL(`mailto:${em}`).catch(() => {});
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.settings.copySupport", {
            email: supportEmail(),
          })}
        >
          <Text style={styles.linkText} importantForAccessibility="no">
            {t("mobile.settings.copySupport", { email: supportEmail() })}
          </Text>
          <Text style={styles.linkChevron} importantForAccessibility="no">
            ⎘
          </Text>
        </Pressable>
        <Pressable
          onLongPress={async () => {
            const label = buildLabel();
            try {
              await Clipboard.setStringAsync(label);
              showToast(t("mobile.settings.buildCopied", { build: label }));
              hapticLight();
            } catch {
              /* ignore */
            }
          }}
          delayLongPress={400}
          style={styles.buildBox}
          accessibilityRole="button"
          accessibilityLabel={buildLabel()}
          accessibilityHint={t("mobile.settings.buildCopyHint")}
        >
          <Text style={styles.buildText}>
            {t("mobile.settings.userMeta", {
              id: identity.user_id.slice(0, 12),
              hub: hubHost,
            })}
            {"\n"}
            {buildLabel()}
            {isFriendsOnly()
              ? ` · ${t("mobile.settings.friendsOnlyTag")}`
              : ""}
            {" · "}
            {connected
              ? t("mobile.settings.hubOnline")
              : t("mobile.settings.hubOffline")}
            {"\n"}
            {t("mobile.settings.buildCopyHint")}
            {__DEV__
              ? `\nprojectId: ${String(
                  (
                    Constants.expoConfig?.extra as {
                      eas?: { projectId?: string };
                    }
                  )?.eas?.projectId || "—"
                )}`
              : ""}
          </Text>
        </Pressable>
      </Section>

      <View style={{ height: 32 }} />
    </ScrollView>
    <OpenOnPcSheet
      visible={pcSheetOpen}
      onClose={() => setPcSheetOpen(false)}
      url="https://ruletka.vip"
      code={friendCode || undefined}
    />
    </>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12, paddingBottom: 40 },
  meta: { color: "#6b7a90", fontSize: 11, marginTop: 12, marginBottom: 24 },
  metaInline: { color: "#6b7a90", fontSize: 12, marginTop: 4 },
  hint: { color: "#6b7a90", fontSize: 12, lineHeight: 17 },
  fieldLabel: {
    color: "#c5d0e0",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 4,
  },
  alertGuide: {
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    gap: 8,
    backgroundColor: "rgba(61,126,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(100,160,255,0.28)",
  },
  alertGuideTitle: {
    color: "#c8dcff",
    fontWeight: "800",
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardHeadText: { flex: 1, gap: 3 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTitle: { color: "#e8eef7", fontWeight: "800", fontSize: 16 },
  cardSub: { color: "#7a889c", fontSize: 12, lineHeight: 16 },
  cardBadge: {
    backgroundColor: "rgba(255,45,85,0.22)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,80,100,0.35)",
  },
  cardBadgeText: { color: "#ffb0bc", fontSize: 11, fontWeight: "800" },
  cardChevron: {
    color: "#9aa8bc",
    fontSize: 18,
    fontWeight: "700",
    width: 22,
    textAlign: "center",
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 12,
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
  moreLangsBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  moreLangsText: { color: "#9ec5ff", fontWeight: "700", fontSize: 13 },
  cta: {
    marginTop: 8,
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
  hubBtn: { flex: 1, minWidth: 120 },
  hubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  hubRowOn: {
    borderColor: "rgba(61,126,255,0.55)",
    backgroundColor: "rgba(40,70,120,0.35)",
  },
  hubHost: { color: "#e8eef7", fontWeight: "600", fontSize: 13, flex: 1 },
  hubOk: { color: "#6b7a90", fontSize: 12, fontWeight: "700" },
  hubOkYes: { color: "#6dffa8" },
  hubOkNo: { color: "#ff8fab" },
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
  linkText: { color: "#c5d0e0", fontWeight: "600", fontSize: 14, flex: 1 },
  linkChevron: { color: "#6b7a90", fontSize: 14, marginLeft: 8 },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  /** On-device partner snap, always blurred on Blocked list */
  blockThumbBlur: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#1a1216",
    borderWidth: 2,
    borderColor: "rgba(255,90,110,0.55)",
  },
  blockThumbLetter: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#1a1520",
    borderWidth: 2,
    borderColor: "rgba(255,90,110,0.4)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.8,
  },
  blockThumbLetterText: {
    color: "#b09098",
    fontWeight: "700",
    fontSize: 15,
  },
  blockMeta: { flex: 1, gap: 2 },
  blockName: { color: "#e8eef7", fontWeight: "700", fontSize: 14 },
  blockId: { color: "#6b7a90", fontSize: 11, fontFamily: "monospace" },
  unblockBtn: {
    backgroundColor: "rgba(61,126,255,0.35)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  unblockText: { color: "#c8dcff", fontWeight: "700", fontSize: 12 },
  safetyCard: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,45,85,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,80,100,0.25)",
  },
  safetyLine: { color: "#e0c8cc", fontSize: 13, lineHeight: 19 },
  repRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  repChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  repKnown: {
    borderColor: "rgba(100,160,255,0.45)",
    backgroundColor: "rgba(20,36,60,0.55)",
  },
  repTrusted: {
    borderColor: "rgba(80,220,160,0.5)",
    backgroundColor: "rgba(12,40,32,0.55)",
  },
  repSenior: {
    borderColor: "rgba(255,180,60,0.6)",
    backgroundColor: "rgba(50,36,8,0.6)",
  },
  repStars: {
    backgroundColor: "rgba(40,32,8,0.65)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,200,80,0.4)",
  },
  repChipText: { color: "#e8eef7", fontSize: 12, fontWeight: "800" },
  buildBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  buildText: { color: "#6b7a90", fontSize: 11, lineHeight: 16 },
});
