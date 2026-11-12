import { describe, expect, it } from "vitest";
import { allocateCoverage, type CoverageSlice } from "./coverage";

const slice = (id: string, dueDate: string, plannedQty: number): CoverageSlice => ({
  id,
  dueDate,
  plannedQty,
});

const W1 = slice("w1", "2026-11-07", 2);
const W2 = slice("w2", "2026-11-13", 2);
const W3 = slice("w3", "2026-11-21", 2);

const covered = (slices: CoverageSlice[], verified: number) =>
  allocateCoverage(slices, verified).slices.map((s) => s.coveredQty);

describe("allocateCoverage", () => {
  it("fills the oldest slice first", () => {
    const result = allocateCoverage([W1, W2, W3], 3);
    expect(result.slices.map((s) => s.coveredQty)).toEqual([2, 1, 0]);
    expect(result.slices.map((s) => s.remainingQty)).toEqual([0, 1, 2]);
    expect(result.surplusQty).toBe(0);
  });

  it("covers nothing when nothing is verified", () => {
    const result = allocateCoverage([W1, W2, W3], 0);
    expect(result.slices.map((s) => s.coveredQty)).toEqual([0, 0, 0]);
    expect(result.slices.map((s) => s.remainingQty)).toEqual([2, 2, 2]);
  });

  it("pre-pays future slices once earlier ones are full", () => {
    expect(covered([W1, W2, W3], 4)).toEqual([2, 2, 0]);
  });

  it("reports surplus beyond every slice", () => {
    const result = allocateCoverage([W1, W2, W3], 9);
    expect(result.slices.map((s) => s.coveredQty)).toEqual([2, 2, 2]);
    expect(result.surplusQty).toBe(3);
  });

  it("allocates by due date, not by input order", () => {
    const result = allocateCoverage([W3, W2, W1], 3);
    expect(result.slices.map((s) => s.id)).toEqual(["w3", "w2", "w1"]);
    expect(result.slices.map((s) => s.coveredQty)).toEqual([0, 1, 2]);
  });

  it("fills a carried slice from last month before this month's slices", () => {
    const carry = slice("carry", "2026-10-30", 3);
    expect(covered([carry, W1], 4)).toEqual([3, 1]);
  });

  it("keeps input order when due dates tie", () => {
    const a = slice("a", "2026-11-07", 2);
    const b = slice("b", "2026-11-07", 2);
    expect(covered([a, b], 3)).toEqual([2, 1]);
  });

  it("lets a zero-planned slice consume nothing", () => {
    const zero = slice("zero", "2026-11-07", 0);
    const result = allocateCoverage([zero, W2], 1);
    expect(result.slices.map((s) => s.coveredQty)).toEqual([0, 1]);
    expect(result.slices.map((s) => s.remainingQty)).toEqual([0, 1]);
  });

  it("handles an empty list of slices", () => {
    expect(allocateCoverage([], 5)).toEqual({ slices: [], surplusQty: 5 });
  });

  it("throws on a negative verified quantity", () => {
    expect(() => allocateCoverage([W1], -1)).toThrow();
  });

  it("throws on a fractional verified quantity", () => {
    expect(() => allocateCoverage([W1], 1.5)).toThrow();
  });

  it("throws on a negative planned quantity", () => {
    expect(() => allocateCoverage([slice("bad", "2026-11-07", -1)], 1)).toThrow();
  });
});

describe("allocateCoverage: invariants", () => {
  // Already in due-date order, so "earlier" means "earlier in the list".
  const slices = [
    slice("a", "2026-11-02", 3),
    slice("b", "2026-11-07", 0),
    slice("c", "2026-11-13", 4),
    slice("d", "2026-11-21", 2),
    slice("e", "2026-11-27", 5),
  ];

  it("conserves quantity and always fills oldest first", () => {
    for (let verified = 0; verified <= 20; verified++) {
      const { slices: out, surplusQty } = allocateCoverage(slices, verified);

      const coveredTotal = out.reduce((acc, s) => acc + s.coveredQty, 0);
      expect(coveredTotal + surplusQty).toBe(verified);

      out.forEach((s, i) => {
        expect(s.coveredQty).toBeLessThanOrEqual(s.plannedQty);
        expect(s.remainingQty).toBe(s.plannedQty - s.coveredQty);
        // Anything covered means every older slice is already full.
        if (s.coveredQty > 0) {
          out.slice(0, i).forEach((older) => expect(older.remainingQty).toBe(0));
        }
      });

      // Surplus only exists when every slice is full.
      if (surplusQty > 0) {
        expect(out.every((s) => s.remainingQty === 0)).toBe(true);
      }
    }
  });
});