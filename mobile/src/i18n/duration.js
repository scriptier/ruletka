/**
 * Compact durations for history and stage timers.
 * Callers pass already-translated unit strings so this stays free of i18n.
 */

export function formatAgoSeconds(totalSec, units) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  if (sec < 60) return units.sec(sec);
  if (sec < 3600) return units.min(Math.floor(sec / 60));
  if (sec < 86400) return units.hour(Math.floor(sec / 3600));
  return units.day(Math.floor(sec / 86400));
}

/** Build unit closures from the app translator. */
export function unitsFromTranslator(t) {
  return {
    sec: (n) => t("mobile.time.s", { n }),
    min: (n) => t("mobile.time.m", { n }),
    hour: (n) => t("mobile.time.h", { n }),
    day: (n) => t("mobile.time.d", { n }),
    minSec: (m, s) => t("mobile.time.ms", { m, s }),
  };
}

export function formatDurationSeconds(totalSec, units) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  if (s <= 0) return "";
  if (s < 60) return units.sec(s);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (rem === 0) return units.min(m);
  return units.minSec(m, rem);
}
