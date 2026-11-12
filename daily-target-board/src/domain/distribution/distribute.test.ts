import { describe, expect, it } from "vitest";
import { distribute } from "./distribute";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("distribute: basic splits", () => {
  it("returns the whole total for a single period", () => {
    expect(distribute(100, [1])).toEqual([100]);
  });

  it("splits evenly when it divides exactly", () => {
    expect(distribute(21, [6, 5, 5, 5])).toEqual([6, 5, 5, 5]);
    expect(distribute(3, [1, 2])).toEqual([1, 2]);
  });

  it("gives leftovers to the earliest periods when remainders tie", () => {
    expect(distribute(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(distribute(7, [1, 1, 1, 1])).toEqual([2, 2, 2, 1]);
    expect(distribute(2, [1, 1, 1, 1])).toEqual([1, 1, 0, 0]);
  });

  it("gives a leftover to the larger remainder, not just the first period", () => {
    // exact shares 5.45 and 4.55: the second period lost more, so it gains
    expect(distribute(10, [6, 5])).toEqual([5, 5]);
  });

  it("gives the leftover to the first period when its remainder is larger", () => {
    // exact shares 3.75 and 1.25
    expect(distribute(5, [3, 1])).toEqual([4, 1]);
  });

  it("returns all zeros for a total of zero", () => {
    expect(distribute(0, [1, 2, 3])).toEqual([0, 0, 0]);
    expect(distribute(0, [0, 0])).toEqual([0, 0]);
  });
});

describe("distribute: zero weights", () => {
  it("gives a zero-weight period nothing", () => {
    expect(distribute(10, [0, 1, 1])).toEqual([0, 5, 5]);
  });

  it("never gives a leftover unit to a zero-weight period", () => {
    expect(distribute(1, [0, 1, 1])).toEqual([0, 1, 0]);
  });
});

describe("distribute: large amounts", () => {
  it("handles Rs 50 lakh in paise over 21 days", () => {
    const result = distribute(500_000_000, new Array(21).fill(1));
    expect(sum(result)).toBe(500_000_000);
    expect(result.slice(0, 17).every((v) => v === 23_809_524)).toBe(true);
    expect(result.slice(17).every((v) => v === 23_809_523)).toBe(true);
  });
});

describe("distribute: invariants", () => {
  const weightSets = [
    [1],
    [1, 1],
    [1, 1, 1, 1],
    [6, 5, 5, 5],
    [4, 6, 6, 5],
    [0, 3, 0, 2],
    [1, 2, 3, 4, 5],
    [7, 1, 1],
  ];

  it("always sums to the total, never goes negative, and stays within 1 of the exact share", () => {
    for (let total = 0; total <= 60; total++) {
      for (const weights of weightSets) {
        const result = distribute(total, weights);
        const weightSum = sum(weights);

        expect(result).toHaveLength(weights.length);
        expect(sum(result)).toBe(total);

        result.forEach((share, i) => {
          expect(share).toBeGreaterThanOrEqual(0);
          const exact = (total * weights[i]) / weightSum;
          expect(Math.abs(share - exact)).toBeLessThan(1);
          if (weights[i] === 0) expect(share).toBe(0);
        });
      }
    }
  });

  it("does not modify the weights array it was given", () => {
    const weights = [3, 1, 2];
    distribute(10, weights);
    expect(weights).toEqual([3, 1, 2]);
  });
});

describe("distribute: invalid input", () => {
  it("throws on a negative total", () => {
    expect(() => distribute(-1, [1, 1])).toThrow();
  });

  it("throws on a non-integer total", () => {
    expect(() => distribute(1.5, [1, 1])).toThrow();
  });

  it("throws when there are no weights", () => {
    expect(() => distribute(5, [])).toThrow();
    expect(() => distribute(0, [])).toThrow();
  });

  it("throws on a negative or non-integer weight", () => {
    expect(() => distribute(5, [-1, 2])).toThrow();
    expect(() => distribute(5, [1.5, 1])).toThrow();
  });

  it("throws when every weight is zero but there is something to distribute", () => {
    expect(() => distribute(5, [0, 0])).toThrow();
  });
});