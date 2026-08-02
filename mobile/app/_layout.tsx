import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { loadOrCreateIdentity, rulesAccepted, type LocalIdentity } from "../src/identity/store";

export type AppContext = {
  identity: LocalIdentity;
  rulesOk: boolean;
  refreshRules: () => Promise<void>;
};

import { createContext, useContext } from "react";

export const AppCtx = createContext<AppContext | null>(null);

export function useApp(): AppContext {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
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
  };

  return (
    <AppCtx.Provider value={value}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0b0e" },
          headerTintColor: "#e8eef7",
          contentStyle: { backgroundColor: "#07080c" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "ruletka" }} />
        <Stack.Screen name="rules" options={{ title: "18+ rules" }} />
        <Stack.Screen name="live" options={{ title: "Live", headerShown: false }} />
      </Stack>
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
