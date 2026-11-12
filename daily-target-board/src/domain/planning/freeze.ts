import type { BusinessDate } from "../calendar/types";

export interface FreezableSlice {
  dueDate: BusinessDate;
  /** Whole units: a count, or paise for amounts. */
  plannedQty: number;
  /** True once the rollover has closed the slice. */
  closed: boolean;
}

export interface SlicePartition<T> {
  /** Due before the effective date. Never touched by a re-publish. */
  frozen: T[];
  /** Due on or after the effective date. Replaced by a re-publish. */
  open: T[];
}

/**
 * Split existing slices into those a re-publish must keep and those it may replace.
 * Throws if a closed slice would be replaced, because closed periods are never rewritten.
 */
export function partitionSlices<T extends FreezableSlice>(
  slices: readonly T[],
  effectiveFrom: BusinessDate,
): SlicePartition<T> {
  const frozen: T[] = [];
  const open: T[] = [];

  for (const slice of slices) {
    if (slice.dueDate < effectiveFrom) {
      frozen.push(slice);
    } else if (slice.closed) {
      throw new Error(
        `Cannot publish from ${effectiveFrom}: the slice due ${slice.dueDate} is already closed`,
      );
    } else {
      open.push(slice);
    }
  }
  return { frozen, open };
}

/**
 * What is left to plan once the frozen slices are accounted for.
 * Throws if the new total is smaller than what was already planned for the past.
 */
export function remainingQty(
  total: number,
  frozen: readonly { plannedQty: number }[],
  label: string,
): number {
  const frozenTotal = frozen.reduce((acc, slice) => acc + slice.plannedQty, 0);
  if (frozenTotal > total) {
    throw new Error(
      `${label}: the new target (${total}) is below the ${frozenTotal} already due before the effective date`,
    );
  }
  return total - frozenTotal;
}