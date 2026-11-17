import { describe, expect, it } from "vitest";
import { buildAllocation, type AllocationMetric, type ExtraEntry } from "./allocate";

const METRICS: AllocationMetric[] = [
  { id: "FD", scope: "INDIVIDUAL" },
  { id: "SA", scope: "INDIVIDUAL" },
  { id: "MF", scope: "INDIVIDUAL" },
  { id: "LEGACY", scope: "BRANCH" },
];

const EMPLOYEES = [
  { userId: "cro1", designationId: "CRO" },
  { userId: "cro2", designationId: "CRO" },
];

const QUOTAS = [
  { designationId: "CRO", metricId: "FD", quantity: 500 },
  { designationId: "CRO", metricId: "SA", quantity: 7 },
];

const run = (extras: ExtraEntry[]) =>
  buildAllocation({
    employees: EMPLOYEES,
    quotas: QUOTAS,
    extras,
    metrics: METRICS,
    branchTargets: [],
  });

const lineOf = (extras: ExtraEntry[], userId: string, metricId: string) =>
  run(extras).lines.find((l) => l.userId === userId && l.metricId === metricId);

describe("buildAllocation: negative adjustments", () => {
  it("lowers a target below the quota", () => {
    expect(lineOf([{ userId: "cro1", metricId: "FD", quantity: -100 }], "cro1", "FD")).toEqual({
      userId: "cro1",
      metricId: "FD",
      baseQty: 500,
      extraQty: -100,
      totalQty: 400,
    });
  });

  it("can lower a target to zero and keeps the line, so the choice is visible", () => {
    expect(lineOf([{ userId: "cro1", metricId: "SA", quantity: -7 }], "cro1", "SA")).toMatchObject({
      baseQty: 7,
      extraQty: -7,
      totalQty: 0,
    });
  });

  it("refuses to go below zero", () => {
    expect(() => run([{ userId: "cro1", metricId: "FD", quantity: -501 }])).toThrow();
  });

  it("refuses a negative adjustment on a product with no quota", () => {
    expect(() => run([{ userId: "cro1", metricId: "MF", quantity: -1 }])).toThrow();
  });

  it("combines raises and cuts for the same person and product", () => {
    expect(
      lineOf(
        [
          { userId: "cro1", metricId: "FD", quantity: 50 },
          { userId: "cro1", metricId: "FD", quantity: -20 },
        ],
        "cro1",
        "FD",
      ),
    ).toMatchObject({ extraQty: 30, totalQty: 530 });
  });

  it("drops a line that nets out to nothing on a product with no quota", () => {
    const result = run([
      { userId: "cro1", metricId: "MF", quantity: 5 },
      { userId: "cro1", metricId: "MF", quantity: -5 },
    ]);
    expect(result.lines.some((l) => l.metricId === "MF")).toBe(false);
  });

  it("counts lowered amounts in the branch totals", () => {
    const { totals } = run([{ userId: "cro1", metricId: "FD", quantity: -100 }]);
    expect(totals.find((t) => t.metricId === "FD")?.allocatedQty).toBe(900);
  });

  it("still rejects fractions and NaN", () => {
    expect(() => run([{ userId: "cro1", metricId: "FD", quantity: 1.5 }])).toThrow();
    expect(() => run([{ userId: "cro1", metricId: "FD", quantity: Number.NaN }])).toThrow();
  });
});