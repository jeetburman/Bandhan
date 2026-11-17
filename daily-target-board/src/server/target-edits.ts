import { db } from "../lib/db";
import { formatQty } from "../lib/money";
import { qtyFromDb } from "../lib/qty";
import { writeAudit } from "./audit";
import { UserFacingError } from "./errors";
import type { Actor } from "./permissions";
import { canEditTargetsOf } from "./policy";
import { publishPlan } from "./publish-plan";
import { loadEditWindow, loadFloors } from "./target-grid";

export interface TargetChangeRequest {
  metricCode: string;
  /** The total the form was showing. Used to spot someone else changing it in the meantime. */
  expectedCurrent: number;
  newTotal: number;
}

export interface ChangeTargetsInput {
  userId: string;
  changes: TargetChangeRequest[];
  note?: string;
}

export interface ChangeTargetsResult {
  version: number;
  effectiveFrom: string;
  changed: number;
}

/**
 * Set new monthly totals for one employee, up or down, effective immediately.
 * Days that have already closed keep their targets, and a total cannot drop below what has
 * already fallen due. Saved as a new plan version with an audit entry.
 */
export async function changeEmployeeTargets(
  actor: Actor,
  input: ChangeTargetsInput,
  now: Date = new Date(),
): Promise<ChangeTargetsResult> {
  const notFound = () => new UserFacingError("That person was not found.");
  if (actor.role !== "BRANCH_MANAGER" || !actor.branchId) throw notFound();
  const branchId = actor.branchId;

  const person = await db.user.findUnique({
    where: { id: input.userId },
    include: { designation: true, branch: true },
  });
  if (!person || !person.isActive || !person.branch) throw notFound();
  if (person.id === actor.id) throw new UserFacingError("You can't change your own targets.");
  const allowed = canEditTargetsOf(actor, {
    id: person.id,
    clusterId: person.clusterId,
    branchId: person.branchId,
    reportsToId: person.reportsToId,
    role: person.designation.role,
  });
  if (!allowed) throw notFound();

  const note = input.note?.trim() || undefined;
  if (note && note.length > 200) throw new UserFacingError("The reason is too long (200 characters at most).");

  const { today, month, effectiveFrom } = await loadEditWindow(actor.clusterId, branchId, now);
  if (!effectiveFrom) {
    throw new UserFacingError("There are no working days left this month, so targets can't be changed.");
  }

  const [plan, metrics, floors] = await Promise.all([
    db.targetPlan.findFirst({
      where: { branchId, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      include: { lines: { where: { userId: person.id } } },
    }),
    db.metric.findMany({ where: { scope: "INDIVIDUAL", isActive: true } }),
    loadFloors(person.id, month, effectiveFrom),
  ]);
  if (!plan) throw new UserFacingError("No plan has been published for this month yet.");

  const metricByCode = new Map(metrics.map((m) => [m.code, m] as const));
  const lineByMetric = new Map(plan.lines.map((line) => [line.metricId, line] as const));
  const seen = new Set<string>();
  const applied: {
    metricCode: string;
    metricName: string;
    unit: "COUNT" | "AMOUNT";
    from: number;
    to: number;
  }[] = [];

  for (const change of input.changes) {
    const metric = metricByCode.get(change.metricCode);
    if (!metric) throw new UserFacingError("One of those products can no longer be changed.");
    if (seen.has(change.metricCode)) throw new UserFacingError("Please check the form and try again.");
    seen.add(change.metricCode);
    if (!Number.isSafeInteger(change.newTotal) || change.newTotal < 0) {
      throw new UserFacingError(`${metric.name}: enter a valid target.`);
    }

    const line = lineByMetric.get(metric.id);
    const current = line ? qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty) : 0;
    if (current !== change.expectedCurrent) {
      throw new UserFacingError(
        "These targets were changed by someone else while you were editing. Please reload the page and try again.",
      );
    }
    if (change.newTotal === current) continue;

    const floor = floors.get(metric.id) ?? 0;
    if (change.newTotal < floor) {
      throw new UserFacingError(
        `${metric.name} can't go below ${formatQty(metric.unit, floor)}, because that much has already fallen due.`,
      );
    }
    applied.push({
      metricCode: metric.code,
      metricName: metric.name,
      unit: metric.unit,
      from: current,
      to: change.newTotal,
    });
  }
  if (applied.length === 0) throw new UserFacingError("Nothing was changed.");

  let published;
  try {
    published = await publishPlan({
      branchCode: person.branch.code,
      month,
      actorEmail: actor.email,
      effectiveFrom,
      today,
      setTotals: applied.map((a) => ({
        email: person.email,
        metricCode: a.metricCode,
        total: a.to,
        note,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Someone else published")) {
      throw new UserFacingError(error.message);
    }
    throw error;
  }

  const preview = applied
    .slice(0, 3)
    .map((a) => `${a.metricName} ${formatQty(a.unit, a.from)} → ${formatQty(a.unit, a.to)}`)
    .join("; ");
  await writeAudit(db, {
    actorId: actor.id,
    branchId,
    action: "TARGETS_CHANGED",
    entityType: "User",
    entityId: person.id,
    summary:
      `${actor.name} changed ${person.name}'s targets: ${preview}` +
      (applied.length > 3 ? ` and ${applied.length - 3} more` : ""),
    metadata: {
      version: published.version,
      effectiveFrom,
      note,
      changes: applied.map((a) => ({ metric: a.metricCode, from: a.from, to: a.to })),
    },
  });

  return { version: published.version, effectiveFrom, changed: applied.length };
}