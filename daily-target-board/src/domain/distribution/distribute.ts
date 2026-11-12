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
  // 1. Validate the input.
  if (!Number.isInteger(total) || total < 0) {
    throw new Error(`Total must be a non-negative integer, got ${total}`);
  }
  if (weights.length === 0) {
    throw new Error("Weights must not be empty");
  }
  for (const weight of weights) {
    if (!Number.isInteger(weight) || weight < 0) {
      throw new Error(`Weights must be non-negative integers, got ${weight}`);
    }
  }

  const weightSum = weights.reduce((acc, weight) => acc + weight, 0);
  if (weightSum === 0) {
    if (total > 0) {
      throw new Error("Cannot distribute a positive total across zero weights");
    }
    return weights.map(() => 0);
  }

  // 2. Give every period its exact share rounded down, and remember what was lost.
  //    Everything here is integer arithmetic, so no floating-point rounding can creep in.
  const shares: number[] = [];
  const remainders: number[] = [];
  let assigned = 0;

  weights.forEach((weight, i) => {
    const numerator = total * weight;
    if (!Number.isSafeInteger(numerator)) {
      throw new Error("Total is too large to distribute exactly");
    }
    const remainder = numerator % weightSum;
    // (numerator - remainder) is an exact multiple of weightSum, so this division is exact.
    const share = (numerator - remainder) / weightSum;

    shares.push(share);
    remainders.push(remainder);
    assigned += share;
  });

  // 3. Hand the leftover units, one each, to the periods that lost the most.
  //    Ties go to the earlier period, so work lands early rather than late.
  const leftover = total - assigned;
  const order = weights
    .map((_, i) => i)
    .sort((a, b) => remainders[b] - remainders[a] || a - b);

  for (let k = 0; k < leftover; k++) {
    shares[order[k]] += 1;
  }

  return shares;
}