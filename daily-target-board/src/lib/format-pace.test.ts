import { describe, expect, it } from "vitest";
import { buildPerformance, type PerformanceInput } from "../domain/performance/performance";
import { formatPace } from "./format-pace";

const perf = (overrides: Partial<PerformanceInput> = {}) =>
  buildPerformance({
    monthTotal: 25,
    verifiedQty: 10,
    verifiedClosedQty: 10,
    expectedQty: 11,
    elapsedWorkingDays: 14,
    remainingWorkingDays: 7,
    ...overrides,
  });

describe("formatPace: counts", () => {
  it("shows whole numbers for what is done and what is needed", () => {
    expect(formatPace("COUNT", perf())).toBe(
      "10 done in 14 working days · needs 15 more in the 7 working days left",
    );
  });

  it("shows only what is done once the target is met", () => {
    expect(formatPace("COUNT", perf({ verifiedQty: 25, verifiedClosedQty: 25 }))).toBe(
      "25 done in 14 working days",
    );
  });

  it("drops 'more' and the done part before anything has been done or closed", () => {
    const start = perf({
      verifiedQty: 0,
      verifiedClosedQty: 0,
      expectedQty: 0,
      elapsedWorkingDays: 0,
      remainingWorkingDays: 21,
    });
    expect(formatPace("COUNT", start)).toBe("Needs 25 in the 21 working days left");
  });

  it("says so when no working days are left", () => {
    expect(formatPace("COUNT", perf({ elapsedWorkingDays: 21, remainingWorkingDays: 0 }))).toBe(
      "10 done in 21 working days · no working days left",
    );
  });

  it("uses the singular for one day", () => {
    expect(
      formatPace(
        "COUNT",
        perf({ verifiedQty: 1, verifiedClosedQty: 1, elapsedWorkingDays: 1, remainingWorkingDays: 1 }),
      ),
    ).toBe("1 done in 1 working day · needs 24 more in the 1 working day left");
  });

  it("never prints a decimal for a count", () => {
    for (let verified = 0; verified <= 25; verified++) {
      for (let elapsed = 1; elapsed <= 14; elapsed++) {
        for (let remaining = 1; remaining <= 7; remaining++) {
          const text = formatPace(
            "COUNT",
            perf({
              verifiedQty: verified,
              verifiedClosedQty: verified,
              elapsedWorkingDays: elapsed,
              remainingWorkingDays: remaining,
            }),
          );
          expect(text).not.toMatch(/\d\.\d/);
        }
      }
    }
  });
});

describe("formatPace: amounts", () => {
  it("keeps a whole-rupee daily rate", () => {
    const money = buildPerformance({
      monthTotal: 500_000_000,
      verifiedQty: 100_000_000,
      verifiedClosedQty: 100_000_000,
      expectedQty: 200_000_000,
      elapsedWorkingDays: 10,
      remainingWorkingDays: 11,
    });
    expect(formatPace("AMOUNT", money)).toBe("Doing ₹1,00,000 a day · needs ₹3,63,636 a day");
  });
});