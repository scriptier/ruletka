import { useCallback, useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import {
  Redirect,
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { flagEmoji } from "../src/identity/flagTrust";
import { loadMatchPrefs } from "../src/prefs/store";
import { maybeOfferNotifOptIn } from "../src/push/notifOptIn";
import {
  forgetBlock,
  rememberBlock,
  resolveBlockedList,
  type BlockedEntry,
} from "../src/safety/blocks";
import { pushReportHistory } from "../src/safety/reportHistory";
import {
  cleanPartnerLabel,
  isHexIdLike,
  isPlaceholderPartnerName,
} from "../src/live/matchPeers";

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

/**
 * Signal-style row time: time today, weekday this week, else short date.
 * Used on friend list (last_msg_ts) and history.
 */
function formatRowTime(ts: number | undefined | null): string {
  if (!ts || !Number.isFinite(ts) || ts <= 0) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const startThat = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    ).getTime();
    const dayMs = 86400000;
    if (startThat === startToday) {
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (startThat === startToday - dayMs) {
      // "Yesterday" — keep short; full locale string can be long
      return d.toLocaleDateString(undefined, { weekday: "short" });
    }
    if (now.getTime() - d.getTime() < 6 * dayMs) {
      return d.toLocaleDateString(undefined, { weekday: "short" });
    }
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** Signal-like solid avatar colors (dark theme). */
const SIGNAL_AVATAR_COLORS = [
  "#6B7CFF",
  "#C45CFF",
  "#E85D75",
  "#F0A202",
  "#2BB673",
  "#3D9EED",
  "#FF6B4A",
  "#9B6DFF",
];

function signalAvatarColor(seed: string): string {
  let h = 0;
  const s = seed || "?";
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return SIGNAL_AVATAR_COLORS[Math.abs(h) % SIGNAL_AVATAR_COLORS.length];
}

/** data: / http(s) / file:// — hub may send avatar as data URL. */
function isAvatarUri(uri: string | undefined | null): boolean {
  if (!uri || typeof uri !== "string") return false;
  const s = uri.trim();
  if (!s) return false;
  return (
    s.startsWith("data:image/") ||
    s.startsWith("https://") ||
    s.startsWith("http://") ||
    s.startsWith("file://")
  );
}

/**
 * Prefer a real display name; if name is 6–12 hex poison, show friend_code
 * (or a non-hex short_id) instead of raw hex as the "name".
 */
function friendDisplayName(
  item: {
    name?: string;
    short_id?: string;
    friend_code?: string;
    user_id?: string;
  },
  fallback: string
): string {
  const name = (item.name || "").trim();
  const code = (item.friend_code || "").trim();
  const shortId = (item.short_id || "").trim();
  const ids = { userId: item.user_id, shortId };
  if (name && !isPlaceholderPartnerName(name, ids) && !isHexIdLike(name)) {
    return name;
  }
  if (code) return code;
  if (shortId && !isHexIdLike(shortId)) return shortId;
  if (name) return name;
  if (shortId) return shortId;
  return fallback;
}

/**
 * Match-history title: real name preferred; never pure hex as primary when
 * friend_code exists → "Partner · CODE". Friend list name wins when non-poison.
 */
function matchHistoryDisplayName(
  h: MatchHistoryEntry,
  fr?: FriendInfo | null
): { title: string; letter: string } {
  const ids = {
    userId: h.user_id,
    shortId: h.short_id || fr?.short_id,
  };
  const code = cleanPartnerLabel(h.friend_code || fr?.friend_code).toUpperCase();
  const friendName = cleanPartnerLabel(fr?.name);
  if (friendName && !isPlaceholderPartnerName(friendName, ids)) {
    return {
      title: friendName,
      letter: friendName.charAt(0).toUpperCase() || "?",
    };
  }
  const raw = cleanPartnerLabel(h.name);
  if (raw && !isPlaceholderPartnerName(raw, ids)) {
    return {
      title: raw,
      letter: raw.charAt(0).toUpperCase() || "?",
    };
  }
  if (code) {
    return {
      title: `Partner · ${code}`,
      letter: code.charAt(0).toUpperCase() || "P",
    };
  }
  return { title: "Partner", letter: "P" };
}

/** Soft two-tone letter tile palette (no linear-gradient dep). */
const LETTER_TILE_PALETTE: {
  top: string;
  bot: string;
  text: string;
  border: string;
}[] = [
  {
    top: "rgba(61,126,255,0.42)",
    bot: "rgba(30,60,120,0.55)",
    text: "#d4e4ff",
    border: "rgba(120,170,255,0.35)",
  },
  {
    top: "rgba(255,45,85,0.38)",
    bot: "rgba(100,20,40,0.55)",
    text: "#ffc8d4",
    border: "rgba(255,120,150,0.32)",
  },
  {
    top: "rgba(45,180,120,0.40)",
    bot: "rgba(20,80,55,0.55)",
    text: "#c0f5dc",
    border: "rgba(80,220,160,0.32)",
  },
  {
    top: "rgba(180,120,255,0.40)",
    bot: "rgba(70,40,120,0.55)",
    text: "#e4d4ff",
    border: "rgba(180,140,255,0.32)",
  },
  {
    top: "rgba(255,170,60,0.38)",
    bot: "rgba(120,70,20,0.55)",
    text: "#ffe4b8",
    border: "rgba(255,190,100,0.32)",
  },
  {
    top: "rgba(60,200,220,0.38)",
    bot: "rgba(20,80,100,0.55)",
    text: "#c8f4fc",
    border: "rgba(100,210,230,0.32)",
  },
];

function letterTilePalette(seed: string) {
  let h = 0;
  const s = seed || "?";
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return LETTER_TILE_PALETTE[Math.abs(h) % LETTER_TILE_PALETTE.length];
}

function MatchThumbLetter(props: {
  letter: string;
  seed: string;
  size?: number;
  radius?: number;
}) {
  const { letter, seed, size = 54, radius = 12 } = props;
  const pal = letterTilePalette(seed);
  return (
    <View
      style={[
        styles.histThumbLetter,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: pal.border,
          backgroundColor: pal.bot,
        },
      ]}
    >
      <View
        style={[
          styles.histThumbLetterGrad,
          {
            backgroundColor: pal.top,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
          },
        ]}
      />
      <Text style={[styles.histThumbLetterText, { color: pal.text }]}>
        {(letter || "?").slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

/** Last-message preview for row line 3 (~48 chars). */
function lastMsgSnippet(msg: string | undefined, max = 48): string {
  const s = (msg || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Browser Friends sheet is titled Chats (`friends.tabList`). Overlay may
 * still ship "Friends" or miss the key — only keep a chat-like label.
 */
function chatsScreenTitle(
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  for (const key of ["friends.tabList", "friends.title"] as const) {
    const s = String(t(key) || "").trim();
    if (s && s !== key && /chat|чат/i.test(s)) return s;
  }
  return "Chats";
}

function chatsSearchPlaceholder(
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const s = String(t("friends.searchChats") || "").trim();
  if (s && s !== "friends.searchChats") return s;
  return t("mobile.friends.search");
}

function FriendRow(props: {
  item: FriendInfo;
  unread: number;
  /** In a live 1v1 — show Invite (join) instead of Call. */
  liveBusy: boolean;
  /** Already you+3 remotes — no 5th. */
  partyFull?: boolean;
  onCall: () => void;
  onInvite: () => void;
  onChat: () => void;
  onRemove: () => void;
  onCopyCode: () => void;
}) {
  const {
    item,
    unread,
    liveBusy,
    partyFull,
    onCall,
    onInvite,
    onChat,
    onRemove,
    onCopyCode,
  } = props;
  const t = useT();
  const showInvite = liveBusy && !partyFull;
  /** a11y only — row is chat-first like Signal; call is icon on the right. */
  const callA11y = partyFull
    ? t("mobile.friends.invitePartyFull")
    : liveBusy
    ? t("mobile.friends.inviteJoin")
    : item.online
      ? t("friends.call")
      : t("mobile.history.ringAnyway");
  const chatLabel = t("mobile.friends.chat");
  const callActive = liveBusy ? item.online : true;
  const friendName = friendDisplayName(
    {
      name: item.name,
      short_id: item.short_id,
      friend_code: item.friend_code,
      user_id: item.user_id,
    },
    t("mobile.friends.friend")
  );
  const onlineState = item.online
    ? t("mobile.common.online")
    : t("mobile.common.offline");
  const avatarUri = isAvatarUri(item.avatar) ? item.avatar!.trim() : "";
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUri]);
  const letter = (friendName || "?").slice(0, 1).toUpperCase();
  const avatarBg = signalAvatarColor(
    item.user_id || item.friend_code || friendName
  );
  const snippet = lastMsgSnippet(item.last_msg, 52);
  const fallbackSub = onlineState;
  const preview = snippet || fallbackSub;
  const when = formatRowTime(item.last_msg_ts);
  const showAvatar = !!avatarUri && !avatarFailed;

  function openActions() {
    Alert.alert(friendName, t("mobile.friends.actionsHint"), [
      { text: t("mobile.common.cancel"), style: "cancel" },
      {
        text: t("mobile.friends.copyCode"),
        onPress: onCopyCode,
      },
      {
        text: showInvite
          ? t("mobile.friends.inviteJoin")
          : t("friends.call"),
        onPress: showInvite ? onInvite : onCall,
      },
      {
        text: t("mobile.friends.removeBtn"),
        style: "destructive",
        onPress: onRemove,
      },
    ]);
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onChat}
      onLongPress={openActions}
      delayLongPress={380}
      accessibilityRole="button"
      accessibilityLabel={`${friendName}. ${onlineState}${
        preview ? `. ${preview}` : ""
      }${unread > 0 ? `. ${chatLabel} ${unread > 9 ? "9+" : unread}` : ""}`}
      accessibilityHint={t("mobile.friends.actionsHint")}
    >
      <View style={styles.avatarOuter} importantForAccessibility="no">
        <View
          style={[
            styles.avatar,
            !showAvatar ? { backgroundColor: avatarBg } : null,
          ]}
        >
          {showAvatar ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatarImg}
              resizeMode="cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <Text style={styles.avatarText}>{letter}</Text>
          )}
        </View>
        <View
          style={[styles.dot, item.online ? styles.dotOn : styles.dotOff]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>

      <View style={styles.rowMain}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, unread > 0 && styles.nameUnread]}
            numberOfLines={1}
          >
            {friendName}
          </Text>
          {when ? (
            <Text
              style={[styles.rowTime, unread > 0 && styles.rowTimeUnread]}
              numberOfLines={1}
            >
              {when}
            </Text>
          ) : null}
        </View>
        <View style={styles.previewRow}>
          <Text
            style={[styles.snippet, unread > 0 && styles.snippetUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {unread > 0 ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>
                {unread > 99 ? "99+" : String(unread)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.rowActions}>
        <Pressable
          style={[
            styles.callIconOnly,
            !(callActive && !(showInvite && !item.online)) &&
              styles.callIconOnlyMuted,
          ]}
          onPress={(e) => {
            // Don't bubble to row → chat
            e?.stopPropagation?.();
            if (partyFull) {
              onInvite();
              return;
            }
            if (showInvite) onInvite();
            else onCall();
          }}
          accessibilityRole="button"
          accessibilityLabel={callA11y}
          hitSlop={8}
        >
          <Ionicons
            name={liveBusy ? "person-add" : "videocam"}
            size={20}
            color={
              partyFull ||
              !(callActive && !(showInvite && !item.online))
                ? "#6b7a90"
                : "#3d9eed"
            }
          />
        </Pressable>
      </View>
    </Pressable>
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
    liveRemoteCount,
    openFriendChat,
    reconnectHub,
    blockedIds,
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
  /** user_id → Image onError (broken/missing file://) */
  const [failedThumbs, setFailedThumbs] = useState<Record<string, true>>({});
  const [missed, setMissed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [chatFriend, setChatFriend] = useState<FriendInfo | null>(null);
  /** Local match/call history load lifecycle (empty ≠ error). */
  const [histStatus, setHistStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [sheetTab, setSheetTab] = useState<"list" | "history" | "blocked">(
    "list"
  );
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);

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
    setHistStatus((prev) => (prev === "ready" ? prev : "loading"));
    try {
      const n = await countUnreadMissed();
      setMissed(n);
      const list = await loadCallHistory();
      setHistory(Array.isArray(list) ? list : []);
      const matches = await loadMatchHistory();
      setMatchHistory(Array.isArray(matches) ? matches : []);
      try {
        const ids = (Array.isArray(matches) ? matches : [])
          .map((m) => m.user_id)
          .filter(Boolean);
        setMatchThumbs(await loadMatchThumbsMap(ids));
        // Fresh map may restore paths that previously failed to paint
        setFailedThumbs({});
      } catch {
        setMatchThumbs({});
        setFailedThumbs({});
      }
      await markMissedCallsRead();
      setMissed(0);
      try {
        const list = await resolveBlockedList(blockedIds);
        setBlocked(list);
        const ids = list.map((b) => b.user_id).filter(Boolean);
        const extraThumbs = await loadMatchThumbsMap(ids);
        setMatchThumbs((prev) => ({ ...prev, ...extraThumbs }));
      } catch {
        /* keep prior blocked rows */
      }
      setHistStatus("ready");
    } catch {
      // Keep prior rows if any; still surface recovery CTA
      setHistStatus("error");
    }
  }, [blockedIds]);

  useFocusEffect(
    useCallback(() => {
      void reloadHistory();
    }, [reloadHistory, callHistoryTick])
  );

  useEffect(() => {
    void reloadHistory();
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

  const chatsTitle = chatsScreenTitle(t);
  const searchPlaceholder = chatsSearchPlaceholder(t);

  const sortedFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...friends];
    if (q) {
      list = list.filter((f) => {
        const hay =
          `${f.name} ${f.short_id} ${f.friend_code} ${f.user_id} ${f.last_msg || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    // Signal-ish: recent DM activity first, then online, then name
    list.sort((a, b) => {
      const ta = Number(a.last_msg_ts) || 0;
      const tb = Number(b.last_msg_ts) || 0;
      if (ta !== tb) return tb - ta;
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    return list;
  }, [friends, query]);

  /** Pull-to-refresh + offline offline CTA: nudge hub + reload local history. */
  async function refresh() {
    setRefreshing(true);
    hapticLight();
    try {
      if (!connected) {
        try {
          reconnectHub();
        } catch {
          /* ignore */
        }
      }
      // Re-hello nudges hub to re-push friends snapshot
      const prefs = await loadMatchPrefs();
      hub.hello({
        user_id: identity.user_id,
        name: identity.name || "anon",
        gender: prefs.gender || "",
        looking: prefs.looking || "any",
        flag: prefs.flag || "",
        hide_ip: !!prefs.hideIp,
        avatar: prefs.avatar || "",
      });
      await reloadHistory();
    } catch {
      /* ignore — empty/error UI still offers Retry */
    }
    setTimeout(() => setRefreshing(false), 600);
  }

  function retryConnection() {
    hapticLight();
    try {
      reconnectHub();
    } catch {
      /* ignore */
    }
    void refresh();
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
    const c = (friendCode || "").trim();
    if (!c) {
      showToast(
        connected
          ? t("mobile.common.loading")
          : t("mobile.friends.notConnected")
      );
      return;
    }
    try {
      const share = friendInviteShareMessage(hubBase(), c, "ruletka");
      track("funnel_invite_share", { via: "friends" });
      track("friend_invite_share", { via: "friends" });
      Share.share({
        message: share.message,
        title: share.title,
        url: share.url,
      }).catch(() => {
        showToast(t("mobile.friends.notConnected"));
      });
    } catch {
      showToast(t("mobile.friends.notConnected"));
    }
  }

  async function copyCode(c: string) {
    const text = (c || "").trim();
    if (!text) {
      showToast(
        friendCode
          ? t("mobile.friends.codeShort")
          : connected
            ? t("mobile.common.loading")
            : t("mobile.friends.notConnected")
      );
      return;
    }
    try {
      await Clipboard.setStringAsync(text);
      showToast(t("mobile.friends.codeCopied"));
    } catch {
      try {
        await Share.share({ message: text });
      } catch {
        showToast(t("mobile.friends.notConnected"));
      }
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
    if (opts?.join && liveBusy && liveRemoteCount >= 3) {
      showToast(t("mobile.friends.invitePartyFull"));
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
        avatar: "avatar" in f ? String(f.avatar || "") : "",
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
    const label = friendDisplayName(item, t("mobile.friends.friend"));
    Alert.alert(t("mobile.friends.remove"), label, [
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
              setSheetTab("blocked");
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
      setSheetTab("blocked");
    } catch (e) {
      showToast(t("mobile.friends.notConnected"));
    }
  }

  function unblockUser(uid: string, name?: string) {
    Alert.alert(
      t("friends.unblock") || t("mobile.settings.unblockTitle"),
      name || t("mobile.settings.unblockBody"),
      [
        { text: t("mobile.common.cancel"), style: "cancel" },
        {
          text: t("friends.unblock") || t("mobile.settings.unblockBtn"),
          onPress: () => {
            try {
              hub.unblockUser(uid);
              void forgetBlock(uid);
              setBlocked((list) => list.filter((e) => e.user_id !== uid));
              showToast(t("friends.unblock") || t("mobile.settings.unblockBtn"));
            } catch (e) {
              showToast(t("mobile.friends.notConnected"));
            }
          },
        },
      ]
    );
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

  const uniqueMatches = useMemo(() => {
    const seen = new Set<string>();
    const out: MatchHistoryEntry[] = [];
    for (const h of matchHistory) {
      const id = String(h.user_id || h.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(h);
      if (out.length >= 6) break;
    }
    return out;
  }, [matchHistory]);

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable
            style={styles.heroCodeHit}
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
            <Text style={styles.heroLabel}>{t("mobile.friends.yourCode")}</Text>
            <Text style={styles.heroCode} importantForAccessibility="no">
              {friendCode || "…"}
            </Text>
          </Pressable>
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
        {!connected ? (
          <Pressable
            style={styles.offlineRow}
            onPress={retryConnection}
            accessibilityRole="button"
            accessibilityLabel={`${t("mobile.friends.offline")} ${t("mobile.live.retryPath")}`}
            accessibilityHint={t("mobile.home.hubOfflineTap")}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.warn} accessibilityRole="alert">
              {t("mobile.friends.offline")}
            </Text>
            <View style={styles.retryBtn}>
              <Text style={styles.retryBtnText} importantForAccessibility="no">
                {t("mobile.live.retryPath")}
              </Text>
            </View>
          </Pressable>
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
            {liveRemoteCount >= 3
              ? t("mobile.friends.invitePartyFull")
              : t("mobile.friends.liveBusyHint")}
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

      <View style={styles.searchWrap}>
        <Ionicons
          name="search"
          size={16}
          color="#6b7a90"
          style={styles.searchIcon}
          importantForAccessibility="no"
        />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor="#6b7a90"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={searchPlaceholder}
        />
      </View>

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

      {histStatus === "loading" &&
      history.length === 0 &&
      matchHistory.length === 0 ? (
        <View
          style={styles.statusStrip}
          accessibilityRole="text"
          accessibilityLabel={t("mobile.common.loading")}
        >
          <ActivityIndicator size="small" color="#9ec5ff" />
          <Text style={styles.statusStripText}>
            {t("mobile.common.loading")}
          </Text>
        </View>
      ) : null}

      {/* Local history load failure only — when hub is down the hero offline
          strip is the single reconnect CTA; avoid a second Offline/Retry. */}
      {histStatus === "error" && connected ? (
        <Pressable
          style={styles.errorBanner}
          onPress={() => {
            void reloadHistory();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t("mobile.live.errorTitle")} ${t("mobile.live.retryPath")}`}
        >
          <View style={styles.errorBannerTextCol}>
            <Text style={styles.errorBannerTitle}>
              {t("mobile.live.errorTitle")}
            </Text>
            <Text style={styles.errorBannerBody}>
              {t("mobile.friends.notConnected")}
            </Text>
          </View>
          <View style={styles.retryBtn}>
            <Text style={styles.retryBtnText} importantForAccessibility="no">
              {t("mobile.live.retryPath")}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {incomingRequests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("mobile.friends.incoming")} ({incomingRequests.length})
          </Text>
          {incomingRequests.map((r) => {
            const reqName = r.name || r.short_id || r.friend_code || "?";
            const reqLetter = (reqName || "?").slice(0, 1).toUpperCase();
            const reqColor = signalAvatarColor(
              r.user_id || r.friend_code || reqName
            );
            return (
              <View key={r.user_id} style={styles.row}>
                <View
                  style={[styles.reqAvatar, { backgroundColor: reqColor }]}
                  importantForAccessibility="no"
                >
                  <Text style={styles.reqAvatarText}>{reqLetter}</Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.name}>{reqName}</Text>
                  <Text style={styles.sub}>{r.friend_code}</Text>
                </View>
                <Pressable
                  style={styles.acceptBtnSoft}
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
                      showToast(t("mobile.friends.notConnected"));
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("friends.accept")}
                >
                  <Text
                    style={styles.acceptBtnSoftText}
                    importantForAccessibility="no"
                  >
                    {t("friends.accept")}
                  </Text>
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
                  accessibilityRole="button"
                  accessibilityLabel={t("friends.declineReq")}
                >
                  <Text
                    style={styles.btnTextMuted}
                    importantForAccessibility="no"
                  >
                    {t("friends.declineReq")}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {outgoingRequests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mobile.friends.waiting")}</Text>
          {outgoingRequests.map((r) => (
            <View key={r.user_id} style={[styles.row, styles.rowMuted]}>
              <View style={styles.rowMain}>
                <Text style={styles.nameMuted}>
                  {r.name || r.short_id || r.friend_code}
                </Text>
                <Text style={styles.sub}>{r.friend_code}</Text>
              </View>
              <Pressable
                style={styles.cancelTextBtn}
                onPress={() => {
                  try {
                    hub.declineFriend(r.user_id);
                    showToast(t("mobile.friends.requestCancelled"));
                  } catch {
                    /* ignore */
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={t("mobile.common.cancel")}
                hitSlop={8}
              >
                <Text
                  style={styles.cancelTextBtnText}
                  importantForAccessibility="no"
                >
                  {t("mobile.common.cancel")}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {chatsTitle} ({sortedFriends.length})
        {query ? ` · “${query}”` : ""}
      </Text>
    </View>
  );

  const listFooter = (
    <View style={styles.footerBlock}>
      {uniqueMatches.length === 0 && history.length === 0 ? (
        <Text style={styles.empty}>{t("friends.historyTitle")}</Text>
      ) : null}
      {uniqueMatches.length > 0 ? (
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
                      setFailedThumbs({});
                    },
                  },
                ]);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.history.clearMatches")}
            >
              <Text style={styles.clearLink} importantForAccessibility="no">
                {t("mobile.friends.clear")}
              </Text>
            </Pressable>
          </View>
          {uniqueMatches.map((h) => {
            const fr = friends.find((f) => f.user_id === h.user_id);
            const mins = Math.floor((h.duration_secs || 0) / 60);
            const secs = (h.duration_secs || 0) % 60;
            const dur =
              (h.duration_secs || 0) >= 60
                ? `${mins}m${secs ? ` ${secs}s` : ""}`
                : `${h.duration_secs || 0}s`;
            const thumbUri = matchThumbs[h.user_id];
            const showThumb = !!thumbUri && !failedThumbs[h.user_id];
            // Prefer on-device match thumb; else friend hub avatar; else letter tile.
            const friendAv =
              !showThumb &&
              fr &&
              isAvatarUri(fr.avatar) &&
              !failedThumbs[`fav:${h.user_id}`]
                ? fr.avatar!.trim()
                : "";
            const { title: matchTitle, letter } = matchHistoryDisplayName(h, fr);
            const flag = flagEmoji(h.flag) || (h.flag ? String(h.flag) : "");
            const starsN = Number(h.stars) || 0;
            const friendSnippet = fr?.last_msg
              ? lastMsgSnippet(fr.last_msg, 48)
              : "";
            const subParts = [
              dur,
              formatWhen(h.t),
              fr ? t("mobile.friends.friend") : "",
              starsN > 0 ? `★${starsN}` : "",
              h.mode && h.mode !== "solo" ? h.mode : "",
            ].filter(Boolean);
            return (
              <View key={h.id} style={styles.matchCard}>
                <View style={styles.row}>
                  {showThumb ? (
                    <Image
                      source={{ uri: thumbUri }}
                      style={styles.histThumb}
                      accessibilityLabel={t("mobile.history.thumbOnDevice")}
                      onError={() => {
                        setFailedThumbs((prev) =>
                          prev[h.user_id]
                            ? prev
                            : { ...prev, [h.user_id]: true }
                        );
                      }}
                    />
                  ) : friendAv ? (
                    <Image
                      source={{ uri: friendAv }}
                      style={styles.histThumb}
                      resizeMode="cover"
                      onError={() => {
                        const k = `fav:${h.user_id}`;
                        setFailedThumbs((prev) =>
                          prev[k] ? prev : { ...prev, [k]: true }
                        );
                      }}
                    />
                  ) : (
                    <MatchThumbLetter
                      letter={letter}
                      seed={h.user_id || matchTitle}
                    />
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
                    accessibilityRole="text"
                    accessibilityLabel={`${matchTitle}. ${subParts.join(" · ")}`}
                    accessibilityHint={
                      h.friend_code ? t("mobile.friends.copyCode") : undefined
                    }
                  >
                    <Text style={styles.name} numberOfLines={1}>
                      {flag ? `${flag} ` : ""}
                      {matchTitle}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {subParts.join(" · ")}
                    </Text>
                    {friendSnippet ? (
                      <Text style={styles.matchLastMsg} numberOfLines={1}>
                        {`Last: ${friendSnippet}`}
                      </Text>
                    ) : null}
                  </Pressable>
                <View style={styles.matchActions}>
                  {fr ? (
                    <Pressable
                      style={styles.matchAct}
                      onPress={() => setChatFriend(fr)}
                      accessibilityRole="button"
                      accessibilityLabel={t("mobile.friends.chat")}
                    >
                      <Text
                        style={styles.matchActText}
                        importantForAccessibility="no"
                      >
                        {t("mobile.friends.chat")}
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      {h.friend_code ? (
                        <Pressable
                          style={styles.matchAct}
                          onPress={() => addMatchFriend(h)}
                          accessibilityRole="button"
                          accessibilityLabel={t("mobile.live.addFriend")}
                        >
                          <Text
                            style={styles.matchActText}
                            importantForAccessibility="no"
                          >
                            {t("mobile.live.addFriend")}
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={styles.matchAct}
                        onPress={() => blockMatchHistory(h)}
                        accessibilityRole="button"
                        accessibilityLabel={t("mobile.friends.blockBtn")}
                      >
                        <Text
                          style={styles.matchActText}
                          importantForAccessibility="no"
                        >
                          {t("mobile.friends.blockBtn")}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.matchAct}
                        onPress={() => reportMatchHistory(h)}
                        accessibilityRole="button"
                        accessibilityLabel={t("mobile.live.report")}
                      >
                        <Text
                          style={styles.matchActText}
                          importantForAccessibility="no"
                        >
                          {t("mobile.live.report")}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
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
              accessibilityRole="button"
              accessibilityLabel={t("mobile.history.clear")}
            >
              <Text style={styles.clearLink} importantForAccessibility="no">
                {t("mobile.friends.clear")}
              </Text>
            </Pressable>
          </View>
          {history.slice(0, 20).map((h) => (
            <CallHistRow
              key={h.id}
              entry={h}
              friend={friends.find((f) => f.user_id === h.user_id)}
              onCall={() => callFromHistory(h)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  const tabChats = t("friends.tabList") || chatsTitle;
  const tabCalls = t("friends.tabCalls") || t("friends.tabHistory") || "Calls";
  const tabBlocked = t("friends.tabBlocked") || "Blocked";
  const screenTitle =
    sheetTab === "history"
      ? tabCalls
      : sheetTab === "blocked"
        ? tabBlocked
        : chatsTitle;

  const tabs = (
    <View style={styles.tabsRow} accessibilityRole="tablist">
      {(
        [
          ["list", tabChats, sortedFriends.length],
          ["history", tabCalls, uniqueMatches.length + history.length],
          ["blocked", tabBlocked, blocked.length],
        ] as const
      ).map(([id, label, n]) => {
        const on = sheetTab === id;
        return (
          <Pressable
            key={id}
            style={[styles.tabBtn, on && styles.tabBtnOn]}
            onPress={() => setSheetTab(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${label}${n ? ` ${n}` : ""}`}
            testID={`friends-tab-${id}`}
          >
            <Text style={[styles.tabBtnText, on && styles.tabBtnTextOn]}>
              {label}
              {n ? ` ${n}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const blockedPanel = (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.blockedPad}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor="#9ec5ff"
          colors={["#3d7eff"]}
          progressBackgroundColor="#12151c"
        />
      }
    >
      {blocked.length === 0 ? (
        <Text style={styles.empty}>{t("friends.blockedEmpty")}</Text>
      ) : (
        <>
          <Text style={styles.blockedHint}>
            {t("friends.blockedThumbHint") ||
              "Snapshots stay on this device. Tap to unblock."}
          </Text>
          <View style={styles.blockedGrid}>
            {blocked.map((b) => {
              const thumb = matchThumbs[b.user_id];
              const showThumb = !!thumb && !failedThumbs[b.user_id];
              const letter =
                (b.name || b.user_id || "?").trim().charAt(0).toUpperCase() ||
                "?";
              return (
                <Pressable
                  key={b.user_id}
                  style={styles.blockedTile}
                  onPress={() => unblockUser(b.user_id, b.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("friends.unblock") || "Unblock"} ${b.name || b.user_id.slice(0, 8)}`}
                  testID="friends-blocked-tile"
                >
                  {showThumb ? (
                    <Image
                      source={{ uri: thumb }}
                      style={styles.blockedThumb}
                      blurRadius={12}
                      accessibilityLabel={t("mobile.history.thumbOnDevice")}
                      onError={() => {
                        setFailedThumbs((prev) =>
                          prev[b.user_id]
                            ? prev
                            : { ...prev, [b.user_id]: true }
                        );
                      }}
                    />
                  ) : (
                    <View style={styles.blockedLetter}>
                      <Text style={styles.blockedLetterText}>{letter}</Text>
                    </View>
                  )}
                  <Text style={styles.blockedName} numberOfLines={1}>
                    {b.name || b.user_id.slice(0, 8)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
      // Android's window already resizes for the keyboard (adjustResize);
      // iOS needs this explicitly or the code/search inputs and the
      // native header both end up hidden under the keyboard.
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: screenTitle }} />
      {tabs}
      {sheetTab === "history" ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#9ec5ff"
              colors={["#3d7eff"]}
              progressBackgroundColor="#12151c"
            />
          }
        >
          {listFooter}
        </ScrollView>
      ) : null}
      {sheetTab === "blocked" ? blockedPanel : null}
      {sheetTab === "list" ? (
      <FlatList
        data={sortedFriends}
        keyExtractor={(f, index) =>
          f.user_id || f.friend_code || f.short_id || `friend-${index}`
        }
        style={styles.list}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          (() => {
            const q = query.trim();
            const isSearchMiss = !!q && friends.length > 0;
            const emptyTitle = isSearchMiss
              ? t("mobile.friends.searchEmpty", { query: q })
              : t("mobile.friends.emptyTitle");
            const emptyBody = isSearchMiss
              ? ""
              : t("mobile.friends.empty");
            // Offline · Retry lives only in the hero offline strip (listHeader).
            // Do not duplicate it here when the list is empty.
            const a11y = [emptyTitle, emptyBody].filter(Boolean).join(". ");
            return (
              <View
                style={styles.emptyWrap}
                accessibilityRole="summary"
                accessibilityLabel={a11y}
              >
                <Text style={styles.emptyTitle} importantForAccessibility="no">
                  {emptyTitle}
                </Text>
                {emptyBody ? (
                  <Text style={styles.empty} importantForAccessibility="no">
                    {emptyBody}
                  </Text>
                ) : null}
                {!isSearchMiss ? (
                  <View style={styles.heroActions}>
                    <Pressable
                      style={styles.shareBtn}
                      onPress={shareMyCode}
                      accessibilityRole="button"
                      accessibilityLabel={t("mobile.friends.shareInvite")}
                    >
                      <Text
                        style={styles.btnText}
                        importantForAccessibility="no"
                      >
                        {t("mobile.friends.shareInvite")}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.copyBtn}
                      onPress={() => copyCode(friendCode)}
                      accessibilityRole="button"
                      accessibilityLabel={t("mobile.friends.copyCode")}
                    >
                      <Text
                        style={styles.btnText}
                        importantForAccessibility="no"
                      >
                        {t("mobile.friends.copyCode")}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.copyBtn}
                    onPress={() => setQuery("")}
                    accessibilityRole="button"
                    accessibilityLabel={t("mobile.friends.clear")}
                  >
                    <Text style={styles.btnText} importantForAccessibility="no">
                      {t("mobile.friends.clear")}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })()
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
            partyFull={liveBusy && liveRemoteCount >= 3}
            onCall={() => call(item)}
            onInvite={() => call(item, { join: true })}
            onChat={() => setChatFriend(item)}
            onRemove={() => removeFriend(item)}
            onCopyCode={() =>
              copyCode(item.friend_code || item.user_id.slice(0, 12))
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
      ) : null}
      <FriendChatSheet
        friend={chatFriend}
        visible={!!chatFriend}
        onClose={() => setChatFriend(null)}
        onCall={() => {
          if (!chatFriend) return;
          const f = chatFriend;
          setChatFriend(null);
          call(f);
        }}
      />
    </KeyboardAvoidingView>
  );
}

/** Call-history row: left circle = friend avatar or letter. */
function CallHistRow(props: {
  entry: CallHistoryEntry;
  friend?: FriendInfo;
  onCall: () => void;
}) {
  const { entry: h, friend: fr, onCall } = props;
  const t = useT();
  const online = !!fr?.online;
  const histName = friendDisplayName(
    {
      name: h.name || fr?.name,
      short_id: h.short_id || fr?.short_id,
      friend_code: h.friend_code || fr?.friend_code,
      user_id: h.user_id,
    },
    h.name || t("mobile.friends.friend")
  );
  const av = fr && isAvatarUri(fr.avatar) ? fr.avatar!.trim() : "";
  const [avFailed, setAvFailed] = useState(false);
  useEffect(() => {
    setAvFailed(false);
  }, [av]);
  const letter = (histName || "?").slice(0, 1).toUpperCase();
  const showAv = !!av && !avFailed;
  const when = formatRowTime(h.t);
  const kindLine = [
    t(kindI18nKey(h.kind)),
    h.kind === "missed" ? t("mobile.history.callbackHint") : "",
    !fr ? t("mobile.history.notFriend") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const avBg = signalAvatarColor(h.user_id || histName);
  return (
    <Pressable
      style={({ pressed }) => [styles.histRow, pressed && styles.rowPressed]}
      onPress={fr ? onCall : undefined}
      disabled={!fr}
      accessibilityRole={fr ? "button" : "text"}
      accessibilityLabel={`${histName}. ${kindLine}`}
    >
      <View style={styles.histAvatarOuter} importantForAccessibility="no">
        <View
          style={[
            styles.histAvatar,
            !showAv ? { backgroundColor: avBg } : null,
          ]}
        >
          {showAv ? (
            <Image
              source={{ uri: av }}
              style={styles.histAvatarImg}
              resizeMode="cover"
              onError={() => setAvFailed(true)}
            />
          ) : (
            <Text style={styles.histAvatarText}>{letter}</Text>
          )}
        </View>
        {fr ? (
          <View
            style={[styles.dot, online ? styles.dotOn : styles.dotOff]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>
      <View style={styles.rowMain}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {histName}
          </Text>
          {when ? (
            <Text style={styles.rowTime} numberOfLines={1}>
              {when}
            </Text>
          ) : null}
        </View>
        <Text style={styles.snippet} numberOfLines={1}>
          {kindLine}
        </Text>
      </View>
      {fr ? (
        <Pressable
          style={[styles.callIconOnly, !online && styles.callIconOnlyMuted]}
          onPress={onCall}
          accessibilityRole="button"
          accessibilityLabel={
            online
              ? t("mobile.history.callBack")
              : t("mobile.history.ringAnyway")
          }
          hitSlop={8}
        >
          <Ionicons
            name={online ? "videocam" : "videocam-outline"}
            size={20}
            color={online ? "#3d9eed" : "#6b7a90"}
          />
        </Pressable>
      ) : null}
    </Pressable>
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
  screenTitle: {
    color: "#f0f3f8",
    fontWeight: "800",
    fontSize: 22,
    letterSpacing: -0.3,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnOn: {
    borderBottomColor: "#ff2d55",
  },
  tabBtnText: {
    color: "#8b97ab",
    fontSize: 14,
    fontWeight: "700",
  },
  tabBtnTextOn: {
    color: "#f0f3f8",
  },
  blockedPad: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  blockedHint: {
    color: "#8b97ab",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  blockedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  blockedTile: {
    width: "30%",
    minWidth: 88,
    alignItems: "center",
    gap: 6,
  },
  blockedThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#1a2030",
  },
  blockedLetter: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#243044",
    alignItems: "center",
    justifyContent: "center",
  },
  blockedLetterText: {
    color: "#d7e2f2",
    fontSize: 22,
    fontWeight: "800",
  },
  blockedName: {
    color: "#c5d0e0",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  hero: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,45,85,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.22)",
    gap: 6,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heroCodeHit: { flex: 1, minWidth: 0, gap: 2 },
  heroLabel: { color: "#9aa8bc", fontSize: 11, fontWeight: "600" },
  heroCode: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  shareBtn: {
    alignSelf: "center",
    backgroundColor: "#ff2d55",
    paddingVertical: 8,
    paddingHorizontal: 14,
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
  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
    flexWrap: "wrap",
  },
  retryBtn: {
    backgroundColor: "rgba(61,126,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(100,160,255,0.45)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  retryBtnText: {
    color: "#c8dcff",
    fontSize: 12,
    fontWeight: "800",
  },
  statusStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(61,126,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(100,160,255,0.25)",
  },
  statusStripText: { color: "#9ec5ff", fontSize: 13, fontWeight: "600" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,170,60,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,190,100,0.35)",
  },
  errorBannerTextCol: { flex: 1, gap: 2 },
  errorBannerTitle: {
    color: "#ffe4b8",
    fontSize: 13,
    fontWeight: "800",
  },
  errorBannerBody: {
    color: "#d0b890",
    fontSize: 12,
    lineHeight: 16,
  },
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#16181f",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  search: {
    flex: 1,
    paddingVertical: 11,
    color: "#e8eef7",
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: "#3d7eff",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 12,
  },
  addBtnDisabled: { opacity: 0.45 },
  footerBlock: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 4,
    backgroundColor: "#07080c",
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
  rowPressed: { backgroundColor: "rgba(255,255,255,0.04)" },
  /** Outgoing (waiting) requests — de-emphasized vs. incoming/friends. */
  rowMuted: { opacity: 0.68 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  nameUnread: { color: "#fff" },
  nameMuted: { color: "#9aa8bc", fontWeight: "600", fontSize: 15 },
  rowTime: { color: "#6b7a90", fontSize: 11, fontWeight: "600" },
  rowTimeUnread: { color: "#9ec5ff", fontWeight: "800" },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#3d7eff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadPillText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  /** Incoming request avatar — same letter-tile spirit as friend rows. */
  reqAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reqAvatarText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  acceptBtnSoft: {
    backgroundColor: "rgba(45,159,111,0.32)",
    borderWidth: 1,
    borderColor: "rgba(45,159,111,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  acceptBtnSoftText: { color: "#b8f5d4", fontWeight: "800", fontSize: 13 },
  cancelTextBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  cancelTextBtnText: { color: "#9aa8bc", fontWeight: "700", fontSize: 13 },
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
  /** On-device center crop of partner (match history) — 54px · rounded-12 */
  histThumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#121820",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  histThumbLetter: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#1a2230",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
  },
  /** Soft top wash for letter tiles (no linear-gradient dep). */
  histThumbLetterGrad: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  histThumbLetterText: {
    color: "#9aabbf",
    fontWeight: "800",
    fontSize: 20,
    zIndex: 1,
  },
  /** Call-history row: slightly taller for avatar + larger CTA */
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  /** Outer so online presence dot is not clipped by histAvatar overflow. */
  histAvatarOuter: {
    width: 50,
    height: 50,
    position: "relative",
    flexShrink: 0,
  },
  histAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#6B7CFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "rgba(255,255,255,0.12)",
    flexShrink: 0,
  },
  histAvatarImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  histAvatarText: {
    color: "#c8dcff",
    fontWeight: "800",
    fontSize: 17,
  },
  matchCard: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  matchLastMsg: {
    color: "#7a8a9e",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  matchActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  matchAct: {
    backgroundColor: "rgba(45,159,111,0.35)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  matchActCall: {
    backgroundColor: "rgba(61,158,237,0.32)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  matchActText: { color: "#b8f5d4", fontSize: 11, fontWeight: "800" },
  matchActCallText: { color: "#bfe0ff", fontSize: 11, fontWeight: "800" },
  /** "…" overflow — report / block / dismiss / copy live in this Alert. */
  matchActMore: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  /** Outer so online dot + DM badge are not clipped by avatar overflow. */
  avatarOuter: {
    width: 46,
    height: 46,
    position: "relative",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(61,126,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  avatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarText: { color: "#c8dcff", fontWeight: "800", fontSize: 17 },
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
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#07080c",
  },
  dotOn: { backgroundColor: "#3dd68c" },
  dotOff: { backgroundColor: "#e24b4b" },
  rowMain: { flex: 1, minWidth: 0 },
  name: { color: "#e8eef7", fontWeight: "700", fontSize: 15, flexShrink: 1 },
  online: { color: "#6dffa8", fontWeight: "600" },
  offline: { color: "#6b7a90", fontWeight: "500" },
  sub: { color: "#6b7a90", fontSize: 12, marginTop: 2 },
  subUnread: { color: "#c8dcff", fontWeight: "700" },
  /** Line 3: last DM preview (only when last_msg present). */
  snippet: {
    color: "#7a8a9e",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  snippetUnread: {
    color: "#c8dcff",
    fontWeight: "700",
  },
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
  /** Icon-only call CTA on call-history rows (Signal-style, no label pill). */
  callIconOnly: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(61,158,237,0.14)",
  },
  callIconOnlyMuted: {
    backgroundColor: "rgba(255,255,255,0.05)",
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
  emptyTitle: {
    color: "#e8eef7",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  empty: { color: "#6b7a90", fontSize: 13, lineHeight: 20 },
});
