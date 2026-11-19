import { calendarDrift } from "../domain/planning/drift";
import { branchTargetDrift } from "../domain/planning/target-drift";
import { db } from "../lib/db";
import { qtyFromDb } from "../lib/qty";
import { loadCalendar } from "./calendar-config";
import type { Actor } from "./permissions";
import { loadEditWindow } from "./target-grid";

export interface BranchPlanStatus {
  month: string;
  /** null when nothing has been published for this month yet. */
  planVersion: number | null;
  holidaysChanged: boolean;
  /** Whole-branch targets the Cluster Head has changed since the plan was published. */
  branchWideChanged: string[];
  /** Other branch targets the Cluster Head has changed. Employee targets stay as they are. */
  individualChanged: string[];
  /** True when holidays or a whole-branch target changed, so the plan itself is out of date. */
  needsRepublish: boolean;
  /** False when no working days are left to republish from. */
  canPublish: boolean;
}

/** Where the signed-in branch manager's published plan stands against holidays and branch targets. */
export async function loadBranchPlanStatus(
  actor: Actor,
  now: Date = new Date(),
): Promise<BranchPlanStatus | null> {
  if (actor.role !== "BRANCH_MANAGER" || !actor.branchId) return null;
  const branch = await db.branch.findUnique({ where: { id: actor.branchId } });
  if (!branch) return null;

  const { month, effectiveFrom } = await loadEditWindow(actor.clusterId, branch.id, now);
  const [plan, metrics, current, { holidays }] = await Promise.all([
    db.targetPlan.findFirst({
      where: { branchId: branch.id, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      include: { branchTargets: true },
    }),
    db.metric.findMany({ where: { isActive: true } }),
    db.branchTarget.findMany({ where: { branchId: branch.id, month } }),
    loadCalendar(branch.clusterId, branch.id, month),
  ]);

  if (!plan) {
    return {
      month,
      planVersion: null,
      holidaysChanged: false,
      branchWideChanged: [],
      individualChanged: [],
      needsRepublish: false,
      canPublish: true,
    };
  }

  const drift = branchTargetDrift(
    metrics.map((m) => ({ id: m.id, scope: m.scope })),
    new Map(plan.branchTargets.map((t) => [t.metricId, qtyFromDb(t.quantity)] as const)),
    new Map(current.map((t) => [t.metricId, qtyFromDb(t.quantity)] as const)),
  );
  const nameOf = new Map(metrics.map((m) => [m.id, m.name] as const));
  const names = (ids: string[]) => ids.map((id) => nameOf.get(id) ?? id);
  const holidaysChanged = calendarDrift(plan.holidayDates, holidays).stale;

  return {
    month,
    planVersion: plan.version,
    holidaysChanged,
    branchWideChanged: names(drift.changedBranchWide),
    individualChanged: names(drift.changed.filter((id) => !drift.changedBranchWide.includes(id))),
    needsRepublish: holidaysChanged || drift.changedBranchWide.length > 0,
    canPublish: effectiveFrom !== null,
  };
}