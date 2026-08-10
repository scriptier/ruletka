/**
 * Mutual-friend DM sheet (hub friend_chat + history).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticLight } from "../feedback/haptics";
import { useHub } from "../hub/HubProvider";
import type { FriendChatLine, FriendInfo, ServerMsg } from "../hub/types";
import { useT } from "../i18n";

const DM_MAX = 500;

function formatTs(ts: number): string {
  try {
    const d = new Date(ts < 1e12 ? ts * 1000 : ts);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function FriendChatSheet(props: {
  friend: FriendInfo | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { friend, visible, onClose } = props;
  const {
    hub,
    userId,
    addMessageListener,
    connected,
    markFriendChatRead,
    setActiveChatUserId,
    showToast,
  } = useHub();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<FriendChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);
  const peerId = friend?.user_id || "";

  const scrollEnd = useCallback(() => {
    setTimeout(() => {
      try {
        listRef.current?.scrollToEnd({ animated: true });
      } catch {
        /* ignore */
      }
    }, 80);
  }, []);

  useEffect(() => {
    if (!visible || !peerId) {
      setActiveChatUserId("");
      setMessages([]);
      setDraft("");
      return;
    }
    setActiveChatUserId(peerId);
    markFriendChatRead(peerId);
    setMessages([]);
    try {
      hub.friendChatHistory(peerId);
    } catch {
      /* offline */
    }
    return () => setActiveChatUserId("");
  }, [visible, peerId, hub, markFriendChatRead, setActiveChatUserId]);

  useEffect(() => {
    if (!visible || !peerId) return;
    return addMessageListener((msg: ServerMsg) => {
      if (msg.type === "friend_chat_history") {
        const m = msg as {
          with_user_id?: string;
          messages?: FriendChatLine[];
        };
        if (m.with_user_id !== peerId) return;
        const lines = (m.messages || []).map((x) => ({
          ...x,
          ts: Number(x.ts) || 0,
        }));
        setMessages(lines);
        scrollEnd();
        return;
      }
      if (msg.type === "friend_chat") {
        const m = msg as {
          id?: string;
          from_user_id?: string;
          from_name?: string;
          to_user_id?: string;
          body?: string;
          ts?: number;
        };
        const from = String(m.from_user_id || "");
        const to = String(m.to_user_id || "");
        if (from !== peerId && to !== peerId) return;
        // Only for this conversation
        if (from !== peerId && from !== userId) return;
        if (to !== peerId && to !== userId) return;
        const line: FriendChatLine = {
          id: String(m.id || `${Date.now()}`),
          from_user_id: from,
          from_name: String(m.from_name || ""),
          body: String(m.body || ""),
          ts: Number(m.ts) || Math.floor(Date.now() / 1000),
        };
        if (!line.body) return;
        setMessages((prev) => {
          if (prev.some((p) => p.id === line.id)) return prev;
          // Replace optimistic local bubble if hub echo matches
          const withoutLocal = prev.filter(
            (p) =>
              !(
                p.id.startsWith("local-") &&
                p.from_user_id === line.from_user_id &&
                p.body === line.body
              )
          );
          return [...withoutLocal, line].slice(-200);
        });
        scrollEnd();
      }
    });
  }, [visible, peerId, userId, addMessageListener, scrollEnd]);

  function send() {
    const body = draft.trim().slice(0, DM_MAX);
    if (!body || !peerId || !connected) return;
    try {
      hub.friendChat(peerId, body);
      setDraft("");
      hapticLight();
      // Optimistic line until hub echo arrives
      const opt: FriendChatLine = {
        id: `local-${Date.now()}`,
        from_user_id: userId,
        from_name: "you",
        body,
        ts: Math.floor(Date.now() / 1000),
      };
      setMessages((prev) => [...prev, opt].slice(-200));
      scrollEnd();
    } catch {
      /* ignore */
    }
  }

  if (!friend) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.head}>
            <View style={styles.headMain}>
              <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                {friend.name || friend.short_id || t("mobile.friends.friend")}
              </Text>
              <Text style={styles.sub}>
                {friend.online
                  ? t("mobile.common.online")
                  : t("mobile.common.offline")}
                {friend.friend_code ? ` · ${friend.friend_code}` : ""}
              </Text>
            </View>
            <Pressable
              style={styles.close}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.common.ok")}
            >
              <Text style={styles.closeText}>{t("mobile.common.ok")}</Text>
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            style={styles.list}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.empty}>{t("mobile.friends.chatEmpty")}</Text>
            }
            renderItem={({ item }) => {
              const mine = item.from_user_id === userId;
              return (
                <Pressable
                  style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}
                  onLongPress={() => {
                    void Clipboard.setStringAsync(item.body).then(() => {
                      showToast(t("mobile.chat.copied"));
                      hapticLight();
                    });
                  }}
                  delayLongPress={350}
                  accessibilityRole="button"
                  accessibilityLabel={item.body}
                >
                  <Text style={styles.bubbleText}>{item.body}</Text>
                  <Text style={styles.bubbleTs}>{formatTs(item.ts)}</Text>
                </Pressable>
              );
            }}
            onContentSizeChange={scrollEnd}
          />

          {!connected ? (
            <Text style={styles.warn}>{t("mobile.friends.offline")}</Text>
          ) : null}

          <View style={styles.compose}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={(text) =>
                setDraft(text.length > DM_MAX ? text.slice(0, DM_MAX) : text)
              }
              placeholder={t("mobile.friends.chatPlaceholder")}
              placeholderTextColor="#6b7a90"
              onSubmitEditing={send}
              returnKeyType="send"
              maxLength={DM_MAX}
              editable={connected}
              accessibilityLabel={t("mobile.friends.chatPlaceholder")}
            />
            <Pressable
              style={[styles.send, !connected && styles.sendDisabled]}
              onPress={send}
              disabled={!connected}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.common.send")}
              accessibilityState={{ disabled: !connected }}
            >
              <Text style={styles.sendText}>{t("mobile.common.send")}</Text>
            </Pressable>
          </View>
          {draft.length >= 400 ? (
            <Text style={styles.charHint}>
              {t("mobile.chat.charsLeft", {
                n: Math.max(0, DM_MAX - draft.length),
              })}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    maxHeight: "88%",
    minHeight: "55%",
    backgroundColor: "#10141c",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headMain: { flex: 1 },
  title: { color: "#e8eef7", fontWeight: "800", fontSize: 17 },
  sub: { color: "#9aa8bc", fontSize: 12, marginTop: 2 },
  close: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closeText: { color: "#c8d4e4", fontWeight: "700", fontSize: 13 },
  list: { flex: 1, marginTop: 8 },
  listContent: { paddingVertical: 8, gap: 6 },
  empty: {
    color: "#6b7a90",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
  },
  bubble: {
    maxWidth: "82%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginVertical: 2,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(61,126,255,0.35)",
  },
  bubbleThem: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  bubbleText: { color: "#e8eef7", fontSize: 14, lineHeight: 19 },
  bubbleTs: {
    color: "#8a96a8",
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  warn: {
    color: "#ffe9a0",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 6,
  },
  compose: { flexDirection: "row", gap: 8, paddingTop: 8 },
  input: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  send: {
    backgroundColor: "#3d7eff",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 999,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  charHint: {
    color: "#6b7a90",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
