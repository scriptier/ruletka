import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  clearCallHistory,
  kindI18nKey,
  loadCallHistory,
  markMissedCallsRead,
  type CallHistoryEntry,
} from "../src/calls/history";
import { hubBase } from "../src/config";
import type { FriendInfo } from "../src/hub/types";
import { useHub } from "../src/hub/HubProvider";
import { useT } from "../src/i18n";

function FriendRow(props: {
  item: FriendInfo;
  onCall: () => void;
  onRemove: () => void;
}) {
  const { item, onCall, onRemove } = props;
  const t = useT();
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.name}>
          {item.name || item.short_id || "friend"}
          {item.online ? (
            <Text style={styles.online}> · {t("mobile.common.online")}</Text>
          ) : (
            <Text style={styles.offline}> · {t("mobile.common.offline")}</Text>
          )}
        </Text>
        <Text style={styles.sub}>
          {item.friend_code ? `Code ${item.friend_code}` : item.user_id.slice(0, 12)}
          {item.stars ? ` · ★${item.stars}` : ""}
        </Text>
      </View>
      {item.online ? (
        <Pressable style={styles.callBtn} onPress={onCall}>
          <Text style={styles.btnText}>{t("friends.call")}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.ghostBtn} onPress={onRemove}>
          <Text style={styles.btnTextMuted}>{t("mobile.friends.removeBtn")}</Text>
        </Pressable>
      )}
    </View>
  );
}

function formatWhen(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function FriendsScreen() {
  const {
    hub,
    friendCode,
    friends,
    incomingRequests,
    outgoingRequests,
    connected,
    setOutboundCall,
    callHistoryTick,
  } = useHub();
  const t = useT();
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);

  useEffect(() => {
    loadCallHistory().then(setHistory);
    markMissedCallsRead().catch(() => {});
  }, [callHistoryTick]);

  function add() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      Alert.alert(t("mobile.friends.codeShort"));
      return;
    }
    try {
      hub.addFriend(c);
      setCode("");
      Alert.alert(t("mobile.friends.requestSentTitle"), t("mobile.friends.requestSent", { code: c }));
    } catch (e) {
      Alert.alert(t("mobile.friends.notConnected"), String(e));
    }
  }

  function shareMyCode() {
    const url = `${hubBase()}/live.html?friend=${encodeURIComponent(friendCode)}&ref=friend_invite`;
    Share.share({
      message: t("friends.inviteLiveNow", {
        brand: "ruletka",
        code: friendCode,
      }) + `\n${url}`,
      title: t("friends.inviteLiveTitle", {
        brand: "ruletka",
        code: friendCode,
      }),
    }).catch(() => {});
  }

  function call(f: FriendInfo | { user_id: string; name?: string; short_id?: string }) {
    try {
      hub.callFriend(f.user_id);
      setOutboundCall({
        user_id: f.user_id,
        name: f.name || ("short_id" in f ? f.short_id : undefined) || "Friend",
      });
    } catch (e) {
      Alert.alert(t("mobile.friends.callFailed"), String(e));
    }
  }

  function callFromHistory(h: CallHistoryEntry) {
    const online = friends.find((f) => f.user_id === h.user_id)?.online;
    if (!online) {
      Alert.alert(
        t("mobile.history.offline"),
        t("mobile.history.offlineBody", { name: h.name })
      );
      return;
    }
    call({ user_id: h.user_id, name: h.name });
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t("mobile.friends.yourCode")}</Text>
        <Text style={styles.heroCode}>{friendCode || "…"}</Text>
        <Pressable style={styles.shareBtn} onPress={shareMyCode}>
          <Text style={styles.btnText}>{t("mobile.friends.shareInvite")}</Text>
        </Pressable>
        {!connected ? (
          <Text style={styles.warn}>{t("mobile.friends.offline")}</Text>
        ) : null}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder={t("mobile.friends.codePlaceholder")}
          placeholderTextColor="#6b7a90"
          onSubmitEditing={add}
        />
        <Pressable style={styles.addBtn} onPress={add}>
          <Text style={styles.btnText}>{t("mobile.friends.add")}</Text>
        </Pressable>
      </View>

      {incomingRequests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mobile.friends.incoming")}</Text>
          {incomingRequests.map((r) => (
            <View key={r.user_id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.name}>{r.name || r.short_id}</Text>
                <Text style={styles.sub}>{r.friend_code}</Text>
              </View>
              <Pressable
                style={styles.callBtn}
                onPress={() => hub.acceptFriend(r.user_id)}
              >
                <Text style={styles.btnText}>{t("friends.accept")}</Text>
              </Pressable>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => hub.declineFriend(r.user_id)}
              >
                <Text style={styles.btnTextMuted}>{t("friends.declineReq")}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {outgoingRequests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mobile.friends.waiting")}</Text>
          {outgoingRequests.map((r) => (
            <View key={r.user_id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.name}>{r.name || r.short_id || r.friend_code}</Text>
                <Text style={styles.sub}>{r.friend_code}</Text>
              </View>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => hub.declineFriend(r.user_id)}
              >
                <Text style={styles.btnTextMuted}>{t("mobile.common.cancel")}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {history.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t("friends.historyTitle")}</Text>
            <Pressable
              onPress={() => {
                Alert.alert(t("mobile.history.clear"), undefined, [
                  { text: t("mobile.common.cancel"), style: "cancel" },
                  {
                    text: t("mobile.friends.clear"),
                    style: "destructive",
                    onPress: async () => {
                      await clearCallHistory();
                      setHistory([]);
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.clearLink}>{t("mobile.friends.clear")}</Text>
            </Pressable>
          </View>
          {history.slice(0, 12).map((h) => {
            const online = friends.find((f) => f.user_id === h.user_id)?.online;
            return (
              <View key={h.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.name}>{h.name}</Text>
                  <Text style={styles.sub}>
                    {t(kindI18nKey(h.kind))} · {formatWhen(h.t)}
                    {online ? ` · ${t("mobile.common.online")}` : ""}
                  </Text>
                </View>
                <Pressable
                  style={online ? styles.callBtn : styles.ghostBtn}
                  onPress={() => callFromHistory(h)}
                >
                  <Text style={online ? styles.btnText : styles.btnTextMuted}>
                    {t("mobile.history.callBack")}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>{t("mobile.friends.list", { n: friends.length })}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.user_id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t("mobile.friends.empty")}
          </Text>
        }
        renderItem={({ item }) => (
          <FriendRow
            item={item}
            onCall={() => call(item)}
            onRemove={() => {
              Alert.alert(t("mobile.friends.remove"), item.name, [
                { text: t("mobile.common.cancel"), style: "cancel" },
                {
                  text: t("mobile.friends.removeBtn"),
                  style: "destructive",
                  onPress: () => hub.removeFriend(item.user_id),
                },
              ]);
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 10 },
  hero: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,45,85,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.28)",
    gap: 6,
  },
  heroLabel: { color: "#9aa8bc", fontSize: 12, fontWeight: "600" },
  heroCode: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
  },
  shareBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "#ff2d55",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  warn: { color: "#ffe9a0", fontSize: 12 },
  addRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  addBtn: {
    backgroundColor: "#3d7eff",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 12,
  },
  headerBlock: { gap: 10, marginBottom: 4 },
  section: { gap: 6 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionTitle: {
    color: "#c5d0e0",
    fontWeight: "700",
    fontSize: 14,
    marginTop: 8,
  },
  clearLink: { color: "#9aa8bc", fontSize: 13, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowMain: { flex: 1 },
  name: { color: "#e8eef7", fontWeight: "700", fontSize: 15 },
  online: { color: "#6dffa8", fontWeight: "600" },
  offline: { color: "#6b7a90", fontWeight: "500" },
  sub: { color: "#6b7a90", fontSize: 12, marginTop: 2 },
  callBtn: {
    backgroundColor: "#2d9f6f",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  ghostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnTextMuted: { color: "#9aa8bc", fontWeight: "600", fontSize: 13 },
  empty: { color: "#6b7a90", fontSize: 13, marginTop: 12, lineHeight: 20 },
});
