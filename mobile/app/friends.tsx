import { useState } from "react";
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
import { hubBase } from "../src/config";
import type { FriendInfo } from "../src/hub/types";
import { useHub } from "../src/hub/HubProvider";

function FriendRow(props: {
  item: FriendInfo;
  onCall: () => void;
  onRemove: () => void;
}) {
  const { item, onCall, onRemove } = props;
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.name}>
          {item.name || item.short_id || "friend"}
          {item.online ? (
            <Text style={styles.online}> · online</Text>
          ) : (
            <Text style={styles.offline}> · offline</Text>
          )}
        </Text>
        <Text style={styles.sub}>
          {item.friend_code ? `Code ${item.friend_code}` : item.user_id.slice(0, 12)}
          {item.stars ? ` · ★${item.stars}` : ""}
        </Text>
      </View>
      {item.online ? (
        <Pressable style={styles.callBtn} onPress={onCall}>
          <Text style={styles.btnText}>Call</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.ghostBtn} onPress={onRemove}>
          <Text style={styles.btnTextMuted}>Remove</Text>
        </Pressable>
      )}
    </View>
  );
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
  } = useHub();
  const [code, setCode] = useState("");

  function add() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      Alert.alert("Code too short");
      return;
    }
    try {
      hub.addFriend(c);
      setCode("");
      Alert.alert("Request sent", `If ${c} is online or returns, they can Accept.`);
    } catch (e) {
      Alert.alert("Not connected", String(e));
    }
  }

  function shareMyCode() {
    const url = `${hubBase()}/live.html?friend=${encodeURIComponent(friendCode)}&ref=friend_invite`;
    Share.share({
      message: `Add me on ruletka · code ${friendCode}\n${url}`,
      title: "ruletka friend code",
    }).catch(() => {});
  }

  function call(f: FriendInfo) {
    try {
      hub.callFriend(f.user_id);
      setOutboundCall({ user_id: f.user_id, name: f.name || f.short_id });
    } catch (e) {
      Alert.alert("Call failed", String(e));
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Your code</Text>
        <Text style={styles.heroCode}>{friendCode || "…"}</Text>
        <Pressable style={styles.shareBtn} onPress={shareMyCode}>
          <Text style={styles.btnText}>Share invite</Text>
        </Pressable>
        {!connected ? (
          <Text style={styles.warn}>Offline — reconnecting…</Text>
        ) : null}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="Friend code"
          placeholderTextColor="#6b7a90"
          onSubmitEditing={add}
        />
        <Pressable style={styles.addBtn} onPress={add}>
          <Text style={styles.btnText}>Add</Text>
        </Pressable>
      </View>

      {incomingRequests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incoming requests</Text>
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
                <Text style={styles.btnText}>Accept</Text>
              </Pressable>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => hub.declineFriend(r.user_id)}
              >
                <Text style={styles.btnTextMuted}>No</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {outgoingRequests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Waiting for accept</Text>
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
                <Text style={styles.btnTextMuted}>Cancel</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>
        Friends ({friends.length})
      </Text>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.user_id}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No friends yet. Share your code or add theirs.
          </Text>
        }
        renderItem={({ item }) => (
          <FriendRow
            item={item}
            onCall={() => call(item)}
            onRemove={() => {
              Alert.alert("Remove friend?", item.name, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
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
  section: { gap: 6 },
  sectionTitle: {
    color: "#c5d0e0",
    fontWeight: "700",
    fontSize: 14,
    marginTop: 8,
  },
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
