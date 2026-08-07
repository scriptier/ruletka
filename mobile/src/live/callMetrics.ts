/**
 * Pure helpers for Live timer / ★ unlock chrome (easy to unit-test).
 */

/** mm:ss or empty when not in a timed call. */
export function formatCallTimer(elapsedSecs: number): string {
  const s = Math.max(0, Math.floor(elapsedSecs));
  if (s <= 0) return "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function elapsedSince(startedAt: number, now = Date.now()): number {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** 0..1 progress toward gift unlock window. */
export function starProgress(
  elapsedSecs: number,
  rateMinSecs: number
): number {
  if (rateMinSecs <= 0) return 0;
  return Math.min(1, elapsedSecs / rateMinSecs);
}

export function starNeedMinutes(rateMinSecs: number): number {
  return Math.max(1, Math.round(rateMinSecs / 60));
}
