import type { Branch, Metric } from "@prisma/client";
import { calendarDrift } from "../domain/planning/drift";
import { db } from "../lib/db";
import { qtyFromDb } from "../lib/qty";
import type { Actor } from "./permissions";
import { canViewBranch } from "./policy";

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

/** One metric for a person, a branch or the whole branch. */
export interface Figure {
  metricId: string;
  code: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  /** The month's target. A count, or paise. */
  monthQty: number;
  /** What has fallen due by today: slices due on or before today. */
  dueQty: number;
}

export interface EmployeeFigures {
  userId: string;
  name: string;
  designation: string;
  /** Empty for people with no personal targets, such as the branch head. */
  figures: Figure[];
}

export interface BranchDetail {
  branch: { code: string; name: string };
  month: string;
  today: string;
  planVersion: number | null;
  planStale: boolean;
  /** Individual metrics, added up over the branch's employees. */
  totals: Figure[];
  /** Branch-wide targets such as Affluent Legacy. */
  branchWide: Figure[];
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

function figure(metric: Metric, monthQty: number, dueQty: number): Figure {
  return {
    metricId: metric.id,
    code: metric.code,
    name: metric.name,
    unit: metric.unit,
    monthQty,
    dueQty,
  };
}

/**
 * One branch for one month. Returns null when the branch does not exist or this person
 * may not open it, so the caller cannot tell the two apart.
 */
export async function loadBranchDetail(
  actor: Actor,
  branchCode: string,
  month: string,
  today: string,
): Promise<BranchDetail | null> {
  const branch = await db.branch.findUnique({ where: { code: branchCode } });
  if (!branch || !canViewBranch(actor, branch)) return null;

  const [plan, employees, metrics, slices, branchSlices, holidays] = await Promise.all([
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
    db.targetSlice.findMany({
      where: { month, user: { branchId: branch.id } },
      select: { userId: true, metricId: true, dueDate: true, plannedQty: true },
    }),
    db.branchSlice.findMany({
      where: { branchId: branch.id, month },
      select: { metricId: true, dueDate: true, plannedQty: true },
    }),
    db.holiday.findMany({
      where: {
        clusterId: branch.clusterId,
        date: { startsWith: month },
        OR: [{ branchId: null }, { branchId: branch.id }],
      },
    }),
  ]);

  const individual = metrics.filter((metric) => metric.scope === "INDIVIDUAL");

  // Month target per person and metric.
  const monthByUser = new Map<string, Map<string, number>>();
  for (const line of plan?.lines ?? []) {
    const byMetric = monthByUser.get(line.userId) ?? new Map<string, number>();
    byMetric.set(line.metricId, qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty));
    monthByUser.set(line.userId, byMetric);
  }

  // What has fallen due by today, per person and metric.
  const dueByLine = new Map<string, number>();
  for (const slice of slices) {
    if (slice.dueDate > today) continue;
    const key = `${slice.userId}|${slice.metricId}`;
    dueByLine.set(key, (dueByLine.get(key) ?? 0) + qtyFromDb(slice.plannedQty));
  }

  const employeeFigures = employees.map((employee): EmployeeFigures => {
    const monthByMetric = monthByUser.get(employee.id);
    const figures = monthByMetric
      ? individual
          .filter((metric) => monthByMetric.has(metric.id))
          .map((metric) =>
            figure(
              metric,
              monthByMetric.get(metric.id) ?? 0,
              dueByLine.get(`${employee.id}|${metric.id}`) ?? 0,
            ),
          )
      : [];
    return {
      userId: employee.id,
      name: employee.name,
      designation: employee.designation.name,
      figures,
    };
  });

  const totals = individual
    .map((metric) => {
      let monthQty = 0;
      let dueQty = 0;
      for (const employee of employeeFigures) {
        const found = employee.figures.find((f) => f.metricId === metric.id);
        if (found) {
          monthQty += found.monthQty;
          dueQty += found.dueQty;
        }
      }
      return figure(metric, monthQty, dueQty);
    })
    .filter((f) => f.monthQty > 0);

  const branchWide = metrics
    .filter((metric) => metric.scope === "BRANCH")
    .flatMap((metric) => {
      const target = plan?.branchTargets.find((t) => t.metricId === metric.id);
      if (!target) return [];
      const dueQty = branchSlices
        .filter((s) => s.metricId === metric.id && s.dueDate <= today)
        .reduce((acc, s) => acc + qtyFromDb(s.plannedQty), 0);
      return [figure(metric, qtyFromDb(target.quantity), dueQty)];
    });

  const planStale = plan
    ? calendarDrift(plan.holidayDates, holidays.map((h) => h.date)).stale
    : false;

  return {
    branch: { code: branch.code, name: branch.name },
    month,
    today,
    planVersion: plan?.version ?? null,
    planStale,
    totals,
    branchWide,
    employees: employeeFigures,
  };
}