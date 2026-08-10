/**
 * Soft ICE restart vs hard PC rebuild for phone↔browser recovery.
 */
import type { IceConfig } from "../hub/types";
import type { MediaSession, MediaStreamLike } from "./MediaSession";

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
};

/**
 * Soft: tryIceRestart. Hard: closeCall + startCall as offerer.
 * Caller updates React state (remote stream, epochs, flags).
 */
export async function runConnectRetry(
  deps: ConnectRetryDeps,
  opts: { hard?: boolean } = {}
): Promise<ConnectRetryResult> {
  const hard = !!opts.hard;
  let hasTurn = false;
  try {
    const cfg = await deps.fetchIce();
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

  try {
    if (hard) {
      // Hard rebuild: prefer TURN-only once so same-NAT hairpin / UDP blocks recover
      if (hasTurn && typeof (media as { forceRelayRebuild?: () => void }).forceRelayRebuild === "function") {
        (media as { forceRelayRebuild: () => void }).forceRelayRebuild();
        deps.log("hard retry force TURN relay");
      } else {
        media.closeCall({ keepLocal: true, sendBye: false });
      }
      await media.startCall({ isOfferer: deps.forceOfferer !== false });
      deps.log("hard retry startCall ok (forced offerer)");
      return { hard, hasTurn, remoteStream: null, ok: true };
    }
    // Soft: prefer TURN-only restart when still no remote video (host path
    // often "connects" with black tiles / endless checking). Then iceRestart.
    const noVideo =
      !(media.getRemoteStream()?.getVideoTracks?.() || []).length;
    if (
      noVideo &&
      hasTurn &&
      typeof (media as { setForceRelay?: (on: boolean) => void }).setForceRelay ===
        "function"
    ) {
      (media as { setForceRelay: (on: boolean) => void }).setForceRelay(true);
      deps.log("soft retry arm force_relay (no remote video)");
    }
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
    };
  }
}
