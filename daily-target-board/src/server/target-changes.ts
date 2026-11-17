import { lastChange } from "../domain/dashboard/change-history";
import { db } from "../lib/db";
import { describeChange } from "../lib/describe-change";
import { formatShortDate } from "../lib/format-time";
import { istBusinessDate } from "../lib/ist";
import { qtyFromDb } from "../lib/qty";

export interface ChangeView {
  /** "Changed on Thu 12 Nov: was ₹50,00,000 (+₹2,00,000)" */
  text: string;
  direction: "UP" | "DOWN" | "NEW";
  /** The reason the branch manager gave, if any. */
  note: string | null;
}

/**
 * For each product, the most recent real change to this person's monthly target.
 * Worked out from the plan versions already stored, so it needs no table of its own.
 */
export async function loadTargetChangeViews(
  userId: string,
  branchId: string,
  month: string,
): Promise<Map<string, ChangeView>> {
  const [plans, lines, metrics] = await Promise.all([
    db.targetPlan.findMany({
      where: { branchId, month },
      orderBy: { version: "asc" },
      select: { id: true, version: true, createdAt: true, publishedAt: true },
    }),
    db.targetLine.findMany({ where: { userId, plan: { branchId, month } } }),
    db.metric.findMany({ where: { scope: "INDIVIDUAL" } }),
  ]);
  if (plans.length < 2) return new Map();

  const lineByKey = new Map(lines.map((line) => [`${line.planId}|${line.metricId}`, line] as const));
  const latestPlan = plans[plans.length - 1];
  const views = new Map<string, ChangeView>();

  for (const metric of metrics) {
    if (!lines.some((line) => line.metricId === metric.id)) continue;

    const history = plans.map((plan) => {
      const line = lineByKey.get(`${plan.id}|${metric.id}`);
      return {
        version: plan.version,
        total: line ? qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty) : 0,
        at: plan.publishedAt ?? plan.createdAt,
      };
    });

    const change = lastChange(history);
    if (!change) continue;

    const dateLabel = formatShortDate(istBusinessDate(change.at));
    views.set(metric.id, {
      text: describeChange(metric.unit, change, dateLabel),
      direction: change.kind === "NEW" ? "NEW" : change.delta > 0 ? "UP" : "DOWN",
      note: lineByKey.get(`${latestPlan.id}|${metric.id}`)?.extraNote ?? null,
    });
  }
  return views;
}