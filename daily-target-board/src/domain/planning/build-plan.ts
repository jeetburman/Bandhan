import type { AllocationLine, BranchTargetEntry } from "../allocation/allocate";
import type { BusinessDate, CalendarConfig } from "../calendar/types";
import { planSlices, type Pacing, type PlannedSlice } from "../distribution/plan-slices";

export interface PlanMetricInfo {
  id: string;
  scope: "INDIVIDUAL" | "BRANCH";
  pacing: Pacing;
}

export interface PlannedEmployeeLine extends AllocationLine {
  slices: PlannedSlice[];
}

export interface PlannedBranchMetric {
  metricId: string;
  totalQty: number;
  slices: PlannedSlice[];
}

export interface BuildPlanInput {
  /** "YYYY-MM" */
  month: string;
  /** First day the plan applies to. Defaults to the first of the month. */
  startDate?: BusinessDate;
  calendar: CalendarConfig;
  /** Listed in display order. */
  metrics: readonly PlanMetricInfo[];
  /** One line per employee and metric, from buildAllocation. */
  lines: readonly AllocationLine[];
  branchTargets: readonly BranchTargetEntry[];
}

export interface PlanOutput {
  employeeLines: PlannedEmployeeLine[];
  /** Branch-wide targets, such as Affluent Legacy. They belong to nobody in particular. */
  branchMetrics: PlannedBranchMetric[];
}

/**
 * Turn allocation lines into daily, weekly or monthly slices, using each metric's pacing.
 *
 * - Employee lines keep the order they were given.
 * - Branch-wide targets get their own slices and never appear as employee lines.
 * - Anything inconsistent (unknown metric, a branch-wide metric on an employee line,
 *   two targets for one metric) throws instead of being guessed at.
 */
export function buildPlan(input: BuildPlanInput): PlanOutput {
  const { month, startDate, calendar, metrics, lines, branchTargets } = input;

  const metricById = new Map(metrics.map((metric) => [metric.id, metric]));
  const requireMetric = (metricId: string): PlanMetricInfo => {
    const metric = metricById.get(metricId);
    if (!metric) throw new Error(`Unknown metric: ${metricId}`);
    return metric;
  };

  const employeeLines = lines.map((line): PlannedEmployeeLine => {
    const metric = requireMetric(line.metricId);
    if (metric.scope === "BRANCH") {
      throw new Error(`${metric.id} is a branch-wide target and cannot be on an employee line`);
    }
    return {
      ...line,
      slices: planSlices({ month, quantity: line.totalQty, pacing: metric.pacing, startDate, calendar }),
    };
  });

  const targetByMetric = new Map<string, number>();
  for (const target of branchTargets) {
    requireMetric(target.metricId);
    if (targetByMetric.has(target.metricId)) {
      throw new Error(`Two branch targets for ${target.metricId}`);
    }
    targetByMetric.set(target.metricId, target.quantity);
  }

  const branchMetrics = metrics
    .filter((metric) => metric.scope === "BRANCH" && targetByMetric.has(metric.id))
    .map((metric): PlannedBranchMetric => {
      const totalQty = targetByMetric.get(metric.id) as number;
      return {
        metricId: metric.id,
        totalQty,
        slices: planSlices({ month, quantity: totalQty, pacing: metric.pacing, startDate, calendar }),
      };
    });

  return { employeeLines, branchMetrics };
}