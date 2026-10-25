import type { Stage } from "./schemas";

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

/** The customers are in Sweden; days start at midnight there. */
export const TIME_ZONE = "Europe/Stockholm";

export function parseRange(value: string | undefined): Range {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

const DAY = 86_400_000;
const HALF_DAY = DAY / 2;

/** How far the time zone is ahead of UTC at this moment, in ms. */
function offset(t: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(t);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return local - Math.floor(t / 1000) * 1000;
}

/** Local midnight at the start of the day that contains t. */
export function dayStart(t: number, timeZone: string) {
  const off = offset(t, timeZone);
  return Math.floor((t + off) / DAY) * DAY - off;
}

/** Days the period covers: 90 days is shown as 13 whole weeks. */
export function spanDays(range: Range) {
  return range === 90 ? 91 : range;
}

/** Local midnight `days` days before the end of today. */
function daysBack(now: number, days: number, timeZone: string) {
  const end = dayStart(now, timeZone) + DAY;
  // Aim at midday, so a daylight saving day still lands on the right date.
  return dayStart(end - days * DAY + HALF_DAY, timeZone);
}

export type Bucket = {
  /** Start of the bucket, as epoch ms. */
  start: number;
  applications: number;
  interviews: number;
  hires: number;
};

/**
 * Counts per bucket over the period: daily for 7 and 30 days, weekly for 90.
 * The last bucket ends at the end of today, local time.
 */
export function buildSeries(
  range: Range,
  now: number,
  timeZone: string,
  series: { applications: string[]; interviews: string[]; hires: string[] },
): Bucket[] {
  const step = range === 90 ? 7 : 1;
  const count = spanDays(range) / step;
  const starts = Array.from({ length: count }, (_, i) =>
    daysBack(now, (count - i) * step, timeZone),
  );
  const end = dayStart(now, timeZone) + DAY;
  const buckets: Bucket[] = starts.map((start) => ({
    start,
    applications: 0,
    interviews: 0,
    hires: 0,
  }));
  const at = (iso: string) => {
    const t = new Date(iso).getTime();
    if (t < starts[0] || t >= end) return undefined;
    let i = count - 1;
    while (starts[i] > t) i--;
    return buckets[i];
  };
  for (const key of ["applications", "interviews", "hires"] as const)
    for (const iso of series[key]) {
      const b = at(iso);
      if (b) b[key] += 1;
    }
  return buckets;
}

/** How many timestamps fall in this period and in the one before it. */
export function periodCounts(
  range: Range,
  now: number,
  timeZone: string,
  times: string[],
) {
  const end = dayStart(now, timeZone) + DAY;
  const start = daysBack(now, spanDays(range), timeZone);
  const prevStart = daysBack(now, 2 * spanDays(range), timeZone);
  let current = 0;
  let previous = 0;
  for (const iso of times) {
    const t = new Date(iso).getTime();
    if (t >= start && t < end) current += 1;
    else if (t >= prevStart && t < start) previous += 1;
  }
  return { current, previous, start, prevStart };
}

/** Days in a stage before a candidate counts as stuck. */
export const STUCK_DAYS = 14;

export function daysSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
}

export function isActive(stage: Stage) {
  return stage !== "hired" && stage !== "rejected";
}

/** Rejected cards leave the board on their own after this many days. */
export const REJECTED_DAYS = 7;

/** Whether an application still has a card on the board. */
export function onBoard(
  app: { stage: Stage; stage_changed_at: string; archived_at: string | null },
  now: number,
) {
  if (app.archived_at) return false;
  return (
    app.stage !== "rejected" ||
    daysSince(app.stage_changed_at, now) < REJECTED_DAYS
  );
}
