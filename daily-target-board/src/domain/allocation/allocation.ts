export type MetricScope = "INDIVIDUAL" | "BRANCH";

export interface AllocationMetric {
  id: string;
  scope: MetricScope;
}

export interface AllocationEmployee {
  userId: string;
  designationId: string;
}

/** The pre-defined number for a designation. Whole units: a count, or paise. */
export interface QuotaEntry {
  designationId: string;
  metricId: string;
  quantity: number;
}

/** Extra quantity the branch manager adds by hand to one employee. */
export interface ExtraEntry {
  userId: string;
  metricId: string;
  quantity: number;
  note?: string;
}

/** The Cluster Head's target for this branch. */
export interface BranchTargetEntry {
  metricId: string;
  quantity: number;
}

export interface AllocationInput {
  employees: readonly AllocationEmployee[];
  quotas: readonly QuotaEntry[];
  extras: readonly ExtraEntry[];
  /** Listed in display order. The output follows this order. */
  metrics: readonly AllocationMetric[];
  branchTargets: readonly BranchTargetEntry[];
}

export interface AllocationLine {
  userId: string;
  metricId: string;
  baseQty: number;
  extraQty: number;
  totalQty: number;
  extraNote?: string;
}

export interface MetricTotal {
  metricId: string;
  allocatedQty: number;
  /** null when the Cluster Head has not set a target for this metric. */
  branchTargetQty: number | null;
}

export type AllocationWarning =
  | { code: "ALLOCATED_ABOVE_TARGET"; metricId: string; allocatedQty: number; targetQty: number }
  | { code: "ALLOCATED_BELOW_TARGET"; metricId: string; allocatedQty: number; targetQty: number }
  | { code: "NO_BRANCH_TARGET"; metricId: string; allocatedQty: number }
  | { code: "QUOTA_ON_BRANCH_METRIC"; metricId: string };

export interface AllocationResult {
  lines: AllocationLine[];
  totals: MetricTotal[];
  warnings: AllocationWarning[];
}

function assertQty(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative whole number, got ${value}`);
  }
}

/**
 * Turn designation quotas and manual extras into one target line per employee and metric.
 *
 * - Each employee gets the quota of their designation, for individual metrics only.
 * - Extras are added on top. An extra on a metric the designation has no quota for
 *   creates a line with a base of 0.
 * - Branch-wide metrics (such as Affluent Legacy) never produce employee lines. A quota
 *   on one is ignored with a warning, and an extra on one throws.
 * - Totals are compared with the Cluster Head's branch target. Differences are warnings,
 *   never errors, so the branch manager can still publish.
 * - Output order: employees as given, then metrics as given.
 */
export function buildAllocation(input: AllocationInput): AllocationResult {
  const { employees, quotas, extras, metrics, branchTargets } = input;

  const metricById = new Map(metrics.map((metric) => [metric.id, metric]));
  const requireMetric = (metricId: string): AllocationMetric => {
    const metric = metricById.get(metricId);
    if (!metric) throw new Error(`Unknown metric: ${metricId}`);
    return metric;
  };

  const employeeIds = new Set<string>();
  for (const employee of employees) {
    if (employeeIds.has(employee.userId)) {
      throw new Error(`Employee listed twice: ${employee.userId}`);
    }
    employeeIds.add(employee.userId);
  }

  const warnings: AllocationWarning[] = [];

  // Quotas, grouped by designation.
  const quotaByDesignation = new Map<string, Map<string, number>>();
  const seenQuotaKeys = new Set<string>();
  const warnedBranchMetrics = new Set<string>();
  for (const quota of quotas) {
    assertQty(quota.quantity, "Quota");
    const metric = requireMetric(quota.metricId);

    const key = `${quota.designationId}|${quota.metricId}`;
    if (seenQuotaKeys.has(key)) {
      throw new Error(`Two quotas for ${quota.designationId} and ${quota.metricId}`);
    }
    seenQuotaKeys.add(key);

    if (metric.scope === "BRANCH") {
      if (!warnedBranchMetrics.has(metric.id)) {
        warnedBranchMetrics.add(metric.id);
        warnings.push({ code: "QUOTA_ON_BRANCH_METRIC", metricId: metric.id });
      }
      continue;
    }

    const forDesignation = quotaByDesignation.get(quota.designationId) ?? new Map<string, number>();
    forDesignation.set(quota.metricId, quota.quantity);
    quotaByDesignation.set(quota.designationId, forDesignation);
  }

  // Base lines from quotas, keyed by user and metric.
  const lines = new Map<string, AllocationLine>();
  const lineKey = (userId: string, metricId: string) => `${userId}|${metricId}`;

  for (const employee of employees) {
    const forDesignation = quotaByDesignation.get(employee.designationId);
    if (!forDesignation) continue;
    for (const [metricId, quantity] of forDesignation) {
      lines.set(lineKey(employee.userId, metricId), {
        userId: employee.userId,
        metricId,
        baseQty: quantity,
        extraQty: 0,
        totalQty: quantity,
      });
    }
  }

  // Extras on top.
  for (const extra of extras) {
    assertQty(extra.quantity, "Extra");
    if (!employeeIds.has(extra.userId)) {
      throw new Error(`Extra given to someone outside this branch: ${extra.userId}`);
    }
    const metric = requireMetric(extra.metricId);
    if (metric.scope === "BRANCH") {
      throw new Error(`${metric.id} is a branch-wide target and cannot be given to one employee`);
    }
    if (extra.quantity === 0) continue;

    const key = lineKey(extra.userId, extra.metricId);
    const line = lines.get(key) ?? {
      userId: extra.userId,
      metricId: extra.metricId,
      baseQty: 0,
      extraQty: 0,
      totalQty: 0,
    };
    line.extraQty += extra.quantity;
    line.totalQty += extra.quantity;
    if (extra.note) {
      line.extraNote = line.extraNote ? `${line.extraNote}; ${extra.note}` : extra.note;
    }
    lines.set(key, line);
  }

  // Lines in display order: employees as given, then metrics as given.
  const orderedLines: AllocationLine[] = [];
  for (const employee of employees) {
    for (const metric of metrics) {
      const line = lines.get(lineKey(employee.userId, metric.id));
      if (line) orderedLines.push(line);
    }
  }

  // Totals per individual metric, compared with the Cluster Head's target.
  const allocated = new Map<string, number>();
  for (const line of orderedLines) {
    allocated.set(line.metricId, (allocated.get(line.metricId) ?? 0) + line.totalQty);
  }

  const targets = new Map<string, number>();
  for (const target of branchTargets) {
    assertQty(target.quantity, "Branch target");
    const metric = requireMetric(target.metricId);
    if (targets.has(target.metricId)) {
      throw new Error(`Two branch targets for ${target.metricId}`);
    }
    // Branch-wide targets go straight into the plan. There is nothing to split or compare.
    if (metric.scope === "BRANCH") continue;
    targets.set(target.metricId, target.quantity);
  }

  const totals: MetricTotal[] = [];
  for (const metric of metrics) {
    if (metric.scope === "BRANCH") continue;
    const allocatedQty = allocated.get(metric.id) ?? 0;
    const targetQty = targets.get(metric.id);
    if (allocatedQty === 0 && targetQty === undefined) continue;

    totals.push({ metricId: metric.id, allocatedQty, branchTargetQty: targetQty ?? null });

    if (targetQty === undefined) {
      warnings.push({ code: "NO_BRANCH_TARGET", metricId: metric.id, allocatedQty });
    } else if (allocatedQty > targetQty) {
      warnings.push({ code: "ALLOCATED_ABOVE_TARGET", metricId: metric.id, allocatedQty, targetQty });
    } else if (allocatedQty < targetQty) {
      warnings.push({ code: "ALLOCATED_BELOW_TARGET", metricId: metric.id, allocatedQty, targetQty });
    }
  }

  return { lines: orderedLines, totals, warnings };
}