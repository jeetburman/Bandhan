import { describe, expect, it } from "vitest";
import {
  buildAllocation,
  type AllocationInput,
  type AllocationMetric,
  type BranchTargetEntry,
} from "./allocate";

const METRICS: AllocationMetric[] = [
  { id: "FD", scope: "INDIVIDUAL" },
  { id: "SA", scope: "INDIVIDUAL" },
  { id: "MF", scope: "INDIVIDUAL" },
  { id: "LEGACY", scope: "BRANCH" },
];

const EMPLOYEES = [
  { userId: "cro1", designationId: "CRO" },
  { userId: "cro2", designationId: "CRO" },
  { userId: "se1", designationId: "SE" },
  { userId: "bh", designationId: "BH" }, // the branch head has no quota
];

const QUOTAS = [
  { designationId: "CRO", metricId: "FD", quantity: 500 },
  { designationId: "CRO", metricId: "SA", quantity: 7 },
  { designationId: "SE", metricId: "FD", quantity: 200 },
  { designationId: "SE", metricId: "SA", quantity: 3 },
];

// Quotas add up to FD 1200 and SA 17.
const MATCHING_TARGETS: BranchTargetEntry[] = [
  { metricId: "FD", quantity: 1200 },
  { metricId: "SA", quantity: 17 },
];

const input = (overrides: Partial<AllocationInput> = {}): AllocationInput => ({
  employees: EMPLOYEES,
  quotas: QUOTAS,
  extras: [],
  metrics: METRICS,
  branchTargets: MATCHING_TARGETS,
  ...overrides,
});

describe("buildAllocation: lines", () => {
  it("gives every employee the quota of their designation, in display order", () => {
    const { lines } = buildAllocation(input());
    expect(lines).toEqual([
      { userId: "cro1", metricId: "FD", baseQty: 500, extraQty: 0, totalQty: 500 },
      { userId: "cro1", metricId: "SA", baseQty: 7, extraQty: 0, totalQty: 7 },
      { userId: "cro2", metricId: "FD", baseQty: 500, extraQty: 0, totalQty: 500 },
      { userId: "cro2", metricId: "SA", baseQty: 7, extraQty: 0, totalQty: 7 },
      { userId: "se1", metricId: "FD", baseQty: 200, extraQty: 0, totalQty: 200 },
      { userId: "se1", metricId: "SA", baseQty: 3, extraQty: 0, totalQty: 3 },
    ]);
  });

  it("gives an employee with no quota no lines", () => {
    const { lines } = buildAllocation(input());
    expect(lines.some((line) => line.userId === "bh")).toBe(false);
  });

  it("adds an extra on top of the base", () => {
    const { lines } = buildAllocation(
      input({ extras: [{ userId: "cro1", metricId: "FD", quantity: 50, note: "Festival push" }] }),
    );
    expect(lines.find((l) => l.userId === "cro1" && l.metricId === "FD")).toEqual({
      userId: "cro1",
      metricId: "FD",
      baseQty: 500,
      extraQty: 50,
      totalQty: 550,
      extraNote: "Festival push",
    });
    expect(lines.find((l) => l.userId === "cro2" && l.metricId === "FD")?.totalQty).toBe(500);
  });

  it("creates a line with a base of 0 when the extra is on a metric the designation has no quota for", () => {
    const { lines } = buildAllocation(input({ extras: [{ userId: "se1", metricId: "MF", quantity: 5 }] }));
    expect(lines.find((l) => l.userId === "se1" && l.metricId === "MF")).toEqual({
      userId: "se1",
      metricId: "MF",
      baseQty: 0,
      extraQty: 5,
      totalQty: 5,
    });
  });

  it("sums several extras for the same employee and metric and joins their notes", () => {
    const { lines } = buildAllocation(
      input({
        extras: [
          { userId: "cro1", metricId: "FD", quantity: 20, note: "A" },
          { userId: "cro1", metricId: "FD", quantity: 30, note: "B" },
        ],
      }),
    );
    expect(lines.find((l) => l.userId === "cro1" && l.metricId === "FD")).toMatchObject({
      extraQty: 50,
      totalQty: 550,
      extraNote: "A; B",
    });
  });

  it("ignores a zero extra", () => {
    const { lines } = buildAllocation(input({ extras: [{ userId: "se1", metricId: "MF", quantity: 0 }] }));
    expect(lines.some((l) => l.metricId === "MF")).toBe(false);
  });

  it("follows the order of the metrics and employees it is given", () => {
    const reversedMetrics = [METRICS[1], METRICS[0], METRICS[2], METRICS[3]];
    const { lines } = buildAllocation(input({ metrics: reversedMetrics }));
    expect(lines[0]).toMatchObject({ userId: "cro1", metricId: "SA" });
    expect(lines[1]).toMatchObject({ userId: "cro1", metricId: "FD" });
  });
});

describe("buildAllocation: totals and warnings", () => {
  it("reports no warnings when employee totals match the branch target", () => {
    const { totals, warnings } = buildAllocation(input());
    expect(totals).toEqual([
      { metricId: "FD", allocatedQty: 1200, branchTargetQty: 1200 },
      { metricId: "SA", allocatedQty: 17, branchTargetQty: 17 },
    ]);
    expect(warnings).toEqual([]);
  });

  it("includes extras in the totals", () => {
    const { totals } = buildAllocation(
      input({ extras: [{ userId: "cro1", metricId: "FD", quantity: 50 }] }),
    );
    expect(totals[0]).toEqual({ metricId: "FD", allocatedQty: 1250, branchTargetQty: 1200 });
  });

  it("warns when the employee total is above the branch target", () => {
    const { warnings } = buildAllocation(
      input({ branchTargets: [{ metricId: "FD", quantity: 1000 }, { metricId: "SA", quantity: 17 }] }),
    );
    expect(warnings).toEqual([
      { code: "ALLOCATED_ABOVE_TARGET", metricId: "FD", allocatedQty: 1200, targetQty: 1000 },
    ]);
  });

  it("warns when the employee total is below the branch target", () => {
    const { warnings } = buildAllocation(
      input({ branchTargets: [{ metricId: "FD", quantity: 1500 }, { metricId: "SA", quantity: 17 }] }),
    );
    expect(warnings).toEqual([
      { code: "ALLOCATED_BELOW_TARGET", metricId: "FD", allocatedQty: 1200, targetQty: 1500 },
    ]);
  });

  it("warns when there are allocations but the Cluster Head has set no target", () => {
    const { totals, warnings } = buildAllocation(input({ branchTargets: [] }));
    expect(totals.map((t) => t.branchTargetQty)).toEqual([null, null]);
    expect(warnings).toEqual([
      { code: "NO_BRANCH_TARGET", metricId: "FD", allocatedQty: 1200 },
      { code: "NO_BRANCH_TARGET", metricId: "SA", allocatedQty: 17 },
    ]);
  });

  it("warns when a branch target exists but nothing is allocated for it", () => {
    const { totals, warnings } = buildAllocation(
      input({ branchTargets: [...MATCHING_TARGETS, { metricId: "MF", quantity: 10 }] }),
    );
    expect(totals).toContainEqual({ metricId: "MF", allocatedQty: 0, branchTargetQty: 10 });
    expect(warnings).toEqual([
      { code: "ALLOCATED_BELOW_TARGET", metricId: "MF", allocatedQty: 0, targetQty: 10 },
    ]);
  });
});

describe("buildAllocation: branch-wide metrics", () => {
  it("ignores quotas on a branch-wide metric and warns once", () => {
    const { lines, warnings } = buildAllocation(
      input({
        quotas: [
          ...QUOTAS,
          { designationId: "CRO", metricId: "LEGACY", quantity: 1 },
          { designationId: "SE", metricId: "LEGACY", quantity: 1 },
        ],
      }),
    );
    expect(lines.some((l) => l.metricId === "LEGACY")).toBe(false);
    expect(warnings).toEqual([{ code: "QUOTA_ON_BRANCH_METRIC", metricId: "LEGACY" }]);
  });

  it("leaves a branch-wide target out of the totals and the warnings", () => {
    const { totals, warnings } = buildAllocation(
      input({ branchTargets: [...MATCHING_TARGETS, { metricId: "LEGACY", quantity: 8 }] }),
    );
    expect(totals.map((t) => t.metricId)).toEqual(["FD", "SA"]);
    expect(warnings).toEqual([]);
  });

  it("refuses to give a branch-wide target to one employee", () => {
    expect(() =>
      buildAllocation(input({ extras: [{ userId: "cro1", metricId: "LEGACY", quantity: 1 }] })),
    ).toThrow();
  });
});

describe("buildAllocation: invalid input", () => {
  it("throws on an extra for someone outside the branch", () => {
    expect(() =>
      buildAllocation(input({ extras: [{ userId: "stranger", metricId: "FD", quantity: 5 }] })),
    ).toThrow();
  });

  it("throws on an unknown metric in quotas, extras or branch targets", () => {
    expect(() =>
      buildAllocation(input({ quotas: [{ designationId: "CRO", metricId: "NOPE", quantity: 1 }] })),
    ).toThrow();
    expect(() =>
      buildAllocation(input({ extras: [{ userId: "cro1", metricId: "NOPE", quantity: 1 }] })),
    ).toThrow();
    expect(() => buildAllocation(input({ branchTargets: [{ metricId: "NOPE", quantity: 1 }] }))).toThrow();
  });

  it("throws on negative or fractional quantities", () => {
    expect(() =>
      buildAllocation(input({ quotas: [{ designationId: "CRO", metricId: "FD", quantity: -1 }] })),
    ).toThrow();
    expect(() =>
      buildAllocation(input({ extras: [{ userId: "cro1", metricId: "FD", quantity: 1.5 }] })),
    ).toThrow();
    expect(() => buildAllocation(input({ branchTargets: [{ metricId: "FD", quantity: -5 }] }))).toThrow();
  });

  it("throws on duplicates", () => {
    expect(() =>
      buildAllocation(input({ employees: [...EMPLOYEES, { userId: "cro1", designationId: "CRO" }] })),
    ).toThrow();
    expect(() =>
      buildAllocation(input({ quotas: [...QUOTAS, { designationId: "CRO", metricId: "FD", quantity: 1 }] })),
    ).toThrow();
    expect(() =>
      buildAllocation(input({ branchTargets: [...MATCHING_TARGETS, { metricId: "FD", quantity: 1 }] })),
    ).toThrow();
  });

  it("does not change what it was given", () => {
    const given = input({ extras: [{ userId: "cro1", metricId: "FD", quantity: 50, note: "x" }] });
    const before = JSON.stringify(given);
    buildAllocation(given);
    expect(JSON.stringify(given)).toBe(before);
  });
});