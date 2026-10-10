/**
 * Mutual-friend DM sheet (hub friend_chat + history).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import {
  FlatList,
  Image,
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

/** Solid letter tile — matches Friends Signal palette. */
const AVATAR_COLORS = [
  "#6B7CFF",
  "#C45CFF",
  "#E85D75",
  "#F0A202",
  "#2BB673",
  "#3D9EED",
  "#FF6B4A",
  "#9B6DFF",
];

function avatarColor(seed: string): string {
  let h = 0;
  const s = seed || "?";
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

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
  /** Signal-thread-header spirit: icon-only call CTA next to name. */
  onCall?: () => void;
}) {
  const { friend, visible, onClose, onCall } = props;
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
            <Pressable
              style={styles.backBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.common.ok")}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={26} color="#3d9eed" />
            </Pressable>
            <View
              style={[
                styles.headAvatar,
                {
                  backgroundColor: avatarColor(
                    friend.user_id || friend.friend_code || friend.name || "?"
                  ),
                },
              ]}
              importantForAccessibility="no"
            >
              {friend.avatar && String(friend.avatar).startsWith("http") ? (
                <Image
                  source={{ uri: String(friend.avatar).trim() }}
                  style={styles.headAvatarImg}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.headAvatarText}>
                  {(
                    friend.name ||
                    friend.short_id ||
                    friend.friend_code ||
                    "?"
                  )
                    .slice(0, 1)
                    .toUpperCase()}
                </Text>
              )}
              {friend.online ? <View style={styles.headDot} /> : null}
            </View>
            <View style={styles.headMain}>
              <Text
                style={styles.title}
                numberOfLines={1}
                accessibilityRole="header"
              >
                {friend.name || friend.short_id || t("mobile.friends.friend")}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {friend.online
                  ? t("mobile.common.online")
                  : t("mobile.common.offline")}
              </Text>
            </View>
            {onCall ? (
              <Pressable
                style={styles.headCallBtn}
                onPress={onCall}
                accessibilityRole="button"
                accessibilityLabel={t("friends.call")}
                hitSlop={8}
              >
                <Ionicons name="videocam" size={22} color="#3d9eed" />
              </Pressable>
            ) : null}
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
                  <Text style={mine ? styles.bubbleTextMe : styles.bubbleTextThem}>
                    {item.body}
                  </Text>
                  <Text style={mine ? styles.bubbleTsMe : styles.bubbleTsThem}>
                    {formatTs(item.ts)}
                  </Text>
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
              <Ionicons name="send" size={18} color="#fff" />
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
    backgroundColor: "#0b0c10",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: {
    width: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headAvatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  headDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#3dffa0",
    borderWidth: 2,
    borderColor: "#0b0c10",
  },
  headMain: { flex: 1, minWidth: 0 },
  headCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(61,158,237,0.14)",
  },
  title: { color: "#f0f3f8", fontWeight: "700", fontSize: 16 },
  sub: { color: "#8b97a8", fontSize: 12, marginTop: 1 },
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
    borderRadius: 18,
    marginVertical: 2,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: "#3d7eff",
  },
  bubbleThem: {
    alignSelf: "flex-start",
    backgroundColor: "#1c212b",
  },
  bubbleTextMe: { color: "#ffffff", fontSize: 14, lineHeight: 19 },
  bubbleTextThem: { color: "#e8eef7", fontSize: 14, lineHeight: 19 },
  bubbleTsMe: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  bubbleTsThem: {
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
  compose: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
  input: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  send: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d7eff",
    borderRadius: 999,
  },
  sendDisabled: { opacity: 0.4 },
  charHint: {
    color: "#6b7a90",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
