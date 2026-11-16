import { describe, expect, it } from "vitest";
import type { CalendarConfig } from "../calendar/types";
import { planSlices } from "../distribution/plan-slices";
import type { EvaluationContext } from "../status/status";
import { buildMetricCard, orderCards, type MetricCardInput } from "./metric-card";

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

// 21 working days, one unit each.
const SLICES = planSlices({
  month: "2026-11",
  quantity: 21,
  pacing: "DAILY",
  calendar: NOV,
}).map((s) => ({ id: s.dueDate, dueDate: s.dueDate, plannedQty: s.plannedQty }));

const input = (overrides: Partial<MetricCardInput> = {}): MetricCardInput => ({
  metricId: "m1",
  code: "SA_COUNT",
  name: "Savings accounts",
  unit: "COUNT",
  pacing: "DAILY",
  monthTotal: 21,
  verifiedQty: 0,
  pendingQty: 0,
  slices: SLICES,
  ...overrides,
});

const TUE_10 = ctx("2026-11-10");

describe("buildMetricCard: state", () => {
  it("is on track when every closed day is covered", () => {
    const card = buildMetricCard(input({ verifiedQty: 7 }), TUE_10);
    expect(card).toMatchObject({
      state: "ON_TRACK",
      label: "On track",
      remaining: 14,
      percent: 33,
      behindQty: 0,
      shade: null,
    });
  });

  it("is behind, with a shade and a label, when closed days are not covered", () => {
    const card = buildMetricCard(input({ verifiedQty: 4 }), TUE_10);
    expect(card).toMatchObject({
      state: "BEHIND",
      label: "Overdue 3 days",
      overdueWorkingDays: 3,
      shade: "MEDIUM",
      behindQty: 3,
      remaining: 17,
      percent: 19,
    });
  });

  it("gets darker the longer it has been overdue", () => {
    const card = buildMetricCard(input({ verifiedQty: 0 }), TUE_10);
    expect(card).toMatchObject({ overdueWorkingDays: 7, shade: "STRONG", behindQty: 7 });
  });

  it("is achieved once the whole target is verified, and never goes past 100 percent", () => {
    for (const verified of [21, 25]) {
      const card = buildMetricCard(input({ verifiedQty: verified }), TUE_10);
      expect(card).toMatchObject({ state: "ACHIEVED", label: "Achieved", remaining: 0, percent: 100, shade: null });
    }
  });

  it("turns today's slice overdue only after the cut-off", () => {
    const before = buildMetricCard(input({ verifiedQty: 7 }), ctx("2026-11-10", false));
    const after = buildMetricCard(input({ verifiedQty: 7 }), ctx("2026-11-10", true));
    expect(before.state).toBe("ON_TRACK");
    expect(after).toMatchObject({ state: "BEHIND", label: "Overdue 1 day", shade: "LIGHT", behindQty: 1 });
  });

  it("makes a carried-forward target the darkest red", () => {
    const card = buildMetricCard(
      input({
        monthTotal: 3,
        slices: [{ id: "carry", dueDate: "2026-10-30", plannedQty: 3, isCarry: true }],
      }),
      ctx("2026-11-02"),
    );
    expect(card).toMatchObject({
      state: "BEHIND",
      shade: "DARK",
      label: "Carried forward, overdue 2 days",
    });
  });

  it("does not count sales waiting for approval as progress", () => {
    const card = buildMetricCard(input({ verifiedQty: 4, pendingQty: 10 }), TUE_10);
    expect(card.state).toBe("BEHIND");
    expect(card.verifiedQty).toBe(4);
    expect(card.pendingQty).toBe(10);
  });
});

describe("buildMetricCard: suggestion", () => {
  it("matches the plan when the person is on track", () => {
    const card = buildMetricCard(input({ verifiedQty: 7 }), TUE_10);
    expect(card.suggestion).toMatchObject({ needed: 14, dayQty: 1, weekQty: 3 });
    expect(card.planned).toEqual({ day: 1, week: 3 });
  });

  it("rises above the plan when the person is behind", () => {
    const card = buildMetricCard(input({ verifiedQty: 4 }), TUE_10);
    expect(card.suggestion).toMatchObject({ needed: 17, dayQty: 2, weekQty: 6 });
    expect(card.planned).toEqual({ day: 1, week: 3 });
  });

  it("does not ask again for what is already waiting for approval", () => {
    const card = buildMetricCard(input({ verifiedQty: 7, pendingQty: 20 }), TUE_10);
    expect(card.state).toBe("ON_TRACK");
    expect(card.suggestion).toMatchObject({ needed: 0, dayQty: 0 });
  });

  it("starts from the next working day after the cut-off", () => {
    const card = buildMetricCard(input({ verifiedQty: 7 }), ctx("2026-11-10", true));
    expect(card.suggestion).toMatchObject({ fromDate: "2026-11-12", startsToday: false });
  });

  it("suggests nothing for an achieved target", () => {
    const card = buildMetricCard(input({ verifiedQty: 21 }), TUE_10);
    expect(card.suggestion).toMatchObject({ needed: 0, dayQty: 0, weekQty: 0 });
  });
});

describe("buildMetricCard: invalid input", () => {
  it("throws on negative or fractional quantities", () => {
    expect(() => buildMetricCard(input({ verifiedQty: -1 }), TUE_10)).toThrow();
    expect(() => buildMetricCard(input({ pendingQty: 1.5 }), TUE_10)).toThrow();
    expect(() => buildMetricCard(input({ monthTotal: -3 }), TUE_10)).toThrow();
  });
});

describe("orderCards", () => {
  const card = (name: string, state: "BEHIND" | "ON_TRACK" | "ACHIEVED", days = 0) => ({
    name,
    state,
    overdueWorkingDays: days,
  });

  it("puts the worst gap first, then on track, then achieved", () => {
    const ordered = orderCards([
      card("done", "ACHIEVED"),
      card("fine", "ON_TRACK"),
      card("late", "BEHIND", 2),
      card("later", "BEHIND", 9),
    ]);
    expect(ordered.map((c) => c.name)).toEqual(["later", "late", "fine", "done"]);
  });

  it("keeps the given order for ties", () => {
    const ordered = orderCards([card("a", "ON_TRACK"), card("b", "ON_TRACK"), card("c", "ON_TRACK")]);
    expect(ordered.map((c) => c.name)).toEqual(["a", "b", "c"]);
  });
});