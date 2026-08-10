/**
 * Link quality polling for Live connection pill.
 */
import { useEffect, useState, type RefObject } from "react";
import type { MediaSession } from "./MediaSession";

export type LinkTier = "good" | "ok" | "weak" | "bad" | "unknown";

export type LinkQualityState = {
  tier: LinkTier;
  rttMs: number;
  relay: boolean;
};

const IDLE: LinkQualityState = {
  tier: "unknown",
  rttMs: 0,
  relay: false,
};

/** Poll WebRTC getStats while matched. */
export function useLinkQuality(
  mediaRef: RefObject<MediaSession | null>,
  active: boolean,
  intervalMs = 2500
): LinkQualityState {
  const [state, setState] = useState<LinkQualityState>(IDLE);

  useEffect(() => {
    if (!active) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await mediaRef.current?.getLinkStats();
        if (cancelled || !s) return;
        setState({
          tier: s.tier,
          rttMs: s.rttMs,
          relay: s.relay,
        });
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, intervalMs, mediaRef]);

  return state;
}
