import { describe, expect, it } from "vitest";
import { formatShortDate } from "./format-time";

describe("formatShortDate", () => {
  it("shows the weekday, day and month", () => {
    expect(formatShortDate("2026-11-11")).toBe("Wed 11 Nov");
    expect(formatShortDate("2026-11-01")).toBe("Sun 1 Nov");
  });

  it("throws on a date that does not exist", () => {
    expect(() => formatShortDate("2026-02-30")).toThrow();
  });
});