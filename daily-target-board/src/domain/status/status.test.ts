import { describe, expect, it } from "vitest";
import type { CalendarConfig } from "../calendar/types";
import { planSlices } from "../distribution/plan-slices";
import {
  evaluateSlices,
  overdueWorkingDays,
  shadeFor,
  type EvaluationContext,
  type SliceToEvaluate,
} from "./status";

// Bhai Phota (Wed 11) and Guru Nanak Jayanti (Tue 24)
const NOV: CalendarConfig = {
  weeklyOffDays: [0],
  offSaturdays: [2, 4],
  holidays: new Set(["2026-11-11", "2026-11-24"]),
};

const ctx = (today: string, cutoffPassed = false): EvaluationContext => ({
  today,
  cutoffPassed,
  calendar: NOV,
});

const W1: SliceToEvaluate = { id: "w1", dueDate: "2026-11-07", plannedQty: 2 };
const W2: SliceToEvaluate = { id: "w2", dueDate: "2026-11-13", plannedQty: 2 };

describe("overdueWorkingDays", () => {
  it("is 0 on the due day until the cut-off passes", () => {
    expect(overdueWorkingDays("2026-11-07", ctx("2026-11-07", false))).toBe(0);
  });

  it("is 1 on the due day once the cut-off has passed", () => {
    expect(overdueWorkingDays("2026-11-07", ctx("2026-11-07", true))).toBe(1);
  });

  it("is 0 for a slice that is not due yet", () => {
    expect(overdueWorkingDays("2026-11-13", ctx("2026-11-10"))).toBe(0);
  });

  it("does not count a weekend", () => {
    // Friday 13 is due; Saturday 14 (2nd) and Sunday 15 are off.
    expect(overdueWorkingDays("2026-11-13", ctx("2026-11-16", false))).toBe(1);
    expect(overdueWorkingDays("2026-11-13", ctx("2026-11-16", true))).toBe(2);
  });

  it("does not count a holiday", () => {
    // Wednesday 11 is Bhai Phota.
    expect(overdueWorkingDays("2026-11-10", ctx("2026-11-12", false))).toBe(1);
    expect(overdueWorkingDays("2026-11-10", ctx("2026-11-12", true))).toBe(2);
  });

  it("counts across a month boundary", () => {
    // Fri 30 Oct and Sat 31 Oct (a 5th Saturday) work; Sun 1 Nov does not.
    expect(overdueWorkingDays("2026-10-30", ctx("2026-11-02", false))).toBe(2);
    expect(overdueWorkingDays("2026-10-30", ctx("2026-11-02", true))).toBe(3);
  });

  it("counts every working day of the month for the oldest slice", () => {
    expect(overdueWorkingDays("2026-11-02", ctx("2026-11-30", true))).toBe(21);
  });
});

describe("shadeFor", () => {
  it("follows the age bands", () => {
    expect(shadeFor(1, false)).toBe("LIGHT");
    expect(shadeFor(2, false)).toBe("LIGHT");
    expect(shadeFor(3, false)).toBe("MEDIUM");
    expect(shadeFor(5, false)).toBe("MEDIUM");
    expect(shadeFor(6, false)).toBe("STRONG");
    expect(shadeFor(10, false)).toBe("STRONG");
    expect(shadeFor(11, false)).toBe("DARK");
    expect(shadeFor(40, false)).toBe("DARK");
  });

  it("is always dark for a carried slice", () => {
    expect(shadeFor(1, true)).toBe("DARK");
  });

  it("throws unless the age is a whole number of at least 1", () => {
    expect(() => shadeFor(0, false)).toThrow();
    expect(() => shadeFor(2.5, false)).toThrow();
  });
});

describe("evaluateSlices", () => {
  const today = ctx("2026-11-10", false);

  it("marks an unmet slice that is past due as overdue, and a future one as on track", () => {
    const { slices } = evaluateSlices([W1, W2], 0, today);

    expect(slices[0]).toMatchObject({
      status: "OVERDUE",
      overdueWorkingDays: 2,
      shade: "LIGHT",
      label: "Overdue 2 days",
    });
    expect(slices[1]).toMatchObject({
      status: "ON_TRACK",
      overdueWorkingDays: 0,
      shade: null,
      label: "On track",
    });
  });

  it("marks a fully verified slice as achieved", () => {
    const { slices } = evaluateSlices([W1, W2], 2, today);
    expect(slices.map((s) => s.status)).toEqual(["ACHIEVED", "ON_TRACK"]);
    expect(slices[0].shade).toBeNull();
  });

  it("keeps a partly covered slice overdue and shows what is left", () => {
    const { slices } = evaluateSlices([W1, W2], 1, today);
    expect(slices[0]).toMatchObject({ status: "OVERDUE", coveredQty: 1, remainingQty: 1 });
  });

  it("fixes an overdue slice when a late verification arrives", () => {
    expect(evaluateSlices([W1, W2], 1, today).slices[0].status).toBe("OVERDUE");
    expect(evaluateSlices([W1, W2], 2, today).slices[0].status).toBe("ACHIEVED");
  });

  it("uses the singular for one day overdue", () => {
    const due: SliceToEvaluate = { id: "d", dueDate: "2026-11-07", plannedQty: 2 };
    const { slices } = evaluateSlices([due], 0, ctx("2026-11-07", true));
    expect(slices[0].label).toBe("Overdue 1 day");
  });

  it("makes a carried slice dark red with its own label", () => {
    const carry: SliceToEvaluate = { id: "c", dueDate: "2026-10-30", plannedQty: 3, isCarry: true };
    const { slices } = evaluateSlices([carry], 0, ctx("2026-11-02", false));
    expect(slices[0]).toMatchObject({
      status: "OVERDUE",
      overdueWorkingDays: 2,
      shade: "DARK",
      label: "Carried forward, overdue 2 days",
    });
  });

  it("turns a carried slice green once it is fully verified", () => {
    const carry: SliceToEvaluate = { id: "c", dueDate: "2026-10-30", plannedQty: 3, isCarry: true };
    const { slices } = evaluateSlices([carry], 3, ctx("2026-11-02", false));
    expect(slices[0].status).toBe("ACHIEVED");
    expect(slices[0].shade).toBeNull();
  });

  it("reports results in the input order", () => {
    const { slices } = evaluateSlices([W2, W1], 2, today);
    expect(slices.map((s) => s.id)).toEqual(["w2", "w1"]);
    expect(slices.map((s) => s.status)).toEqual(["ON_TRACK", "ACHIEVED"]);
  });

  it("works with slices from the planner", () => {
    // 7 savings accounts, weekly pacing: planned [2, 2, 2, 1, 0].
    const planned = planSlices({
      month: "2026-11",
      quantity: 7,
      pacing: "WEEKLY",
      calendar: NOV,
    }).map((s) => ({ id: s.dueDate, dueDate: s.dueDate, plannedQty: s.plannedQty }));

    const { slices } = evaluateSlices(planned, 3, ctx("2026-11-16", false));
    expect(slices.map((s) => s.status)).toEqual([
      "ACHIEVED",
      "OVERDUE",
      "ON_TRACK",
      "ON_TRACK",
      "ACHIEVED", // planned 0: nothing to do, so the screen can hide it
    ]);
    expect(slices[1].label).toBe("Overdue 1 day");
  });
});

describe("evaluateSlices: invariants", () => {
  const slices: SliceToEvaluate[] = [
    { id: "a", dueDate: "2026-11-02", plannedQty: 3 },
    { id: "b", dueDate: "2026-11-07", plannedQty: 0 },
    { id: "c", dueDate: "2026-11-13", plannedQty: 4 },
    { id: "d", dueDate: "2026-11-21", plannedQty: 2 },
    { id: "e", dueDate: "2026-11-27", plannedQty: 5 },
  ];

  it("keeps status, colour and quantities consistent", () => {
    const contexts = [ctx("2026-11-02", false), ctx("2026-11-10", false), ctx("2026-11-16", true), ctx("2026-11-30", true)];

    for (const context of contexts) {
      for (let verified = 0; verified <= 16; verified++) {
        for (const s of evaluateSlices(slices, verified, context).slices) {
          if (s.status === "ACHIEVED") {
            expect(s.remainingQty).toBe(0);
            expect(s.shade).toBeNull();
          } else {
            expect(s.remainingQty).toBeGreaterThan(0);
          }
          if (s.status === "OVERDUE") {
            expect(s.overdueWorkingDays).toBeGreaterThanOrEqual(1);
            expect(s.shade).not.toBeNull();
          }
          if (s.status === "ON_TRACK") {
            expect(s.overdueWorkingDays).toBe(0);
            expect(s.shade).toBeNull();
          }
        }
      }
    }
  });
});