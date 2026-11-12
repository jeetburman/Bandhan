import { describe, expect, it } from "vitest";
import { qtyFromDb, qtyToDb } from "./qty";

describe("qty helpers", () => {
  it("round-trips a Rs 50 crore amount in paise, which a 32-bit integer could not hold", () => {
    const paise = 50_00_00_000 * 100;
    expect(qtyFromDb(qtyToDb(paise))).toBe(paise);
    expect(paise).toBeGreaterThan(2 ** 31);
  });

  it("round-trips zero and small counts", () => {
    expect(qtyFromDb(qtyToDb(0))).toBe(0);
    expect(qtyFromDb(qtyToDb(7))).toBe(7);
  });

  it("rejects fractions, NaN and unsafe numbers when writing", () => {
    expect(() => qtyToDb(1.5)).toThrow();
    expect(() => qtyToDb(Number.NaN)).toThrow();
    expect(() => qtyToDb(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  it("rejects bigints beyond the safe range when reading", () => {
    expect(() => qtyFromDb(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(2))).toThrow();
  });
});