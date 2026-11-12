import { describe, expect, it } from "vitest";
import { buildAllocation, type BranchTargetEntry } from "../allocation/allocate";
import type { CalendarConfig } from "../calendar/types";
import { buildPlan, type PlanMetricInfo, type PlanOutput } from "./build-plan";

// Bhai Phota (Wed 11) and Guru Nanak Jayanti (Tue 24)
const NOV: CalendarConfig = {
  weeklyOffDays: [0],
  offSaturdays: [2, 4],
  holidays: new Set(["2026-11-11", "2026-11-24"]),
};

const METRICS: PlanMetricInfo[] = [
  { id: "FD", scope: "INDIVIDUAL", pacing: "DAILY" },
  { id: "SA", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { id: "CA", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { id: "SIP", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { id: "LEGACY", scope: "BRANCH", pacing: "MONTHLY" },
];

const FD_TOTAL = 500_000_000; // Rs 50 lakh in paise

const QUOTAS = [
  { designationId: "CRO", metricId: "FD", quantity: FD_TOTAL },
  { designationId: "CRO", metricId: "SA", quantity: 7 },
  { designationId: "CRO", metricId: "CA", quantity: 2 },
  { designationId: "CRO", metricId: "SIP", quantity: 5 },
];

const BRANCH_TARGETS: BranchTargetEntry[] = [
  { metricId: "FD", quantity: FD_TOTAL },
  { metricId: "SA", quantity: 7 },
  { metricId: "CA", quantity: 2 },
  { metricId: "SIP", quantity: 5 },
  { metricId: "LEGACY", quantity: 8 },
];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function plan(overrides: { calendar?: CalendarConfig; startDate?: string } = {}): PlanOutput {
  const allocation = buildAllocation({
    employees: [{ userId: "cro1", designationId: "CRO" }],
    quotas: QUOTAS,
    extras: [],
    metrics: METRICS.map(({ id, scope }) => ({ id, scope })),
    branchTargets: BRANCH_TARGETS,
  });
  return buildPlan({
    month: "2026-11",
    calendar: overrides.calendar ?? NOV,
    startDate: overrides.startDate,
    metrics: METRICS,
    lines: allocation.lines,
    branchTargets: BRANCH_TARGETS,
  });
}

function lineOf(output: PlanOutput, metricId: string) {
  const found = output.employeeLines.find((line) => line.metricId === metricId);
  if (!found) throw new Error(`No line for ${metricId}`);
  return found;
}

const planned = (output: PlanOutput, metricId: string) =>
  lineOf(output, metricId).slices.map((slice) => slice.plannedQty);

describe("buildPlan", () => {
  it("plans each metric with its own pacing", () => {
    const output = plan();
    expect(lineOf(output, "FD").slices).toHaveLength(21);
    expect(lineOf(output, "FD").slices.every((s) => s.kind === "DAY")).toBe(true);
    expect(lineOf(output, "SA").slices).toHaveLength(5);
    expect(lineOf(output, "SA").slices.every((s) => s.kind === "WEEK")).toBe(true);
  });

  it("places every paisa of a Rs 50 lakh FD across the 21 working days", () => {
    const output = plan();
    const slices = lineOf(output, "FD").slices;
    expect(sum(planned(output, "FD"))).toBe(FD_TOTAL);
    expect(slices[0].plannedQty).toBe(23_809_524);
    expect(slices[20].plannedQty).toBe(23_809_523);
  });

  it("splits the low-count products across the weeks", () => {
    const output = plan();
    expect(planned(output, "SA")).toEqual([2, 2, 2, 1, 0]);
    expect(planned(output, "CA")).toEqual([1, 0, 1, 0, 0]);
    expect(planned(output, "SIP")).toEqual([2, 1, 1, 1, 0]);
  });

  it("plans a branch-wide target as one monthly slice", () => {
    const { branchMetrics } = plan();
    expect(branchMetrics).toHaveLength(1);
    expect(branchMetrics[0]).toMatchObject({ metricId: "LEGACY", totalQty: 8 });
    expect(branchMetrics[0].slices).toEqual([
      {
        kind: "MONTH",
        periodStart: "2026-11-01",
        periodEnd: "2026-11-30",
        dueDate: "2026-11-30",
        workingDays: 21,
        plannedQty: 8,
      },
    ]);
  });

  it("never creates an employee line for a branch-wide metric", () => {
    expect(plan().employeeLines.some((line) => line.metricId === "LEGACY")).toBe(false);
  });

  it("re-spreads the numbers when another holiday is added", () => {
    const withExtraHoliday: CalendarConfig = {
      ...NOV,
      holidays: new Set([...NOV.holidays, "2026-11-12"]),
    };
    const output = plan({ calendar: withExtraHoliday });
    expect(lineOf(output, "FD").slices).toHaveLength(20);
    expect(planned(output, "FD")[0]).toBe(25_000_000); // Rs 2,50,000 a day
    expect(planned(output, "SA")).toEqual([2, 1, 2, 2, 0]);
    expect(sum(planned(output, "SA"))).toBe(7);
  });

  it("plans from the given start date", () => {
    const output = plan({ startDate: "2026-11-23" });
    expect(lineOf(output, "FD").slices[0].dueDate).toBe("2026-11-23");
    expect(sum(planned(output, "FD"))).toBe(FD_TOTAL);
  });

  it("always plans exactly the target for every line", () => {
    for (const line of plan().employeeLines) {
      expect(sum(line.slices.map((slice) => slice.plannedQty))).toBe(line.totalQty);
    }
  });
});

describe("buildPlan: invalid input", () => {
  const base = { month: "2026-11", calendar: NOV, metrics: METRICS };
  const line = (metricId: string) => ({
    userId: "u1",
    metricId,
    baseQty: 1,
    extraQty: 0,
    totalQty: 1,
  });

  it("throws on an unknown metric", () => {
    expect(() => buildPlan({ ...base, lines: [line("NOPE")], branchTargets: [] })).toThrow();
    expect(() =>
      buildPlan({ ...base, lines: [], branchTargets: [{ metricId: "NOPE", quantity: 1 }] }),
    ).toThrow();
  });

  it("throws when a branch-wide metric is on an employee line", () => {
    expect(() => buildPlan({ ...base, lines: [line("LEGACY")], branchTargets: [] })).toThrow();
  });

  it("throws on two targets for one metric", () => {
    expect(() =>
      buildPlan({
        ...base,
        lines: [],
        branchTargets: [
          { metricId: "LEGACY", quantity: 1 },
          { metricId: "LEGACY", quantity: 2 },
        ],
      }),
    ).toThrow();
  });
});