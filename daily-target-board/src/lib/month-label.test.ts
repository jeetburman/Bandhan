import { describe, expect, it } from "vitest";
import { monthLabel } from "./month-label";

describe("monthLabel", () => {
  it("spells out the month and year", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
    expect(monthLabel("2026-12")).toBe("December 2026");
    expect(monthLabel("2027-01")).toBe("January 2027");
  });

  it("throws on an invalid month", () => {
    expect(() => monthLabel("2026-13")).toThrow();
    expect(() => monthLabel("2026-1")).toThrow();
    expect(() => monthLabel("November")).toThrow();
  });
});