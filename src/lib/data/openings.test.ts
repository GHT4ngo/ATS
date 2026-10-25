import { describe, expect, it } from "vitest";
import { hiresByJob, isFilled, isHiring } from "./openings";

const apps = [
  { job_id: "a", stage: "hired" },
  { job_id: "a", stage: "hired" },
  { job_id: "a", stage: "offer" },
  { job_id: "b", stage: "rejected" },
];

describe("openings", () => {
  it("counts hires per job", () => {
    const hired = hiresByJob(apps);
    expect(hired.get("a")).toBe(2);
    expect(hired.get("b")).toBeUndefined();
  });

  it("treats a job with as many hires as openings as filled", () => {
    const hired = hiresByJob(apps);
    expect(isFilled({ id: "a", openings: 2 }, hired)).toBe(true);
    expect(isFilled({ id: "a", openings: 3 }, hired)).toBe(false);
    expect(isFilled({ id: "b", openings: 1 }, hired)).toBe(false);
  });

  it("only counts open, unfilled jobs as hiring", () => {
    const hired = hiresByJob(apps);
    expect(isHiring({ id: "a", status: "open", openings: 2 }, hired)).toBe(
      false,
    );
    expect(isHiring({ id: "b", status: "open", openings: 1 }, hired)).toBe(
      true,
    );
    expect(isHiring({ id: "b", status: "paused", openings: 1 }, hired)).toBe(
      false,
    );
  });
});
