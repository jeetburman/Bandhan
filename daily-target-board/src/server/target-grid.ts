import { monthRange } from "../domain/calendar/calendar";
import { firstPlanningDay } from "../domain/dashboard/suggest";
import { cutoffPassed as isCutoffPassed } from "../lib/cutoff";
import { db } from "../lib/db";
import { istBusinessDate } from "../lib/ist";
import { qtyFromDb } from "../lib/qty";
import { loadBranchTargetChangeViews, type BranchChangeView } from "./branch-target-changes";
import { loadCalendar } from "./calendar-config";
import type { Actor } from "./permissions";
import { canEditTargetsOf, userWhere, visibilityScope } from "./policy";
import { loadTargetChangeViews, type ChangeView } from "./target-changes";

export interface TargetCell {
  metricId: string;
  code: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  pacing: "DAILY" | "WEEKLY" | "MONTHLY";
  /** The quota for this person's designation. 0 if they have none. */
  baseQty: number;
  /** What the branch manager has added or taken off. Can be negative. */
  adjustmentQty: number;
  totalQty: number;
  /** The lowest the total can go: what has already fallen due. */
  minQty: number;
  change: ChangeView | null;
}

export interface EmployeeTargets {
  person: { id: string; name: string; designation: string };
  month: string;
  today: string;
  /** The first day a change applies to. null when no working days are left this month. */
  effectiveFrom: string | null;
  planVersion: number | null;
  cells: TargetCell[];
}

export interface OverviewMetric {
  metricId: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  allocated: number;
  /** The Cluster Head's current figure. null if she has set none. */
  branchTarget: number | null;
  /** Her most recent change to it. */
  change: BranchChangeView | null;
}

export interface OverviewPerson {
  id: string;
  name: string;
  designation: string;
  targetCount: number;
  isSelf: boolean;
  editable: boolean;
}

export interface TargetsOverview {
  branchName: string;
  month: string;
  today: string;
  effectiveFrom: string | null;
  planVersion: number | null;
  metrics: OverviewMetric[];
  people: OverviewPerson[];
}

/** Today's date, the month, and the first day a change would apply to. */
export async function loadEditWindow(clusterId: string, branchId: string, now: Date) {
  const today = istBusinessDate(now);
  const month = today.slice(0, 7);
  const { calendar } = await loadCalendar(clusterId, branchId, month);
  const first = firstPlanningDay(today, isCutoffPassed(now), calendar);
  const effectiveFrom = first <= monthRange(month).end ? first : null;
  return { today, month, effectiveFrom };
}

/** Per product: how much of a person's target has already fallen due before the given day. */
export async function loadFloors(
  userId: string,
  month: string,
  effectiveFrom: string,
): Promise<Map<string, number>> {
  const rows = await db.targetSlice.groupBy({
    by: ["metricId"],
    where: { userId, month, kind: { not: "CARRY" }, dueDate: { lt: effectiveFrom } },
    _sum: { plannedQty: true },
  });
  return new Map(
    rows.map(
      (row) =>
        [row.metricId, row._sum.plannedQty === null ? 0 : qtyFromDb(row._sum.plannedQty)] as const,
    ),
  );
}

/** One person's targets for editing. null if this person may not edit them. */
export async function loadEmployeeTargets(
  actor: Actor,
  userId: string,
  now: Date = new Date(),
): Promise<EmployeeTargets | null> {
  if (actor.role !== "BRANCH_MANAGER" || !actor.branchId) return null;
  const branchId = actor.branchId;

  const person = await db.user.findUnique({ where: { id: userId }, include: { designation: true } });
  if (!person || !person.isActive) return null;
  const allowed = canEditTargetsOf(actor, {
    id: person.id,
    clusterId: person.clusterId,
    branchId: person.branchId,
    reportsToId: person.reportsToId,
    role: person.designation.role,
  });
  if (!allowed) return null;

  const { today, month, effectiveFrom } = await loadEditWindow(actor.clusterId, branchId, now);
  const [plan, metrics, changes, floors] = await Promise.all([
    db.targetPlan.findFirst({
      where: { branchId, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      include: { lines: { where: { userId } } },
    }),
    db.metric.findMany({ where: { scope: "INDIVIDUAL", isActive: true }, orderBy: { sortOrder: "asc" } }),
    loadTargetChangeViews(userId, branchId, month),
    effectiveFrom ? loadFloors(userId, month, effectiveFrom) : Promise.resolve(new Map<string, number>()),
  ]);

  const lineByMetric = new Map((plan?.lines ?? []).map((line) => [line.metricId, line] as const));
  const cells = metrics.map((metric): TargetCell => {
    const line = lineByMetric.get(metric.id);
    const base = line ? qtyFromDb(line.baseQty) : 0;
    const adjustment = line ? qtyFromDb(line.extraQty) : 0;
    return {
      metricId: metric.id,
      code: metric.code,
      name: metric.name,
      unit: metric.unit,
      pacing: metric.pacing,
      baseQty: base,
      adjustmentQty: adjustment,
      totalQty: base + adjustment,
      minQty: floors.get(metric.id) ?? 0,
      change: changes.get(metric.id) ?? null,
    };
  });

  return {
    person: { id: person.id, name: person.name, designation: person.designation.name },
    month,
    today,
    effectiveFrom,
    planVersion: plan?.version ?? null,
    cells,
  };
}

/** The branch's targets against the Cluster Head's current ones, and the people the manager can edit. */
export async function loadTargetsOverview(
  actor: Actor,
  now: Date = new Date(),
): Promise<TargetsOverview | null> {
  if (actor.role !== "BRANCH_MANAGER" || !actor.branchId) return null;
  const branchId = actor.branchId;

  const { today, month, effectiveFrom } = await loadEditWindow(actor.clusterId, branchId, now);
  const [branch, plan, metrics, visible, currentTargets, changes] = await Promise.all([
    db.branch.findUnique({ where: { id: branchId } }),
    db.targetPlan.findFirst({
      where: { branchId, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      include: { lines: true },
    }),
    db.metric.findMany({ where: { scope: "INDIVIDUAL", isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.user.findMany({
      where: { AND: [{ isActive: true }, userWhere(visibilityScope(actor))] },
      include: { designation: true },
      orderBy: [{ designation: { name: "asc" } }, { name: "asc" }],
    }),
    db.branchTarget.findMany({ where: { branchId, month } }),
    loadBranchTargetChangeViews(branchId, month),
  ]);
  if (!branch) return null;

  const allocated = new Map<string, number>();
  const targetCount = new Map<string, number>();
  for (const line of plan?.lines ?? []) {
    const total = qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty);
    if (total <= 0) continue;
    allocated.set(line.metricId, (allocated.get(line.metricId) ?? 0) + total);
    targetCount.set(line.userId, (targetCount.get(line.userId) ?? 0) + 1);
  }
  const branchTargets = new Map(currentTargets.map((t) => [t.metricId, qtyFromDb(t.quantity)] as const));

  return {
    branchName: branch.name,
    month,
    today,
    effectiveFrom,
    planVersion: plan?.version ?? null,
    metrics: metrics
      .filter((m) => (allocated.get(m.id) ?? 0) > 0 || branchTargets.has(m.id) || changes.has(m.id))
      .map((m) => ({
        metricId: m.id,
        name: m.name,
        unit: m.unit,
        allocated: allocated.get(m.id) ?? 0,
        branchTarget: branchTargets.get(m.id) ?? null,
        change: changes.get(m.id) ?? null,
      })),
    people: visible.map((user) => ({
      id: user.id,
      name: user.name,
      designation: user.designation.name,
      targetCount: targetCount.get(user.id) ?? 0,
      isSelf: user.id === actor.id,
      editable: canEditTargetsOf(actor, {
        id: user.id,
        clusterId: user.clusterId,
        branchId: user.branchId,
        reportsToId: user.reportsToId,
        role: user.designation.role,
      }),
    })),
  };
}