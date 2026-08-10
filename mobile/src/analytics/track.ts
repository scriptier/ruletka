/**
 * Lightweight mobile analytics — local ring + optional hub /v1/funnel beacon.
 * Never throws; never blocks UI.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hubBase } from "../config";

const FUNNEL_KEY = "ruletka-mobile-funnel-v1";

const FUNNEL_EVENTS: Record<string, 1> = {
  app_open: 1,
  app_foreground: 1,
  hub_connect_attempt: 1,
  start_match: 1,
  match_ok: 1,
  match_fail_ice: 1,
  video_ok: 1,
  ice_retry: 1,
  hard_retry: 1,
  multi_promote: 1,
  friend_call_place: 1,
  /** Alias used by Friends screen (counts as place attempt). */
  friend_call_attempt: 1,
  /** Time-to-first-remote-video cohort (ms in params). */
  connect_video_ms: 1,
  /** Match → first offer sent/applied (ms). */
  connect_offer_ms: 1,
  /** Match → answer sent/applied (ms). */
  connect_answer_ms: 1,
  /** Match → first inbound decoded frame (ms). */
  connect_first_frame_ms: 1,
  /** Warm PC reused (1) / rewarmed (rewarm) / cold rebuild. */
  connect_warm_reuse: 1,
  /** Queue status ack after spin. */
  queue_ack: 1,
  /** Adaptive quality tier change. */
  quality_tier: 1,
  /** Network path change mid-call (wifi↔cell). */
  net_path_change: 1,
  /** Liquidity: friend invite funnel (hub metrics_today). */
  funnel_invite_share: 1,
  friend_invite_share: 1,
  empty_alone_invite_share: 1,
  funnel_invite_land: 1,
  friend_invite_deep_link: 1,
  funnel_invite_request: 1,
  funnel_invite_connected: 1,
  add_friend_match: 1,
  funnel_home_pack_live: 1,
  funnel_home_pack_copy: 1,
};

type FunnelDay = {
  day: string;
  counts: Record<string, number>;
  last: { e: string; t: number; p?: Record<string, unknown> }[];
};

function todayKey(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return "unknown";
  }
}

async function loadLocal(): Promise<FunnelDay> {
  try {
    const raw = await AsyncStorage.getItem(FUNNEL_KEY);
    if (!raw) return { day: todayKey(), counts: {}, last: [] };
    const o = JSON.parse(raw) as FunnelDay;
    if (!o || o.day !== todayKey()) {
      return { day: todayKey(), counts: {}, last: [] };
    }
    if (!o.counts) o.counts = {};
    if (!Array.isArray(o.last)) o.last = [];
    return o;
  } catch {
    return { day: todayKey(), counts: {}, last: [] };
  }
}

async function saveLocal(f: FunnelDay): Promise<void> {
  try {
    await AsyncStorage.setItem(FUNNEL_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

function beaconHub(event: string): void {
  if (!FUNNEL_EVENTS[event]) return;
  try {
    const url = `${hubBase().replace(/\/$/, "")}/v1/funnel`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget product event. */
export function track(
  name: string,
  params?: Record<string, string | number | boolean | undefined>
): void {
  try {
    const clean: Record<string, string | number | boolean> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) clean[k] = v;
      }
    }
    loadLocal()
      .then((f) => {
        f.counts[name] = (Number(f.counts[name]) || 0) + 1;
        f.last.unshift({ e: name, t: Date.now(), p: clean });
        if (f.last.length > 40) f.last.length = 40;
        return saveLocal(f);
      })
      .catch(() => {});
    beaconHub(name);
  } catch {
    /* ignore */
  }
}
