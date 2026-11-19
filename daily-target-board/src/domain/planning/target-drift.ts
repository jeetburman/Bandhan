export interface DriftMetric {
  id: string;
  scope: "INDIVIDUAL" | "BRANCH";
}

export interface BranchTargetDrift {
  /** Every product whose branch target is not what the plan was built against. */
  changed: string[];
  /** The ones shared by the whole branch. Only these change the plan's own slices. */
  changedBranchWide: string[];
}

/**
 * Compare the Cluster Head's current branch targets with the ones the plan was built against.
 * A product with no target on either side counts as 0.
 */
export function branchTargetDrift(
  metrics: readonly DriftMetric[],
  atPublish: ReadonlyMap<string, number>,
  current: ReadonlyMap<string, number>,
): BranchTargetDrift {
  const changed: string[] = [];
  const changedBranchWide: string[] = [];

  for (const metric of metrics) {
    if ((atPublish.get(metric.id) ?? 0) === (current.get(metric.id) ?? 0)) continue;
    changed.push(metric.id);
    if (metric.scope === "BRANCH") changedBranchWide.push(metric.id);
  }
  return { changed, changedBranchWide };
}