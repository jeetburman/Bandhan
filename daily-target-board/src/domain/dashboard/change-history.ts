export interface VersionTotal {
  version: number;
  /** The person's total for one product in that plan version. 0 if they had none. */
  total: number;
  at: Date;
}

export interface TargetChange {
  /** NEW when the person had no target for this product before. */
  kind: "NEW" | "CHANGED";
  previousTotal: number;
  newTotal: number;
  delta: number;
  at: Date;
}

/**
 * The most recent time this total actually changed between two plan versions.
 * A version that only re-spread days after a holiday leaves the total alone, so it is not a change.
 */
export function lastChange(history: readonly VersionTotal[]): TargetChange | null {
  for (const entry of history) {
    if (!Number.isSafeInteger(entry.total) || entry.total < 0) {
      throw new Error(`Total must be a non-negative whole number, got ${entry.total}`);
    }
  }

  const ordered = [...history].sort((a, b) => a.version - b.version);
  for (let i = ordered.length - 1; i >= 1; i--) {
    const before = ordered[i - 1];
    const after = ordered[i];
    if (after.total === before.total) continue;
    return {
      kind: before.total === 0 ? "NEW" : "CHANGED",
      previousTotal: before.total,
      newTotal: after.total,
      delta: after.total - before.total,
      at: after.at,
    };
  }
  return null;
}