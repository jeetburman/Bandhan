import { describe, expect, it } from "vitest";
import { holidayImpact } from "./impact";
import type { CalendarConfig } from "./types";

// Bhai Phota (Wed 11) and Guru Nanak Jayanti (Tue 24)
const NOV: CalendarConfig = {
  weeklyOffDays: [0],
  offSaturdays: [2, 4],
  holidays: new Set(["2026-11-11", "2026-11-24"]),
};

describe("holidayImpact", () => {
  it("removes one working day when a working day becomes a holiday", () => {
    // 18, 19, 20, 21, 23, 25, 26, 27 and 30 Nov are working days.
    expect(holidayImpact("2026-11-18", "2026-11-30", NOV)).toEqual({ before: 9, after: 8 });
  });

  it("changes nothing for a date that is already a holiday", () => {
    expect(holidayImpact("2026-11-24", "2026-11-30", NOV)).toEqual({ before: 4, after: 4 });
  });

  it("changes nothing for a Sunday", () => {
    expect(holidayImpact("2026-11-15", "2026-11-30", NOV)).toEqual({ before: 11, after: 11 });
  });

  it("can take away the last working day of the month", () => {
    expect(holidayImpact("2026-11-30", "2026-11-30", NOV)).toEqual({ before: 1, after: 0 });
  });

  it("is zero when the date is after the end of the range", () => {
    expect(holidayImpact("2026-12-01", "2026-11-30", NOV)).toEqual({ before: 0, after: 0 });
  });

  it("does not change the calendar it was given", () => {
    const before = [...NOV.holidays];
    holidayImpact("2026-11-18", "2026-11-30", NOV);
    expect([...NOV.holidays]).toEqual(before);
  });
});