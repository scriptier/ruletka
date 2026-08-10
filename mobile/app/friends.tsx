import { useCallback, useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  clearCallHistory,
  countUnreadMissed,
  kindI18nKey,
  loadCallHistory,
  markMissedCallsRead,
  type CallHistoryEntry,
} from "../src/calls/history";
import {
  clearMatchHistory,
  loadMatchHistory,
  removeMatchHistory,
  type MatchHistoryEntry,
} from "../src/calls/matchHistory";
import {
  clearMatchThumbs,
  loadMatchThumbsMap,
} from "../src/calls/matchThumbs";
import { track } from "../src/analytics/track";
import { hubBase } from "../src/config";
import type { FriendInfo } from "../src/hub/types";
import { useHub } from "../src/hub/HubProvider";
import { useT } from "../src/i18n";
import { useApp } from "./_layout";
import { friendInviteShareMessage } from "../src/linking/friendInvite";
import { FriendChatSheet } from "../src/friends/FriendChatSheet";
import { hapticLight } from "../src/feedback/haptics";
import { flagEmoji, trustTierI18nKey } from "../src/identity/flagTrust";
import { loadMatchPrefs } from "../src/prefs/store";
import { maybeOfferNotifOptIn } from "../src/push/notifOptIn";
import { rememberBlock } from "../src/safety/blocks";
import { pushReportHistory } from "../src/safety/reportHistory";

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

function FriendRow(props: {
  item: FriendInfo;
  unread: number;
  /** In a live 1v1 — show Invite (join) instead of Call. */
  liveBusy: boolean;
  onCall: () => void;
  onInvite: () => void;
  onChat: () => void;
  onRemove: () => void;
  onCopyCode: () => void;
  onBlock: () => void;
}) {
  const {
    item,
    unread,
    liveBusy,
    onCall,
    onInvite,
    onChat,
    onRemove,
    onCopyCode,
    onBlock,
  } = props;
  const t = useT();
  /** Short label on the row CTA; longer a11y when offline ring. */
  const callLabel = liveBusy
    ? t("mobile.friends.inviteJoin")
    : t("friends.call");
  const callA11y = liveBusy
    ? t("mobile.friends.inviteJoin")
    : item.online
      ? t("friends.call")
      : t("mobile.history.ringAnyway");
  const chatLabel = t("mobile.friends.chat");
  const callActive = liveBusy ? item.online : true;
  const friendName =
    item.name || item.short_id || t("mobile.friends.friend");
  const onlineState = item.online
    ? t("mobile.common.online")
    : t("mobile.common.offline");

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onChat}
        accessibilityRole="button"
        accessibilityLabel={`${friendName}. ${onlineState}. ${chatLabel}`}
      >
        <View style={styles.avatar} importantForAccessibility="no">
          <Text style={styles.avatarText}>
            {(item.name || item.short_id || "?").slice(0, 1).toUpperCase()}
          </Text>
          <View
            style={[styles.dot, item.online ? styles.dotOn : styles.dotOff]}
          />
          {unread > 0 ? (
            <View style={styles.dmBadge}>
              <Text style={styles.dmBadgeText}>
                {unread > 9 ? "9+" : String(unread)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        style={styles.rowMain}
        onPress={onChat}
        onLongPress={onCopyCode}
        accessibilityRole="button"
        accessibilityLabel={`${friendName}. ${onlineState}`}
        accessibilityHint={t("mobile.friends.copyCode")}
      >
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || item.short_id || t("mobile.friends.friend")}
          </Text>
          {item.online ? (
            <View style={styles.onlinePill}>
              <Text style={styles.onlinePillText}>
                {t("mobile.common.online")}
              </Text>
            </View>
          ) : (
            <Text style={styles.offlinePill}>{t("mobile.common.offline")}</Text>
          )}
        </View>
        <Text
          style={[styles.sub, unread > 0 && styles.subUnread]}
          numberOfLines={1}
        >
          {item.friend_code
            ? t("mobile.friends.codeLabel", { code: item.friend_code })
            : item.user_id.slice(0, 12)}
          {item.stars ? ` · ★${item.stars}` : ""}
          {item.last_msg ? ` · ${item.last_msg.slice(0, 28)}` : ""}
        </Text>
      </Pressable>
      <View style={styles.rowActions}>
        <Pressable
          style={[styles.ctaBtn, unread > 0 && styles.ctaBtnUnread]}
          onPress={onChat}
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0
              ? `${chatLabel} (${unread > 9 ? "9+" : unread})`
              : chatLabel
          }
          hitSlop={2}
        >
          <Ionicons
            name={unread > 0 ? "chatbubble" : "chatbubble-outline"}
            size={14}
            color={unread > 0 ? "#c8dcff" : "#e8eef7"}
          />
          <Text
            style={[styles.ctaBtnText, unread > 0 && styles.ctaBtnTextUnread]}
            numberOfLines={1}
          >
            {chatLabel}
          </Text>
          {unread > 0 ? (
            <View style={styles.ctaBadge}>
              <Text style={styles.ctaBadgeText}>
                {unread > 9 ? "9+" : String(unread)}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          style={[
            styles.ctaBtn,
            callActive ? styles.ctaBtnCall : styles.ctaBtnMuted,
            liveBusy && !item.online && styles.ctaBtnMuted,
          ]}
          onPress={liveBusy ? onInvite : onCall}
          accessibilityRole="button"
          accessibilityLabel={callA11y}
          hitSlop={2}
        >
          <Ionicons
            name={liveBusy ? "person-add" : "call"}
            size={14}
            color={
              callActive && !(liveBusy && !item.online) ? "#b8f5d4" : "#9aa8bc"
            }
          />
          <Text
            style={[
              styles.ctaBtnText,
              callActive && !(liveBusy && !item.online)
                ? styles.ctaBtnTextCall
                : styles.ctaBtnTextMuted,
            ]}
            numberOfLines={1}
          >
            {callLabel}
          </Text>
        </Pressable>
        <Pressable
          style={styles.moreBtn}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.friends.actionsHint")}
          onPress={() => {
            Alert.alert(
              item.name || t("mobile.friends.friend"),
              t("mobile.friends.actionsHint"),
              [
                { text: t("mobile.common.cancel"), style: "cancel" },
                {
                  text: t("mobile.friends.copyCode"),
                  onPress: onCopyCode,
                },
                {
                  text: t("mobile.friends.removeBtn"),
                  style: "destructive",
                  onPress: onRemove,
                },
                {
                  text: t("mobile.friends.blockBtn"),
                  style: "destructive",
                  onPress: onBlock,
                },
              ]
            );
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color="#9aa8bc" />
        </Pressable>
      </View>
    </View>
  );
}

export default function FriendsScreen() {
  const { rulesOk } = useApp();
  if (!rulesOk) return <Redirect href="/rules" />;
  return <FriendsBody />;
}

function FriendsBody() {
  const {
    hub,
    friendCode,
    friends,
    incomingRequests,
    outgoingRequests,
    connected,
    setOutboundCall,
    clearNoAnswerPrompt,
    callHistoryTick,
    pendingFriendCode,
    clearPendingFriendCode,
    showToast,
    unreadDms,
    pendingChatUserId,
    clearPendingChatUserId,
    liveBusy,
    openFriendChat,
  } = useHub();
  const { identity } = useApp();
  const t = useT();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ openChat?: string }>();
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  /** user_id → on-device file:// thumb (never from server) */
  const [matchThumbs, setMatchThumbs] = useState<Record<string, string>>({});
  const [missed, setMissed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [chatFriend, setChatFriend] = useState<FriendInfo | null>(null);

  // Open DM from toast tap, push deep link, or pending chat
  useEffect(() => {
    const fromPush = String(params.openChat || "").trim();
    if (fromPush) {
      openFriendChat(fromPush);
    }
  }, [params.openChat, openFriendChat]);

  useEffect(() => {
    if (!pendingChatUserId) return;
    const f = friends.find((x) => x.user_id === pendingChatUserId);
    if (f) {
      setChatFriend(f);
      clearPendingChatUserId();
    }
  }, [pendingChatUserId, friends, clearPendingChatUserId]);

  const reloadHistory = useCallback(async () => {
    const n = await countUnreadMissed();
    setMissed(n);
    const list = await loadCallHistory();
    setHistory(list);
    const matches = await loadMatchHistory();
    setMatchHistory(matches);
    try {
      const ids = matches.map((m) => m.user_id).filter(Boolean);
      setMatchThumbs(await loadMatchThumbsMap(ids));
    } catch {
      setMatchThumbs({});
    }
    await markMissedCallsRead();
    setMissed(0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadHistory().catch(() => {});
    }, [reloadHistory, callHistoryTick])
  );

  useEffect(() => {
    reloadHistory().catch(() => {});
  }, [callHistoryTick, reloadHistory]);

  useEffect(() => {
    if (pendingFriendCode) {
      setCode(pendingFriendCode);
      // Don't clear until add succeeds — keep visible
    }
  }, [pendingFriendCode]);

  const onlineCount = useMemo(
    () => friends.filter((f) => f.online).length,
    [friends]
  );

  const sortedFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...friends];
    if (q) {
      list = list.filter((f) => {
        const hay = `${f.name} ${f.short_id} ${f.friend_code} ${f.user_id}`.toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    return list;
  }, [friends, query]);

  async function refresh() {
    setRefreshing(true);
    hapticLight();
    try {
      // Re-hello nudges hub to re-push friends snapshot
      const prefs = await loadMatchPrefs();
      hub.hello({
        user_id: identity.user_id,
        name: identity.name || "anon",
        gender: prefs.gender || "",
        looking: prefs.looking || "any",
      });
      await reloadHistory();
    } catch {
      /* ignore */
    }
    setTimeout(() => setRefreshing(false), 600);
  }

  function add() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      showToast(t("mobile.friends.codeShort"));
      return;
    }
    if (!connected) {
      showToast(t("mobile.friends.notConnected"));
      return;
    }
    try {
      hub.addFriend(c);
      setCode("");
      clearPendingFriendCode();
      track("funnel_invite_request", { via: "friends_add", code: c.slice(0, 8) });
      showToast(t("mobile.friends.requestSent", { code: c }));
    } catch (e) {
      showToast(t("mobile.friends.notConnected"));
    }
  }

  function shareMyCode() {
    const share = friendInviteShareMessage(hubBase(), friendCode, "ruletka");
    track("funnel_invite_share", { via: "friends" });
    track("friend_invite_share", { via: "friends" });
    Share.share({
      message: share.message,
      title: share.title,
      url: share.url,
    }).catch(() => {});
  }

  async function copyCode(c: string) {
    if (!c) return;
    try {
      await Clipboard.setStringAsync(c);
      showToast(t("mobile.friends.codeCopied"));
    } catch {
      Share.share({ message: c }).catch(() => {});
    }
  }

  function call(
    f: FriendInfo | { user_id: string; name?: string; short_id?: string },
    opts?: { join?: boolean }
  ) {
    if (!friends.some((x) => x.user_id === f.user_id)) {
      showToast(t("friends.callOnlyFriends"));
      return;
    }
    if (!connected) {
      showToast(t("mobile.friends.notConnected"));
      return;
    }
    hapticLight();
    if (opts?.join && !liveBusy) {
      showToast(t("mobile.friends.inviteNeedLive"));
      return;
    }
    if (opts?.join && !("online" in f ? f.online : true)) {
      showToast(t("mobile.friends.inviteNeedOnline"));
      return;
    }
    try {
      const online = "online" in f ? !!f.online : true;
      clearNoAnswerPrompt();
      hub.callFriend(f.user_id, { join: !!opts?.join });
      setOutboundCall({
        user_id: f.user_id,
        name: f.name || ("short_id" in f ? f.short_id : undefined) || "Friend",
        join: !!opts?.join,
      });
      track("friend_call_attempt", {
        join: opts?.join ? 1 : 0,
        online: online ? 1 : 0,
      });
      track("friend_call_place", {
        join: opts?.join ? 1 : 0,
        online: online ? 1 : 0,
      });
      if (opts?.join) {
        showToast(
          t("mobile.friends.inviteSentToast", { name: f.name || "…" })
        );
      } else if (!online) {
        // Offline ring: hub may queue; make expectation clear
        showToast(t("mobile.friends.ringingOffline", { name: f.name || "…" }));
      }
      // Open Live so MediaSession mounts and cam/ICE can warm before match
      if (!opts?.join) {
        try {
          router.push("/live");
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      showToast(t("mobile.friends.callFailed"));
    }
  }

  function callFromHistory(h: CallHistoryEntry) {
    const fr = friends.find((f) => f.user_id === h.user_id);
    if (!fr) {
      showToast(t("mobile.history.notFriend") || t("friends.callOnlyFriends"));
      return;
    }
    if (!fr.online) {
      Alert.alert(
        t("mobile.history.offline"),
        t("mobile.history.offlineRingHint", { name: h.name }),
        [
          { text: t("mobile.common.cancel"), style: "cancel" },
          {
            text: t("mobile.history.ringAnyway"),
            onPress: () => call({ user_id: h.user_id, name: h.name }),
          },
        ]
      );
      return;
    }
    call({ user_id: h.user_id, name: h.name });
  }

  function removeFriend(item: FriendInfo) {
    Alert.alert(t("mobile.friends.remove"), item.name || item.short_id, [
      { text: t("mobile.common.cancel"), style: "cancel" },
      {
        text: t("mobile.friends.removeBtn"),
        style: "destructive",
        onPress: () => {
          try {
            hub.removeFriend(item.user_id);
            showToast(t("mobile.friends.removed"));
          } catch (e) {
            showToast(t("mobile.friends.notConnected"));
          }
        },
      },
    ]);
  }

  function blockFriend(item: FriendInfo) {
    Alert.alert(
      t("mobile.friends.blockTitle"),
      t("mobile.friends.blockBody", {
        name: item.name || item.short_id || "…",
      }),
      [
        { text: t("mobile.common.cancel"), style: "cancel" },
        {
          text: t("mobile.friends.blockBtn"),
          style: "destructive",
          onPress: () => {
            try {
              hub.blockUser(item.user_id);
              void rememberBlock(item.user_id, item.name || item.short_id);
              void pushReportHistory({
                user_id: item.user_id,
                name: item.name || item.short_id || item.user_id.slice(0, 8),
                kind: "block",
              });
              showToast(t("mobile.friends.blocked"));
            } catch (e) {
              showToast(t("mobile.friends.notConnected"));
            }
          },
        },
      ]
    );
  }

  function blockMatchHistory(h: MatchHistoryEntry) {
    Alert.alert(
      t("mobile.history.blockTitle"),
      t("mobile.history.blockBody", { name: h.name || "…" }),
      [
        { text: t("mobile.common.cancel"), style: "cancel" },
        {
          text: t("mobile.friends.blockBtn"),
          style: "destructive",
          onPress: () => {
            try {
              hub.blockUser(h.user_id);
              void rememberBlock(h.user_id, h.name);
              void pushReportHistory({
                user_id: h.user_id,
                name: h.name || h.user_id.slice(0, 8),
                kind: "block",
              });
              void removeMatchHistory(h.id).then(() =>
                setMatchHistory((list) => list.filter((x) => x.id !== h.id))
              );
              hapticLight();
              showToast(t("mobile.friends.blocked"));
            } catch (e) {
              showToast(t("mobile.friends.notConnected"));
            }
          },
        },
      ]
    );
  }

  function reportMatchHistory(h: MatchHistoryEntry) {
    Alert.alert(
      t("mobile.history.reportTitle"),
      t("mobile.history.reportBody", { name: h.name || "…" }),
      [
        { text: t("mobile.common.cancel"), style: "cancel" },
        {
          text: t("mobile.live.reasonSpam"),
          onPress: () => doReportMatch(h, "spam"),
        },
        {
          text: t("mobile.live.reasonHarassment"),
          onPress: () => doReportMatch(h, "harassment"),
        },
        {
          text: t("mobile.live.reasonExplicit"),
          onPress: () => doReportMatch(h, "explicit"),
        },
        {
          text: t("mobile.live.reasonOther"),
          onPress: () => doReportMatch(h, "other"),
        },
      ]
    );
  }

  function doReportMatch(h: MatchHistoryEntry, reason: string) {
    try {
      hub.reportUser(h.user_id, reason);
      hub.blockUser(h.user_id);
      void rememberBlock(h.user_id, h.name);
      void pushReportHistory({
        user_id: h.user_id,
        name: h.name || h.user_id.slice(0, 8),
        kind: "report",
        reason,
      });
      void removeMatchHistory(h.id).then(() =>
        setMatchHistory((list) => list.filter((x) => x.id !== h.id))
      );
      hapticLight();
      showToast(t("mobile.history.reported"));
    } catch (e) {
      showToast(t("mobile.friends.notConnected"));
    }
  }

  function addMatchFriend(h: MatchHistoryEntry) {
    const code = (h.friend_code || "").trim();
    if (!code) {
      showToast(t("mobile.home.lastMatchNoCode"));
      return;
    }
    try {
      hub.addFriend(code);
      hapticLight();
      showToast(t("mobile.friends.requestSent", { code }));
    } catch (e) {
      showToast(t("mobile.friends.notConnected"));
    }
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t("mobile.friends.yourCode")}</Text>
        <Pressable
          onLongPress={() => copyCode(friendCode)}
          onPress={shareMyCode}
          accessibilityRole="button"
          accessibilityLabel={
            friendCode
              ? `${t("mobile.friends.yourCode")} ${friendCode}`
              : t("mobile.friends.yourCode")
          }
          accessibilityHint={t("mobile.friends.tapCodeHint")}
        >
          <Text style={styles.heroCode} importantForAccessibility="no">
            {friendCode || "…"}
          </Text>
        </Pressable>
        <Text style={styles.copyHint}>{t("mobile.friends.tapCodeHint")}</Text>
        <View style={styles.heroActions}>
          <Pressable
            style={styles.shareBtn}
            onPress={shareMyCode}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.friends.shareInvite")}
          >
            <Text style={styles.btnText} importantForAccessibility="no">
              {t("mobile.friends.shareInvite")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.copyBtn}
            onPress={() => copyCode(friendCode)}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.friends.copyCode")}
          >
            <Text style={styles.btnText} importantForAccessibility="no">
              {t("mobile.friends.copyCode")}
            </Text>
          </Pressable>
        </View>
        {!connected ? (
          <Text
            style={styles.warn}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {t("mobile.friends.offline")}
          </Text>
        ) : (
          <Text
            style={styles.onlineCount}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
          >
            {t("mobile.friends.onlineCount", {
              n: onlineCount,
              total: friends.length,
            })}
          </Text>
        )}
        {liveBusy ? (
          <Text style={styles.liveBusyHint}>
            {t("mobile.friends.liveBusyHint")}
          </Text>
        ) : null}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={t("mobile.friends.codePlaceholder")}
          placeholderTextColor="#6b7a90"
          onSubmitEditing={add}
          returnKeyType="done"
          accessibilityLabel={t("mobile.friends.codePlaceholder")}
        />
        <Pressable
          style={[styles.addBtn, !connected && styles.addBtnDisabled]}
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.friends.add")}
          accessibilityState={{ disabled: !connected }}
        >
          <Text style={styles.btnText} importantForAccessibility="no">
            {t("mobile.friends.add")}
          </Text>
        </Pressable>
      </View>

      {friends.length > 2 ? (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t("mobile.friends.search")}
          placeholderTextColor="#6b7a90"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={t("mobile.friends.search")}
        />
      ) : null}

      {missed > 0 ? (
        <View style={styles.missedBanner}>
          <Text style={styles.missedText}>
            {t("mobile.home.missedTitle", { n: missed })}
          </Text>
          <Text style={styles.missedHint}>
            {t("mobile.history.callbackHint")}
          </Text>
        </View>
      ) : null}

      {incomingRequests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("mobile.friends.incoming")} ({incomingRequests.length})
          </Text>
          {incomingRequests.map((r) => (
            <View key={r.user_id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.name}>{r.name || r.short_id}</Text>
                <Text style={styles.sub}>{r.friend_code}</Text>
              </View>
              <Pressable
                style={styles.callBtn}
                onPress={() => {
                  try {
                    hub.acceptFriend(r.user_id);
                    track("funnel_invite_connected", { via: "friends_accept" });
                    hapticLight();
                    showToast(t("mobile.friends.accepted"));
                    void maybeOfferNotifOptIn({
                      hub,
                      title: t("mobile.notif.optInTitle"),
                      body: t("mobile.notif.optInBody"),
                      enableLabel: t("mobile.notif.optInEnable"),
                      laterLabel: t("mobile.notif.optInLater"),
                      deniedTitle: t("mobile.notif.optInDeniedTitle"),
                      deniedBody: t("mobile.notif.optInDeniedBody"),
                      openSettingsLabel: t("mobile.notif.optInOpenSettings"),
                      batteryTitle: t("mobile.notif.batteryTitle"),
                      batteryBody: t("mobile.notif.batteryBody"),
                      batteryEnableLabel: t("mobile.notif.batteryEnable"),
                      onEnabled: () =>
                        showToast(t("mobile.notif.optInEnabled")),
                    });
                  } catch (e) {
                    showToast(String(e).slice(0, 80));
                  }
                }}
              >
                <Text style={styles.btnText}>{t("friends.accept")}</Text>
              </Pressable>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => {
                  try {
                    hub.declineFriend(r.user_id);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                <Text style={styles.btnTextMuted}>
                  {t("friends.declineReq")}
                </Text>
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
                <Text style={styles.name}>
                  {r.name || r.short_id || r.friend_code}
                </Text>
                <Text style={styles.sub}>{r.friend_code}</Text>
              </View>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => {
                  try {
                    hub.declineFriend(r.user_id);
                    showToast(t("mobile.friends.requestCancelled"));
                  } catch {
                    /* ignore */
                  }
                }}
              >
                <Text style={styles.btnTextMuted}>
                  {t("mobile.common.cancel")}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {matchHistory.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>
              {t("mobile.history.matchesTitle")}
            </Text>
            <Pressable
              onPress={() => {
                Alert.alert(t("mobile.history.clearMatches"), undefined, [
                  { text: t("mobile.common.cancel"), style: "cancel" },
                  {
                    text: t("mobile.friends.clear"),
                    style: "destructive",
                    onPress: async () => {
                      await clearMatchHistory();
                      await clearMatchThumbs();
                      setMatchHistory([]);
                      setMatchThumbs({});
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.clearLink}>{t("mobile.friends.clear")}</Text>
            </Pressable>
          </View>
          {matchHistory.slice(0, 12).map((h) => {
            const fr = friends.find((f) => f.user_id === h.user_id);
            const mins = Math.floor((h.duration_secs || 0) / 60);
            const secs = (h.duration_secs || 0) % 60;
            const dur =
              (h.duration_secs || 0) >= 60
                ? `${mins}m${secs ? ` ${secs}s` : ""}`
                : `${h.duration_secs || 0}s`;
            const thumb = matchThumbs[h.user_id];
            const letter = (h.name || "?").trim().charAt(0).toUpperCase() || "?";
            return (
              <View key={h.id} style={styles.matchCard}>
                <View style={styles.row}>
                  {thumb ? (
                    <Image
                      source={{ uri: thumb }}
                      style={styles.histThumb}
                      accessibilityLabel={t("mobile.history.thumbOnDevice")}
                    />
                  ) : (
                    <View style={styles.histThumbLetter}>
                      <Text style={styles.histThumbLetterText}>{letter}</Text>
                    </View>
                  )}
                  <Pressable
                    style={styles.rowMain}
                    onLongPress={() => {
                      const code = (h.friend_code || "").trim();
                      if (!code) return;
                      void Clipboard.setStringAsync(code).then(() => {
                        showToast(t("mobile.friends.codeCopied"));
                        hapticLight();
                      });
                    }}
                    delayLongPress={380}
                  >
                    <Text style={styles.name} numberOfLines={1}>
                      {flagEmoji(h.flag)
                        ? `${flagEmoji(h.flag)} `
                        : h.flag
                          ? `${h.flag} `
                          : ""}
                      {h.name}
                      {h.friend_code ? ` · ${h.friend_code}` : ""}
                    </Text>
                    <Text style={styles.sub}>
                      {dur}
                      {h.stars ? ` · ★${h.stars}` : ""}
                      {h.trust
                        ? ` · ${t(trustTierI18nKey(h.trust))} ${h.trust}`
                        : ""}
                      {h.mode && h.mode !== "solo" ? ` · ${h.mode}` : ""}
                      {` · ${formatWhen(h.t)}`}
                      {fr ? ` · ${t("mobile.friends.friend")}` : ""}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.matchActions}>
                  {h.friend_code && !fr ? (
                    <Pressable
                      style={styles.matchAct}
                      onPress={() => addMatchFriend(h)}
                    >
                      <Text style={styles.matchActText}>
                        {t("mobile.live.addFriend")}
                      </Text>
                    </Pressable>
                  ) : null}
                  {h.friend_code ? (
                    <Pressable
                      style={styles.matchActGhost}
                      onPress={() => {
                        void Clipboard.setStringAsync(h.friend_code || "").then(
                          () => {
                            showToast(t("mobile.friends.codeCopied"));
                            hapticLight();
                          }
                        );
                      }}
                    >
                      <Text style={styles.matchActTextMuted}>
                        {t("mobile.friends.copyCode")}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.matchActGhost}
                    onPress={() => reportMatchHistory(h)}
                  >
                    <Text style={styles.matchActTextWarn}>
                      {t("mobile.live.report")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.matchActGhost}
                    onPress={() => blockMatchHistory(h)}
                  >
                    <Text style={styles.matchActTextWarn}>
                      {t("mobile.friends.blockBtn")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.matchActGhost}
                    onPress={() => {
                      void removeMatchHistory(h.id).then(() =>
                        setMatchHistory((list) =>
                          list.filter((x) => x.id !== h.id)
                        )
                      );
                    }}
                  >
                    <Text style={styles.matchActTextMuted}>
                      {t("mobile.history.dismiss")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
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
          {history.slice(0, 20).map((h) => {
            const fr = friends.find((f) => f.user_id === h.user_id);
            const online = !!fr?.online;
            return (
              <View key={h.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.name}>{h.name}</Text>
                  <Text style={styles.sub}>
                    {t(kindI18nKey(h.kind))}
                    {h.kind === "missed"
                      ? ` · ${t("mobile.history.callbackHint")}`
                      : ""}{" "}
                    · {formatWhen(h.t)}
                    {online ? ` · ${t("mobile.common.online")}` : ""}
                    {!fr ? ` · ${t("mobile.history.notFriend")}` : ""}
                  </Text>
                </View>
                {fr ? (
                  <Pressable
                    style={online ? styles.histCallBtn : styles.histCallBtnMuted}
                    onPress={() => callFromHistory(h)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      online
                        ? t("mobile.history.callBack")
                        : t("mobile.history.ringAnyway")
                    }
                  >
                    <Ionicons
                      name={online ? "call" : "call-outline"}
                      size={14}
                      color={online ? "#b8f5d4" : "#9aa8bc"}
                    />
                    <Text
                      style={
                        online
                          ? styles.histCallBtnText
                          : styles.histCallBtnTextMuted
                      }
                      numberOfLines={1}
                    >
                      {online
                        ? t("friends.call")
                        : t("mobile.history.ringAnyway")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t("mobile.friends.list", { n: sortedFriends.length })}
        {query ? ` · “${query}”` : ""}
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      <FlatList
        data={sortedFriends}
        keyExtractor={(f) => f.user_id}
        style={styles.list}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View
            style={styles.emptyWrap}
            accessibilityRole="summary"
            accessibilityLabel={t("mobile.friends.empty")}
          >
            <Text style={styles.empty} importantForAccessibility="no">
              {t("mobile.friends.empty")}
            </Text>
            <Pressable
              style={styles.shareBtn}
              onPress={shareMyCode}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.friends.shareInvite")}
            >
              <Text style={styles.btnText} importantForAccessibility="no">
                {t("mobile.friends.shareInvite")}
              </Text>
            </Pressable>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#9ec5ff"
            colors={["#3d7eff"]}
            progressBackgroundColor="#12151c"
            accessibilityLabel={t("mobile.friends.list", {
              n: sortedFriends.length,
            })}
          />
        }
        renderItem={({ item }) => (
          <FriendRow
            item={item}
            unread={unreadDms[item.user_id] || 0}
            liveBusy={liveBusy}
            onCall={() => call(item)}
            onInvite={() => call(item, { join: true })}
            onChat={() => setChatFriend(item)}
            onRemove={() => removeFriend(item)}
            onCopyCode={() =>
              copyCode(item.friend_code || item.user_id.slice(0, 12))
            }
            onBlock={() => blockFriend(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
      <FriendChatSheet
        friend={chatFriend}
        visible={!!chatFriend}
        onClose={() => setChatFriend(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07080c",
  },
  list: {
    flex: 1,
    backgroundColor: "#07080c",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 4,
    backgroundColor: "#07080c",
    flexGrow: 1,
  },
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
  heroActions: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  shareBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#ff2d55",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  copyBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  warn: { color: "#ffe9a0", fontSize: 12 },
  onlineCount: { color: "#9effc8", fontSize: 12, fontWeight: "600" },
  liveBusyHint: {
    color: "#9ec5ff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 16,
  },
  addRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e8eef7",
    backgroundColor: "#12151c",
  },
  search: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e8eef7",
    backgroundColor: "#12151c",
  },
  addBtn: {
    backgroundColor: "#3d7eff",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 12,
  },
  addBtnDisabled: { opacity: 0.45 },
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
  copyHint: { color: "#6b7a90", fontSize: 11, marginTop: 2 },
  clearLink: { color: "#9aa8bc", fontSize: 13, fontWeight: "600" },
  missedHint: {
    color: "#ffd0d8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  missedBanner: {
    backgroundColor: "rgba(255,45,85,0.15)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,80,100,0.35)",
  },
  missedText: { color: "#ffb0bc", fontWeight: "700", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  onlinePill: {
    backgroundColor: "rgba(61,255,160,0.16)",
    borderWidth: 1,
    borderColor: "rgba(61,255,160,0.4)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  onlinePillText: {
    color: "#6dffa8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  offlinePill: {
    color: "#6b7a90",
    fontSize: 11,
    fontWeight: "600",
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    maxWidth: 88,
  },
  ctaBtnUnread: {
    backgroundColor: "rgba(61,126,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(100,160,255,0.4)",
  },
  ctaBtnCall: {
    backgroundColor: "rgba(45,159,111,0.4)",
    borderWidth: 1,
    borderColor: "rgba(45,159,111,0.55)",
  },
  ctaBtnMuted: {
    backgroundColor: "rgba(255,255,255,0.05)",
    opacity: 0.85,
  },
  ctaBtnText: {
    color: "#e8eef7",
    fontSize: 11,
    fontWeight: "800",
  },
  ctaBtnTextUnread: { color: "#c8dcff" },
  ctaBtnTextCall: { color: "#b8f5d4" },
  ctaBtnTextMuted: { color: "#9aa8bc", fontWeight: "700" },
  ctaBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  ctaBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  moreBtn: {
    width: 32,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  /** On-device center crop of partner (match history) */
  histThumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#121820",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  histThumbLetter: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#1a2230",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  histThumbLetterText: {
    color: "#9aabbf",
    fontWeight: "700",
    fontSize: 16,
  },
  matchCard: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 6,
  },
  matchActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingBottom: 4,
  },
  matchAct: {
    backgroundColor: "rgba(45,159,111,0.35)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  matchActGhost: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  matchActText: { color: "#b8f5d4", fontSize: 11, fontWeight: "800" },
  matchActTextMuted: { color: "#9aa8bc", fontSize: 11, fontWeight: "700" },
  matchActTextWarn: { color: "#ffb0bc", fontSize: 11, fontWeight: "700" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(61,126,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#c8dcff", fontWeight: "800", fontSize: 16 },
  dmBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#07080c",
  },
  dmBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  dot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#07080c",
  },
  dotOn: { backgroundColor: "#3dffa0" },
  dotOff: { backgroundColor: "#556070" },
  rowMain: { flex: 1 },
  name: { color: "#e8eef7", fontWeight: "700", fontSize: 15 },
  online: { color: "#6dffa8", fontWeight: "600" },
  offline: { color: "#6b7a90", fontWeight: "500" },
  sub: { color: "#6b7a90", fontSize: 12, marginTop: 2 },
  subUnread: { color: "#c8dcff", fontWeight: "700" },
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
  /** Dense icon actions (chat / call / more) on friend rows */
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconBtnUnread: {
    backgroundColor: "rgba(61,126,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(100,160,255,0.4)",
  },
  callIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2d9f6f",
  },
  /** Labeled call CTA on call-history rows */
  histCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(45,159,111,0.4)",
    borderWidth: 1,
    borderColor: "rgba(45,159,111,0.55)",
    maxWidth: 120,
  },
  histCallBtnMuted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    maxWidth: 130,
  },
  histCallBtnText: {
    color: "#b8f5d4",
    fontWeight: "800",
    fontSize: 11,
  },
  histCallBtnTextMuted: {
    color: "#9aa8bc",
    fontWeight: "700",
    fontSize: 11,
  },
  iconBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  iconBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnTextMuted: { color: "#9aa8bc", fontWeight: "600", fontSize: 13 },
  emptyWrap: { gap: 12, marginTop: 16, alignItems: "flex-start" },
  empty: { color: "#6b7a90", fontSize: 13, lineHeight: 20 },
});
