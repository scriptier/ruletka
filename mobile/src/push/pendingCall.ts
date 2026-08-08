/**
 * Cold-start / notification-tap handoff for friend-call push.
 * Live/CallBanners can show a brief “opening call…” state; Hub reconnects.
 */
export type PendingCallFromPush = {
  fromUserId: string;
  fromName: string;
  join?: boolean;
  at: number;
};

let pending: PendingCallFromPush | null = null;
const listeners = new Set<(p: PendingCallFromPush | null) => void>();

export function setPendingCallFromPush(
  p: Omit<PendingCallFromPush, "at"> | null
): void {
  pending = p
    ? {
        fromUserId: String(p.fromUserId || "").trim(),
        fromName: String(p.fromName || "Friend").slice(0, 40),
        join: !!p.join,
        at: Date.now(),
      }
    : null;
  if (pending && !pending.fromUserId) {
    pending = null;
  }
  for (const fn of listeners) {
    try {
      fn(pending);
    } catch {
      /* ignore */
    }
  }
}

export function getPendingCallFromPush(): PendingCallFromPush | null {
  if (pending && Date.now() - pending.at > 60_000) {
    pending = null;
  }
  return pending;
}

export function clearPendingCallFromPush(): void {
  setPendingCallFromPush(null);
}

export function subscribePendingCallFromPush(
  fn: (p: PendingCallFromPush | null) => void
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
