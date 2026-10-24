import { describe, expect, it } from "vitest";
import { buildSeries, dayStart, parseRange, periodCounts } from "./dashboard";

const now = Date.parse("2026-10-24T15:00:00Z");
const none = { applications: [], interviews: [], hires: [] };

describe("parseRange", () => {
  it("accepts the three ranges and falls back to 30", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("12")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
  });
});

describe("dayStart", () => {
  it("uses local midnight", () => {
    // 00:30 in Stockholm (summer time) is still the 23rd in UTC.
    const t = Date.parse("2026-08-23T22:30:00Z");
    expect(new Date(dayStart(t, "Europe/Stockholm")).toISOString()).toBe(
      "2026-08-23T22:00:00.000Z",
    );
    expect(new Date(dayStart(t, "UTC")).toISOString()).toBe(
      "2026-08-23T00:00:00.000Z",
    );
  });
});

describe("buildSeries", () => {
  it("uses daily buckets ending today", () => {
    const s = buildSeries(7, now, "UTC", {
      ...none,
      applications: ["2026-10-24T01:00:00Z", "2026-10-18T00:00:00Z"],
    });
    expect(s).toHaveLength(7);
    expect(s[6].applications).toBe(1);
    expect(s[0].applications).toBe(1);
    expect(new Date(s[0].start).toISOString()).toBe("2026-10-18T00:00:00.000Z");
  });

  it("drops events outside the range", () => {
    const s = buildSeries(7, now, "UTC", {
      ...none,
      applications: ["2026-10-17T23:59:00Z"],
    });
    expect(s.every((b) => b.applications === 0)).toBe(true);
  });

  it("puts an event just after local midnight on the new day", () => {
    const s = buildSeries(7, now, "Europe/Stockholm", {
      ...none,
      hires: ["2026-10-23T22:30:00Z"],
    });
    expect(s[6].hires).toBe(1);
  });

  it("buckets across the daylight saving change", () => {
    const s = buildSeries(
      7,
      Date.parse("2026-10-27T12:00:00Z"),
      "Europe/Stockholm",
      none,
    );
    expect(new Date(s[0].start).toISOString()).toBe("2026-10-20T22:00:00.000Z");
    expect(new Date(s[6].start).toISOString()).toBe("2026-10-26T23:00:00.000Z");
  });

  it("uses weekly buckets for 90 days", () => {
    expect(buildSeries(90, now, "UTC", none)).toHaveLength(13);
  });
});

describe("periodCounts", () => {
  it("splits the current and the previous period", () => {
    const r = periodCounts(7, now, "UTC", [
      "2026-10-23T00:00:00Z",
      "2026-10-15T00:00:00Z",
      "2026-10-01T00:00:00Z",
    ]);
    expect(r).toMatchObject({ current: 1, previous: 1 });
  });

  it("covers the same 91 days as the weekly chart for 90", () => {
    const s = buildSeries(90, now, "UTC", none);
    const r = periodCounts(90, now, "UTC", [
      new Date(s[0].start).toISOString(),
    ]);
    expect(r.current).toBe(1);
  });
});
