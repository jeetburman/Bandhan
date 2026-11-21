import { describe, expect, it } from "vitest";
import {
  orderBranches,
  productStatus,
  sortByGap,
  statusFor,
  summariseBranch,
  summariseCluster,
  type BranchSummary,
} from "./branch-status";

describe("statusFor", () => {
  it("is behind the plan from 10 points under", () => {
    expect(statusFor(41, 55)).toBe("BEHIND");
    expect(statusFor(45, 55)).toBe("BEHIND");
    expect(statusFor(46, 55)).toBe("SLIGHTLY_BEHIND");
  });

  it("is a little behind from 4 to 9 points under", () => {
    expect(statusFor(51, 55)).toBe("SLIGHTLY_BEHIND");
    expect(statusFor(52, 55)).toBe("ON_TRACK");
  });

  it("is on track when level or ahead", () => {
    expect(statusFor(55, 55)).toBe("ON_TRACK");
    expect(statusFor(63, 55)).toBe("ON_TRACK");
    expect(statusFor(0, 0)).toBe("ON_TRACK");
  });

  it("throws on something that is not a number", () => {
    expect(() => statusFor(Number.NaN, 50)).toThrow();
    expect(() => statusFor(50, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("productStatus", () => {
  it("is achieved once the target is met, whatever the plan said", () => {
    expect(productStatus({ outlook: "ACHIEVED", percentDone: 100, expectedPercent: 50 })).toBe("ACHIEVED");
  });

  it("otherwise follows the plan gap", () => {
    expect(productStatus({ outlook: "BEHIND", percentDone: 21, expectedPercent: 54 })).toBe("BEHIND");
    expect(productStatus({ outlook: "ON_PACE", percentDone: 56, expectedPercent: 56 })).toBe("ON_TRACK");
  });
});

describe("sortByGap", () => {
  it("puts the furthest behind first and keeps the order of ties", () => {
    const items = [
      { n: "level", p: { percentDone: 50, expectedPercent: 50 } },
      { n: "far", p: { percentDone: 20, expectedPercent: 55 } },
      { n: "ahead", p: { percentDone: 70, expectedPercent: 55 } },
      { n: "tie", p: { percentDone: 50, expectedPercent: 50 } },
    ];
    expect(sortByGap(items, (i) => i.p).map((i) => i.n)).toEqual(["far", "level", "tie", "ahead"]);
  });
});

describe("summariseBranch", () => {
  const products = [
    { name: "Fixed deposits", percentDone: 36, expectedPercent: 55 },
    { name: "Savings accounts", percentDone: 44, expectedPercent: 54 },
    { name: "Life insurance", percentDone: 21, expectedPercent: 54 },
    { name: "Current accounts", percentDone: 56, expectedPercent: 56 },
    { name: "Loans", percentDone: 54, expectedPercent: 51 },
  ];

  it("averages the products, and names the two furthest behind", () => {
    expect(
      summariseBranch(products, [
        { hasTargets: true, behindCount: 5 },
        { hasTargets: true, behindCount: 0 },
        { hasTargets: false, behindCount: 0 },
        { hasTargets: true, behindCount: 2 },
      ]),
    ).toEqual({
      percentDone: 42,
      expectedPercent: 54,
      status: "BEHIND",
      peopleBehind: 2,
      peopleWithTargets: 3,
      furthest: ["Life insurance", "Fixed deposits"],
    });
  });

  it("names nothing when every product is close to the plan", () => {
    const close = [
      { name: "A", percentDone: 52, expectedPercent: 55 },
      { name: "B", percentDone: 60, expectedPercent: 55 },
    ];
    expect(summariseBranch(close, [])?.furthest).toEqual([]);
  });

  it("is null when there is nothing to judge", () => {
    expect(summariseBranch([], [{ hasTargets: true, behindCount: 1 }])).toBeNull();
  });
});

const summary = (done: number, expected: number, overrides: Partial<BranchSummary> = {}): BranchSummary => ({
  percentDone: done,
  expectedPercent: expected,
  status: statusFor(done, expected),
  peopleBehind: 0,
  peopleWithTargets: 10,
  furthest: [],
  ...overrides,
});

describe("summariseCluster", () => {
  it("averages the branches and adds up people and branches", () => {
    expect(
      summariseCluster([
        summary(41, 55, { peopleBehind: 7, peopleWithTargets: 10 }),
        summary(63, 55, { peopleBehind: 1, peopleWithTargets: 14 }),
        summary(47, 55, { peopleBehind: 7, peopleWithTargets: 13 }),
      ]),
    ).toEqual({
      percentDone: 50,
      expectedPercent: 55,
      status: "SLIGHTLY_BEHIND",
      peopleBehind: 15,
      peopleWithTargets: 37,
      branchesBehind: 1,
      branchesWithPlan: 3,
    });
  });

  it("is null for no branches", () => {
    expect(summariseCluster([])).toBeNull();
  });
});

describe("orderBranches", () => {
  it("puts the furthest behind first, then the rest, then branches with no plan", () => {
    const items = [
      { id: "ahead", summary: summary(63, 55) },
      { id: "no plan", summary: null },
      { id: "far", summary: summary(41, 55) },
      { id: "near", summary: summary(47, 55) },
    ];
    expect(orderBranches(items).map((i) => i.id)).toEqual(["far", "near", "ahead", "no plan"]);
  });

  it("keeps the given order for ties", () => {
    const items = [
      { id: "a", summary: summary(50, 55) },
      { id: "b", summary: summary(50, 55) },
    ];
    expect(orderBranches(items).map((i) => i.id)).toEqual(["a", "b"]);
  });
});