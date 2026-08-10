// Must be first — enables react-navigation / expo-router gestures
import "react-native-gesture-handler";

import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { track } from "../src/analytics/track";
import { ErrorBoundary } from "../src/boot/ErrorBoundary";
import {
  hapticMatch,
  startIncomingRing,
  stopRing,
} from "../src/feedback/haptics";
import { loadSoundPref } from "../src/feedback/audioSession";
import {
  enterCallAudio,
  preloadUiSounds,
  startRingtone,
  stopRingtone,
} from "../src/feedback/sounds";
import { HubProvider, useHub } from "../src/hub/HubProvider";
import {
  loadOrCreateIdentity,
  rulesAccepted,
  type LocalIdentity,
} from "../src/identity/store";
import { I18nProvider, useI18n, useT } from "../src/i18n";
import { FriendInviteHandler } from "../src/linking/FriendInviteHandler";
import { dismissLocalCallAlert } from "../src/push/localCallAlert";
import { attachPushResponseListener } from "../src/push/listeners";
import {
  clearPendingCallFromPush,
  getPendingCallFromPush,
  subscribePendingCallFromPush,
  type PendingCallFromPush,
} from "../src/push/pendingCall";

// Catch unhandled JS exceptions in release (otherwise app can just vanish)
try {
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (e: Error, isFatal?: boolean) => void;
      setGlobalHandler?: (fn: (e: Error, isFatal?: boolean) => void) => void;
    };
  };
  const EU = g.ErrorUtils;
  if (EU?.setGlobalHandler) {
    const prev = EU.getGlobalHandler?.();
    EU.setGlobalHandler((error, isFatal) => {
      try {
        console.error("[JS]", isFatal ? "FATAL" : "error", error?.message || error);
      } catch {
        /* ignore */
      }
      try {
        prev?.(error, isFatal);
      } catch {
        /* ignore */
      }
    });
  }
} catch {
  /* ignore */
}

export type AppContext = {
  identity: LocalIdentity;
  rulesOk: boolean;
  refreshRules: () => Promise<void>;
  setIdentityName: (name: string) => void;
  /** Swap full identity (import) — remounts hub via key change. */
  replaceAppIdentity: (id: LocalIdentity) => void;
};

export const AppCtx = createContext<AppContext | null>(null);

export function useApp(): AppContext {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

function CallBanners() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 12) + 8;
  const {
    incomingCall,
    outboundCall,
    hub,
    clearIncomingCall,
    setOutboundCall,
    toast,
    toastOpenUserId,
    clearToast,
    openFriendChat,
    connected,
    recordNoAnswer,
    cancelOutboundCall,
    noAnswerPrompt,
    clearNoAnswerPrompt,
    ratePrompt,
    clearRatePrompt,
    findThirdIncoming,
    clearFindThirdIncoming,
    reconnectHub,
    friends,
  } = useHub();
  // Avoid flashing "reconnecting" on cold start before first hello
  const [sawOnline, setSawOnline] = useState(false);
  const [ringSecs, setRingSecs] = useState(0);
  const [pendingPush, setPendingPush] = useState<PendingCallFromPush | null>(
    () => getPendingCallFromPush()
  );
  useEffect(() => {
    if (connected) setSawOnline(true);
  }, [connected]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 4000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  // Push cold-start banner until real call_incoming arrives
  useEffect(() => {
    return subscribePendingCallFromPush((p) => {
      setPendingPush(p);
    });
  }, []);
  useEffect(() => {
    if (incomingCall) {
      clearPendingCallFromPush();
      setPendingPush(null);
    }
  }, [incomingCall?.from_user_id]);

  // Repeating ring vibe while friend is calling
  useEffect(() => {
    if (!incomingCall) {
      stopRing();
      return;
    }
    startIncomingRing();
    void dismissLocalCallAlert(); // in-app UI owns the ring now
    return () => stopRing();
  }, [incomingCall?.from_user_id]);

  // Soft ringback while outbound call waits
  useEffect(() => {
    if (!outboundCall || incomingCall) {
      void stopRingtone();
      return;
    }
    void startRingtone();
    return () => {
      void stopRingtone();
    };
  }, [outboundCall?.user_id, incomingCall?.from_user_id]);

  // Keep screen on while ringing (incoming or outbound)
  useEffect(() => {
    const ringing = !!(incomingCall || outboundCall);
    const tag = "ruletka-call-ring";
    if (ringing) {
      activateKeepAwakeAsync(tag).catch(() => {});
      return () => {
        try {
          deactivateKeepAwake(tag);
        } catch {
          /* ignore */
        }
      };
    }
    return undefined;
  }, [incomingCall?.from_user_id, outboundCall?.user_id]);

  // Ring elapsed seconds for UI
  useEffect(() => {
    if (!incomingCall && !outboundCall) {
      setRingSecs(0);
      return;
    }
    setRingSecs(0);
    const tmr = setInterval(() => setRingSecs((s) => s + 1), 1000);
    return () => clearInterval(tmr);
  }, [incomingCall?.from_user_id, outboundCall?.user_id]);

  // Outbound ring timeout (30s) — matches web no-answer path + Call back banner
  useEffect(() => {
    if (!outboundCall || incomingCall) return;
    const peer = outboundCall;
    const timer = setTimeout(() => {
      try {
        hub.callCancel(peer.user_id);
      } catch {
        /* ignore */
      }
      recordNoAnswer(peer);
      setOutboundCall(null);
      void stopRingtone();
    }, 30_000);
    return () => clearTimeout(timer);
  }, [outboundCall, incomingCall, hub, recordNoAnswer, setOutboundCall]);

  // Soft haptic when rate sheet appears after a long chat
  useEffect(() => {
    if (!ratePrompt) return;
    hapticMatch();
  }, [ratePrompt?.user_id]);

  return (
    <>
      {!connected && sawOnline ? (
        <View style={[bannerStyles.strip, { paddingTop: Math.max(insets.top, 4) }]}>
          <Text style={bannerStyles.stripText}>{t("mobile.reconnect")}</Text>
        </View>
      ) : null}

      {toast ? (
        <Pressable
          style={[bannerStyles.toast, { top: topPad }]}
          onPress={() => {
            const openId = toastOpenUserId;
            clearToast();
            if (openId) {
              openFriendChat(openId);
              try {
                router.push("/friends");
              } catch {
                /* ignore */
              }
            }
          }}
        >
          <Text style={bannerStyles.toastText}>{toast}</Text>
          {toastOpenUserId ? (
            <Text style={bannerStyles.toastHint}>
              {t("mobile.toast.tapOpenChat")}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {/* Waiting for hub ring after opening from offline push */}
      {pendingPush && !incomingCall && !outboundCall ? (
        <View style={[bannerStyles.outgoing, { top: topPad }]}>
          <Text style={bannerStyles.incomingTitle}>
            {t("mobile.call.pushWaitingTitle")}
          </Text>
          <Text style={bannerStyles.incomingBody}>
            {pendingPush.fromName}
          </Text>
          <Text style={bannerStyles.incomingHint}>
            {connected
              ? t("mobile.call.pushWaitingBody")
              : t("mobile.call.pushWaitingReconnect")}
          </Text>
          <View style={bannerStyles.row}>
            <Pressable
              style={bannerStyles.decline}
              onPress={() => {
                clearPendingCallFromPush();
                setPendingPush(null);
              }}
            >
              <Text style={bannerStyles.btnText}>{t("mobile.common.dismiss")}</Text>
            </Pressable>
            {!connected ? (
              <Pressable
                style={bannerStyles.accept}
                onPress={() => {
                  reconnectHub();
                }}
              >
                <Text style={bannerStyles.btnText}>
                  {t("mobile.settings.hubReconnect")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {incomingCall ? (
        <View style={bannerStyles.incomingScrim} pointerEvents="box-none">
          <View style={[bannerStyles.incoming, { marginTop: topPad }]}>
            <Text style={bannerStyles.incomingPulse}>●</Text>
            <Text style={bannerStyles.incomingTitle}>
              {incomingCall.join
                ? t("mobile.call.joinTitle")
                : t("mobile.call.incoming")}
            </Text>
            <Text style={bannerStyles.incomingBody}>
              {incomingCall.from_name || incomingCall.from_short || "Friend"}
            </Text>
            {ringSecs > 0 ? (
              <Text style={bannerStyles.incomingCode}>
                {t("mobile.call.ringingFor", { s: ringSecs })}
              </Text>
            ) : null}
            {incomingCall.join ? (
              <Text style={bannerStyles.incomingHint}>
                {t("mobile.call.joinHint", {
                  with:
                    incomingCall.with_name ||
                    (incomingCall.with_user_id || "").slice(0, 8) ||
                    "…",
                })}
              </Text>
            ) : (
              <Text style={bannerStyles.incomingHint}>
                {t("mobile.call.ringHint")}
              </Text>
            )}
            {incomingCall.from_code ? (
              <Text style={bannerStyles.incomingCode}>
                {t("mobile.friends.yourCode")} {incomingCall.from_code}
              </Text>
            ) : null}
            {!connected ? (
              <Text style={bannerStyles.incomingHint}>
                {t("mobile.call.answerNeedsHub")}
              </Text>
            ) : null}
            <View style={bannerStyles.row}>
              <Pressable
                style={bannerStyles.decline}
                onPress={() => {
                  stopRing();
                  void dismissLocalCallAlert();
                  try {
                    hub.callRespond(incomingCall.from_user_id, false);
                  } catch {
                    /* ignore */
                  }
                  clearIncomingCall();
                }}
              >
                <Text style={bannerStyles.btnText}>{t("friends.decline")}</Text>
              </Pressable>
              <Pressable
                style={bannerStyles.accept}
                onPress={() => {
                  stopRing();
                  void dismissLocalCallAlert();
                  void enterCallAudio();
                  if (!connected) {
                    reconnectHub();
                  }
                  try {
                    hub.callRespond(incomingCall.from_user_id, true);
                  } catch {
                    /* ignore */
                  }
                  clearIncomingCall();
                  // MediaSession only mounts on Live — open it so A/V starts
                  try {
                    router.replace("/live");
                  } catch {
                    try {
                      router.push("/live");
                    } catch {
                      /* ignore */
                    }
                  }
                }}
              >
                <Text style={bannerStyles.btnText}>
                  {incomingCall.join
                    ? t("mobile.call.join")
                    : t("mobile.call.answer")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {outboundCall && !incomingCall ? (
        <View style={[bannerStyles.outgoing, { top: topPad }]}>
          <Text style={bannerStyles.incomingPulse}>●</Text>
          <Text style={bannerStyles.incomingTitle}>
            {outboundCall.join
              ? t("mobile.call.invitingJoin")
              : t("mobile.call.calling")}
          </Text>
          <Text style={bannerStyles.incomingBody}>{outboundCall.name}</Text>
          {ringSecs > 0 ? (
            <Text style={bannerStyles.incomingCode}>
              {t("mobile.call.ringingFor", { s: ringSecs })}
            </Text>
          ) : null}
          <Text style={bannerStyles.incomingHint}>
            {outboundCall.join
              ? t("mobile.call.invitingJoinHint")
              : t("mobile.call.callingHint")}
          </Text>
          <Pressable
            style={bannerStyles.decline}
            onPress={() => {
              void stopRingtone();
              cancelOutboundCall();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.call.cancel")}
          >
            <Text style={bannerStyles.btnText}>{t("mobile.call.cancel")}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* No answer — Call back (web parity) */}
      {noAnswerPrompt && !outboundCall && !incomingCall ? (
        <View style={[bannerStyles.outgoing, bannerStyles.noAnswer, { top: topPad }]}>
          <Text style={bannerStyles.incomingTitle}>
            {t("mobile.call.noAnswerTitle")}
          </Text>
          <Text style={bannerStyles.incomingBody}>{noAnswerPrompt.name}</Text>
          <Text style={bannerStyles.incomingHint}>
            {friends.some(
              (f) => f.user_id === noAnswerPrompt.user_id && f.online
            )
              ? t("mobile.call.noAnswerBodyOnline", {
                  name: noAnswerPrompt.name,
                })
              : t("mobile.call.noAnswerBody", {
                  name: noAnswerPrompt.name,
                })}
          </Text>
          <View style={bannerStyles.row}>
            <Pressable
              style={bannerStyles.decline}
              onPress={() => clearNoAnswerPrompt()}
            >
              <Text style={bannerStyles.btnText}>
                {t("mobile.common.dismiss")}
              </Text>
            </Pressable>
            <Pressable
              style={bannerStyles.accept}
              onPress={() => {
                const peer = noAnswerPrompt;
                clearNoAnswerPrompt();
                setOutboundCall({
                  user_id: peer.user_id,
                  name: peer.name,
                  join: false,
                });
                try {
                  hub.callFriend(peer.user_id, { join: false });
                } catch {
                  /* ignore */
                }
                try {
                  router.push("/live");
                } catch {
                  /* ignore */
                }
              }}
            >
              <Text style={bannerStyles.btnText}>
                {t("mobile.call.redial")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {findThirdIncoming && !incomingCall ? (
        <View style={bannerStyles.incomingScrim} pointerEvents="box-none">
          <View style={[bannerStyles.incoming, { marginTop: topPad }]}>
            <Text style={bannerStyles.incomingTitle}>
              {t("mobile.party.findThirdTitle")}
            </Text>
            <Text style={bannerStyles.incomingBody}>
              {findThirdIncoming.from_name || "Partner"}
            </Text>
            <Text style={bannerStyles.incomingHint}>
              {t("mobile.party.findThirdBody")}
            </Text>
            <View style={bannerStyles.row}>
              <Pressable
                style={bannerStyles.decline}
                onPress={() => {
                  try {
                    hub.findThirdRespond(false);
                  } catch {
                    /* ignore */
                  }
                  clearFindThirdIncoming();
                }}
              >
                <Text style={bannerStyles.btnText}>{t("friends.decline")}</Text>
              </Pressable>
              <Pressable
                style={bannerStyles.accept}
                onPress={() => {
                  try {
                    hub.findThirdRespond(true);
                  } catch {
                    /* ignore */
                  }
                  clearFindThirdIncoming();
                  try {
                    router.push("/live");
                  } catch {
                    /* ignore */
                  }
                }}
              >
                <Text style={bannerStyles.btnText}>
                  {t("mobile.party.findThirdAccept")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Rate partner after long chat — global so it works even if user left Live */}
      {ratePrompt && !incomingCall ? (
        <View style={bannerStyles.rateScrim} pointerEvents="box-none">
          <View style={[bannerStyles.rateCard, { marginTop: topPad }]}>
            <Text style={bannerStyles.rateTitle}>
              {t("mobile.live.rateTitle", { name: ratePrompt.name })}
            </Text>
            {ratePrompt.early ? (
              <Text style={bannerStyles.rateEarly}>
                {t("mobile.live.rateEarly")}
              </Text>
            ) : null}
            <Text style={bannerStyles.rateBody}>
              {t("mobile.live.rateBody", {
                m: Math.max(
                  1,
                  Math.floor(ratePrompt.duration_secs / 60)
                ),
                max: ratePrompt.max_gift,
              })}
            </Text>
            <Text style={bannerStyles.rateHint}>
              {t("mobile.live.rateHint")}
            </Text>
            <View style={bannerStyles.row}>
              {Array.from({ length: ratePrompt.max_gift }, (_, i) => i + 1).map(
                (n) => (
                  <Pressable
                    key={n}
                    style={bannerStyles.rateGift}
                    onPress={() => {
                      try {
                        hub.ratePartner(ratePrompt.user_id, true, n);
                      } catch {
                        /* ignore */
                      }
                      clearRatePrompt();
                    }}
                  >
                    <Text style={bannerStyles.btnText}>★{n}</Text>
                  </Pressable>
                )
              )}
              <Pressable
                style={bannerStyles.rateThanks}
                onPress={() => {
                  try {
                    hub.ratePartner(ratePrompt.user_id, false, 0, {
                      thanks: true,
                    });
                  } catch {
                    /* ignore */
                  }
                  clearRatePrompt();
                }}
              >
                <Text style={bannerStyles.btnText}>
                  {t("mobile.live.rateThanks")}
                </Text>
              </Pressable>
              <Pressable
                style={bannerStyles.decline}
                onPress={() => {
                  try {
                    hub.ratePartner(ratePrompt.user_id, false, 0);
                  } catch {
                    /* ignore */
                  }
                  clearRatePrompt();
                }}
              >
                <Text style={bannerStyles.btnText}>
                  {t("mobile.common.skip")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

/**
 * Any match (friend call or stranger) must open Live so MediaSession mounts.
 * Caller previously stayed on Friends → no video. Answerer already pushed /live.
 */
function MatchLiveNavigator() {
  const { addMessageListener } = useHub();
  useEffect(() => {
    return addMessageListener((msg) => {
      if (msg.type !== "matched") return;
      stopRing();
      void enterCallAudio();
      try {
        // push is fine even if already on Live (stack may duplicate; replace is safer)
        router.replace("/live");
      } catch {
        try {
          router.push("/live");
        } catch {
          /* ignore */
        }
      }
    });
  }, [addMessageListener]);
  return null;
}

function Shell({
  identity,
  rulesOk,
  children,
}: {
  identity: LocalIdentity;
  rulesOk: boolean;
  children: ReactNode;
}) {
  // Warm sound cache + load mute pref once rules accepted
  useEffect(() => {
    if (!rulesOk) return;
    void loadSoundPref();
    void preloadUiSounds();
    return attachPushResponseListener();
  }, [rulesOk]);

  if (!rulesOk) return <>{children}</>;
  // key remounts WS when profile import swaps user_id
  return (
    <HubProvider key={identity.user_id} identity={identity}>
      <FriendInviteHandler />
      <MatchLiveNavigator />
      <CallBanners />
      {children}
    </HubProvider>
  );
}

function StackNav() {
  const t = useT();
  const { lang } = useI18n();
  // Remount stack when language changes so header titles refresh
  return (
    <Stack
      key={lang}
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0b0e" },
        headerTintColor: "#e8eef7",
        headerTitleStyle: { color: "#e8eef7", fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#07080c" },
        // Android: keep status/nav bars dark when opening Friends/Settings
        statusBarStyle: "light",
        statusBarBackgroundColor: "#07080c",
        navigationBarColor: "#07080c",
      }}
    >
      <Stack.Screen name="index" options={{ title: "ruletka" }} />
      <Stack.Screen name="rules" options={{ title: t("mobile.nav.rules") }} />
      <Stack.Screen
        name="live"
        options={{
          title: t("mobile.nav.live"),
          headerShown: false,
          // CRITICAL: opaque stack content hid Android SurfaceView (black stage
          // while audio still worked — video painted "behind" the dark shell).
          contentStyle: { backgroundColor: "transparent" },
          statusBarBackgroundColor: "#050608",
          navigationBarColor: "#050608",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: t("mobile.nav.settings") }}
      />
      <Stack.Screen
        name="friends"
        options={{
          title: t("mobile.nav.friends"),
          contentStyle: { backgroundColor: "#07080c" },
          headerStyle: { backgroundColor: "#0a0b0e" },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [rulesOk, setRulesOk] = useState(false);

  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    track("app_open");
    (async () => {
      try {
        const id = await loadOrCreateIdentity();
        setIdentity(id);
        setRulesOk(await rulesAccepted());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setBootError(msg || "startup failed");
        track("boot_error", { msg: String(msg).slice(0, 80) });
      }
    })();
  }, []);

  if (bootError) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootErrorTitle}>Couldn’t start</Text>
        <Text style={styles.bootErrorBody}>{bootError}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!identity) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#ff2d55" />
        <StatusBar style="light" />
      </View>
    );
  }

  const value: AppContext = {
    identity,
    rulesOk,
    refreshRules: async () => setRulesOk(await rulesAccepted()),
    setIdentityName: (name: string) =>
      setIdentity((prev) => (prev ? { ...prev, name } : prev)),
    replaceAppIdentity: (id: LocalIdentity) => setIdentity(id),
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <I18nProvider>
            <AppCtx.Provider value={value}>
              <StatusBar style="light" />
              <Shell identity={identity} rulesOk={rulesOk}>
                <StackNav />
              </Shell>
            </AppCtx.Provider>
          </I18nProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: "#07080c",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  bootErrorTitle: {
    color: "#ff8fab",
    fontSize: 18,
    fontWeight: "800",
  },
  bootErrorBody: {
    color: "#9aa8bc",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});

const bannerStyles = StyleSheet.create({
  strip: {
    backgroundColor: "rgba(255,180,40,0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stripText: {
    color: "#ffe9a0",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: "rgba(20,24,34,0.96)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  toastText: { color: "#e8eef7", fontSize: 14, textAlign: "center" },
  toastHint: {
    color: "#9ec5ff",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "600",
  },
  incomingScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
  },
  incoming: {
    backgroundColor: "rgba(12,22,20,0.98)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "rgba(80,220,140,0.55)",
    gap: 8,
    shadowColor: "#2d9f6f",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  incomingPulse: {
    color: "#5dffb0",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  outgoing: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 110,
    backgroundColor: "rgba(16,20,30,0.98)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(100,150,255,0.4)",
    gap: 8,
  },
  noAnswer: {
    borderColor: "rgba(255, 180, 80, 0.55)",
    backgroundColor: "rgba(36, 28, 14, 0.98)",
  },
  incomingTitle: {
    color: "#9effc8",
    fontWeight: "800",
    fontSize: 18,
    textAlign: "center",
  },
  incomingBody: {
    color: "#e8eef7",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  incomingCode: {
    color: "#9aa8bc",
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  incomingHint: {
    color: "#7a8a9e",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },
  rateScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 115,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
  },
  rateCard: {
    backgroundColor: "rgba(40,32,12,0.98)",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,200,80,0.5)",
    gap: 8,
    elevation: 10,
  },
  rateTitle: { color: "#ffe9a0", fontWeight: "800", fontSize: 17 },
  rateEarly: { color: "#ffc850", fontSize: 12, fontWeight: "700" },
  rateBody: { color: "#c8d4e4", fontSize: 13, lineHeight: 18 },
  rateHint: { color: "#9aa8bc", fontSize: 12, lineHeight: 16 },
  rateThanks: {
    backgroundColor: "rgba(80,180,120,0.35)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(100,220,140,0.4)",
  },
  rateGift: {
    flex: 1,
    backgroundColor: "rgba(255,200,80,0.28)",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  row: { flexDirection: "row", gap: 10, marginTop: 4 },
  accept: {
    flex: 1,
    backgroundColor: "#2d9f6f",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  decline: {
    flex: 1,
    backgroundColor: "rgba(255,80,90,0.45)",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
