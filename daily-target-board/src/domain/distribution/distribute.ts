/**
 * Split a whole-number total across periods in proportion to their weights,
 * using the largest remainder method.
 *
 * - The result always sums exactly to `total`.
 * - Each share is within 1 of its exact proportional value.
 * - Leftover units go to the largest fractional remainder; ties go to the earlier period.
 * - A weight of 0 always receives 0.
 * - Throws on a negative or non-integer total, an empty weights list,
 *   a negative or non-integer weight, or all-zero weights with a total above 0.
 */
export function distribute(total: number, weights: readonly number[]): number[] {
  throw new Error("not implemented");
}