import { describe, expect, it } from "vitest";
import { dayOfWeek, monthRange } from "./calendar";

describe("dayOfWeek", () => {
  it("returns 0 for a Sunday and 6 for a Saturday", () => {
    expect(dayOfWeek("2026-11-01")).toBe(0);
    expect(dayOfWeek("2026-11-07")).toBe(6);
  });

  it("throws on an invalid date", () => {
    expect(() => dayOfWeek("2026-02-30")).toThrow();
  });
});

describe("monthRange", () => {
  it("returns the first and last day of a 30-day month", () => {
    expect(monthRange("2026-11")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("handles December and a leap-year February", () => {
    expect(monthRange("2026-12").end).toBe("2026-12-31");
    expect(monthRange("2028-02").end).toBe("2028-02-29");
  });

  it("throws on an invalid month", () => {
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("2026-1")).toThrow();
    expect(() => monthRange("November")).toThrow();
  });
});