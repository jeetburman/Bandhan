import { describe, expect, it } from "vitest";
import { describeWarning, type WarningMetric } from "./warnings";

const metrics = new Map<string, WarningMetric>([
  ["fd", { name: "Fixed deposit value", unit: "AMOUNT" }],
  ["sa", { name: "Savings accounts", unit: "COUNT" }],
]);

describe("describeWarning", () => {
  it("formats amounts as rupees", () => {
    expect(
      describeWarning(
        { code: "ALLOCATED_ABOVE_TARGET", metricId: "fd", allocatedQty: 500_000_000, targetQty: 400_000_000 },
        metrics,
      ),
    ).toBe("Fixed deposit value: employees total ₹50,00,000, above the branch target of ₹40,00,000");
  });

  it("formats counts as plain numbers", () => {
    expect(
      describeWarning(
        { code: "ALLOCATED_BELOW_TARGET", metricId: "sa", allocatedQty: 80, targetQty: 82 },
        metrics,
      ),
    ).toBe("Savings accounts: employees total 80, below the branch target of 82");
  });

  it("explains a missing branch target and an ignored quota", () => {
    expect(
      describeWarning({ code: "NO_BRANCH_TARGET", metricId: "sa", allocatedQty: 7 }, metrics),
    ).toBe("Savings accounts: employees total 7 but the Cluster Head has set no branch target");
    expect(describeWarning({ code: "QUOTA_ON_BRANCH_METRIC", metricId: "sa" }, metrics)).toContain(
      "ignored",
    );
  });

  it("falls back to the id for an unknown metric", () => {
    expect(
      describeWarning({ code: "NO_BRANCH_TARGET", metricId: "zz", allocatedQty: 3 }, metrics),
    ).toContain("zz");
  });
});