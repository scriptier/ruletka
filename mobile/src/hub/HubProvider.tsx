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
import type { LocalIdentity } from "../identity/store";
import { setHubBaseOverride } from "../config";
import { pickHealthyHub } from "../hubs/directory";
import { loadMatchPrefs } from "../prefs/store";
import { HubClient } from "./HubClient";
import type {
  FriendInfo,
  ServerCallIncoming,
  ServerMsg,
  ServerRatePrompt,
} from "./types";

export type IncomingCall = {
  from_user_id: string;
  from_name: string;
  from_short: string;
  from_peer: string;
  from_code?: string;
};

export type OutboundCall = {
  user_id: string;
  name: string;
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
  friendCode: string;
  stars: number;
  setStars: (n: number) => void;
  friends: FriendInfo[];
  incomingRequests: FriendInfo[];
  outgoingRequests: FriendInfo[];
  incomingCall: IncomingCall | null;
  outboundCall: OutboundCall | null;
  ratePrompt: RatePromptState | null;
  clearRatePrompt: () => void;
  lastError: string;
  /** Subscribe to all hub messages (live screen uses this for match/signal). */
  addMessageListener: (fn: (msg: ServerMsg) => void) => () => void;
  clearIncomingCall: () => void;
  setOutboundCall: (c: OutboundCall | null) => void;
  toast: string;
  clearToast: () => void;
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
  const hubRef = useRef(new HubClient());
  const listeners = useRef(new Set<(msg: ServerMsg) => void>());

  const [connected, setConnected] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [stars, setStars] = useState(0);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendInfo[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendInfo[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [outboundCall, setOutboundCall] = useState<OutboundCall | null>(null);
  const [ratePrompt, setRatePrompt] = useState<RatePromptState | null>(null);
  const [lastError, setLastError] = useState("");
  const [toast, setToast] = useState("");

  const clearToast = useCallback(() => setToast(""), []);
  const clearIncomingCall = useCallback(() => setIncomingCall(null), []);
  const clearRatePrompt = useCallback(() => setRatePrompt(null), []);

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
          });
          hub.setPrefs({
            gender: prefs.gender,
            looking: prefs.looking,
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
              setToast(`Switched hub · ${next.replace(/^https?:\/\//, "")}`);
            }
          } catch {
            /* ignore */
          }
        }
      },
      onError: () => setLastError("connection error"),
      onMessage: (msg) => {
        switch (msg.type) {
          case "hello_ok": {
            const m = msg as {
              friend_code?: string;
              stars?: number;
              rate_min_secs?: number;
              early_rates_left?: number;
            };
            if (m.friend_code) setFriendCode(m.friend_code);
            setStars(Number(m.stars || 0));
            break;
          }
          case "friends": {
            const m = msg as {
              friends?: FriendInfo[];
              friend_code?: string;
              incoming_requests?: FriendInfo[];
              outgoing_requests?: FriendInfo[];
            };
            setFriends(m.friends || []);
            if (m.friend_code) setFriendCode(m.friend_code);
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
              `${m.from_name || "Someone"} sent a friend request`
            );
            break;
          }
          case "call_incoming": {
            const m = msg as ServerCallIncoming;
            setIncomingCall({
              from_user_id: m.from_user_id,
              from_name: m.from_name,
              from_short: m.from_short,
              from_peer: m.from_peer,
              from_code: m.from_code,
            });
            setOutboundCall(null);
            break;
          }
          case "call_ended": {
            const m = msg as { reason?: string };
            setIncomingCall(null);
            setOutboundCall(null);
            if (m.reason) setToast(`Call ended · ${m.reason}`);
            break;
          }
          case "matched": {
            // Friend or stranger match — clear ring UI
            setIncomingCall(null);
            setOutboundCall(null);
            break;
          }
          case "rate_prompt": {
            const m = msg as ServerRatePrompt;
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
            if (m.message) setToast(m.message);
            else if (m.ok && m.star)
              setToast(`Gifted ★${m.amount || 1}`);
            else if (m.ok) setToast("Review saved");
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
              setToast(
                m.from_name
                  ? `${m.from_name}: ${m.effect}${m.cost ? ` (−${m.cost}★)` : ""}`
                  : `Gift ${m.effect}${m.cost ? ` (−${m.cost}★)` : ""}`
              );
            } else if (m.message) setToast(m.message);
            break;
          }
          case "error": {
            const m = msg as { message?: string };
            if (m.message) {
              setLastError(m.message);
              setToast(m.message);
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
    (async () => {
      try {
        const healthy = await pickHealthyHub();
        if (closed) return;
        setHubBaseOverride(healthy);
        hub.setBase(healthy);
      } catch {
        /* use default */
      }
      if (!closed) hub.connect({ autoReconnect: true });
    })();
    return () => {
      closed = true;
      hub.disconnect();
    };
  }, [identity.name, identity.user_id]);

  const value = useMemo<HubContextValue>(
    () => ({
      hub: hubRef.current,
      connected,
      friendCode,
      stars,
      setStars,
      friends,
      incomingRequests,
      outgoingRequests,
      incomingCall,
      outboundCall,
      ratePrompt,
      clearRatePrompt,
      lastError,
      addMessageListener,
      clearIncomingCall,
      setOutboundCall,
      toast,
      clearToast,
    }),
    [
      connected,
      friendCode,
      stars,
      friends,
      incomingRequests,
      outgoingRequests,
      incomingCall,
      outboundCall,
      ratePrompt,
      clearRatePrompt,
      lastError,
      addMessageListener,
      clearIncomingCall,
      toast,
      clearToast,
    ]
  );

  return <HubCtx.Provider value={value}>{children}</HubCtx.Provider>;
}
