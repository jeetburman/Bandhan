import { buildAllocation, type AllocationResult } from "../domain/allocation/allocate";
import { dayOfWeek, monthRange, workingDaysInRange } from "../domain/calendar/calendar";
import type { CalendarConfig } from "../domain/calendar/types";
import { buildPlan, type PlanOutput } from "../domain/planning/build-plan";
import { db } from "../lib/db";
import { qtyFromDb } from "../lib/qty";
import { OFF_SATURDAYS, WEEKLY_OFF_DAYS } from "./calendar-config";

export interface PlanPreviewOptions {
  branchCode: string;
  /** "YYYY-MM" */
  month: string;
  /** Holidays to try out. They are never saved. */
  extraHolidays?: readonly string[];
}

export interface PreviewEmployee {
  userId: string;
  name: string;
  email: string;
  designationCode: string;
}

export interface PreviewMetric {
  id: string;
  code: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  scope: "INDIVIDUAL" | "BRANCH";
  pacing: "DAILY" | "WEEKLY" | "MONTHLY";
}

export interface PlanPreview {
  branch: { code: string; name: string };
  month: string;
  workingDays: number;
  holidays: string[];
  employees: PreviewEmployee[];
  metrics: PreviewMetric[];
  allocation: AllocationResult;
  plan: PlanOutput;
}

/**
 * Read-only: loads quotas, branch targets and holidays, then runs allocation and planning.
 * Nothing is written to the database.
 */
export async function loadPlanPreview(options: PlanPreviewOptions): Promise<PlanPreview> {
  const { branchCode, month, extraHolidays = [] } = options;
  const range = monthRange(month); // throws on a bad month

  for (const date of extraHolidays) {
    dayOfWeek(date); // throws on a date that does not exist
    if (!date.startsWith(month)) throw new Error(`Trial holiday ${date} is outside ${month}`);
  }

  const branch = await db.branch.findUnique({ where: { code: branchCode } });
  if (!branch) throw new Error(`Unknown branch: ${branchCode}`);

  const [employees, metrics, quotas, branchTargets, holidays] = await Promise.all([
    db.user.findMany({
      where: { branchId: branch.id, isActive: true },
      include: { designation: true },
      orderBy: [{ designation: { name: "asc" } }, { name: "asc" }],
    }),
    db.metric.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.designationQuota.findMany({ where: { clusterId: branch.clusterId, month } }),
    db.branchTarget.findMany({ where: { branchId: branch.id, month } }),
    db.holiday.findMany({
      where: {
        clusterId: branch.clusterId,
        date: { startsWith: month },
        OR: [{ branchId: null }, { branchId: branch.id }],
      },
    }),
  ]);

  const holidayDates = new Set<string>([...holidays.map((h) => h.date), ...extraHolidays]);
  const calendar: CalendarConfig = {
    weeklyOffDays: WEEKLY_OFF_DAYS,
    offSaturdays: OFF_SATURDAYS,
    holidays: holidayDates,
  };

  const branchTargetEntries = branchTargets.map((t) => ({
    metricId: t.metricId,
    quantity: qtyFromDb(t.quantity),
  }));

  const allocation = buildAllocation({
    employees: employees.map((e) => ({ userId: e.id, designationId: e.designationId })),
    quotas: quotas.map((q) => ({
      designationId: q.designationId,
      metricId: q.metricId,
      quantity: qtyFromDb(q.quantity),
    })),
    extras: [], // manual extras arrive with the allocation screen
    metrics: metrics.map((m) => ({ id: m.id, scope: m.scope })),
    branchTargets: branchTargetEntries,
  });

  const plan = buildPlan({
    month,
    calendar,
    metrics: metrics.map((m) => ({ id: m.id, scope: m.scope, pacing: m.pacing })),
    lines: allocation.lines,
    branchTargets: branchTargetEntries,
  });

  return {
    branch: { code: branch.code, name: branch.name },
    month,
    workingDays: workingDaysInRange(range.start, range.end, calendar).length,
    holidays: [...holidayDates].sort(),
    employees: employees.map((e) => ({
      userId: e.id,
      name: e.name,
      email: e.email,
      designationCode: e.designation.code,
    })),
    metrics: metrics.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      scope: m.scope,
      pacing: m.pacing,
    })),
    allocation,
    plan,
  };
}