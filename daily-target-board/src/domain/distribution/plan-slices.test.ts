import { describe, expect, it } from "vitest";
import { isWorkingDay } from "../calendar/calendar";
import type { CalendarConfig } from "../calendar/types";
import { planSlices, type Pacing } from "./plan-slices";

const bankWeek: CalendarConfig = {
  weeklyOffDays: [0],
  offSaturdays: [2, 4],
  holidays: new Set(),
};

// Bhai Phota (Wed 11) and Guru Nanak Jayanti (Tue 24)
const NOV: CalendarConfig = { ...bankWeek, holidays: new Set(["2026-11-11", "2026-11-24"]) };

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("planSlices: DAILY", () => {
  it("makes one slice per working day from the 1st", () => {
    const slices = planSlices({ month: "2026-11", quantity: 21, pacing: "DAILY", calendar: NOV });
    expect(slices).toHaveLength(21);
    expect(slices[0].dueDate).toBe("2026-11-02");
    expect(slices[20].dueDate).toBe("2026-11-30");
    expect(slices.every((s) => s.kind === "DAY" && s.plannedQty === 1)).toBe(true);
  });

  it("starts from the given start date", () => {
    const slices = planSlices({
      month: "2026-11",
      quantity: 14,
      pacing: "DAILY",
      startDate: "2026-11-10",
      calendar: NOV,
    });
    expect(slices).toHaveLength(14);
    expect(slices[0].dueDate).toBe("2026-11-10");
  });

  it("gives a leftover unit to the earliest day", () => {
    const slices = planSlices({
      month: "2026-11",
      quantity: 15,
      pacing: "DAILY",
      startDate: "2026-11-10",
      calendar: NOV,
    });
    expect(slices[0].plannedQty).toBe(2);
    expect(slices.slice(1).every((s) => s.plannedQty === 1)).toBe(true);
  });

  it("re-spreads the remaining target when another holiday is added", () => {
    const base = {
      month: "2026-11",
      quantity: 28,
      pacing: "DAILY" as const,
      startDate: "2026-11-10",
    };

    const before = planSlices({ ...base, calendar: NOV });
    expect(before).toHaveLength(14);
    expect(before.every((s) => s.plannedQty === 2)).toBe(true);

    const withExtraHoliday: CalendarConfig = {
      ...NOV,
      holidays: new Set([...NOV.holidays, "2026-11-12"]),
    };
    const after = planSlices({ ...base, calendar: withExtraHoliday });
    expect(after).toHaveLength(13);
    expect(sum(after.map((s) => s.plannedQty))).toBe(28);
    expect(after.map((s) => s.dueDate)).not.toContain("2026-11-12");
    expect(Math.max(...after.map((s) => s.plannedQty))).toBe(3);
  });
});

describe("planSlices: WEEKLY", () => {
  it("groups working days into Monday-to-Sunday weeks clipped to the month", () => {
    const slices = planSlices({ month: "2026-11", quantity: 21, pacing: "WEEKLY", calendar: NOV });
    expect(
      slices.map(({ periodStart, periodEnd, dueDate, workingDays }) => ({
        periodStart,
        periodEnd,
        dueDate,
        workingDays,
      })),
    ).toEqual([
      { periodStart: "2026-11-02", periodEnd: "2026-11-08", dueDate: "2026-11-07", workingDays: 6 },
      { periodStart: "2026-11-09", periodEnd: "2026-11-15", dueDate: "2026-11-13", workingDays: 4 },
      { periodStart: "2026-11-16", periodEnd: "2026-11-22", dueDate: "2026-11-21", workingDays: 6 },
      { periodStart: "2026-11-23", periodEnd: "2026-11-29", dueDate: "2026-11-27", workingDays: 4 },
      { periodStart: "2026-11-30", periodEnd: "2026-11-30", dueDate: "2026-11-30", workingDays: 1 },
    ]);
  });

  it("splits 7 savings accounts across the weeks by working days", () => {
    const slices = planSlices({ month: "2026-11", quantity: 7, pacing: "WEEKLY", calendar: NOV });
    expect(slices.map((s) => s.plannedQty)).toEqual([2, 2, 2, 1, 0]);
  });

  it("clips the first week when starting mid-month", () => {
    const slices = planSlices({
      month: "2026-11",
      quantity: 14,
      pacing: "WEEKLY",
      startDate: "2026-11-10",
      calendar: NOV,
    });
    expect(slices.map((s) => s.plannedQty)).toEqual([3, 6, 4, 1]);
    expect(slices[0].periodStart).toBe("2026-11-10");
    expect(slices[0].periodEnd).toBe("2026-11-15");
  });
});

describe("planSlices: MONTHLY", () => {
  it("makes one slice due on the last working day of the month", () => {
    const slices = planSlices({ month: "2026-11", quantity: 5, pacing: "MONTHLY", calendar: NOV });
    expect(slices).toEqual([
      {
        kind: "MONTH",
        periodStart: "2026-11-01",
        periodEnd: "2026-11-30",
        dueDate: "2026-11-30",
        workingDays: 21,
        plannedQty: 5,
      },
    ]);
  });

  it("uses the last working day, not the last calendar day", () => {
    const calendar: CalendarConfig = { ...bankWeek, holidays: new Set(["2026-11-30"]) };
    const [slice] = planSlices({ month: "2026-11", quantity: 5, pacing: "MONTHLY", calendar });
    expect(slice.dueDate).toBe("2026-11-27");
    expect(slice.periodEnd).toBe("2026-11-30");
  });

  it("is clipped to the start date", () => {
    const [slice] = planSlices({
      month: "2026-11",
      quantity: 5,
      pacing: "MONTHLY",
      startDate: "2026-11-10",
      calendar: NOV,
    });
    expect(slice.periodStart).toBe("2026-11-10");
    expect(slice.workingDays).toBe(14);
  });
});

describe("planSlices: edge cases", () => {
  const noDaysLeft: CalendarConfig = { ...bankWeek, holidays: new Set(["2026-11-30"]) };

  it("returns an empty plan for a zero quantity when no working days are left", () => {
    expect(
      planSlices({
        month: "2026-11",
        quantity: 0,
        pacing: "DAILY",
        startDate: "2026-11-29",
        calendar: noDaysLeft,
      }),
    ).toEqual([]);
  });

  it("throws when there is something to plan but no working days are left", () => {
    expect(() =>
      planSlices({
        month: "2026-11",
        quantity: 3,
        pacing: "DAILY",
        startDate: "2026-11-29",
        calendar: noDaysLeft,
      }),
    ).toThrow();
  });

  it("plans zeros when the quantity is zero", () => {
    const slices = planSlices({ month: "2026-11", quantity: 0, pacing: "DAILY", calendar: NOV });
    expect(slices).toHaveLength(21);
    expect(slices.every((s) => s.plannedQty === 0)).toBe(true);
  });

  it("throws when the start date is outside the month or not a real date", () => {
    const base = { month: "2026-11", quantity: 5, pacing: "DAILY" as const, calendar: NOV };
    expect(() => planSlices({ ...base, startDate: "2026-10-31" })).toThrow();
    expect(() => planSlices({ ...base, startDate: "2026-12-01" })).toThrow();
    expect(() => planSlices({ ...base, startDate: "2026-11-31" })).toThrow();
  });

  it("throws on an invalid month", () => {
    const base = { quantity: 5, pacing: "DAILY" as const, calendar: NOV };
    expect(() => planSlices({ ...base, month: "2026-13" })).toThrow();
    expect(() => planSlices({ ...base, month: "2026-1" })).toThrow();
    expect(() => planSlices({ ...base, month: "November" })).toThrow();
  });

  it("throws on a negative or fractional quantity", () => {
    const base = { month: "2026-11", pacing: "DAILY" as const, calendar: NOV };
    expect(() => planSlices({ ...base, quantity: -1 })).toThrow();
    expect(() => planSlices({ ...base, quantity: 2.5 })).toThrow();
  });
});

describe("planSlices: invariants", () => {
  it("always sums to the quantity, in order, on working days, without overlap", () => {
    const pacings: Pacing[] = ["DAILY", "WEEKLY", "MONTHLY"];
    const starts = [undefined, "2026-11-10", "2026-11-23"];

    for (const pacing of pacings) {
      for (const startDate of starts) {
        for (let quantity = 0; quantity <= 40; quantity++) {
          const slices = planSlices({ month: "2026-11", quantity, pacing, startDate, calendar: NOV });

          expect(sum(slices.map((s) => s.plannedQty))).toBe(quantity);

          slices.forEach((slice, i) => {
            expect(isWorkingDay(slice.dueDate, NOV)).toBe(true);
            expect(slice.dueDate >= slice.periodStart && slice.dueDate <= slice.periodEnd).toBe(true);
            if (i > 0) expect(slice.periodStart > slices[i - 1].periodEnd).toBe(true);
          });
        }
      }
    }
  });
});