import type { Prisma } from "@prisma/client";
import { isWorkingDay, monthRange } from "../domain/calendar/calendar";
import {
  buildMetricCard,
  orderCards,
  type MetricCard,
} from "../domain/dashboard/metric-card";
import { cutoffPassed as isCutoffPassed } from "../lib/cutoff";
import { db } from "../lib/db";
import { istBusinessDate } from "../lib/ist";
import { qtyFromDb } from "../lib/qty";
import { loadCalendar } from "./calendar-config";
import type { Actor } from "./permissions";

export interface BranchGoal {
  metricId: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  target: number;
  verified: number;
}

export interface MyDashboard {
  month: string;
  today: string;
  todayIsWorkingDay: boolean;
  cutoffPassed: boolean;
  /** null when the branch has no published plan this month. */
  planVersion: number | null;
  /** Behind first, then on track, then achieved. */
  cards: MetricCard[];
  /** Targets shared by the whole branch, such as Affluent Legacy. */
  branchGoals: BranchGoal[];
  behind: number;
  onTrack: number;
  achieved: number;
}

async function creditsByMetric(where: Prisma.EntryCreditWhereInput): Promise<Map<string, number>> {
  const rows = await db.entryCredit.groupBy({
    by: ["metricId"],
    where,
    _sum: { quantity: true },
  });
  return new Map(
    rows.map((row) => [row.metricId, row._sum.quantity === null ? 0 : qtyFromDb(row._sum.quantity)]),
  );
}

/** One person's own targets against what has been verified this month. */
export async function loadMyDashboard(actor: Actor, now: Date = new Date()): Promise<MyDashboard> {
  const today = istBusinessDate(now);
  const month = today.slice(0, 7);
  const range = monthRange(month);
  const passed = isCutoffPassed(now);

  const empty: MyDashboard = {
    month,
    today,
    todayIsWorkingDay: false,
    cutoffPassed: passed,
    planVersion: null,
    cards: [],
    branchGoals: [],
    behind: 0,
    onTrack: 0,
    achieved: 0,
  };
  if (!actor.branchId) return empty;

  const branchId = actor.branchId;
  const inMonth = { gte: range.start, lte: range.end };

  const [plan, metrics, slices, verified, pending, branchVerified, { calendar }] = await Promise.all([
    db.targetPlan.findFirst({
      where: { branchId, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      include: { lines: { where: { userId: actor.id } }, branchTargets: true },
    }),
    db.metric.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.targetSlice.findMany({ where: { userId: actor.id, month } }),
    creditsByMetric({ entry: { userId: actor.id, status: "VERIFIED", activityDate: inMonth } }),
    creditsByMetric({
      entry: { userId: actor.id, status: { in: ["SUBMITTED", "L1_APPROVED"] }, activityDate: inMonth },
    }),
    creditsByMetric({
      metric: { scope: "BRANCH" },
      entry: { branchId, status: "VERIFIED", activityDate: inMonth },
    }),
    loadCalendar(actor.clusterId, branchId, month),
  ]);

  const totalByMetric = new Map<string, number>();
  for (const line of plan?.lines ?? []) {
    totalByMetric.set(line.metricId, qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty));
  }

  const slicesByMetric = new Map<string, typeof slices>();
  for (const slice of slices) {
    const list = slicesByMetric.get(slice.metricId) ?? [];
    list.push(slice);
    slicesByMetric.set(slice.metricId, list);
  }

  const ctx = { today, cutoffPassed: passed, calendar };

  const cards = orderCards(
    metrics
      .filter((m) => m.scope === "INDIVIDUAL" && (totalByMetric.get(m.id) ?? 0) > 0)
      .map((m) =>
        buildMetricCard(
          {
            metricId: m.id,
            code: m.code,
            name: m.name,
            unit: m.unit,
            pacing: m.pacing,
            monthTotal: totalByMetric.get(m.id) ?? 0,
            verifiedQty: verified.get(m.id) ?? 0,
            pendingQty: pending.get(m.id) ?? 0,
            slices: (slicesByMetric.get(m.id) ?? []).map((s) => ({
              id: s.id,
              dueDate: s.dueDate,
              plannedQty: qtyFromDb(s.plannedQty),
              isCarry: s.kind === "CARRY",
            })),
          },
          ctx,
        ),
      ),
  );

  const branchGoals: BranchGoal[] = metrics
    .filter((m) => m.scope === "BRANCH")
    .flatMap((m) => {
      const target = plan?.branchTargets.find((t) => t.metricId === m.id);
      if (!target) return [];
      return [
        {
          metricId: m.id,
          name: m.name,
          unit: m.unit,
          target: qtyFromDb(target.quantity),
          verified: branchVerified.get(m.id) ?? 0,
        },
      ];
    });

  return {
    month,
    today,
    todayIsWorkingDay: isWorkingDay(today, calendar),
    cutoffPassed: passed,
    planVersion: plan?.version ?? null,
    cards,
    branchGoals,
    behind: cards.filter((c) => c.state === "BEHIND").length,
    onTrack: cards.filter((c) => c.state === "ON_TRACK").length,
    achieved: cards.filter((c) => c.state === "ACHIEVED").length,
  };
}