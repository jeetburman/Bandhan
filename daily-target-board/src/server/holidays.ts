import type { Branch } from "@prisma/client";
import { dayOfWeek, isWorkingDay, monthRange } from "../domain/calendar/calendar";
import { holidayImpact } from "../domain/calendar/impact";
import { calendarDrift } from "../domain/planning/drift";
import { db } from "../lib/db";
import { istBusinessDate } from "../lib/ist";
import { loadActor } from "./actor";
import { writeAudit } from "./audit";
import { loadCalendar, OFF_SATURDAYS, WEEKLY_OFF_DAYS } from "./calendar-config";
import { canManageHoliday } from "./permissions";

export interface HolidayImpactRow {
  branchCode: string;
  /** Working days from the holiday date to month end, before and after. */
  workingDaysBefore: number;
  workingDaysAfter: number;
  /** True when this branch has a published plan that will need re-publishing. */
  hasPublishedPlan: boolean;
}

export interface HolidayChangeOptions {
  /** "YYYY-MM-DD" */
  date: string;
  actorEmail: string;
  /** Leave out for a holiday that applies to the whole cluster. */
  branchCode?: string;
  /** The business date in IST. Defaults to now. Pass it to pin a date for a demo. */
  today?: string;
}

export interface AddHolidayOptions extends HolidayChangeOptions {
  name: string;
}

export interface AddHolidayResult {
  holidayId: string;
  date: string;
  scope: "CLUSTER" | "BRANCH";
  impact: HolidayImpactRow[];
}

async function resolveScope(actorEmail: string, branchCode: string | undefined) {
  const actor = await loadActor(actorEmail);
  if (branchCode === undefined) {
    return { actor, clusterId: actor.clusterId, branch: null };
  }
  const branch = await db.branch.findUnique({ where: { code: branchCode } });
  if (!branch) throw new Error(`Unknown branch: ${branchCode}`);
  return { actor, clusterId: branch.clusterId, branch };
}

function checkDates(date: string, today: string): void {
  dayOfWeek(today); // throws if the text is not a real date
  dayOfWeek(date);
  if (date < today) {
    throw new Error(`Holidays can only be changed from today (${today}) onwards, got ${date}`);
  }
}

export async function addHoliday(options: AddHolidayOptions): Promise<AddHolidayResult> {
  const { date, actorEmail, branchCode } = options;
  const today = options.today ?? istBusinessDate(new Date());
  checkDates(date, today);

  const name = options.name.trim();
  if (name.length === 0 || name.length > 80) {
    throw new Error("Holiday name must be between 1 and 80 characters");
  }

  const { actor, clusterId, branch } = await resolveScope(actorEmail, branchCode);
  const scopeLabel = branch ? branch.code : "cluster-wide";
  if (!canManageHoliday(actor, { clusterId, branchId: branch?.id ?? null })) {
    throw new Error(`${actor.email} is not allowed to add ${scopeLabel} holidays`);
  }

  const weeklyOnly = {
    weeklyOffDays: WEEKLY_OFF_DAYS,
    offSaturdays: OFF_SATURDAYS,
    holidays: new Set<string>(),
  };
  if (!isWorkingDay(date, weeklyOnly)) {
    throw new Error(`${date} is already a weekly off day, so a holiday would change nothing`);
  }

  if (branch === null) {
    const existing = await db.holiday.findFirst({ where: { clusterId, branchId: null, date } });
    if (existing) throw new Error(`${date} is already a cluster-wide holiday ("${existing.name}")`);
  }

  const month = date.slice(0, 7);
  const monthEnd = monthRange(month).end;
  const affected: Branch[] = branch
    ? [branch]
    : await db.branch.findMany({ where: { clusterId }, orderBy: { code: "asc" } });

  const impact: HolidayImpactRow[] = [];
  for (const affectedBranch of affected) {
    const { calendar } = await loadCalendar(clusterId, affectedBranch.id, month);
    if (branch !== null && calendar.holidays.has(date)) {
      throw new Error(`${date} is already a holiday for ${branch.code}`);
    }
    const { before, after } = holidayImpact(date, monthEnd, calendar);
    const publishedPlans = await db.targetPlan.count({
      where: { branchId: affectedBranch.id, month, status: "PUBLISHED" },
    });
    impact.push({
      branchCode: affectedBranch.code,
      workingDaysBefore: before,
      workingDaysAfter: after,
      hasPublishedPlan: publishedPlans > 0,
    });
  }

  const row = await db.$transaction(async (tx) => {
    const created = await tx.holiday.create({
      data: { date, name, clusterId, branchId: branch?.id ?? null, addedById: actor.id },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      branchId: branch?.id ?? null,
      action: "HOLIDAY_ADDED",
      entityType: "Holiday",
      entityId: created.id,
      summary: `${actor.name} added ${scopeLabel} holiday "${name}" on ${date}`,
      metadata: { date, name, scope: branch ? "BRANCH" : "CLUSTER", impact },
    });
    return created;
  });

  return { holidayId: row.id, date, scope: branch ? "BRANCH" : "CLUSTER", impact };
}

export async function removeHoliday(options: HolidayChangeOptions): Promise<{ name: string }> {
  const { date, actorEmail, branchCode } = options;
  const today = options.today ?? istBusinessDate(new Date());
  checkDates(date, today);

  const { actor, clusterId, branch } = await resolveScope(actorEmail, branchCode);
  const scopeLabel = branch ? branch.code : "cluster-wide";
  if (!canManageHoliday(actor, { clusterId, branchId: branch?.id ?? null })) {
    throw new Error(`${actor.email} is not allowed to remove ${scopeLabel} holidays`);
  }

  const row = await db.holiday.findFirst({
    where: { clusterId, branchId: branch?.id ?? null, date },
  });
  if (!row) throw new Error(`There is no ${scopeLabel} holiday on ${date} to remove`);

  await db.$transaction(async (tx) => {
    await tx.holiday.delete({ where: { id: row.id } });
    await writeAudit(tx, {
      actorId: actor.id,
      branchId: branch?.id ?? null,
      action: "HOLIDAY_REMOVED",
      entityType: "Holiday",
      entityId: row.id,
      summary: `${actor.name} removed ${scopeLabel} holiday "${row.name}" on ${date}`,
      metadata: { date, name: row.name, scope: branch ? "BRANCH" : "CLUSTER" },
    });
  });

  return { name: row.name };
}

export interface BranchFreshness {
  branchCode: string;
  branchName: string;
  month: string;
  /** null when the branch has no published plan for the month. */
  version: number | null;
  stale: boolean;
  added: string[];
  removed: string[];
}

/** Which branches' published plans no longer match their holiday calendar. */
export async function planFreshness(options: {
  actorEmail: string;
  month: string;
}): Promise<BranchFreshness[]> {
  const { actorEmail, month } = options;
  monthRange(month); // throws on a bad month

  const actor = await loadActor(actorEmail);
  let branches: Branch[];
  if (actor.role === "CLUSTER_HEAD") {
    branches = await db.branch.findMany({
      where: { clusterId: actor.clusterId },
      orderBy: { code: "asc" },
    });
  } else if (actor.role === "BRANCH_MANAGER" && actor.branchId) {
    branches = await db.branch.findMany({ where: { id: actor.branchId } });
  } else {
    throw new Error(`${actor.email} is not allowed to see plan status`);
  }

  const rows: BranchFreshness[] = [];
  for (const branch of branches) {
    const plan = await db.targetPlan.findFirst({
      where: { branchId: branch.id, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
    });
    if (!plan) {
      rows.push({
        branchCode: branch.code,
        branchName: branch.name,
        month,
        version: null,
        stale: false,
        added: [],
        removed: [],
      });
      continue;
    }
    const { holidays } = await loadCalendar(branch.clusterId, branch.id, month);
    const drift = calendarDrift(plan.holidayDates, holidays);
    rows.push({
      branchCode: branch.code,
      branchName: branch.name,
      month,
      version: plan.version,
      stale: drift.stale,
      added: drift.added,
      removed: drift.removed,
    });
  }
  return rows;
}