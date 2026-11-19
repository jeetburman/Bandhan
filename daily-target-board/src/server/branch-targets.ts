import { db } from "../lib/db";
import { formatQty } from "../lib/money";
import { qtyFromDb, qtyToDb } from "../lib/qty";
import { writeAudit } from "./audit";
import { loadBranchTargetChangeViews, type BranchChangeView } from "./branch-target-changes";
import { UserFacingError } from "./errors";
import { canSetBranchTargets, type Actor } from "./permissions";
import { loadEditWindow } from "./target-grid";

export interface BranchTargetCell {
  metricId: string;
  code: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  scope: "INDIVIDUAL" | "BRANCH";
  /** The branch target now. 0 when none has been set. A count, or paise. */
  current: number;
  /** What the employees' targets add up to. null for targets shared by the whole branch. */
  allocated: number | null;
  /** The lowest the target can go. Only whole-branch targets have one: what has already fallen due. */
  minQty: number;
  /** True when a whole-branch target can no longer change because no working days are left. */
  locked: boolean;
  change: BranchChangeView | null;
}

export interface BranchTargetsForEditing {
  branch: { code: string; name: string };
  month: string;
  planVersion: number | null;
  cells: BranchTargetCell[];
}

async function loadBranchFloors(
  branchId: string,
  month: string,
  effectiveFrom: string,
): Promise<Map<string, number>> {
  const rows = await db.branchSlice.groupBy({
    by: ["metricId"],
    where: { branchId, month, kind: { not: "CARRY" }, dueDate: { lt: effectiveFrom } },
    _sum: { plannedQty: true },
  });
  return new Map(
    rows.map(
      (row) =>
        [row.metricId, row._sum.plannedQty === null ? 0 : qtyFromDb(row._sum.plannedQty)] as const,
    ),
  );
}

/** One branch's targets for editing. null if this person may not edit them. */
export async function loadBranchTargetsForEditing(
  actor: Actor,
  branchCode: string,
  now: Date = new Date(),
): Promise<BranchTargetsForEditing | null> {
  if (actor.role !== "CLUSTER_HEAD") return null;
  const branch = await db.branch.findUnique({ where: { code: branchCode } });
  if (!branch || !canSetBranchTargets(actor, branch)) return null;

  const { month, effectiveFrom } = await loadEditWindow(branch.clusterId, branch.id, now);
  const [metrics, targets, plan, changes] = await Promise.all([
    db.metric.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.branchTarget.findMany({ where: { branchId: branch.id, month } }),
    db.targetPlan.findFirst({
      where: { branchId: branch.id, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      include: { lines: true },
    }),
    loadBranchTargetChangeViews(branch.id, month),
  ]);
  const floors = effectiveFrom
    ? await loadBranchFloors(branch.id, month, effectiveFrom)
    : new Map<string, number>();

  const currentByMetric = new Map(targets.map((t) => [t.metricId, qtyFromDb(t.quantity)] as const));
  const allocated = new Map<string, number>();
  for (const line of plan?.lines ?? []) {
    allocated.set(
      line.metricId,
      (allocated.get(line.metricId) ?? 0) + qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty),
    );
  }

  return {
    branch: { code: branch.code, name: branch.name },
    month,
    planVersion: plan?.version ?? null,
    cells: metrics.map(
      (metric): BranchTargetCell => ({
        metricId: metric.id,
        code: metric.code,
        name: metric.name,
        unit: metric.unit,
        scope: metric.scope,
        current: currentByMetric.get(metric.id) ?? 0,
        allocated: metric.scope === "INDIVIDUAL" ? (allocated.get(metric.id) ?? 0) : null,
        minQty: metric.scope === "BRANCH" ? (floors.get(metric.id) ?? 0) : 0,
        locked: metric.scope === "BRANCH" && effectiveFrom === null,
        change: changes.get(metric.id) ?? null,
      }),
    ),
  };
}

export interface BranchTargetChangeRequest {
  metricCode: string;
  /** The target the form was showing. Used to spot someone else changing it in the meantime. */
  expectedCurrent: number;
  newTotal: number;
}

export interface ChangeBranchTargetsInput {
  branchCode: string;
  changes: BranchTargetChangeRequest[];
  note?: string;
}

/**
 * Set new monthly targets for a branch. Each change is saved with its old and new value
 * and written to the audit log. It never alters any employee's own targets.
 */
export async function changeBranchTargets(
  actor: Actor,
  input: ChangeBranchTargetsInput,
  now: Date = new Date(),
): Promise<{ changed: number }> {
  const notFound = () => new UserFacingError("That branch was not found.");
  if (actor.role !== "CLUSTER_HEAD") throw notFound();

  const branch = await db.branch.findUnique({ where: { code: input.branchCode } });
  if (!branch || !canSetBranchTargets(actor, branch)) throw notFound();

  const note = input.note?.trim() || undefined;
  if (note && note.length > 200) {
    throw new UserFacingError("The reason is too long (200 characters at most).");
  }

  const { month, effectiveFrom } = await loadEditWindow(branch.clusterId, branch.id, now);
  const [metrics, targets] = await Promise.all([
    db.metric.findMany({ where: { isActive: true } }),
    db.branchTarget.findMany({ where: { branchId: branch.id, month } }),
  ]);
  const floors = effectiveFrom
    ? await loadBranchFloors(branch.id, month, effectiveFrom)
    : new Map<string, number>();

  const metricByCode = new Map(metrics.map((m) => [m.code, m] as const));
  const currentByMetric = new Map(targets.map((t) => [t.metricId, qtyFromDb(t.quantity)] as const));
  const seen = new Set<string>();
  const applied: {
    metricId: string;
    metricCode: string;
    metricName: string;
    unit: "COUNT" | "AMOUNT";
    from: number;
    to: number;
  }[] = [];

  for (const change of input.changes) {
    const metric = metricByCode.get(change.metricCode);
    if (!metric) throw new UserFacingError("One of those targets can no longer be changed.");
    if (seen.has(change.metricCode)) throw new UserFacingError("Please check the form and try again.");
    seen.add(change.metricCode);
    if (!Number.isSafeInteger(change.newTotal) || change.newTotal < 0) {
      throw new UserFacingError(`${metric.name}: enter a valid target.`);
    }

    const current = currentByMetric.get(metric.id) ?? 0;
    if (current !== change.expectedCurrent) {
      throw new UserFacingError(
        "These targets were changed by someone else while you were editing. Please reload the page and try again.",
      );
    }
    if (change.newTotal === current) continue;

    if (metric.scope === "BRANCH") {
      if (effectiveFrom === null) {
        throw new UserFacingError(
          `${metric.name} can't be changed, because no working days are left this month.`,
        );
      }
      const floor = floors.get(metric.id) ?? 0;
      if (change.newTotal < floor) {
        throw new UserFacingError(
          `${metric.name} can't go below ${formatQty(metric.unit, floor)}, because that much has already fallen due.`,
        );
      }
    }

    applied.push({
      metricId: metric.id,
      metricCode: metric.code,
      metricName: metric.name,
      unit: metric.unit,
      from: current,
      to: change.newTotal,
    });
  }
  if (applied.length === 0) throw new UserFacingError("Nothing was changed.");

  const preview = applied
    .slice(0, 3)
    .map((a) => `${a.metricName} ${formatQty(a.unit, a.from)} → ${formatQty(a.unit, a.to)}`)
    .join("; ");

  await db.$transaction(
    async (tx) => {
      for (const a of applied) {
        await tx.branchTarget.upsert({
          where: { branchId_metricId_month: { branchId: branch.id, metricId: a.metricId, month } },
          update: { quantity: qtyToDb(a.to), setById: actor.id },
          create: {
            branchId: branch.id,
            metricId: a.metricId,
            month,
            quantity: qtyToDb(a.to),
            setById: actor.id,
          },
        });
      }
      await tx.branchTargetChange.createMany({
        data: applied.map((a) => ({
          branchId: branch.id,
          metricId: a.metricId,
          month,
          previousQty: qtyToDb(a.from),
          newQty: qtyToDb(a.to),
          changedById: actor.id,
          note: note ?? null,
        })),
      });
      await writeAudit(tx, {
        actorId: actor.id,
        branchId: branch.id,
        action: "BRANCH_TARGET_CHANGED",
        entityType: "Branch",
        entityId: branch.id,
        summary:
          `${actor.name} changed ${branch.name} targets: ${preview}` +
          (applied.length > 3 ? ` and ${applied.length - 3} more` : ""),
        metadata: {
          month,
          note,
          changes: applied.map((a) => ({ metric: a.metricCode, from: a.from, to: a.to })),
        },
      });
    },
    { timeout: 30000, maxWait: 10000 },
  );

  return { changed: applied.length };
}