import { addDays } from "../calendar/calendar";
import type { BusinessDate } from "../calendar/types";

export type Outlook = "ACHIEVED" | "ON_PACE" | "BEHIND" | "NOT_STARTED" | "NO_DAYS_LEFT";

export interface PerformanceInput {
  /** The month's target. A count, or paise. */
  monthTotal: number;
  /** Verified so far this month, on any date. */
  verifiedQty: number;
  /** Verified sales dated on or before the last closed day. */
  verifiedClosedQty: number;
  /** What the plan said should be done by the last closed day. */
  expectedQty: number;
  /** Working days that have fully closed this month. */
  elapsedWorkingDays: number;
  /** Working days still to come, counting today while it is open. */
  remainingWorkingDays: number;
}

export interface Performance {
  monthTotal: number;
  verifiedQty: number;
  expectedQty: number;
  remainingQty: number;
  /** Whole percent of the target that is verified, 0 to 100. */
  percentDone: number;
  /** Whole percent of the target the plan expected by now, 0 to 100. */
  expectedPercent: number;
  /** How far under the plan, 0 when level or ahead. */
  behindQty: number;
  /** How far over the plan, 0 when level or behind. */
  aheadQty: number;
  /** Verified per closed working day. null before any day has closed. */
  currentRate: number | null;
  /** What is needed per working day from here to finish. null when no working days remain. */
  requiredRate: number | null;
  /** An estimate of the month-end total at the current rate. null before any day has closed. */
  projectedQty: number | null;
    /** Verified on days that have closed, the basis of the current pace. */
  verifiedClosedQty: number;
  elapsedWorkingDays: number;
  remainingWorkingDays: number;
  outlook: Outlook;
}

/** The last calendar day that has fully closed: today only once the cut-off has passed. */
export function lastClosedDay(today: BusinessDate, cutoffPassed: boolean): BusinessDate {
  return cutoffPassed ? today : addDays(today, -1);
}

function assertWhole(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative whole number, got ${value}`);
  }
}

/**
 * How a target is going: how far along, how it compares with the plan, and whether the pace
 * so far is enough to finish. Nothing is stored, so it is always up to date.
 */
export function buildPerformance(input: PerformanceInput): Performance {
  const {
    monthTotal,
    verifiedQty,
    verifiedClosedQty,
    expectedQty,
    elapsedWorkingDays,
    remainingWorkingDays,
  } = input;
  assertWhole(monthTotal, "Month total");
  assertWhole(verifiedQty, "Verified quantity");
  assertWhole(verifiedClosedQty, "Verified quantity on closed days");
  assertWhole(expectedQty, "Expected quantity");
  assertWhole(elapsedWorkingDays, "Elapsed working days");
  assertWhole(remainingWorkingDays, "Remaining working days");
  if (verifiedClosedQty > verifiedQty) {
    throw new Error("Verified quantity on closed days cannot be more than the total verified");
  }

  const remainingQty = Math.max(0, monthTotal - verifiedQty);
  const percent = (part: number) =>
    monthTotal === 0 ? 0 : Math.min(100, Math.floor((part * 100) / monthTotal));

  const currentRate = elapsedWorkingDays > 0 ? verifiedClosedQty / elapsedWorkingDays : null;
  const requiredRate = remainingWorkingDays > 0 ? remainingQty / remainingWorkingDays : null;
  const projectedQty =
    currentRate === null ? null : verifiedQty + Math.round(currentRate * remainingWorkingDays);

  let outlook: Outlook;
  if (remainingQty === 0) outlook = "ACHIEVED";
  else if (remainingWorkingDays === 0) outlook = "NO_DAYS_LEFT";
  else if (elapsedWorkingDays === 0) outlook = "NOT_STARTED";
  // current >= required, written without division so there is no rounding to argue about
  else if (verifiedClosedQty * remainingWorkingDays >= remainingQty * elapsedWorkingDays) {
    outlook = "ON_PACE";
  } else outlook = "BEHIND";

  return {
    monthTotal,
    verifiedQty,
    expectedQty,
    remainingQty,
    percentDone: percent(verifiedQty),
    expectedPercent: percent(expectedQty),
    behindQty: Math.max(0, expectedQty - verifiedQty),
    aheadQty: Math.max(0, verifiedQty - expectedQty),
    currentRate,
    requiredRate,
    projectedQty,
    verifiedClosedQty,
    elapsedWorkingDays,
    remainingWorkingDays,
    outlook,
  };
}