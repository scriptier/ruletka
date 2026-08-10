/**
 * Queue spin / search UI helpers shared by Live start/next/resume paths.
 * Pure + thin wrappers — keeps app/live.tsx match-action surface smaller.
 */

export type QueueSpinFn = (why: string) => boolean;

/** Floor wait/online while searching so UI never shows "0 waiting" for self. */
export function floorQueueCounts(
  waiting: number,
  online: number,
  searching: boolean
): { wait: number; online: number } {
  if (!searching) return { wait: waiting, online };
  return {
    wait: Math.max(waiting, 1),
    online: Math.max(online, 1),
  };
}

/** Hub status phase that means we are in the stranger queue. */
export function isQueuePhase(phase: string): boolean {
  return phase === "search" || phase === "waiting";
}

/** Delays (ms) for confirm re-spin when hub never acks waiting. */
export const QUEUE_CONFIRM_DELAYS_MS = [800, 2200, 5000] as const;

export const SPIN_KEEPALIVE_MS = 6_000;
