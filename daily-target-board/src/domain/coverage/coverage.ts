import type { BusinessDate } from "../calendar/types";

export interface CoverageSlice {
  id: string;
  /** The working day on which the slice is judged met or missed. */
  dueDate: BusinessDate;
  /** Whole units: a count, or paise for amounts. */
  plannedQty: number;
}

export interface SliceCoverage {
  id: string;
  plannedQty: number;
  coveredQty: number;
  remainingQty: number;
}

export interface CoverageResult {
  /** Same order as the input slices. */
  slices: SliceCoverage[];
  /** Verified quantity left over after every slice is full. */
  surplusQty: number;
}

/**
 * Match verified progress against slices, oldest due date first.
 *
 * - Verified quantity fills the oldest slice before touching the next one, then
 *   pre-pays future slices once the older ones are full.
 * - Nothing is stored as "remaining": it is always recomputed, so a verification
 *   that arrives late fixes older slices automatically.
 * - `verifiedQty` must be the NET verified quantity (verified entries minus reversals).
 * - Slices tied on due date keep their input order.
 */
export function allocateCoverage(
  slices: readonly CoverageSlice[],
  verifiedQty: number,
): CoverageResult {
  if (!Number.isInteger(verifiedQty) || verifiedQty < 0) {
    throw new Error(`Verified quantity must be a non-negative integer, got ${verifiedQty}`);
  }
  for (const slice of slices) {
    if (!Number.isInteger(slice.plannedQty) || slice.plannedQty < 0) {
      throw new Error(`Planned quantity must be a non-negative integer, got ${slice.plannedQty}`);
    }
  }

  // Allocate in due-date order, but report in the caller's order.
  // Plain string comparison is correct for zero-padded ISO dates.
  const order = slices
    .map((_, i) => i)
    .sort((a, b) => {
      const dateA = slices[a].dueDate;
      const dateB = slices[b].dueDate;
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
      return a - b;
    });

  const result = new Array<SliceCoverage>(slices.length);
  let available = verifiedQty;

  for (const i of order) {
    const planned = slices[i].plannedQty;
    const covered = Math.min(planned, available);
    available -= covered;
    result[i] = {
      id: slices[i].id,
      plannedQty: planned,
      coveredQty: covered,
      remainingQty: planned - covered,
    };
  }

  return { slices: result, surplusQty: available };
}