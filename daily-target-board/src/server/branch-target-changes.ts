import { db } from "../lib/db";
import { describeChange } from "../lib/describe-change";
import { formatShortDate } from "../lib/format-time";
import { istBusinessDate } from "../lib/ist";
import { qtyFromDb } from "../lib/qty";

export interface BranchChangeView {
  /** "Changed on Thu 12 Nov: was ₹5,65,00,000 (+₹5,00,000)" */
  text: string;
  direction: "UP" | "DOWN" | "NEW";
  /** The reason the Cluster Head gave, if any. */
  note: string | null;
}

/** For each product, the most recent change the Cluster Head made to this branch's target. */
export async function loadBranchTargetChangeViews(
  branchId: string,
  month: string,
): Promise<Map<string, BranchChangeView>> {
  const rows = await db.branchTargetChange.findMany({
    where: { branchId, month },
    orderBy: { at: "desc" },
    include: { metric: true },
  });

  const views = new Map<string, BranchChangeView>();
  for (const row of rows) {
    if (views.has(row.metricId)) continue;

    const previous = qtyFromDb(row.previousQty);
    const delta = qtyFromDb(row.newQty) - previous;
    if (delta === 0) continue;

    const kind = previous === 0 ? "NEW" : "CHANGED";
    views.set(row.metricId, {
      text: describeChange(
        row.metric.unit,
        { kind, previousTotal: previous, delta },
        formatShortDate(istBusinessDate(row.at)),
      ),
      direction: kind === "NEW" ? "NEW" : delta > 0 ? "UP" : "DOWN",
      note: row.note,
    });
  }
  return views;
}