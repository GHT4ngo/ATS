import { describe, expect, it } from "vitest";
import { buildSeries, parseRange, periodCounts } from "./dashboard";

const now = Date.parse("2026-10-24T15:00:00Z");

describe("parseRange", () => {
  it("accepts the three ranges and falls back to 30", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("12")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
  });
});

describe("buildSeries", () => {
  it("uses daily buckets ending today", () => {
    const s = buildSeries(
      7,
      now,
      ["2026-10-24T01:00:00Z", "2026-10-18T00:00:00Z"],
      [],
    );
    expect(s).toHaveLength(7);
    expect(s[6].applications).toBe(1);
    expect(s[0].applications).toBe(1);
    expect(new Date(s[0].start).toISOString()).toBe("2026-10-18T00:00:00.000Z");
  });

  it("drops events outside the range", () => {
    const s = buildSeries(7, now, ["2026-10-17T23:59:00Z"], []);
    expect(s.every((b) => b.applications === 0)).toBe(true);
  });

  it("counts interviews and hires from moves", () => {
    const s = buildSeries(
      30,
      now,
      [],
      [
        { at: "2026-10-20T10:00:00Z", to: "interview" },
        { at: "2026-10-20T11:00:00Z", to: "hired" },
        { at: "2026-10-20T12:00:00Z", to: "screening" },
      ],
    );
    const day = s.find((b) => b.interviews)!;
    expect(day.hires).toBe(1);
    expect(s.reduce((n, b) => n + b.interviews + b.hires, 0)).toBe(2);
  });

  it("uses weekly buckets for 90 days", () => {
    expect(buildSeries(90, now, [], [])).toHaveLength(13);
  });
});

describe("periodCounts", () => {
  it("splits the current and the previous period", () => {
    const r = periodCounts(7, now, [
      "2026-10-23T00:00:00Z",
      "2026-10-15T00:00:00Z",
      "2026-10-01T00:00:00Z",
    ]);
    expect(r).toMatchObject({ current: 1, previous: 1 });
  });
});
