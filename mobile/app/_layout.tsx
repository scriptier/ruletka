import { Stack } from "expo-router";
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
import { HubProvider, useHub } from "../src/hub/HubProvider";
import {
  loadOrCreateIdentity,
  rulesAccepted,
  type LocalIdentity,
} from "../src/identity/store";

export type AppContext = {
  identity: LocalIdentity;
  rulesOk: boolean;
  refreshRules: () => Promise<void>;
  setIdentityName: (name: string) => void;
};

export const AppCtx = createContext<AppContext | null>(null);

export function useApp(): AppContext {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

function CallBanners() {
  const {
    incomingCall,
    outboundCall,
    hub,
    clearIncomingCall,
    setOutboundCall,
    toast,
    clearToast,
    connected,
  } = useHub();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return (
    <>
      {!connected ? (
        <View style={bannerStyles.strip}>
          <Text style={bannerStyles.stripText}>Reconnecting to hub…</Text>
        </View>
      ) : null}

      {toast ? (
        <Pressable style={bannerStyles.toast} onPress={clearToast}>
          <Text style={bannerStyles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      {incomingCall ? (
        <View style={bannerStyles.incoming}>
          <Text style={bannerStyles.incomingTitle}>Incoming call</Text>
          <Text style={bannerStyles.incomingBody}>
            {incomingCall.from_name || incomingCall.from_short || "Friend"}
          </Text>
          <View style={bannerStyles.row}>
            <Pressable
              style={bannerStyles.decline}
              onPress={() => {
                try {
                  hub.callRespond(incomingCall.from_user_id, false);
                } catch {
                  /* ignore */
                }
                clearIncomingCall();
              }}
            >
              <Text style={bannerStyles.btnText}>Decline</Text>
            </Pressable>
            <Pressable
              style={bannerStyles.accept}
              onPress={() => {
                try {
                  hub.callRespond(incomingCall.from_user_id, true);
                } catch {
                  /* ignore */
                }
                clearIncomingCall();
              }}
            >
              <Text style={bannerStyles.btnText}>Answer</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {outboundCall && !incomingCall ? (
        <View style={bannerStyles.outgoing}>
          <Text style={bannerStyles.incomingTitle}>Calling…</Text>
          <Text style={bannerStyles.incomingBody}>{outboundCall.name}</Text>
          <Pressable
            style={bannerStyles.decline}
            onPress={() => {
              try {
                hub.callCancel(outboundCall.user_id);
              } catch {
                /* ignore */
              }
              setOutboundCall(null);
            }}
          >
            <Text style={bannerStyles.btnText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
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
  if (!rulesOk) return <>{children}</>;
  return (
    <HubProvider identity={identity}>
      <CallBanners />
      {children}
    </HubProvider>
  );
}

export default function RootLayout() {
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [rulesOk, setRulesOk] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await loadOrCreateIdentity();
      setIdentity(id);
      setRulesOk(await rulesAccepted());
    })();
  }, []);

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
  };

  return (
    <AppCtx.Provider value={value}>
      <StatusBar style="light" />
      <Shell identity={identity} rulesOk={rulesOk}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#0a0b0e" },
            headerTintColor: "#e8eef7",
            contentStyle: { backgroundColor: "#07080c" },
          }}
        >
          <Stack.Screen name="index" options={{ title: "ruletka" }} />
          <Stack.Screen name="rules" options={{ title: "18+ rules" }} />
          <Stack.Screen
            name="live"
            options={{ title: "Live", headerShown: false }}
          />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
          <Stack.Screen name="friends" options={{ title: "Friends" }} />
        </Stack>
      </Shell>
    </AppCtx.Provider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: "#07080c",
    alignItems: "center",
    justifyContent: "center",
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
    top: 52,
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
  incoming: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 56,
    zIndex: 110,
    backgroundColor: "rgba(16,20,30,0.98)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(80,200,140,0.4)",
    gap: 8,
  },
  outgoing: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 56,
    zIndex: 110,
    backgroundColor: "rgba(16,20,30,0.98)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(100,150,255,0.4)",
    gap: 8,
  },
  incomingTitle: { color: "#9effc8", fontWeight: "800", fontSize: 16 },
  incomingBody: { color: "#e8eef7", fontSize: 15 },
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
