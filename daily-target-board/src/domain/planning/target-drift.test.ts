import { describe, expect, it } from "vitest";
import { branchTargetDrift, type DriftMetric } from "./target-drift";

const METRICS: DriftMetric[] = [
  { id: "FD", scope: "INDIVIDUAL" },
  { id: "SA", scope: "INDIVIDUAL" },
  { id: "LEGACY", scope: "BRANCH" },
];

const map = (entries: [string, number][]) => new Map(entries);

describe("branchTargetDrift", () => {
  it("reports nothing when the figures match", () => {
    const same = map([["FD", 100], ["LEGACY", 8]]);
    expect(branchTargetDrift(METRICS, same, same)).toEqual({ changed: [], changedBranchWide: [] });
  });

  it("reports a changed individual target without calling the plan stale", () => {
    expect(branchTargetDrift(METRICS, map([["FD", 100]]), map([["FD", 120]]))).toEqual({
      changed: ["FD"],
      changedBranchWide: [],
    });
  });

  it("reports a changed branch-wide target in both lists", () => {
    expect(branchTargetDrift(METRICS, map([["LEGACY", 8]]), map([["LEGACY", 10]]))).toEqual({
      changed: ["LEGACY"],
      changedBranchWide: ["LEGACY"],
    });
  });

  it("treats a missing target as zero on either side", () => {
    expect(branchTargetDrift(METRICS, map([]), map([["FD", 0]])).changed).toEqual([]);
    expect(branchTargetDrift(METRICS, map([]), map([["FD", 5]])).changed).toEqual(["FD"]);
    expect(branchTargetDrift(METRICS, map([["SA", 3]]), map([])).changed).toEqual(["SA"]);
  });

  it("follows the order of the metrics and ignores products it was not asked about", () => {
    const drift = branchTargetDrift(
      METRICS,
      map([["FD", 1], ["SA", 1], ["OTHER", 1]]),
      map([["FD", 2], ["SA", 2], ["OTHER", 2]]),
    );
    expect(drift.changed).toEqual(["FD", "SA"]);
  });
});