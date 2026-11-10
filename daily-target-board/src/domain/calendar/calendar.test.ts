import { describe, expect, it } from "vitest";
import { addDays, isWorkingDay, nextWorkingDay, workingDaysInRange } from "./calendar";
import type { CalendarConfig } from "./types";

const bankWeek: CalendarConfig = {
  weeklyOffDays: [0],
  offSaturdays: [2, 4],
  holidays: new Set(),
};

const withHolidays = (...dates: string[]): CalendarConfig => ({
  ...bankWeek,
  holidays: new Set(dates),
});

// Bhai Phota (Wed 11) and Guru Nanak Jayanti (Tue 24)
const NOV_HOLIDAYS = withHolidays("2026-11-11", "2026-11-24");

describe("isWorkingDay", () => {
  it("treats Sunday as off", () => {
    expect(isWorkingDay("2026-11-01", bankWeek)).toBe(false);
    expect(isWorkingDay("2026-11-08", bankWeek)).toBe(false);
  });

  it("treats a normal weekday as working", () => {
    expect(isWorkingDay("2026-11-10", bankWeek)).toBe(true);
  });

  it("works on the 1st and 3rd Saturdays", () => {
    expect(isWorkingDay("2026-11-07", bankWeek)).toBe(true);
    expect(isWorkingDay("2026-11-21", bankWeek)).toBe(true);
  });

  it("is off on the 2nd and 4th Saturdays", () => {
    expect(isWorkingDay("2026-11-14", bankWeek)).toBe(false);
    expect(isWorkingDay("2026-11-28", bankWeek)).toBe(false);
  });

  it("works on a 5th Saturday", () => {
    expect(isWorkingDay("2026-10-31", bankWeek)).toBe(true);
  });

  it("is off on a listed holiday, but only when it is listed", () => {
    expect(isWorkingDay("2026-11-11", NOV_HOLIDAYS)).toBe(false);
    expect(isWorkingDay("2026-11-11", bankWeek)).toBe(true);
  });

  it("stays off when a holiday falls on a Sunday", () => {
    expect(isWorkingDay("2026-11-15", withHolidays("2026-11-15"))).toBe(false);
  });

  it("follows the config rather than hard-coded rules", () => {
    const allSaturdaysOff: CalendarConfig = {
      weeklyOffDays: [0, 6],
      offSaturdays: [],
      holidays: new Set(),
    };
    expect(isWorkingDay("2026-11-07", allSaturdaysOff)).toBe(false);
  });

  it("throws on invalid date strings", () => {
    expect(() => isWorkingDay("2026-02-30", bankWeek)).toThrow();
    expect(() => isWorkingDay("2026-13-01", bankWeek)).toThrow();
    expect(() => isWorkingDay("26-11-10", bankWeek)).toThrow();
  });
});

describe("addDays", () => {
  it("returns the same date for zero", () => {
    expect(addDays("2026-11-10", 0)).toBe("2026-11-10");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-10", 21)).toBe("2026-12-01");
  });

  it("handles leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("subtracts for negative numbers", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("nextWorkingDay", () => {
  it("goes from Friday to Monday", () => {
    expect(nextWorkingDay("2026-11-13", bankWeek)).toBe("2026-11-16");
  });

  it("skips a holiday", () => {
    expect(nextWorkingDay("2026-11-10", NOV_HOLIDAYS)).toBe("2026-11-12");
  });

  it("skips an off Saturday and a Sunday together", () => {
    expect(nextWorkingDay("2026-11-27", bankWeek)).toBe("2026-11-30");
  });

  it("is strictly after the given date, even if that date is a working day", () => {
    expect(nextWorkingDay("2026-11-21", bankWeek)).toBe("2026-11-23");
  });

  it("works when starting from a non-working day", () => {
    expect(nextWorkingDay("2026-11-15", bankWeek)).toBe("2026-11-16");
  });

  it("skips a holiday that sits right after a weekend", () => {
    expect(nextWorkingDay("2026-11-13", withHolidays("2026-11-16"))).toBe("2026-11-17");
  });

  it("throws instead of looping forever if every day is off", () => {
    const neverOpen: CalendarConfig = {
      weeklyOffDays: [0, 1, 2, 3, 4, 5, 6],
      offSaturdays: [],
      holidays: new Set(),
    };
    expect(() => nextWorkingDay("2026-11-10", neverOpen)).toThrow();
  });
});

describe("workingDaysInRange", () => {
  it("counts 23 working days in November 2026 with no holidays", () => {
    expect(workingDaysInRange("2026-11-01", "2026-11-30", bankWeek)).toHaveLength(23);
  });

  it("counts 21 once the two festival holidays are added", () => {
    const days = workingDaysInRange("2026-11-01", "2026-11-30", NOV_HOLIDAYS);
    expect(days).toHaveLength(21);
    expect(days).not.toContain("2026-11-11");
    expect(days).not.toContain("2026-11-24");
  });

  it("counts 14 remaining days from 10 Nov, including today", () => {
    const days = workingDaysInRange("2026-11-10", "2026-11-30", NOV_HOLIDAYS);
    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2026-11-10");
    expect(days[days.length - 1]).toBe("2026-11-30");
  });

  it("includes both endpoints when they are working days", () => {
    expect(workingDaysInRange("2026-11-10", "2026-11-10", bankWeek)).toEqual(["2026-11-10"]);
  });

  it("returns an empty list for a single non-working day", () => {
    expect(workingDaysInRange("2026-11-15", "2026-11-15", bankWeek)).toEqual([]);
  });

  it("returns an empty list when start is after end", () => {
    expect(workingDaysInRange("2026-11-20", "2026-11-10", bankWeek)).toEqual([]);
  });

  it("returns dates in ascending order", () => {
    expect(workingDaysInRange("2026-11-12", "2026-11-17", NOV_HOLIDAYS)).toEqual([
      "2026-11-12",
      "2026-11-13",
      "2026-11-16",
      "2026-11-17",
    ]);
  });

  it("works across a month boundary", () => {
    expect(workingDaysInRange("2026-11-27", "2026-12-02", bankWeek)).toEqual([
      "2026-11-27",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
  });
});