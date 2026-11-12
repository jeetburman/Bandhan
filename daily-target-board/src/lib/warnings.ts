import type { AllocationWarning } from "../domain/allocation/allocate";
import { formatQty } from "./money";

export interface WarningMetric {
  name: string;
  unit: "COUNT" | "AMOUNT";
}

export function describeWarning(
  warning: AllocationWarning,
  metricById: ReadonlyMap<string, WarningMetric>,
): string {
  const metric = metricById.get(warning.metricId);
  const name = metric?.name ?? warning.metricId;
  const fmt = (quantity: number) => (metric ? formatQty(metric.unit, quantity) : String(quantity));

  switch (warning.code) {
    case "ALLOCATED_ABOVE_TARGET":
      return `${name}: employees total ${fmt(warning.allocatedQty)}, above the branch target of ${fmt(warning.targetQty)}`;
    case "ALLOCATED_BELOW_TARGET":
      return `${name}: employees total ${fmt(warning.allocatedQty)}, below the branch target of ${fmt(warning.targetQty)}`;
    case "NO_BRANCH_TARGET":
      return `${name}: employees total ${fmt(warning.allocatedQty)} but the Cluster Head has set no branch target`;
    case "QUOTA_ON_BRANCH_METRIC":
      return `${name}: a quota exists for a branch-wide target and was ignored`;
  }
}