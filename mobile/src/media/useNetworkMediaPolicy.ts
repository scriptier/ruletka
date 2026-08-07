/**
 * Network-aware media policy for Live:
 *  - cellular → suggest data-saver ceiling
 *  - offline → report
 *  - type change (wifi↔cell) → ICE restart nudge
 */
import { useEffect, useRef, useState } from "react";

export type NetKind = "wifi" | "cellular" | "none" | "unknown";

export type NetworkMediaPolicy = {
  kind: NetKind;
  isConnected: boolean;
  /** Prefer lower quality on cellular / expensive paths. */
  preferDataSaver: boolean;
  /** Monotonic counter bumped on wifi↔cellular (or offline→online). */
  pathEpoch: number;
};

type NetInfoState = {
  type?: string | null;
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
  details?: { isConnectionExpensive?: boolean } | null;
};

function loadNetInfo(): {
  /** NetInfo v11+: addEventListener(listener) — NOT (eventName, listener). */
  addEventListener: (cb: (s: NetInfoState) => void) => () => void;
  fetch: () => Promise<NetInfoState>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-community/netinfo");
    return mod?.default || mod;
  } catch {
    return null;
  }
}

function classify(s: NetInfoState | null | undefined): {
  kind: NetKind;
  isConnected: boolean;
  preferDataSaver: boolean;
} {
  if (!s) {
    return { kind: "unknown", isConnected: true, preferDataSaver: false };
  }
  const type = String(s.type || "unknown").toLowerCase();
  const connected =
    s.isConnected !== false && s.isInternetReachable !== false;
  if (!connected || type === "none") {
    return { kind: "none", isConnected: false, preferDataSaver: false };
  }
  if (type === "wifi" || type === "ethernet" || type === "wimax") {
    return { kind: "wifi", isConnected: true, preferDataSaver: false };
  }
  if (
    type === "cellular" ||
    type === "2g" ||
    type === "3g" ||
    type === "4g" ||
    type === "5g"
  ) {
    return { kind: "cellular", isConnected: true, preferDataSaver: true };
  }
  // unknown / bluetooth / vpn — if expensive, treat as cellular
  if (s.details?.isConnectionExpensive) {
    return { kind: "cellular", isConnected: true, preferDataSaver: true };
  }
  return { kind: "unknown", isConnected: true, preferDataSaver: false };
}

const IDLE: NetworkMediaPolicy = {
  kind: "unknown",
  isConnected: true,
  preferDataSaver: false,
  pathEpoch: 0,
};

/**
 * Subscribe to NetInfo while Live is mounted.
 * pathEpoch increments when the path class changes in a way that needs ICE restart.
 */
export function useNetworkMediaPolicy(active: boolean): NetworkMediaPolicy {
  const [state, setState] = useState<NetworkMediaPolicy>(IDLE);
  const prevKind = useRef<NetKind>("unknown");
  const epochRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setState(IDLE);
      prevKind.current = "unknown";
      return;
    }
    const net = loadNetInfo();
    if (!net) {
      setState(IDLE);
      return;
    }

    const apply = (raw: NetInfoState) => {
      const c = classify(raw);
      const prev = prevKind.current;
      let bump = false;
      // Path change that often kills WebRTC ICE
      if (
        prev !== "unknown" &&
        c.kind !== "unknown" &&
        prev !== c.kind &&
        !(prev === "none" && c.kind === "none")
      ) {
        // wifi↔cellular or any↔none recovery
        if (
          (prev === "wifi" && c.kind === "cellular") ||
          (prev === "cellular" && c.kind === "wifi") ||
          (prev === "none" && c.isConnected) ||
          (c.kind === "none" && prev !== "none")
        ) {
          bump = true;
        }
      }
      if (bump) {
        epochRef.current += 1;
      }
      prevKind.current = c.kind;
      setState({
        kind: c.kind,
        isConnected: c.isConnected,
        preferDataSaver: c.preferDataSaver,
        pathEpoch: epochRef.current,
      });
    };

    void net.fetch().then(apply).catch(() => {});
    // IMPORTANT: NetInfo API is addEventListener(listener), not ("change", listener).
    // Passing "change" registers a string as the handler → TypeError "change is not a function"
    // on the first network update (often mid phone↔browser connect).
    let unsub: (() => void) | null = null;
    try {
      const ret = net.addEventListener(apply);
      unsub = typeof ret === "function" ? ret : null;
    } catch {
      /* ignore */
    }
    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
    };
  }, [active]);

  return state;
}
