export type ProgressStatus = "BEHIND" | "SLIGHTLY_BEHIND" | "ON_TRACK";
export type ProductStatus = ProgressStatus | "ACHIEVED";
export type StatusKey = ProductStatus | "NO_PLAN";

/** Percentage points under the plan at which something counts as "behind the plan". */
export const BEHIND_GAP = 10;
/** Percentage points under the plan at which something counts as "a little behind". */
export const SLIGHTLY_BEHIND_GAP = 4;

function assertNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a number, got ${value}`);
}

export function statusFor(percentDone: number, expectedPercent: number): ProgressStatus {
  assertNumber(percentDone, "Percent done");
  assertNumber(expectedPercent, "Expected percent");
  const gap = expectedPercent - percentDone;
  if (gap >= BEHIND_GAP) return "BEHIND";
  if (gap >= SLIGHTLY_BEHIND_GAP) return "SLIGHTLY_BEHIND";
  return "ON_TRACK";
}

/** One product: achieved if the target is met, otherwise judged against the plan. */
export function productStatus(p: {
  outlook: string;
  percentDone: number;
  expectedPercent: number;
}): ProductStatus {
  return p.outlook === "ACHIEVED" ? "ACHIEVED" : statusFor(p.percentDone, p.expectedPercent);
}

/** Furthest under the plan first. Ties keep their order. */
export function sortByGap<T>(
  items: readonly T[],
  progress: (item: T) => { percentDone: number; expectedPercent: number },
): T[] {
  return items
    .map((item, index) => {
      const p = progress(item);
      return { item, index, gap: p.expectedPercent - p.percentDone };
    })
    .sort((a, b) => b.gap - a.gap || a.index - b.index)
    .map(({ item }) => item);
}

export interface ProductProgress {
  name: string;
  percentDone: number;
  expectedPercent: number;
}

export interface PersonProgress {
  hasTargets: boolean;
  /** How many of their products are behind. */
  behindCount: number;
}

export interface BranchSummary {
  percentDone: number;
  expectedPercent: number;
  status: ProgressStatus;
  peopleBehind: number;
  peopleWithTargets: number;
  /** Up to two product names, the furthest under the plan first. Empty when all are close. */
  furthest: string[];
}

export interface ClusterSummary {
  percentDone: number;
  expectedPercent: number;
  status: ProgressStatus;
  peopleBehind: number;
  peopleWithTargets: number;
  branchesBehind: number;
  branchesWithPlan: number;
}

const mean = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) / values.length);

/**
 * A branch in one glance. Counts and rupees cannot be added together, so every product's
 * percentage is averaged and each product counts equally. null when there is nothing to judge.
 */
export function summariseBranch(
  products: readonly ProductProgress[],
  people: readonly PersonProgress[],
): BranchSummary | null {
  if (products.length === 0) return null;

  const percentDone = mean(products.map((p) => p.percentDone));
  const expectedPercent = mean(products.map((p) => p.expectedPercent));
  const withTargets = people.filter((p) => p.hasTargets);

  const furthest = products
    .map((product, index) => ({ product, index, gap: product.expectedPercent - product.percentDone }))
    .filter((entry) => entry.gap >= SLIGHTLY_BEHIND_GAP)
    .sort((a, b) => b.gap - a.gap || a.index - b.index)
    .slice(0, 2)
    .map((entry) => entry.product.name);

  return {
    percentDone,
    expectedPercent,
    status: statusFor(percentDone, expectedPercent),
    peopleBehind: withTargets.filter((p) => p.behindCount > 0).length,
    peopleWithTargets: withTargets.length,
    furthest,
  };
}

/** The whole cluster: the branches' percentages averaged, people and branches counted. */
export function summariseCluster(branches: readonly BranchSummary[]): ClusterSummary | null {
  if (branches.length === 0) return null;

  const percentDone = mean(branches.map((b) => b.percentDone));
  const expectedPercent = mean(branches.map((b) => b.expectedPercent));

  return {
    percentDone,
    expectedPercent,
    status: statusFor(percentDone, expectedPercent),
    peopleBehind: branches.reduce((sum, b) => sum + b.peopleBehind, 0),
    peopleWithTargets: branches.reduce((sum, b) => sum + b.peopleWithTargets, 0),
    branchesBehind: branches.filter((b) => b.status === "BEHIND").length,
    branchesWithPlan: branches.length,
  };
}

/** Furthest under the plan first. Branches with no plan go last. Ties keep their order. */
export function orderBranches<T extends { summary: BranchSummary | null }>(items: readonly T[]): T[] {
  const gapOf = (item: T) =>
    item.summary ? item.summary.expectedPercent - item.summary.percentDone : Number.NEGATIVE_INFINITY;

  return items
    .map((item, index) => ({ item, index, gap: gapOf(item) }))
    .sort((a, b) => {
      if (a.gap === b.gap) return a.index - b.index;
      return b.gap > a.gap ? 1 : -1;
    })
    .map(({ item }) => item);
}