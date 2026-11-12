import { describe, expect, it } from "vitest";
import { partitionSlices, remainingQty } from "./freeze";

const slice = (dueDate: string, plannedQty: number, closed = false) => ({
  dueDate,
  plannedQty,
  closed,
});

describe("partitionSlices", () => {
  it("freezes slices due before the effective date and leaves the rest open", () => {
    const a = slice("2026-11-09", 5);
    const b = slice("2026-11-10", 5);
    const c = slice("2026-11-12", 5);
    const { frozen, open } = partitionSlices([a, b, c], "2026-11-12");
    expect(frozen).toEqual([a, b]);
    expect(open).toEqual([c]);
  });

  it("treats a slice due on the effective date as open", () => {
    const due = slice("2026-11-16", 5);
    expect(partitionSlices([due], "2026-11-16")).toEqual({ frozen: [], open: [due] });
  });

  it("keeps the input order within each group", () => {
    const a = slice("2026-11-02", 1);
    const b = slice("2026-11-20", 1);
    const c = slice("2026-11-03", 1);
    const d = slice("2026-11-25", 1);
    const { frozen, open } = partitionSlices([a, b, c, d], "2026-11-10");
    expect(frozen).toEqual([a, c]);
    expect(open).toEqual([b, d]);
  });

  it("accepts a closed slice that is already frozen", () => {
    const closed = slice("2026-11-09", 5, true);
    expect(partitionSlices([closed], "2026-11-12").frozen).toEqual([closed]);
  });

  it("throws when a closed slice is due on or after the effective date", () => {
    expect(() => partitionSlices([slice("2026-11-12", 5, true)], "2026-11-12")).toThrow();
    expect(() => partitionSlices([slice("2026-11-20", 5, true)], "2026-11-12")).toThrow();
  });

  it("handles no slices", () => {
    expect(partitionSlices([], "2026-11-12")).toEqual({ frozen: [], open: [] });
  });
});

describe("remainingQty", () => {
  it("subtracts what was already planned", () => {
    expect(remainingQty(100, [{ plannedQty: 30 }, { plannedQty: 20 }], "x")).toBe(50);
  });

  it("returns the whole total when nothing is frozen", () => {
    expect(remainingQty(100, [], "x")).toBe(100);
  });

  it("returns 0 when the frozen slices already cover the target", () => {
    expect(remainingQty(50, [{ plannedQty: 50 }], "x")).toBe(0);
  });

  it("throws, naming the line, when the new target is below what is already planned", () => {
    expect(() => remainingQty(40, [{ plannedQty: 50 }], "Demo CRO 1 / Savings")).toThrow(
      /Demo CRO 1 \/ Savings/,
    );
  });
});