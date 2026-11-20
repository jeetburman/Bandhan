import { describe, expect, it } from "vitest";
import { buildPerformance, lastClosedDay, type PerformanceInput } from "./performance";

const input = (overrides: Partial<PerformanceInput> = {}): PerformanceInput => ({
  monthTotal: 210,
  verifiedQty: 70,
  verifiedClosedQty: 70,
  expectedQty: 70,
  elapsedWorkingDays: 7,
  remainingWorkingDays: 14,
  ...overrides,
});

describe("lastClosedDay", () => {
  it("is yesterday until the cut-off has passed, and today after it", () => {
    expect(lastClosedDay("2026-11-12", false)).toBe("2026-11-11");
    expect(lastClosedDay("2026-11-12", true)).toBe("2026-11-12");
  });

  it("crosses a month boundary", () => {
    expect(lastClosedDay("2026-12-01", false)).toBe("2026-11-30");
  });
});

describe("buildPerformance: on pace", () => {
  it("is on pace when the current rate equals the required rate", () => {
    expect(buildPerformance(input())).toMatchObject({
      remainingQty: 140,
      percentDone: 33,
      expectedPercent: 33,
      behindQty: 0,
      aheadQty: 0,
      currentRate: 10,
      requiredRate: 10,
      projectedQty: 210,
      outlook: "ON_PACE",
    });
  });

  it("is on pace and ahead of the plan when more than expected is done", () => {
    expect(buildPerformance(input({ verifiedQty: 100, verifiedClosedQty: 100 }))).toMatchObject({
      aheadQty: 30,
      behindQty: 0,
      remainingQty: 110,
      outlook: "ON_PACE",
    });
  });

  it("counts today's sales in the total but not in the pace of closed days", () => {
    const result = buildPerformance(input({ verifiedQty: 75, verifiedClosedQty: 70 }));
    expect(result).toMatchObject({
      percentDone: 35,
      remainingQty: 135,
      currentRate: 10,
      aheadQty: 5,
      outlook: "ON_PACE",
    });
    expect(result.requiredRate).toBeCloseTo(9.64, 2);
  });
});

describe("buildPerformance: behind", () => {
  it("is behind when the pace so far is not enough", () => {
    const result = buildPerformance(input({ verifiedQty: 40, verifiedClosedQty: 40 }));
    expect(result).toMatchObject({
      remainingQty: 170,
      percentDone: 19,
      behindQty: 30,
      projectedQty: 120,
      outlook: "BEHIND",
    });
    expect(result.currentRate).toBeCloseTo(5.71, 2);
    expect(result.requiredRate).toBeCloseTo(12.14, 2);
  });

  it("is behind when nothing has been verified after some days have closed", () => {
    expect(buildPerformance(input({ verifiedQty: 0, verifiedClosedQty: 0 }))).toMatchObject({
      currentRate: 0,
      projectedQty: 0,
      behindQty: 70,
      outlook: "BEHIND",
    });
  });
});

describe("buildPerformance: achieved, not started and closed", () => {
  it("is achieved once the target is met, and never passes 100 percent", () => {
    expect(buildPerformance(input({ verifiedQty: 210, verifiedClosedQty: 210 }))).toMatchObject({
      outlook: "ACHIEVED",
      remainingQty: 0,
      percentDone: 100,
      requiredRate: 0,
      aheadQty: 140,
    });
    expect(buildPerformance(input({ verifiedQty: 250, verifiedClosedQty: 250 }))).toMatchObject({
      percentDone: 100,
      remainingQty: 0,
    });
  });

  it("has no current rate or projection before any working day has closed", () => {
    expect(
      buildPerformance(
        input({
          verifiedQty: 0,
          verifiedClosedQty: 0,
          expectedQty: 0,
          elapsedWorkingDays: 0,
          remainingWorkingDays: 21,
        }),
      ),
    ).toMatchObject({
      outlook: "NOT_STARTED",
      currentRate: null,
      projectedQty: null,
      requiredRate: 10,
    });
  });

  it("is short, with no required rate, when the month has no working days left", () => {
    expect(
      buildPerformance(
        input({
          verifiedQty: 180,
          verifiedClosedQty: 180,
          expectedQty: 210,
          elapsedWorkingDays: 21,
          remainingWorkingDays: 0,
        }),
      ),
    ).toMatchObject({
      outlook: "NO_DAYS_LEFT",
      requiredRate: null,
      remainingQty: 30,
      behindQty: 30,
      projectedQty: 180,
    });
  });

  it("is achieved, not short, when the target was met by the last day", () => {
    expect(
      buildPerformance(
        input({
          verifiedQty: 210,
          verifiedClosedQty: 210,
          elapsedWorkingDays: 21,
          remainingWorkingDays: 0,
        }),
      ).outlook,
    ).toBe("ACHIEVED");
  });
});

describe("buildPerformance: invalid input", () => {
  it("throws on negative or fractional numbers", () => {
    expect(() => buildPerformance(input({ monthTotal: -1 }))).toThrow();
    expect(() => buildPerformance(input({ verifiedQty: 1.5 }))).toThrow();
    expect(() => buildPerformance(input({ elapsedWorkingDays: -1 }))).toThrow();
    expect(() => buildPerformance(input({ remainingWorkingDays: 0.5 }))).toThrow();
  });

  it("throws when more is verified on closed days than in total", () => {
    expect(() => buildPerformance(input({ verifiedQty: 10, verifiedClosedQty: 20 }))).toThrow();
  });
});