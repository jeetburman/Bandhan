import type { Branch, Metric } from "@prisma/client";
import { monthRange, workingDaysInRange } from "../domain/calendar/calendar";
import { firstPlanningDay } from "../domain/dashboard/suggest";
import {
  buildPerformance,
  lastClosedDay,
  type Performance,
} from "../domain/performance/performance";
import { calendarDrift } from "../domain/planning/drift";
import { cutoffPassed as isCutoffPassed } from "../lib/cutoff";
import { db } from "../lib/db";
import { qtyFromDb } from "../lib/qty";
import { loadCalendar } from "./calendar-config";
import type { Actor } from "./permissions";
import { canViewBranch, matchesScope, visibilityScope } from "./policy";

export interface PickerBranch {
  code: string;
  name: string;
}

export interface BranchCard {
  code: string;
  name: string;
  headcount: number;
  /** null when the branch has no published plan for the month. */
  planVersion: number | null;
  planStale: boolean;
}

export interface ClusterOverview {
  clusterName: string;
  cards: BranchCard[];
}

/** One product for a person, a branch or the whole branch, with how it is going. */
export interface Figure {
  metricId: string;
  code: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  /** The month's target. A count, or paise. */
  monthQty: number;
  /** Verified so far this month. */
  verifiedQty: number;
  /** What the plan expected by the last closed day. */
  expectedQty: number;
  performance: Performance;
}

export interface BranchTotalFigure extends Figure {
  /** The Cluster Head's current figure for this branch. null if she has set none. */
  branchTargetQty: number | null;
}

export interface EmployeeFigures {
  userId: string;
  name: string;
  designation: string;
  /** Empty for people with no personal targets, such as the branch head. */
  figures: Figure[];
  /** Products where this person is behind pace or fell short at month end. */
  behindCount: number;
}

export interface BranchDetail {
  branch: { code: string; name: string };
  month: string;
  today: string;
  planVersion: number | null;
  planStale: boolean;
  days: { elapsed: number; remaining: number; total: number };
  cutoffPassed: boolean;
  /** Individual products, added up over the branch's employees. */
  totals: BranchTotalFigure[];
  /** Branch-wide targets such as Affluent Legacy. */
  branchWide: Figure[];
  /** Most behind first. */
  employees: EmployeeFigures[];
}

async function viewableBranches(actor: Actor): Promise<Branch[]> {
  const all = await db.branch.findMany({
    where: { clusterId: actor.clusterId },
    orderBy: { code: "asc" },
  });
  return all.filter((branch) => canViewBranch(actor, branch));
}

export async function listPickerBranches(actor: Actor): Promise<PickerBranch[]> {
  const branches = await viewableBranches(actor);
  return branches.map(({ code, name }) => ({ code, name }));
}

export async function loadClusterOverview(actor: Actor, month: string): Promise<ClusterOverview> {
  const branches = await viewableBranches(actor);
  const branchIds = branches.map((branch) => branch.id);

  const [cluster, headcounts, plans, holidays] = await Promise.all([
    db.cluster.findUnique({ where: { id: actor.clusterId } }),
    db.user.groupBy({
      by: ["branchId"],
      where: { branchId: { in: branchIds }, isActive: true },
      _count: { _all: true },
    }),
    db.targetPlan.findMany({
      where: { branchId: { in: branchIds }, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
    }),
    db.holiday.findMany({ where: { clusterId: actor.clusterId, date: { startsWith: month } } }),
  ]);

  const countByBranch = new Map(headcounts.map((row) => [row.branchId, row._count._all]));
  const latestPlan = new Map<string, (typeof plans)[number]>();
  for (const plan of plans) {
    if (!latestPlan.has(plan.branchId)) latestPlan.set(plan.branchId, plan);
  }
  const clusterWide = holidays.filter((h) => h.branchId === null).map((h) => h.date);

  const cards = branches.map((branch): BranchCard => {
    const plan = latestPlan.get(branch.id);
    const current = [
      ...clusterWide,
      ...holidays.filter((h) => h.branchId === branch.id).map((h) => h.date),
    ];
    return {
      code: branch.code,
      name: branch.name,
      headcount: countByBranch.get(branch.id) ?? 0,
      planVersion: plan?.version ?? null,
      planStale: plan ? calendarDrift(plan.holidayDates, current).stale : false,
    };
  });

  return { clusterName: cluster?.name ?? "Cluster", cards };
}

function bump(map: Map<string, number>, key: string, quantity: number): void {
  map.set(key, (map.get(key) ?? 0) + quantity);
}

/**
 * One branch for one month. Returns null when the branch does not exist or this person
 * may not open it, so the caller cannot tell the two apart.
 * `today` must be the IST date of `now`, which decides whether today has closed.
 */
export async function loadBranchDetail(
  actor: Actor,
  branchCode: string,
  month: string,
  today: string,
  now: Date = new Date(),
): Promise<BranchDetail | null> {
  const branch = await db.branch.findUnique({ where: { code: branchCode } });
  if (!branch || !canViewBranch(actor, branch)) return null;

  const range = monthRange(month);
  const passed = isCutoffPassed(now);
  const closedThrough = lastClosedDay(today, passed);

  const [plan, employees, metrics, currentTargets, slices, branchSlices, credits, calendarInfo] =
    await Promise.all([
      db.targetPlan.findFirst({
        where: { branchId: branch.id, month, status: "PUBLISHED" },
        orderBy: { version: "desc" },
        include: { lines: true, branchTargets: true },
      }),
      db.user.findMany({
        where: { branchId: branch.id, isActive: true },
        include: { designation: true },
        orderBy: [{ designation: { name: "asc" } }, { name: "asc" }],
      }),
      db.metric.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      db.branchTarget.findMany({ where: { branchId: branch.id, month } }),
      db.targetSlice.findMany({
        where: { month, dueDate: { lte: closedThrough }, user: { branchId: branch.id } },
        select: { userId: true, metricId: true, plannedQty: true },
      }),
      db.branchSlice.findMany({
        where: { branchId: branch.id, month, dueDate: { lte: closedThrough } },
        select: { metricId: true, plannedQty: true },
      }),
      db.entryCredit.findMany({
        where: {
          entry: {
            branchId: branch.id,
            status: "VERIFIED",
            activityDate: { gte: range.start, lte: range.end },
          },
        },
        select: {
          metricId: true,
          quantity: true,
          entry: { select: { userId: true, activityDate: true } },
        },
      }),
      loadCalendar(branch.clusterId, branch.id, month),
    ]);
  const { calendar, holidays } = calendarInfo;

  // Working days: how many have closed, and how many are left.
  const closedEnd = closedThrough > range.end ? range.end : closedThrough;
  const elapsed = workingDaysInRange(range.start, closedEnd, calendar).length;
  const first = firstPlanningDay(today, passed, calendar);
  const remaining = first > range.end ? 0 : workingDaysInRange(first, range.end, calendar).length;
  const total = workingDaysInRange(range.start, range.end, calendar).length;

  const metricById = new Map(metrics.map((m) => [m.id, m] as const));
  const individual = metrics.filter((m) => m.scope === "INDIVIDUAL");
  const key = (userId: string, metricId: string) => `${userId}|${metricId}`;

  // Targets, from the published plan.
  const targetOf = new Map<string, number>();
  const assignedByMetric = new Map<string, number>();
  for (const line of plan?.lines ?? []) {
    const lineTotal = qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty);
    targetOf.set(key(line.userId, line.metricId), lineTotal);
    bump(assignedByMetric, line.metricId, lineTotal);
  }

  // What the plan expected by the last closed day.
  const expectedOf = new Map<string, number>();
  const expectedByMetric = new Map<string, number>();
  for (const slice of slices) {
    const planned = qtyFromDb(slice.plannedQty);
    bump(expectedOf, key(slice.userId, slice.metricId), planned);
    bump(expectedByMetric, slice.metricId, planned);
  }
  const branchWideExpected = new Map<string, number>();
  for (const slice of branchSlices) bump(branchWideExpected, slice.metricId, qtyFromDb(slice.plannedQty));

  // Verified sales, split into "all dates" and "on closed days".
  const verifiedOf = new Map<string, number>();
  const verifiedClosedOf = new Map<string, number>();
  const branchVerified = new Map<string, number>();
  const branchVerifiedClosed = new Map<string, number>();
  const wideVerified = new Map<string, number>();
  const wideVerifiedClosed = new Map<string, number>();
  for (const credit of credits) {
    const metric = metricById.get(credit.metricId);
    if (!metric) continue;
    const quantity = qtyFromDb(credit.quantity);
    const onClosedDay = credit.entry.activityDate <= closedThrough;

    if (metric.scope === "BRANCH") {
      bump(wideVerified, metric.id, quantity);
      if (onClosedDay) bump(wideVerifiedClosed, metric.id, quantity);
    } else {
      const personKey = key(credit.entry.userId, metric.id);
      bump(verifiedOf, personKey, quantity);
      bump(branchVerified, metric.id, quantity);
      if (onClosedDay) {
        bump(verifiedClosedOf, personKey, quantity);
        bump(branchVerifiedClosed, metric.id, quantity);
      }
    }
  }

  const figure = (
    metric: Metric,
    monthQty: number,
    verified: number,
    verifiedClosed: number,
    expected: number,
  ): Figure => ({
    metricId: metric.id,
    code: metric.code,
    name: metric.name,
    unit: metric.unit,
    monthQty,
    verifiedQty: verified,
    expectedQty: expected,
    performance: buildPerformance({
      monthTotal: monthQty,
      verifiedQty: verified,
      verifiedClosedQty: verifiedClosed,
      expectedQty: expected,
      elapsedWorkingDays: elapsed,
      remainingWorkingDays: remaining,
    }),
  });

  const employeeFigures = employees.map((employee): EmployeeFigures => {
    const figures = individual.flatMap((metric) => {
      const target = targetOf.get(key(employee.id, metric.id)) ?? 0;
      if (target <= 0) return [];
      const personKey = key(employee.id, metric.id);
      return [
        figure(
          metric,
          target,
          verifiedOf.get(personKey) ?? 0,
          verifiedClosedOf.get(personKey) ?? 0,
          expectedOf.get(personKey) ?? 0,
        ),
      ];
    });
    return {
      userId: employee.id,
      name: employee.name,
      designation: employee.designation.name,
      figures,
      behindCount: figures.filter(
        (f) => f.performance.outlook === "BEHIND" || f.performance.outlook === "NO_DAYS_LEFT",
      ).length,
    };
  });

  const targetByMetric = new Map(currentTargets.map((t) => [t.metricId, qtyFromDb(t.quantity)] as const));
  const totals = individual.flatMap((metric): BranchTotalFigure[] => {
    const assigned = assignedByMetric.get(metric.id) ?? 0;
    if (assigned <= 0) return [];
    return [
      {
        ...figure(
          metric,
          assigned,
          branchVerified.get(metric.id) ?? 0,
          branchVerifiedClosed.get(metric.id) ?? 0,
          expectedByMetric.get(metric.id) ?? 0,
        ),
        branchTargetQty: targetByMetric.get(metric.id) ?? null,
      },
    ];
  });

  const branchWide = metrics
    .filter((metric) => metric.scope === "BRANCH")
    .flatMap((metric) => {
      const target = plan?.branchTargets.find((t) => t.metricId === metric.id);
      if (!target) return [];
      return [
        figure(
          metric,
          qtyFromDb(target.quantity),
          wideVerified.get(metric.id) ?? 0,
          wideVerifiedClosed.get(metric.id) ?? 0,
          branchWideExpected.get(metric.id) ?? 0,
        ),
      ];
    });

  const planStale = plan
    ? calendarDrift(plan.holidayDates, holidays).stale
    : false;

  // The totals above include everyone. The list below shows only the people this person may see.
  const scope = visibilityScope(actor);
  const visibleIds = new Set(
    employees
      .filter((employee) =>
        matchesScope(scope, {
          id: employee.id,
          clusterId: employee.clusterId,
          branchId: employee.branchId,
          reportsToId: employee.reportsToId,
          role: employee.designation.role,
        }),
      )
      .map((employee) => employee.id),
  );
  const visibleEmployees = employeeFigures
    .filter((employee) => visibleIds.has(employee.userId))
    .map((employee, index) => ({ employee, index }))
    .sort((a, b) => b.employee.behindCount - a.employee.behindCount || a.index - b.index)
    .map(({ employee }) => employee);

  return {
    branch: { code: branch.code, name: branch.name },
    month,
    today,
    planVersion: plan?.version ?? null,
    planStale,
    days: { elapsed, remaining, total },
    cutoffPassed: passed,
    totals,
    branchWide,
    employees: visibleEmployees,
  };
}

/** A branch manager's own branch, for the home screen. */
export async function loadOwnBranchDetail(
  actor: Actor,
  month: string,
  today: string,
  now: Date = new Date(),
): Promise<BranchDetail | null> {
  if (!actor.branchId) return null;
  const branch = await db.branch.findUnique({ where: { id: actor.branchId } });
  return branch ? loadBranchDetail(actor, branch.code, month, today, now) : null;
}