import {
  orderBranches,
  summariseBranch,
  summariseCluster,
  type BranchSummary,
  type ClusterSummary,
} from "../domain/performance/branch-status";
import { db } from "../lib/db";
import { istBusinessDate } from "../lib/ist";
import { listPickerBranches, loadBranchDetail, type BranchDetail } from "./branch-overview";
import type { Actor } from "./permissions";

export interface ClusterBranchCard {
  code: string;
  name: string;
  headcount: number;
  summary: BranchSummary | null;
}

export interface ClusterView {
  clusterName: string;
  month: string;
  today: string;
  headcount: number;
  overall: ClusterSummary | null;
  /** Furthest behind the plan first. */
  cards: ClusterBranchCard[];
}

/** A branch in one glance, from the same figures the branch page shows. */
export function summariseDetail(detail: BranchDetail): BranchSummary | null {
  return summariseBranch(
    detail.totals.map((total) => ({
      name: total.name,
      percentDone: total.performance.percentDone,
      expectedPercent: total.performance.expectedPercent,
    })),
    detail.employees.map((employee) => ({
      hasTargets: employee.figures.length > 0,
      behindCount: employee.behindCount,
    })),
  );
}

/** Every branch in the Cluster Head's cluster, ready for her home page. */
export async function loadClusterView(
  actor: Actor,
  now: Date = new Date(),
): Promise<ClusterView | null> {
  if (actor.role !== "CLUSTER_HEAD") return null;

  const today = istBusinessDate(now);
  const month = today.slice(0, 7);
  const [cluster, branches] = await Promise.all([
    db.cluster.findUnique({ where: { id: actor.clusterId } }),
    listPickerBranches(actor),
  ]);

  const details = await Promise.all(
    branches.map((branch) => loadBranchDetail(actor, branch.code, month, today, now)),
  );

  const cards: ClusterBranchCard[] = [];
  for (const detail of details) {
    if (!detail) continue;
    cards.push({
      code: detail.branch.code,
      name: detail.branch.name,
      headcount: detail.employees.length,
      summary: summariseDetail(detail),
    });
  }

  const ordered = orderBranches(cards);
  return {
    clusterName: cluster?.name ?? "Cluster",
    month,
    today,
    headcount: ordered.reduce((sum, card) => sum + card.headcount, 0),
    overall: summariseCluster(ordered.flatMap((card) => (card.summary ? [card.summary] : []))),
    cards: ordered,
  };
}