import type { Pacing } from "../distribution/plan-slices";
import {
  evaluateSlices,
  type EvaluationContext,
  type RedShade,
  type SliceEvaluation,
  type SliceToEvaluate,
} from "../status/status";
import { suggestFor, type Suggestion } from "./suggest";

export type CardState = "ACHIEVED" | "BEHIND" | "ON_TRACK";

export interface MetricCardInput {
  metricId: string;
  code: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  pacing: Pacing;
  /** The month's target. A count, or paise. */
  monthTotal: number;
  /** Net verified so far this month. */
  verifiedQty: number;
  /** Recorded but not yet verified. Never counts as progress. */
  pendingQty: number;
  slices: readonly SliceToEvaluate[];
}

export interface MetricCard {
  metricId: string;
  code: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  pacing: Pacing;
  monthTotal: number;
  verifiedQty: number;
  pendingQty: number;
  remaining: number;
  /** Whole percent of the month's target that is verified, 0 to 100. */
  percent: number;
  state: CardState;
  /** How much of the plan that has already fallen due is still undone. */
  behindQty: number;
  overdueWorkingDays: number;
  shade: RedShade | null;
  label: string;
  suggestion: Suggestion;
  /** What the original plan said for the same stretch, to show how the advice moved. */
  planned: { day: number | null; week: number | null };
}

const SHADE_RANK: Record<RedShade, number> = { LIGHT: 0, MEDIUM: 1, STRONG: 2, DARK: 3 };
const STATE_RANK: Record<CardState, number> = { BEHIND: 0, ON_TRACK: 1, ACHIEVED: 2 };

function assertQty(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative whole number, got ${value}`);
  }
}

/** One target for one person: how far along, how it is going, and what to do next. */
export function buildMetricCard(input: MetricCardInput, ctx: EvaluationContext): MetricCard {
  const { monthTotal, verifiedQty, pendingQty, slices } = input;
  assertQty(monthTotal, "Month total");
  assertQty(verifiedQty, "Verified quantity");
  assertQty(pendingQty, "Pending quantity");

  const remaining = Math.max(0, monthTotal - verifiedQty);
  const percent = monthTotal === 0 ? 0 : Math.min(100, Math.floor((verifiedQty * 100) / monthTotal));

  const overdue = evaluateSlices(slices, verifiedQty, ctx).slices.filter((s) => s.status === "OVERDUE");
  const behindQty = overdue.reduce((acc, s) => acc + s.remainingQty, 0);

  // The worst gap decides the colour: carried-forward first, then the oldest.
  let worst: SliceEvaluation | null = null;
  for (const slice of overdue) {
    if (!slice.shade) continue;
    if (worst === null || !worst.shade) {
      worst = slice;
      continue;
    }
    const rank = SHADE_RANK[slice.shade];
    const worstRank = SHADE_RANK[worst.shade];
    if (rank > worstRank || (rank === worstRank && slice.overdueWorkingDays > worst.overdueWorkingDays)) {
      worst = slice;
    }
  }

  const state: CardState = remaining === 0 ? "ACHIEVED" : worst ? "BEHIND" : "ON_TRACK";

  // Sales already waiting for approval will count once verified, so do not ask for them again.
  const needed = Math.max(0, remaining - pendingQty);
  const suggestion = suggestFor({
    month: ctx.today.slice(0, 7),
    today: ctx.today,
    cutoffPassed: ctx.cutoffPassed,
    calendar: ctx.calendar,
    pacing: input.pacing,
    needed,
  });

  const from = suggestion.fromDate;
  const weekDue = suggestion.weekDueDate;
  const plannedSum = (keep: (dueDate: string) => boolean) =>
    slices.filter((s) => keep(s.dueDate)).reduce((acc, s) => acc + s.plannedQty, 0);

  return {
    metricId: input.metricId,
    code: input.code,
    name: input.name,
    unit: input.unit,
    pacing: input.pacing,
    monthTotal,
    verifiedQty,
    pendingQty,
    remaining,
    percent,
    state,
    behindQty,
    overdueWorkingDays: worst?.overdueWorkingDays ?? 0,
    shade: worst?.shade ?? null,
    label: state === "ACHIEVED" ? "Achieved" : worst ? worst.label : "On track",
    suggestion,
    planned: {
      day: input.pacing === "DAILY" && from ? plannedSum((due) => due === from) : null,
      week: from && weekDue ? plannedSum((due) => due >= from && due <= weekDue) : null,
    },
  };
}

/** Behind first (the worst gap on top), then on track, then achieved. Ties keep their order. */
export function orderCards<T extends Pick<MetricCard, "state" | "overdueWorkingDays">>(
  cards: readonly T[],
): T[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort(
      (a, b) =>
        STATE_RANK[a.card.state] - STATE_RANK[b.card.state] ||
        b.card.overdueWorkingDays - a.card.overdueWorkingDays ||
        a.index - b.index,
    )
    .map(({ card }) => card);
}