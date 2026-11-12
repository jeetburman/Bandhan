import {
  buildAllocation,
  type AllocationWarning,
  type ExtraEntry,
} from "../domain/allocation/allocate";
import { dayOfWeek, monthRange } from "../domain/calendar/calendar";
import { buildPlan } from "../domain/planning/build-plan";
import { partitionSlices, remainingQty } from "../domain/planning/freeze";
import { db } from "../lib/db";
import { istBusinessDate } from "../lib/ist";
import { qtyFromDb, qtyToDb } from "../lib/qty";
import { loadActor } from "./actor";
import { writeAudit } from "./audit";
import { loadCalendar } from "./calendar-config";
import { canPublishPlan } from "./permissions";

export interface ExtraInput {
  /** The employee's email. */
  email: string;
  metricCode: string;
  /** Whole units: a count, or paise for an amount. */
  quantity: number;
  note?: string;
}

export interface PublishPlanOptions {
  branchCode: string;
  /** "YYYY-MM" */
  month: string;
  actorEmail: string;
  /**
   * First day the new version applies to. A re-publish cannot start before today.
   * Defaults to the first of the month, or to today for a re-publish.
   */
  effectiveFrom?: string;
  /**
   * The complete set of extras for this version. Leave it out to carry the previous
   * version's extras forward, or pass [] to clear them.
   */
  extras?: readonly ExtraInput[];
  /** The business date in IST. Defaults to now. Pass it to pin a date for a demo. */
  today?: string;
}

export interface PublishPlanResult {
  planId: string;
  version: number;
  supersededVersion: number | null;
  effectiveFrom: string;
  warnings: AllocationWarning[];
  lineCount: number;
  newSliceCount: number;
  keptSliceCount: number;
  removedSliceCount: number;
}

interface StoredSlice {
  id: string;
  metricId: string;
  dueDate: string;
  plannedQty: number;
  closed: boolean;
}

interface StoredEmployeeSlice extends StoredSlice {
  userId: string;
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * Save a new published version of a branch's plan for a month.
 *
 * - Slices due before the effective date are kept exactly as they were.
 * - The rest of the target is re-spread over the working days from the effective date.
 * - The previous version is marked superseded and the audit entry is written in the
 *   same transaction, so nothing can be half-saved.
 */
export async function publishPlan(options: PublishPlanOptions): Promise<PublishPlanResult> {
  const { branchCode, month, actorEmail } = options;
  const today = options.today ?? istBusinessDate(new Date());
  dayOfWeek(today); // throws if the text is not a real date
  const range = monthRange(month);

  const actor = await loadActor(actorEmail);
  const branch = await db.branch.findUnique({ where: { code: branchCode } });
  if (!branch) throw new Error(`Unknown branch: ${branchCode}`);
  if (!canPublishPlan(actor, branch.id)) {
    throw new Error(`${actor.email} is not allowed to publish plans for ${branch.code}`);
  }

  const [previous, latest] = await Promise.all([
    db.targetPlan.findFirst({
      where: { branchId: branch.id, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      include: { lines: true },
    }),
    db.targetPlan.findFirst({
      where: { branchId: branch.id, month },
      orderBy: { version: "desc" },
      select: { version: true },
    }),
  ]);
  const latestVersion = latest?.version ?? 0;

  // A first publish may start anywhere in the month. A re-publish may not rewrite the past.
  const earliest = previous ? (today > range.start ? today : range.start) : range.start;
  const effectiveFrom = options.effectiveFrom ?? earliest;
  dayOfWeek(effectiveFrom);
  if (effectiveFrom < earliest || effectiveFrom > range.end) {
    throw new Error(`Effective date must be between ${earliest} and ${range.end}, got ${effectiveFrom}`);
  }

  const [employees, metrics, quotas, branchTargets, { calendar, holidays: holidayDates }] = await Promise.all([
    db.user.findMany({
      where: { branchId: branch.id, isActive: true },
      orderBy: [{ designation: { name: "asc" } }, { name: "asc" }],
    }),
    db.metric.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.designationQuota.findMany({ where: { clusterId: branch.clusterId, month } }),
    db.branchTarget.findMany({ where: { branchId: branch.id, month } }),
    loadCalendar(branch.clusterId, branch.id, month),
  ]);

  const metricByCode = new Map(metrics.map((m) => [m.code, m]));
  const metricById = new Map(metrics.map((m) => [m.id, m]));
  const employeeByEmail = new Map(employees.map((e) => [e.email, e]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // Extras: what was passed in, otherwise what the previous version had.
  let extras: ExtraEntry[];
  if (options.extras) {
    extras = options.extras.map((input) => {
      const employee = employeeByEmail.get(input.email);
      if (!employee) throw new Error(`${input.email} is not an active employee of ${branch.code}`);
      const metric = metricByCode.get(input.metricCode);
      if (!metric) throw new Error(`Unknown metric code: ${input.metricCode}`);
      return {
        userId: employee.id,
        metricId: metric.id,
        quantity: input.quantity,
        note: input.note,
      };
    });
  } else if (previous) {
    extras = previous.lines
      .filter((line) => qtyFromDb(line.extraQty) > 0 && employeeById.has(line.userId))
      .map((line) => ({
        userId: line.userId,
        metricId: line.metricId,
        quantity: qtyFromDb(line.extraQty),
        note: line.extraNote ?? undefined,
      }));
  } else {
    extras = [];
  }

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
    extras,
    metrics: metrics.map((m) => ({ id: m.id, scope: m.scope })),
    branchTargets: branchTargetEntries,
  });
  if (allocation.lines.length === 0) {
    throw new Error(`No quotas are set for ${month}, so there is nothing to publish`);
  }

  // Slices already saved for this branch and month, split into kept and replaceable.
  const [storedEmployeeSlices, storedBranchSlices] = await Promise.all([
    db.targetSlice.findMany({
      where: { plan: { branchId: branch.id, month }, kind: { not: "CARRY" } },
    }),
    db.branchSlice.findMany({
      where: { plan: { branchId: branch.id, month }, kind: { not: "CARRY" } },
    }),
  ]);

  const employeePartition = partitionSlices<StoredEmployeeSlice>(
    storedEmployeeSlices.map((s) => ({
      id: s.id,
      userId: s.userId,
      metricId: s.metricId,
      dueDate: s.dueDate,
      plannedQty: qtyFromDb(s.plannedQty),
      closed: s.closedAt !== null,
    })),
    effectiveFrom,
  );
  const branchPartition = partitionSlices<StoredSlice>(
    storedBranchSlices.map((s) => ({
      id: s.id,
      metricId: s.metricId,
      dueDate: s.dueDate,
      plannedQty: qtyFromDb(s.plannedQty),
      closed: s.closedAt !== null,
    })),
    effectiveFrom,
  );

  // Plan only what is left after the frozen slices.
  const frozenByLine = groupBy(employeePartition.frozen, (s) => `${s.userId}|${s.metricId}`);
  const adjustedLines = allocation.lines.map((line) => {
    const who = employeeById.get(line.userId)?.name ?? line.userId;
    const what = metricById.get(line.metricId)?.name ?? line.metricId;
    const frozen = frozenByLine.get(`${line.userId}|${line.metricId}`) ?? [];
    return { ...line, totalQty: remainingQty(line.totalQty, frozen, `${who} / ${what}`) };
  });

  const frozenByBranchMetric = groupBy(branchPartition.frozen, (s) => s.metricId);
  const adjustedBranchTargets = branchTargetEntries.map((target) => {
    const metric = metricById.get(target.metricId);
    if (!metric || metric.scope !== "BRANCH") return target;
    return {
      ...target,
      quantity: remainingQty(
        target.quantity,
        frozenByBranchMetric.get(target.metricId) ?? [],
        `Branch / ${metric.name}`,
      ),
    };
  });

  const planOutput = buildPlan({
    month,
    startDate: effectiveFrom,
    calendar,
    metrics: metrics.map((m) => ({ id: m.id, scope: m.scope, pacing: m.pacing })),
    lines: adjustedLines,
    branchTargets: adjustedBranchTargets,
  });

  // Slices with nothing to do are not stored.
  const newEmployeeSlices = planOutput.employeeLines.flatMap((line) =>
    line.slices
      .filter((slice) => slice.plannedQty > 0)
      .map((slice) => ({
        userId: line.userId,
        metricId: line.metricId,
        month,
        kind: slice.kind,
        periodStart: slice.periodStart,
        periodEnd: slice.periodEnd,
        dueDate: slice.dueDate,
        workingDays: slice.workingDays,
        plannedQty: qtyToDb(slice.plannedQty),
      })),
  );
  const newBranchSlices = planOutput.branchMetrics.flatMap((branchMetric) =>
    branchMetric.slices
      .filter((slice) => slice.plannedQty > 0)
      .map((slice) => ({
        branchId: branch.id,
        metricId: branchMetric.metricId,
        month,
        kind: slice.kind,
        periodStart: slice.periodStart,
        periodEnd: slice.periodEnd,
        dueDate: slice.dueDate,
        workingDays: slice.workingDays,
        plannedQty: qtyToDb(slice.plannedQty),
      })),
  );

  const removeEmployeeSliceIds = employeePartition.open.map((s) => s.id);
  const removeBranchSliceIds = branchPartition.open.map((s) => s.id);

  return db.$transaction(
    async (tx) => {
      // Optimistic check: nobody published for this branch and month since we looked.
      const latestNow = await tx.targetPlan.findFirst({
        where: { branchId: branch.id, month },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      if ((latestNow?.version ?? 0) !== latestVersion) {
        throw new Error(
          "Someone else published a plan for this branch and month while you were working. Please try again.",
        );
      }

      if (previous) {
        await tx.targetPlan.updateMany({
          where: { branchId: branch.id, month, status: "PUBLISHED" },
          data: { status: "SUPERSEDED" },
        });
      }

      const version = latestVersion + 1;
      const plan = await tx.targetPlan.create({
        data: {
          branchId: branch.id,
          month,
          version,
          status: "PUBLISHED",
          effectiveFrom,
          holidayDates,
          createdById: actor.id,
          publishedById: actor.id,
          publishedAt: new Date(),
        },
      });

      await tx.planBranchTarget.createMany({
        data: branchTargetEntries.map((t) => ({
          planId: plan.id,
          metricId: t.metricId,
          quantity: qtyToDb(t.quantity),
        })),
      });

      await tx.targetLine.createMany({
        data: allocation.lines.map((line) => ({
          planId: plan.id,
          userId: line.userId,
          metricId: line.metricId,
          baseQty: qtyToDb(line.baseQty),
          extraQty: qtyToDb(line.extraQty),
          extraNote: line.extraNote ?? null,
        })),
      });

      // Remove the replaceable slices first, so the new ones cannot collide with them.
      await tx.targetSlice.deleteMany({ where: { id: { in: removeEmployeeSliceIds } } });
      await tx.branchSlice.deleteMany({ where: { id: { in: removeBranchSliceIds } } });
      await tx.targetSlice.createMany({
        data: newEmployeeSlices.map((slice) => ({ ...slice, planId: plan.id })),
      });
      await tx.branchSlice.createMany({
        data: newBranchSlices.map((slice) => ({ ...slice, planId: plan.id })),
      });

      const newSliceCount = newEmployeeSlices.length + newBranchSlices.length;
      const keptSliceCount = employeePartition.frozen.length + branchPartition.frozen.length;
      const removedSliceCount = removeEmployeeSliceIds.length + removeBranchSliceIds.length;

      await writeAudit(tx, {
        actorId: actor.id,
        branchId: branch.id,
        action: "PLAN_PUBLISHED",
        entityType: "TargetPlan",
        entityId: plan.id,
        summary: `${actor.name} published plan v${version} for ${branch.code} ${month}, effective ${effectiveFrom}`,
        metadata: {
          version,
          supersededVersion: previous?.version ?? null,
          effectiveFrom,
          today,
          extraCount: extras.length,
          lineCount: allocation.lines.length,
          newSliceCount,
          keptSliceCount,
          removedSliceCount,
          warnings: allocation.warnings,
        },
      });

      return {
        planId: plan.id,
        version,
        supersededVersion: previous?.version ?? null,
        effectiveFrom,
        warnings: allocation.warnings,
        lineCount: allocation.lines.length,
        newSliceCount,
        keptSliceCount,
        removedSliceCount,
      };
    },
    { timeout: 30000, maxWait: 10000 },
  );
}