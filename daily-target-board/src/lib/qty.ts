const MAX = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Database to domain. Postgres BIGINT arrives as a JavaScript bigint, which JSON cannot
 * carry and our domain code does not use. Convert at the repository boundary.
 */
export function qtyFromDb(value: bigint): number {
  if (value > MAX || value < -MAX) {
    throw new Error(`Quantity ${value} is outside the safe integer range`);
  }
  return Number(value);
}

/** Domain to database. Rejects fractions, NaN and anything too large to be exact. */
export function qtyToDb(value: number): bigint {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Quantity must be a safe whole number, got ${value}`);
  }
  return BigInt(value);
}