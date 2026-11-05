/**
 * Soft ICE restart vs hard PC rebuild for phone↔browser recovery.
 * Hard path walks an ordered relay-only ladder after ICE fails:
 *   (a) all relays  (b) turns:443 only  (c) turn udp 3478 / udp 443
 * Soft ICE restart and Hide IP behaviour are unchanged.
 */
import type { IceConfig, IceServer } from "../hub/types";
import type { MediaSession, MediaStreamLike } from "./MediaSession";
import { track } from "../analytics/track";

export type ConnectRetryDeps = {
  media: MediaSession | null;
  media2?: MediaSession | null;
  fetchIce: () => Promise<IceConfig>;
  setIceHasTurn: (v: boolean) => void;
  log: (line: string) => void;
  /** After hard rebuild, primary must offer. */
  forceOfferer?: boolean;
};

export type ConnectRetryResult = {
  hard: boolean;
  hasTurn: boolean;
  remoteStream: MediaStreamLike | null;
  ok: boolean;
  error?: string;
  /** Which relay ladder rung was armed (hard path). */
  relayRung?: string;
};

export const RELAY_RETRY_RUNGS = ["all_relays", "turns_443", "turn_udp"] as const;
export type RelayRetryRung = (typeof RELAY_RETRY_RUNGS)[number];

export function filterIceServersForRung(
  servers: IceServer[] | undefined,
  rung: RelayRetryRung
): IceServer[] {
  const list = servers || [];
  const urlOf = (s: IceServer) => {
    const u = s.urls;
    return String(Array.isArray(u) ? u[0] : u || "").toLowerCase();
  };
  if (rung === "all_relays") {
    const keep = list.filter((s) => {
      const u = urlOf(s);
      return u.startsWith("turn:") || u.startsWith("turns:");
    });
    return keep.length ? keep : list;
  }
  if (rung === "turns_443") {
    const keep = list.filter((s) => {
      const u = urlOf(s);
      return u.startsWith("turns:") && u.includes(":443");
    });
    if (keep.length) return keep;
    const anyTurns = list.filter((s) => urlOf(s).startsWith("turns:"));
    return anyTurns.length ? anyTurns : list;
  }
  // turn_udp
  const keep = list.filter((s) => {
    const u = urlOf(s);
    if (!u.startsWith("turn:") || u.startsWith("turns:")) return false;
    if (u.includes("transport=tcp")) return false;
    return u.includes(":3478") || u.includes(":443");
  });
  if (keep.length) return keep;
  return list.filter((s) => {
    const u = urlOf(s);
    return u.startsWith("turn:") && !u.startsWith("turns:") && !u.includes("transport=tcp");
  });
}

export function nextRelayRetryRung(
  prev: string | null | undefined
): RelayRetryRung | null {
  const i = RELAY_RETRY_RUNGS.indexOf(prev as RelayRetryRung);
  if (i < 0) return RELAY_RETRY_RUNGS[0];
  if (i + 1 >= RELAY_RETRY_RUNGS.length) return null;
  return RELAY_RETRY_RUNGS[i + 1];
}

/**
 * Soft: tryIceRestart. Hard: closeCall + startCall as offerer, walking the
 * relay-only ladder across successive hard retries until one connects.
 * Caller updates React state (remote stream, epochs, flags).
 */
export async function runConnectRetry(
  deps: ConnectRetryDeps,
  opts: { hard?: boolean; relayRung?: string | null } = {}
): Promise<ConnectRetryResult> {
  const hard = !!opts.hard;
  let hasTurn = false;
  let cfg: IceConfig | null = null;
  try {
    cfg = await deps.fetchIce();
    deps.media?.setIceConfig(cfg);
    deps.media2?.setIceConfig(cfg);
    hasTurn = !!cfg.has_turn;
    deps.setIceHasTurn(hasTurn);
    deps.log(`ICE retry has_turn=${hasTurn} hard=${hard}`);
  } catch (e) {
    deps.log(`ICE retry fail ${e}`);
  }

  const media = deps.media;
  if (!media) {
    return { hard, hasTurn, remoteStream: null, ok: false, error: "no media" };
  }

  let armedRung: string | undefined;
  try {
    if (hard) {
      const rung =
        (opts.relayRung as RelayRetryRung | null | undefined) ??
        nextRelayRetryRung(null);
      if (rung && cfg && Array.isArray(cfg.ice_servers)) {
        const filtered = filterIceServersForRung(
          cfg.ice_servers as IceServer[],
          rung
        );
        if (filtered.length) {
          const nextCfg = { ...cfg, ice_servers: filtered };
          media.setIceConfig(nextCfg);
          deps.media2?.setIceConfig(nextCfg);
          armedRung = rung;
          deps.log(`hard retry ladder rung=${rung} servers=${filtered.length}`);
          try {
            track("hard_retry", { relay_rung: rung });
          } catch {
            /* ignore */
          }
        }
      }
      // Hard rebuild: prefer TURN-only once so same-NAT hairpin / UDP blocks recover
      if (hasTurn && typeof (media as { forceRelayRebuild?: () => void }).forceRelayRebuild === "function") {
        (media as { forceRelayRebuild: () => void }).forceRelayRebuild();
        deps.log("hard retry force TURN relay");
      } else {
        media.closeCall({ keepLocal: true, sendBye: false });
      }
      await media.startCall({ isOfferer: deps.forceOfferer !== false });
      deps.log("hard retry startCall ok (forced offerer)");
      return { hard, hasTurn, remoteStream: null, ok: true, relayRung: armedRung };
    }
    // Soft: iceRestart only — do NOT arm pure force_relay.
    // Pure TURN hairpin on same LAN left peer_usage=0 / both black (2026-08-10).
    // Soft: iceRestart / restartIce only — NEVER promote or hard-rebuild here.
    // Soft→hard escalate-as-offerer caused hub dual-offer @~6–12s
    // (android match_to_offer_ms 6200/11600) while web already had offer+answer.
    // Hard rebuild only via explicit hard retry (≥15–16s).
    const okSoft = await media.tryIceRestart({
      force: true,
      promoteOfferer: false,
    });
    if (!okSoft) {
      deps.log(
        "soft restart no-op (grace or coalesce) — wait for frames / hard timer"
      );
      return {
        hard: false,
        hasTurn,
        remoteStream: media.getRemoteStream(),
        ok: false,
        error: "soft no-op",
      };
    }
    const remoteStream = media.getRemoteStream();
    return { hard, hasTurn, remoteStream, ok: true };
  } catch (e) {
    const msg = String(e);
    deps.log(`ice restart ${e}`);
    return {
      hard,
      hasTurn,
      remoteStream: null,
      ok: false,
      error: msg,
      relayRung: armedRung,
    };
  }
}
