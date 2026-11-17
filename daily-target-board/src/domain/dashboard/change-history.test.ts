import { describe, expect, it } from "vitest";
import { lastChange, type VersionTotal } from "./change-history";

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 6, 0, 0));
const v = (version: number, total: number, day = version): VersionTotal => ({
  version,
  total,
  at: at(day),
});

describe("lastChange", () => {
  it("is null for a single version or an empty history", () => {
    expect(lastChange([])).toBeNull();
    expect(lastChange([v(1, 50)])).toBeNull();
  });

  it("is null when the total never moved", () => {
    expect(lastChange([v(1, 50), v(2, 50), v(3, 50)])).toBeNull();
  });

  it("reports a raise", () => {
    expect(lastChange([v(1, 50), v(2, 52)])).toEqual({
      kind: "CHANGED",
      previousTotal: 50,
      newTotal: 52,
      delta: 2,
      at: at(2),
    });
  });

  it("reports a cut with a negative difference", () => {
    expect(lastChange([v(1, 50), v(2, 45)])).toMatchObject({ delta: -5, previousTotal: 50 });
  });

  it("reports only the latest change when there were several", () => {
    expect(lastChange([v(1, 50), v(2, 52), v(3, 60)])).toMatchObject({
      previousTotal: 52,
      newTotal: 60,
      delta: 8,
    });
  });

  it("keeps the change visible after a later version that left the total alone", () => {
    expect(lastChange([v(1, 50), v(2, 52), v(3, 52)])).toMatchObject({
      previousTotal: 50,
      newTotal: 52,
      at: at(2),
    });
  });

  it("calls a first-time target NEW", () => {
    expect(lastChange([v(1, 0), v(2, 5)])).toMatchObject({ kind: "NEW", previousTotal: 0, delta: 5 });
  });

  it("reports a removed target as a cut to zero", () => {
    expect(lastChange([v(1, 5), v(2, 0)])).toMatchObject({ kind: "CHANGED", newTotal: 0, delta: -5 });
  });

  it("sorts versions that arrive out of order", () => {
    expect(lastChange([v(3, 60), v(1, 50), v(2, 52)])).toMatchObject({ previousTotal: 52, newTotal: 60 });
  });

  it("throws on a negative or fractional total", () => {
    expect(() => lastChange([v(1, -1), v(2, 5)])).toThrow();
    expect(() => lastChange([v(1, 1.5), v(2, 5)])).toThrow();
  });
});