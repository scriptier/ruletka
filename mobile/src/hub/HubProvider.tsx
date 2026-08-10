import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, InteractionManager } from "react-native";
import {
  historyKindFromReason,
  pushCallHistory,
} from "../calls/history";
import { track } from "../analytics/track";
import {
  bumpUnread,
  loadUnreadMap,
  markDmRead,
  totalUnread,
  type UnreadMap,
} from "../friends/unread";
import type { LocalIdentity } from "../identity/store";
import { setHubBaseOverride } from "../config";
import {
  normalizeBase,
  pickHealthyHub,
  setSavedHub,
} from "../hubs/directory";
import { useT } from "../i18n";
import { loadMatchPrefs } from "../prefs/store";
import {
  dismissLocalCallAlert,
  isAppInForeground,
  presentLocalCallAlert,
} from "../push/localCallAlert";
import {
  clearPendingCallFromPush,
  getPendingCallFromPush,
  subscribePendingCallFromPush,
} from "../push/pendingCall";
import { tryRegisterPush } from "../push/register";
import { HubClient } from "./HubClient";
import type {
  FriendInfo,
  ServerCallIncoming,
  ServerMsg,
  ServerRatePrompt,
} from "./types";

/** Map hub call_ended reason → i18n key (null = use raw reason). */
function callEndedFriendly(reason: string): string | null {
  const r = (reason || "").toLowerCase();
  if (r.includes("declin")) return "mobile.call.endedDeclined";
  if (r.includes("busy")) return "mobile.call.endedBusy";
  if (r.includes("cancel")) return "mobile.call.endedCancelled";
  if (
    r.includes("expir") ||
    r.includes("timeout") ||
    r.includes("no answer")
  ) {
    return "mobile.call.endedNoAnswer";
  }
  if (r.includes("offline")) return "mobile.call.endedOffline";
  return null;
}

export type IncomingCall = {
  from_user_id: string;
  from_name: string;
  from_short: string;
  from_peer: string;
  from_code?: string;
  /** Invite into existing call as 3rd (not private 1:1). */
  join?: boolean;
  with_user_id?: string;
  with_name?: string;
};

export type OutboundCall = {
  user_id: string;
  name: string;
  /** True when inviting into current live 1v1. */
  join?: boolean;
};

export type FindThirdIncoming = {
  from_user_id: string;
  from_name: string;
};

export type RatePromptState = {
  user_id: string;
  name: string;
  duration_secs: number;
  max_gift: number;
  early: boolean;
};

type HubContextValue = {
  hub: HubClient;
  connected: boolean;
  /** Local peer user_id (debate speaker checks, P2P payloads). */
  userId: string;
  /** Display name for debate / chat labels. */
  displayName: string;
  friendCode: string;
  stars: number;
  setStars: (n: number) => void;
  /** Public trust (peer gifts) from hello_ok — status chrome. */
  trust: number;
  trustEffective: number;
  friends: FriendInfo[];
  /** user_ids this client has blocked (from hub friends snapshot). */
  blockedIds: string[];
  incomingRequests: FriendInfo[];
  outgoingRequests: FriendInfo[];
  incomingCall: IncomingCall | null;
  outboundCall: OutboundCall | null;
  /**
   * After no-answer / timeout — show Call back banner (web parity).
   * Cleared on redial, dismiss, or new ring.
   */
  noAnswerPrompt: OutboundCall | null;
  clearNoAnswerPrompt: () => void;
  findThirdIncoming: FindThirdIncoming | null;
  clearFindThirdIncoming: () => void;
  /**
   * True while Live is matched / friend-call — Friends shows Invite instead of Call.
   * Live screen owns this flag.
   */
  liveBusy: boolean;
  setLiveBusy: (busy: boolean) => void;
  ratePrompt: RatePromptState | null;
  clearRatePrompt: () => void;
  /**
   * Local end-of-chat rate sheet when hub didn't send rate_prompt
   * (e.g. user tapped Next before server timer).
   */
  offerRatePrompt: (p: RatePromptState) => void;
  lastError: string;
  clearLastError: () => void;
  /** Subscribe to all hub messages (live screen uses this for match/signal). */
  addMessageListener: (fn: (msg: ServerMsg) => void) => () => void;
  /** Global hub pool (lobby_info / health) for Home quiet/busy CTAs. */
  poolOnline: number;
  poolWaiting: number;
  /** Force refresh pool from GET /health. */
  refreshPool: () => void;
  clearIncomingCall: () => void;
  setOutboundCall: (c: OutboundCall | null) => void;
  toast: string;
  /** When set, tapping the toast opens this friend's DM. */
  toastOpenUserId: string;
  clearToast: () => void;
  showToast: (msg: string, opts?: { openUserId?: string }) => void;
  /** Bumps when local call history changes (Friends screen reloads). */
  callHistoryTick: number;
  recordNoAnswer: (peer: OutboundCall) => void;
  /** Cancel outbound ring + optional toast (user tapped Cancel). */
  cancelOutboundCall: (opts?: { silent?: boolean }) => void;
  /** Pending friend code from deep link (Friends screen may prefill). */
  pendingFriendCode: string;
  clearPendingFriendCode: () => void;
  consumeFriendInvite: (code: string) => void;
  /** user_id → unread DM count */
  unreadDms: UnreadMap;
  unreadDmTotal: number;
  markFriendChatRead: (userId: string) => void;
  /** Open this friend's chat sheet (Friends screen consumes). */
  pendingChatUserId: string;
  clearPendingChatUserId: () => void;
  openFriendChat: (userId: string) => void;
  /** While FriendChatSheet is open for this user, inbound DMs don't badge. */
  setActiveChatUserId: (userId: string) => void;
  /** Current hub origin (after failover / manual switch). */
  hubBaseUrl: string;
  /** Switch WS hub, persist preference, reconnect. */
  switchHub: (base: string) => Promise<void>;
  /** Force reconnect to the current hub. */
  reconnectHub: () => void;
};

const HubCtx = createContext<HubContextValue | null>(null);

export function useHub(): HubContextValue {
  const c = useContext(HubCtx);
  if (!c) throw new Error("useHub outside HubProvider");
  return c;
}

export function HubProvider(props: {
  identity: LocalIdentity;
  children: ReactNode;
}) {
  const { identity, children } = props;
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const hubRef = useRef(new HubClient());
  const listeners = useRef(new Set<(msg: ServerMsg) => void>());

  const [connected, setConnected] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [stars, setStars] = useState(0);
  const [trust, setTrust] = useState(0);
  const [trustEffective, setTrustEffective] = useState(0);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendInfo[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendInfo[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [outboundCall, setOutboundCall] = useState<OutboundCall | null>(null);
  const [noAnswerPrompt, setNoAnswerPrompt] = useState<OutboundCall | null>(
    null
  );
  const [findThirdIncoming, setFindThirdIncoming] =
    useState<FindThirdIncoming | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [ratePrompt, setRatePrompt] = useState<RatePromptState | null>(null);
  /** Mirrors hub.hubBaseUrl for UI (failover / switch). */
  const [hubBaseUrl, setHubBaseUrl] = useState(() => hubRef.current.hubBaseUrl);
  const [lastError, setLastError] = useState("");
  const [toast, setToast] = useState("");
  const [toastOpenUserId, setToastOpenUserId] = useState("");
  const [callHistoryTick, setCallHistoryTick] = useState(0);
  const [pendingFriendCode, setPendingFriendCode] = useState("");
  const [unreadDms, setUnreadDms] = useState<UnreadMap>({});
  const [pendingChatUserId, setPendingChatUserId] = useState("");
  /** Hub stranger pool size (Home quiet/busy CTA). */
  const [poolOnline, setPoolOnline] = useState(0);
  const [poolWaiting, setPoolWaiting] = useState(0);
  const inviteSentRef = useRef<Set<string>>(new Set());
  /** True after at least one successful hello this session (for reconnect strip). */
  const everConnectedRef = useRef(false);
  /** user_id currently viewing FriendChatSheet — skip badge/toast spam. */
  const activeChatUserIdRef = useRef("");
  /** Online friend ids from last friends snapshot (for "came online" toasts). */
  const prevOnlineFriendsRef = useRef<Set<string> | null>(null);
  const liveBusyRef = useRef(false);
  liveBusyRef.current = liveBusy;

  const incomingRef = useRef<IncomingCall | null>(null);
  const outboundRef = useRef<OutboundCall | null>(null);
  incomingRef.current = incomingCall;
  outboundRef.current = outboundCall;

  const clearToast = useCallback(() => {
    setToast("");
    setToastOpenUserId("");
  }, []);
  const showToast = useCallback(
    (msg: string, opts?: { openUserId?: string }) => {
      setToast(msg);
      setToastOpenUserId(opts?.openUserId || "");
    },
    []
  );
  const clearLastError = useCallback(() => setLastError(""), []);
  const markFriendChatRead = useCallback((userId: string) => {
    const id = String(userId || "").trim();
    if (!id) return;
    void markDmRead(id).then(setUnreadDms);
  }, []);
  const clearPendingChatUserId = useCallback(
    () => setPendingChatUserId(""),
    []
  );
  const openFriendChat = useCallback((userId: string) => {
    const id = String(userId || "").trim();
    if (!id) return;
    setPendingChatUserId(id);
    void markDmRead(id).then(setUnreadDms);
  }, []);
  const setActiveChatUserId = useCallback((userId: string) => {
    activeChatUserIdRef.current = String(userId || "").trim();
  }, []);
  const unreadDmTotal = useMemo(() => totalUnread(unreadDms), [unreadDms]);

  const switchHub = useCallback(async (base: string) => {
    const b = normalizeBase(base);
    if (!b) return;
    setHubBaseOverride(b);
    await setSavedHub(b);
    const hub = hubRef.current;
    hub.setBase(b);
    setHubBaseUrl(b);
    hub.disconnect();
    hub.connect({ autoReconnect: true });
    track("hub_switch", { hub: b.replace(/^https?:\/\//, "").slice(0, 40) });
  }, []);

  const reconnectHub = useCallback(() => {
    const hub = hubRef.current;
    hub.disconnect();
    hub.connect({ autoReconnect: true });
    setHubBaseUrl(hub.hubBaseUrl);
    track("hub_reconnect", {});
  }, []);

  const refreshPoolFromHealth = useCallback(async (client?: HubClient) => {
    try {
      const base = (client || hubRef.current).hubBaseUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/health`, { method: "GET" });
      if (!res.ok) return;
      const j = (await res.json()) as {
        online?: number;
        waiting?: number;
        waiting_solo?: number;
      };
      if (typeof j.online === "number") setPoolOnline(j.online);
      const w =
        typeof j.waiting === "number"
          ? j.waiting
          : typeof j.waiting_solo === "number"
            ? j.waiting_solo
            : null;
      if (w != null) setPoolWaiting(w);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshPool = useCallback(() => {
    void refreshPoolFromHealth();
  }, [refreshPoolFromHealth]);

  useEffect(() => {
    void loadUnreadMap().then(setUnreadDms);
  }, []);
  const clearIncomingCall = useCallback(() => {
    setIncomingCall(null);
    void dismissLocalCallAlert();
  }, []);
  const clearFindThirdIncoming = useCallback(
    () => setFindThirdIncoming(null),
    []
  );
  const clearRatePrompt = useCallback(() => setRatePrompt(null), []);
  const offerRatePrompt = useCallback((p: RatePromptState) => {
    if (!p?.user_id) return;
    setRatePrompt((cur) => {
      // Don't double-prompt if already showing for this peer
      if (cur) {
        if (cur.user_id === p.user_id) return cur;
        return cur;
      }
      return {
        user_id: p.user_id,
        name: p.name || "Partner",
        duration_secs: Math.max(0, Number(p.duration_secs) || 0),
        max_gift: Math.max(1, Math.min(3, Number(p.max_gift) || 1)),
        early: !!p.early,
      };
    });
  }, []);
  const clearPendingFriendCode = useCallback(
    () => setPendingFriendCode(""),
    []
  );

  const bumpHistory = useCallback(() => {
    setCallHistoryTick((n) => n + 1);
  }, []);

  const recordNoAnswer = useCallback(
    (peer: OutboundCall) => {
      if (!peer?.user_id) return;
      pushCallHistory({
        kind: "no_answer",
        user_id: peer.user_id,
        name: peer.name || "Friend",
      }).then(bumpHistory);
      // Web parity: surface Call back after timeout / no answer
      setNoAnswerPrompt({
        user_id: peer.user_id,
        name: peer.name || "Friend",
        join: peer.join,
      });
    },
    [bumpHistory]
  );

  const clearNoAnswerPrompt = useCallback(() => setNoAnswerPrompt(null), []);

  const cancelOutboundCall = useCallback(
    (opts?: { silent?: boolean }) => {
      const peer = outboundRef.current;
      if (!peer?.user_id) {
        setOutboundCall(null);
        return;
      }
      try {
        hubRef.current.callCancel(peer.user_id);
      } catch {
        /* ignore */
      }
      setOutboundCall(null);
      setNoAnswerPrompt(null);
      if (!opts?.silent) {
        setToast(tRef.current("mobile.call.cancelled"));
      }
    },
    []
  );

  /** Queue a friend code from deep link; auto-send when connected. */
  const consumeFriendInvite = useCallback((code: string) => {
    const c = String(code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (c.length < 4) return;
    setPendingFriendCode(c);
  }, []);

  const addMessageListener = useCallback((fn: (msg: ServerMsg) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    const hub = hubRef.current;
    let closed = false;
    let failStreak = 0;

    hub.setHandlers({
      onOpen: async () => {
        setConnected(true);
        failStreak = 0;
        const prefs = await loadMatchPrefs();
        try {
          hub.hello({
            user_id: identity.user_id,
            name: identity.name,
            gender: prefs.gender,
            looking: prefs.looking,
            flag: prefs.flag || "",
            hide_ip: !!prefs.hideIp,
          });
          hub.setPrefs({
            gender: prefs.gender,
            looking: prefs.looking,
            flag: prefs.flag || "",
            hide_ip: !!prefs.hideIp,
          });
        } catch {
          /* ignore */
        }
      },
      onClose: async () => {
        setConnected(false);
        failStreak += 1;
        // After a few drops, try another healthy hub from directory
        if (failStreak >= 3 && !closed) {
          failStreak = 0;
          try {
            const next = await pickHealthyHub(hub.hubBaseUrl);
            if (next && next !== hub.hubBaseUrl) {
              setHubBaseOverride(next);
              hub.setBase(next);
              setHubBaseUrl(next);
              setToast(
                tRef.current("mobile.toast.hubSwitched", {
                  hub: next.replace(/^https?:\/\//, ""),
                })
              );
            }
          } catch {
            /* ignore */
          }
        }
      },
      onError: () => {
        // Transient WS blips — don't paint Live as failed until reconnect gives up
        setLastError("");
      },
      onMessage: (msg) => {
        switch (msg.type) {
          case "hello_ok": {
            const m = msg as {
              friend_code?: string;
              stars?: number;
              trust?: number;
              trust_effective?: number;
              rate_min_secs?: number;
              early_rates_left?: number;
            };
            if (m.friend_code) setFriendCode(m.friend_code);
            setStars(Number(m.stars || 0));
            setTrust(Math.max(0, Math.floor(Number(m.trust) || 0)));
            setTrustEffective(
              Math.max(
                0,
                Math.floor(
                  Number(
                    m.trust_effective != null ? m.trust_effective : m.trust
                  ) || 0
                )
              )
            );
            // Successful hub session — clear any stale error banner
            setLastError("");
            everConnectedRef.current = true;
            // Re-register offline ring token after each successful hello
            loadMatchPrefs()
              .then((prefs) => tryRegisterPush(hub, prefs.notifyFriendCalls))
              .catch(() => {});
            // Snapshot pool after hello (lobby_info often follows; health is backup)
            void refreshPoolFromHealth(hub);
            break;
          }
          case "status": {
            const m = msg as {
              online?: number;
              waiting_peers?: number;
            };
            if (m.online != null) setPoolOnline(Number(m.online) || 0);
            if (m.waiting_peers != null)
              setPoolWaiting(Number(m.waiting_peers) || 0);
            break;
          }
          case "lobby_info": {
            const m = msg as {
              online?: number;
              waiting_peers?: number;
              room_waiting?: number;
            };
            if (m.online != null) setPoolOnline(Number(m.online) || 0);
            const wait =
              m.waiting_peers != null
                ? Number(m.waiting_peers)
                : m.room_waiting != null
                  ? Number(m.room_waiting)
                  : null;
            if (wait != null) setPoolWaiting(wait || 0);
            break;
          }
          case "friends": {
            const m = msg as {
              friends?: FriendInfo[];
              friend_code?: string;
              blocked?: string[];
              incoming_requests?: FriendInfo[];
              outgoing_requests?: FriendInfo[];
            };
            const list = m.friends || [];
            // Toast when a friend comes online (skip mid-call / first snapshot)
            const prevOnline = prevOnlineFriendsRef.current;
            const nextOnline = new Set(
              list
                .filter((f) => f.online && f.user_id)
                .map((f) => String(f.user_id))
            );
            if (prevOnline && !liveBusyRef.current) {
              const newly = list.filter(
                (f) =>
                  f.online &&
                  f.user_id &&
                  !prevOnline.has(String(f.user_id))
              );
              if (newly.length === 1) {
                const f = newly[0];
                setToast(
                  tRef.current("mobile.toast.friendOnline", {
                    name: f.name || f.short_id || f.friend_code || "…",
                  })
                );
                setToastOpenUserId(String(f.user_id));
              } else if (newly.length > 1) {
                setToast(
                  tRef.current("mobile.toast.friendsOnline", {
                    n: newly.length,
                  })
                );
                setToastOpenUserId("");
              }
            }
            prevOnlineFriendsRef.current = nextOnline;
            setFriends(list);
            if (m.friend_code) setFriendCode(m.friend_code);
            if (Array.isArray(m.blocked)) {
              setBlockedIds(
                m.blocked.map((id) => String(id || "").trim()).filter(Boolean)
              );
            }
            setIncomingRequests(m.incoming_requests || []);
            setOutgoingRequests(m.outgoing_requests || []);
            break;
          }
          case "friend_request": {
            const m = msg as {
              from_name?: string;
              from_user_id?: string;
            };
            setToast(
              tRef.current("mobile.toast.friendRequest", {
                code: m.from_name || m.from_user_id || "…",
              })
            );
            break;
          }
          case "friend_chat": {
            const m = msg as {
              from_user_id?: string;
              from_name?: string;
              to_user_id?: string;
              body?: string;
            };
            // Toast + badge only for inbound (not our own echo)
            if (
              m.from_user_id &&
              m.from_user_id !== identity.user_id &&
              m.body
            ) {
              const fromId = String(m.from_user_id);
              const preview = String(m.body).slice(0, 48);
              const name =
                m.from_name || fromId.slice(0, 8);
              // Already reading this thread — mark read, skip badge
              if (activeChatUserIdRef.current === fromId) {
                void markDmRead(fromId).then(setUnreadDms);
              } else {
                void bumpUnread(fromId, 1).then(setUnreadDms);
                setToast(
                  tRef.current("mobile.toast.friendChat", {
                    name,
                    body: preview,
                  })
                );
                setToastOpenUserId(fromId);
              }
            }
            break;
          }
          case "call_incoming": {
            const m = msg as ServerCallIncoming;
            const incoming = {
              from_user_id: m.from_user_id,
              from_name: m.from_name,
              from_short: m.from_short,
              from_peer: m.from_peer,
              from_code: m.from_code,
              join: !!m.join,
              with_user_id: m.with_user_id,
              with_name: m.with_name,
            };
            setIncomingCall(incoming);
            setOutboundCall(null);
            setNoAnswerPrompt(null);
            clearPendingCallFromPush();
            // Background (WS alive): fire sticky local OS alert so user can return
            if (!isAppInForeground()) {
              void presentLocalCallAlert({
                fromUserId: m.from_user_id,
                fromName: m.from_name || m.from_short || "Friend",
                join: !!m.join,
              });
            }
            track("call_incoming", {
              join: m.join ? 1 : 0,
              bg: isAppInForeground() ? 0 : 1,
            });
            break;
          }
          case "find_third_incoming": {
            const m = msg as {
              from_user_id?: string;
              from_name?: string;
            };
            setFindThirdIncoming({
              from_user_id: String(m.from_user_id || ""),
              from_name: String(m.from_name || "Partner"),
            });
            break;
          }
          case "find_third_result": {
            const m = msg as { ok?: boolean; reason?: string };
            setFindThirdIncoming(null);
            const reason = String(m.reason || "");
            if (m.ok || reason === "accepted") {
              setToast(tRef.current("mobile.toast.findThirdAccepted"));
            } else if (reason === "declined") {
              setToast(tRef.current("mobile.toast.findThirdDeclined"));
            } else if (reason === "cancelled" || reason === "expired") {
              setToast(tRef.current("mobile.toast.findThirdEnded"));
            } else if (reason && reason !== "error") {
              setToast(
                tRef.current("mobile.toast.findThirdResult", { reason })
              );
            }
            break;
          }
          case "call_ended": {
            const m = msg as { reason?: string };
            const reason = m.reason || "";
            const wasIn = incomingRef.current;
            const wasOut = outboundRef.current;
            setIncomingCall(null);
            setOutboundCall(null);
            setFindThirdIncoming(null);
            void dismissLocalCallAlert();
            clearPendingCallFromPush();
            if (wasIn) {
              const kind = historyKindFromReason(reason, "callee");
              if (kind) {
                pushCallHistory({
                  kind,
                  user_id: wasIn.from_user_id,
                  name: wasIn.from_name || wasIn.from_short || "Friend",
                  short_id: wasIn.from_short,
                  friend_code: wasIn.from_code,
                }).then(bumpHistory);
              }
            } else if (wasOut) {
              const kind = historyKindFromReason(reason, "caller");
              if (kind) {
                pushCallHistory({
                  kind,
                  user_id: wasOut.user_id,
                  name: wasOut.name || "Friend",
                }).then(bumpHistory);
                if (kind === "no_answer") {
                  setNoAnswerPrompt({
                    user_id: wasOut.user_id,
                    name: wasOut.name || "Friend",
                    join: wasOut.join,
                  });
                }
              }
            }
            if (reason) {
              const friendly = callEndedFriendly(reason);
              setToast(
                friendly
                  ? tRef.current(friendly)
                  : tRef.current("mobile.call.endedReason", { reason })
              );
            }
            break;
          }
          case "matched": {
            // Friend or stranger match — clear ring UI (connected = not missed)
            setIncomingCall(null);
            setOutboundCall(null);
            setNoAnswerPrompt(null);
            void dismissLocalCallAlert();
            clearPendingCallFromPush();
            setLastError("");
            track("match_ok", {
              mode: (msg as { mode?: string }).mode || "solo",
            });
            break;
          }
          case "rate_prompt": {
            const m = msg as ServerRatePrompt;
            // Prefer hub prompt; replace local early offer if any
            setRatePrompt({
              user_id: m.user_id,
              name: m.name || "Partner",
              duration_secs: Number(m.duration_secs || 0),
              max_gift: Math.max(1, Math.min(3, Number(m.max_gift || 1))),
              early: !!m.early,
            });
            break;
          }
          case "rate_result": {
            const m = msg as {
              ok?: boolean;
              star?: boolean;
              amount?: number;
              message?: string;
            };
            // rate_result.stars is the *target* balance — do not overwrite ours
            if (m.ok && m.star) {
              setToast(
                tRef.current("mobile.toast.gifted", { n: m.amount || 1 })
              );
            } else if (m.ok) {
              setToast(tRef.current("mobile.toast.reviewSaved"));
            } else {
              // Friendly copy for hub denials (was raw "no review available…")
              const raw = String(m.message || "").toLowerCase();
              let toast = tRef.current("mobile.toast.reviewFailed");
              if (raw.includes("too short")) {
                toast = tRef.current("mobile.toast.reviewTooShort");
              } else if (
                raw.includes("already") ||
                raw.includes("reviewed")
              ) {
                toast = tRef.current("mobile.toast.reviewAlready");
              } else if (
                raw.includes("expired") ||
                raw.includes("no review") ||
                raw.includes("not available")
              ) {
                toast = tRef.current("mobile.toast.reviewExpired");
              } else if (raw.includes("invalid")) {
                toast = tRef.current("mobile.toast.reviewFailed");
              }
              setToast(toast);
            }
            setRatePrompt(null);
            break;
          }
          case "star_effect": {
            const m = msg as {
              ok?: boolean;
              effect?: string;
              cost?: number;
              spender_stars?: number;
              message?: string;
              from_name?: string;
            };
            if (m.spender_stars != null) setStars(Number(m.spender_stars));
            if (m.ok && m.effect) {
              // Prefer emoji label (heart/bars/…) over raw effect id
              let effectLabel = String(m.effect);
              try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { GIFTS } = require("../stars/gifts") as {
                  GIFTS: { id: string; emoji: string; label: string }[];
                };
                const g = GIFTS.find((x) => x.id === m.effect);
                if (g) effectLabel = `${g.emoji} ${g.label}`;
              } catch {
                /* catalog optional */
              }
              const cost = m.cost ? ` (−${m.cost}★)` : "";
              setToast(
                m.from_name
                  ? `${m.from_name}: ${effectLabel}${cost}`
                  : `${effectLabel}${cost}`
              );
            } else if (m.message) setToast(m.message);
            break;
          }
          case "push_registered": {
            const m = msg as { ok?: boolean; message?: string };
            if (m.ok) {
              setToast(
                m.message === "cleared"
                  ? tRef.current("mobile.toast.alertsCleared")
                  : tRef.current("mobile.toast.alertsRegistered")
              );
            } else if (m.message) {
              setToast(m.message);
            }
            break;
          }
          case "error": {
            const m = msg as { message?: string };
            if (m.message) {
              const low = m.message.toLowerCase();
              // Hub returns "not matched" when ICE/signal arrives outside a room
              // (common race on connect / leftover signal). Not a user-facing failure.
              const benign =
                low === "not matched" ||
                low.includes("not matched") ||
                low === "ok" ||
                low.includes("rate limited");
              if (!benign) {
                setLastError(m.message);
                setToast(m.message);
              }
              // Stop "Calling…" UI when friend is offline / busy / notified
              if (
                low.includes("offline") ||
                low.includes("busy") ||
                low.includes("notification") ||
                low.includes("not friends") ||
                low.includes("blocked")
              ) {
                const out = outboundRef.current;
                setOutboundCall(null);
                if (out && low.includes("busy")) {
                  setNoAnswerPrompt(null);
                }
              }
            }
            break;
          }
          default:
            break;
        }
        listeners.current.forEach((fn) => {
          try {
            fn(msg);
          } catch {
            /* ignore listener errors */
          }
        });
      },
    });
    // Defer hub I/O until after first paint — reduces launch jank / ANRs
    const task = InteractionManager.runAfterInteractions(() => {
      const boot = async () => {
        try {
          const healthy = await pickHealthyHub();
          if (closed) return;
          setHubBaseOverride(healthy);
          hub.setBase(healthy);
          setHubBaseUrl(healthy);
        } catch {
          /* use default */
        }
        if (!closed) {
          setHubBaseUrl(hub.hubBaseUrl);
          hub.connect({ autoReconnect: true });
          track("hub_connect_attempt", { uid: identity.user_id.slice(0, 8) });
        }
      };
      boot().catch(() => {});
    });
    return () => {
      closed = true;
      try {
        task.cancel?.();
      } catch {
        /* ignore */
      }
      hub.disconnect();
    };
  }, [identity.name, identity.user_id, bumpHistory]);

  // Track when app returns to foreground; nudge reconnect after push open
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      track("app_foreground");
      // Returning from background with a pending push call → ensure WS is up
      const pend = getPendingCallFromPush();
      if (pend || incomingRef.current) {
        const hub = hubRef.current;
        if (!hub.connected) {
          hub.connect({ autoReconnect: true });
        }
      }
      // If still ringing in-process, refresh sticky notif was for bg only
      if (incomingRef.current) {
        void dismissLocalCallAlert();
      }
    });
    return () => sub.remove();
  }, []);

  // Client-side ring timeout (32s) — covers missed call_ended / flaky WS
  useEffect(() => {
    if (!incomingCall) return;
    const peer = incomingCall;
    const timer = setTimeout(() => {
      if (incomingRef.current?.from_user_id !== peer.from_user_id) return;
      setIncomingCall(null);
      void dismissLocalCallAlert();
      void pushCallHistory({
        kind: "missed",
        user_id: peer.from_user_id,
        name: peer.from_name || peer.from_short || "Friend",
        short_id: peer.from_short,
        friend_code: peer.from_code,
      }).then(bumpHistory);
      setToast(tRef.current("mobile.call.missedLocal"));
      track("call_ring_timeout", { role: "callee" });
    }, 32_000);
    return () => clearTimeout(timer);
  }, [incomingCall?.from_user_id, bumpHistory]);

  // Push tap / cold start: toast + force reconnect so ring can complete over WS
  useEffect(() => {
    const onPending = (p: ReturnType<typeof getPendingCallFromPush>) => {
      if (!p) return;
      setToast(
        tRef.current("mobile.call.pushOpening", { name: p.fromName })
      );
      const hub = hubRef.current;
      try {
        hub.disconnect();
      } catch {
        /* ignore */
      }
      hub.connect({ autoReconnect: true });
      track("call_push_open", { join: p.join ? 1 : 0 });
    };
    // Catch already-stashed pending from cold start before this effect ran
    onPending(getPendingCallFromPush());
    return subscribePendingCallFromPush(onPending);
  }, []);

  // Keep pool counts warm on Home (lobby_info is sparse when idle)
  useEffect(() => {
    if (!connected) return;
    void refreshPoolFromHealth();
    const id = setInterval(() => void refreshPoolFromHealth(), 20_000);
    return () => clearInterval(id);
  }, [connected, refreshPoolFromHealth]);

  // Auto-send pending friend invite once WS is up
  useEffect(() => {
    if (!connected || !pendingFriendCode) return;
    if (inviteSentRef.current.has(pendingFriendCode)) {
      setPendingFriendCode("");
      return;
    }
    try {
      hubRef.current.addFriend(pendingFriendCode);
      inviteSentRef.current.add(pendingFriendCode);
      track("funnel_invite_request", {
        via: "deep_link",
        code: pendingFriendCode.slice(0, 8),
      });
      setToast(
        tRef.current("mobile.toast.friendRequest", {
          code: pendingFriendCode,
        })
      );
      setPendingFriendCode("");
    } catch {
      /* keep pending for retry */
    }
  }, [connected, pendingFriendCode]);

  const value = useMemo<HubContextValue>(
    () => ({
      hub: hubRef.current,
      connected,
      userId: identity.user_id,
      displayName: identity.name || "anon",
      friendCode,
      stars,
      setStars,
      trust,
      trustEffective,
      friends,
      blockedIds,
      incomingRequests,
      outgoingRequests,
      incomingCall,
      outboundCall,
      noAnswerPrompt,
      clearNoAnswerPrompt,
      findThirdIncoming,
      clearFindThirdIncoming,
      liveBusy,
      setLiveBusy,
      ratePrompt,
      clearRatePrompt,
      offerRatePrompt,
      lastError,
      clearLastError,
      addMessageListener,
      poolOnline,
      poolWaiting,
      refreshPool,
      clearIncomingCall,
      setOutboundCall,
      toast,
      toastOpenUserId,
      clearToast,
      showToast,
      callHistoryTick,
      recordNoAnswer,
      cancelOutboundCall,
      pendingFriendCode,
      clearPendingFriendCode,
      consumeFriendInvite,
      unreadDms,
      unreadDmTotal,
      markFriendChatRead,
      pendingChatUserId,
      clearPendingChatUserId,
      openFriendChat,
      setActiveChatUserId,
      hubBaseUrl,
      switchHub,
      reconnectHub,
    }),
    [
      connected,
      identity.user_id,
      identity.name,
      friendCode,
      stars,
      trust,
      trustEffective,
      friends,
      blockedIds,
      incomingRequests,
      outgoingRequests,
      incomingCall,
      outboundCall,
      noAnswerPrompt,
      clearNoAnswerPrompt,
      findThirdIncoming,
      clearFindThirdIncoming,
      liveBusy,
      ratePrompt,
      offerRatePrompt,
      clearRatePrompt,
      lastError,
      clearLastError,
      addMessageListener,
      poolOnline,
      poolWaiting,
      refreshPool,
      clearIncomingCall,
      toast,
      toastOpenUserId,
      clearToast,
      showToast,
      callHistoryTick,
      recordNoAnswer,
      cancelOutboundCall,
      pendingFriendCode,
      clearPendingFriendCode,
      consumeFriendInvite,
      unreadDms,
      unreadDmTotal,
      markFriendChatRead,
      pendingChatUserId,
      clearPendingChatUserId,
      openFriendChat,
      setActiveChatUserId,
      hubBaseUrl,
      switchHub,
      reconnectHub,
    ]
  );

  return <HubCtx.Provider value={value}>{children}</HubCtx.Provider>;
}
