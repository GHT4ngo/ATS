import type { Stage } from "./schemas";

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: string | undefined): Range {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

const DAY = 86_400_000;

/** Start of the UTC day, so buckets line up however late in the day it is. */
function dayStart(t: number) {
  return Math.floor(t / DAY) * DAY;
}

export type Bucket = {
  /** Start of the bucket, as epoch ms. */
  start: number;
  applications: number;
  interviews: number;
  hires: number;
};

type Move = { at: string; to: string };

/**
 * Counts per bucket over the last `range` days: daily for 7 and 30 days,
 * weekly for 90. The last bucket ends today.
 */
export function buildSeries(
  range: Range,
  now: number,
  applicationsCreated: string[],
  moves: Move[],
): Bucket[] {
  const size = range === 90 ? 7 * DAY : DAY;
  const count = range === 90 ? 13 : range;
  const end = dayStart(now) + DAY;
  const first = end - count * size;
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => ({
    start: first + i * size,
    applications: 0,
    interviews: 0,
    hires: 0,
  }));
  const at = (iso: string) => {
    const i = Math.floor((new Date(iso).getTime() - first) / size);
    return i >= 0 && i < count ? buckets[i] : undefined;
  };
  for (const iso of applicationsCreated) {
    const b = at(iso);
    if (b) b.applications += 1;
  }
  for (const m of moves) {
    const b = at(m.at);
    if (!b) continue;
    if (m.to === "interview") b.interviews += 1;
    if (m.to === "hired") b.hires += 1;
  }
  return buckets;
}

/** How many timestamps fall in this period and in the one before it. */
export function periodCounts(range: Range, now: number, times: string[]) {
  const end = dayStart(now) + DAY;
  const start = end - range * DAY;
  const prevStart = start - range * DAY;
  let current = 0;
  let previous = 0;
  for (const iso of times) {
    const t = new Date(iso).getTime();
    if (t >= start && t < end) current += 1;
    else if (t >= prevStart && t < start) previous += 1;
  }
  return { current, previous, start };
}

/** Days in a stage before a candidate counts as stuck. */
export const STUCK_DAYS = 14;

export function daysSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
}

export function isActive(stage: Stage) {
  return stage !== "hired" && stage !== "rejected";
}
