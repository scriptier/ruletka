export type DurationUnits = {
  sec: (n: number) => string;
  min: (n: number) => string;
  hour: (n: number) => string;
  day: (n: number) => string;
  minSec: (m: number, s: number) => string;
};

export function unitsFromTranslator(
  t: (key: string, vars?: Record<string, string | number>) => string
): DurationUnits;

export function formatAgoSeconds(totalSec: number, units: DurationUnits): string;
export function formatDurationSeconds(
  totalSec: number,
  units: DurationUnits
): string;
