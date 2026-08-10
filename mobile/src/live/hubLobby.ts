/**
 * Pure reducers for hub status / lobby_info → Live queue UI state.
 * Keeps lobby counting rules out of the giant message switch.
 */

import { isQueuePhase } from "./useLiveQueue";

export type LobbyUiPatch = {
  phase?: "search";
  searching?: boolean;
  queueAcked?: boolean;
  alone?: boolean;
  online: number;
  waiting: number;
  log?: string;
  trackQueueAck?: { wait: number; online: number };
};

export type LobbyContext = {
  phaseRef: string;
  searching: boolean;
};

/** Apply hub `status` to waiting/online/alone/search flags. */
export function reduceStatusMsg(
  m: {
    phase?: string;
    online?: number;
    waiting_peers?: number;
    detail?: string;
  },
  ctx: LobbyContext
): LobbyUiPatch {
  const on = Math.max(0, Number(m.online) || 0);
  let wait = Math.max(0, Number(m.waiting_peers) || 0);
  const ph = String(m.phase || "");
  let searching = ctx.searching;
  let phase: "search" | undefined;
  let queueAcked: boolean | undefined;
  let alone: boolean | undefined;
  let trackQueueAck: LobbyUiPatch["trackQueueAck"];

  if (isQueuePhase(ph)) {
    phase = "search";
    searching = true;
    queueAcked = true;
    trackQueueAck = { wait, online: on };
    wait = Math.max(wait, 1);
    alone = wait <= 1;
  } else if (ph === "idle" && searching) {
    queueAcked = false;
    wait = Math.max(wait, 1);
    alone = true;
  } else if (ctx.phaseRef === "search" || searching) {
    wait = Math.max(wait, 1);
    alone = wait <= 1;
  }

  const online = Math.max(on, searching ? 1 : 0);
  const log = m.detail
    ? `status ${ph}: ${m.detail} wait=${wait}`
    : undefined;

  return {
    phase,
    searching,
    queueAcked,
    alone,
    online,
    waiting: wait,
    log,
    trackQueueAck,
  };
}

/** Apply hub `lobby_info` pool ticker. */
export function reduceLobbyInfoMsg(
  m: {
    online?: number;
    waiting_peers?: number;
    room_waiting?: number;
  },
  ctx: LobbyContext
): LobbyUiPatch {
  const on = Math.max(0, Number(m.online) || 0);
  let wait = Math.max(
    0,
    Number(m.waiting_peers != null ? m.waiting_peers : m.room_waiting || 0) ||
      0
  );
  let alone: boolean | undefined;
  const searching = ctx.searching || ctx.phaseRef === "search";
  if (searching) {
    wait = Math.max(wait, 1);
    alone = wait <= 1;
  }
  return {
    alone,
    online: Math.max(on, searching ? 1 : 0),
    waiting: wait,
    log: `lobby online=${on} waiting=${wait} search=${searching ? 1 : 0}`,
  };
}

/**
 * Prefer primary continuity after multi-peer promote / re-match.
 */
export function pickPrimaryPeerIndex(
  peerIds: string[],
  opts: {
    wasMatched: boolean;
    prevPrimary: string;
    prevSecondary: string;
  }
): number {
  if (!peerIds.length) return 0;
  const { wasMatched, prevPrimary, prevSecondary } = opts;
  if (
    wasMatched &&
    prevPrimary &&
    prevPrimary !== "legacy" &&
    peerIds.includes(prevPrimary)
  ) {
    return peerIds.indexOf(prevPrimary);
  }
  if (
    wasMatched &&
    prevSecondary &&
    prevSecondary !== "legacy" &&
    peerIds.includes(prevSecondary)
  ) {
    return peerIds.indexOf(prevSecondary);
  }
  return 0;
}
