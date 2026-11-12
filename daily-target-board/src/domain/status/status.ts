import { addDays, workingDaysInRange } from "../calendar/calendar";
import type { BusinessDate, CalendarConfig } from "../calendar/types";
import { allocateCoverage, type CoverageSlice, type SliceCoverage } from "../coverage/coverage";

export type SliceStatus = "ACHIEVED" | "ON_TRACK" | "OVERDUE";
export type RedShade = "LIGHT" | "MEDIUM" | "STRONG" | "DARK";

export interface EvaluationContext {
  /** Today's business date in IST. */
  today: BusinessDate;
  /** True once today's cut-off time has passed. Decided at the edge of the system. */
  cutoffPassed: boolean;
  /** Weekly offs plus the merged cluster and branch holidays. */
  calendar: CalendarConfig;
}

export interface SliceToEvaluate extends CoverageSlice {
  /** True for a slice carried forward from a closed month. Always the darkest red. */
  isCarry?: boolean;
}

export interface SliceEvaluation extends SliceCoverage {
  status: SliceStatus;
  /** Working days overdue; 0 unless the status is OVERDUE. */
  overdueWorkingDays: number;
  shade: RedShade | null;
  /** Text shown next to the colour, so colour is never the only signal. */
  label: string;
}

export interface EvaluationResult {
  /** Same order as the input slices. */
  slices: SliceEvaluation[];
  surplusQty: number;
}

/**
 * How many working-day cut-offs have passed since the slice fell due, counting the
 * due day's own cut-off. Returns 0 while the slice is not yet overdue.
 *
 * Weekends and holidays never add to the age, so a holiday cannot make anything redder.
 */
export function overdueWorkingDays(dueDate: BusinessDate, ctx: EvaluationContext): number {
  const lastClosedDay = ctx.cutoffPassed ? ctx.today : addDays(ctx.today, -1);
  if (lastClosedDay < dueDate) return 0;
  return workingDaysInRange(dueDate, lastClosedDay, ctx.calendar).length;
}

/** 1-2 days light, 3-5 medium, 6-10 strong, 11 or more dark. Carried slices are always dark. */
export function shadeFor(overdueDays: number, isCarry: boolean): RedShade {
  if (!Number.isInteger(overdueDays) || overdueDays < 1) {
    throw new Error(`Overdue days must be a whole number of at least 1, got ${overdueDays}`);
  }
  if (isCarry || overdueDays >= 11) return "DARK";
  if (overdueDays >= 6) return "STRONG";
  if (overdueDays >= 3) return "MEDIUM";
  return "LIGHT";
}

const dayWord = (n: number) => (n === 1 ? "day" : "days");

/**
 * Work out the status of every slice for one person and one metric.
 * `verifiedQty` is the net verified quantity (verified entries minus reversals).
 * Nothing here is stored: the same inputs always give the same answer.
 */
export function evaluateSlices(
  slices: readonly SliceToEvaluate[],
  verifiedQty: number,
  ctx: EvaluationContext,
): EvaluationResult {
  const coverage = allocateCoverage(slices, verifiedQty);

  const evaluations = coverage.slices.map((c, i): SliceEvaluation => {
    if (c.remainingQty === 0) {
      return { ...c, status: "ACHIEVED", overdueWorkingDays: 0, shade: null, label: "Achieved" };
    }

    const days = overdueWorkingDays(slices[i].dueDate, ctx);
    if (days === 0) {
      return { ...c, status: "ON_TRACK", overdueWorkingDays: 0, shade: null, label: "On track" };
    }

    const isCarry = slices[i].isCarry === true;
    return {
      ...c,
      status: "OVERDUE",
      overdueWorkingDays: days,
      shade: shadeFor(days, isCarry),
      label: isCarry
        ? `Carried forward, overdue ${days} ${dayWord(days)}`
        : `Overdue ${days} ${dayWord(days)}`,
    };
  });

  return { slices: evaluations, surplusQty: coverage.surplusQty };
}