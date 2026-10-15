/**
 * Stranger 1v1 ICE drop: 3 chances × 10s, then auto-Next.
 * Brief ICE flaps (<2s) do not start chance 1. Recover cancels.
 * Friend / hub Next stay elsewhere.
 */

export const RECONNECT_CHANCES = 3;
export const RECONNECT_CHANCE_MS = 10000;
export const RECONNECT_FLAP_MS = 2000;

export type ReconnectSnap = { chance: number; until: number } | null;

export type TickReconnectResult = {
  snap: ReconnectSnap;
  giveUp: boolean;
  recovered: boolean;
};

/** True once ICE has been down long enough to start chance 1 (skip brief flaps). */
export function shouldStartReconnect(downSince: number, now: number): boolean {
  if (!(downSince > 0)) return false;
  return now - downSince >= RECONNECT_FLAP_MS;
}

export function startReconnect(now: number): ReconnectSnap {
  return { chance: 1, until: now + RECONNECT_CHANCE_MS };
}

/** Remaining wait in this chance, ceil seconds, clipped 0..10. */
export function remainingSecs(snap: ReconnectSnap, now: number): number {
  if (!snap) return 0;
  const s = Math.ceil((snap.until - now) / 1000);
  if (s <= 0) return 0;
  const max = RECONNECT_CHANCE_MS / 1000;
  return s > max ? max : s;
}

export function tickReconnect(
  snap: ReconnectSnap,
  now: number,
  iceOk: boolean
): TickReconnectResult {
  if (!snap) {
    return { snap: null, giveUp: false, recovered: false };
  }
  if (iceOk) {
    return { snap: null, giveUp: false, recovered: true };
  }
  if (now < snap.until) {
    return { snap, giveUp: false, recovered: false };
  }
  if (snap.chance >= RECONNECT_CHANCES) {
    return { snap: null, giveUp: true, recovered: false };
  }
  return {
    snap: {
      chance: snap.chance + 1,
      until: now + RECONNECT_CHANCE_MS,
    },
    giveUp: false,
    recovered: false,
  };
}
