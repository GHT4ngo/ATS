export const MARKS = ["starred", "flagged", "mismatch"] as const;
export type Mark = (typeof MARKS)[number];

/** The `marks` filter from a shared URL; unknown values are dropped. */
export function parseMarks(value: string | undefined): Set<Mark> {
  return new Set(
    (value ?? "")
      .split(",")
      .filter((m): m is Mark => (MARKS as readonly string[]).includes(m)),
  );
}
