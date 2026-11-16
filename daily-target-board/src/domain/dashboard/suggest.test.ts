import { describe, expect, it } from "vitest";
import type { CalendarConfig } from "../calendar/types";
import { firstPlanningDay, suggestFor, type SuggestInput } from "./suggest";

// Bhai Phota (Wed 11) and Guru Nanak Jayanti (Tue 24)
const NOV: CalendarConfig = {
  weeklyOffDays: [0],
  offSaturdays: [2, 4],
  holidays: new Set(["2026-11-11", "2026-11-24"]),
};

const base: SuggestInput = {
  month: "2026-11",
  today: "2026-11-10", // a Tuesday
  cutoffPassed: false,
  calendar: NOV,
  pacing: "DAILY",
  needed: 14,
};

describe("firstPlanningDay", () => {
  it("is today while the day is open", () => {
    expect(firstPlanningDay("2026-11-10", false, NOV)).toBe("2026-11-10");
  });

  it("is the next working day once the cut-off has passed", () => {
    expect(firstPlanningDay("2026-11-10", true, NOV)).toBe("2026-11-12"); // the 11th is a holiday
  });

  it("skips a holiday, a weekly off and a closed Saturday", () => {
    expect(firstPlanningDay("2026-11-11", false, NOV)).toBe("2026-11-12");
    expect(firstPlanningDay("2026-11-15", false, NOV)).toBe("2026-11-16");
    expect(firstPlanningDay("2026-11-13", true, NOV)).toBe("2026-11-16");
  });
});

describe("suggestFor: daily", () => {
  it("spreads what is left over the working days that remain", () => {
    expect(suggestFor(base)).toEqual({
      needed: 14,
      workingDaysLeft: 14,
      fromDate: "2026-11-10",
      startsToday: true,
      dayQty: 1,
      weekQty: 3, // the 10th, 12th and 13th
      weekDueDate: "2026-11-13",
      dueDate: "2026-11-30",
    });
  });

  it("rises when more is left, which is what falling behind looks like", () => {
    expect(suggestFor({ ...base, needed: 14 }).dayQty).toBe(1);
    expect(suggestFor({ ...base, needed: 28 }).dayQty).toBe(2);
    expect(suggestFor({ ...base, needed: 42 }).dayQty).toBe(3);
    expect(suggestFor({ ...base, needed: 28 }).weekQty).toBe(6);
  });

  it("gives the leftover units to the earliest days", () => {
    const s = suggestFor({ ...base, needed: 21 });
    expect(s.dayQty).toBe(2);
    expect(s.weekQty).toBe(6);
  });

  it("starts from the next working day once the cut-off has passed", () => {
    const s = suggestFor({ ...base, needed: 13, cutoffPassed: true });
    expect(s.fromDate).toBe("2026-11-12");
    expect(s.startsToday).toBe(false);
    expect(s.workingDaysLeft).toBe(13);
    expect(s.dayQty).toBe(1);
    expect(s.weekQty).toBe(2); // the 12th and 13th
  });

  it("starts from the next working day when today is a holiday or weekly off", () => {
    expect(suggestFor({ ...base, today: "2026-11-11" }).fromDate).toBe("2026-11-12");
    const sunday = suggestFor({ ...base, today: "2026-11-15" });
    expect(sunday.fromDate).toBe("2026-11-16");
    expect(sunday.startsToday).toBe(false);
  });

  it("puts everything on the last working day when only one is left", () => {
    const s = suggestFor({ ...base, today: "2026-11-30", needed: 5 });
    expect(s).toMatchObject({ workingDaysLeft: 1, dayQty: 5, weekQty: 5, weekDueDate: "2026-11-30" });
  });

  it("suggests nothing when nothing is needed", () => {
    expect(suggestFor({ ...base, needed: 0 })).toMatchObject({ dayQty: 0, weekQty: 0 });
  });
});

describe("suggestFor: weekly and monthly", () => {
  it("gives a weekly target a figure for the week and none for the day", () => {
    const s = suggestFor({ ...base, today: "2026-11-02", pacing: "WEEKLY", needed: 7 });
    expect(s).toMatchObject({ dayQty: null, weekQty: 2, weekDueDate: "2026-11-07", dueDate: "2026-11-30" });
  });

  it("clips the first week when the month is already under way", () => {
    // From the 10th the weeks hold 3, 6, 4 and 1 working days.
    const s = suggestFor({ ...base, pacing: "WEEKLY", needed: 3 });
    expect(s).toMatchObject({ weekQty: 1, weekDueDate: "2026-11-13" });
  });

  it("gives a monthly target only a due date", () => {
    const s = suggestFor({ ...base, pacing: "MONTHLY", needed: 5 });
    expect(s).toMatchObject({
      needed: 5,
      dayQty: null,
      weekQty: null,
      weekDueDate: null,
      dueDate: "2026-11-30",
    });
  });
});

describe("suggestFor: edges", () => {
  it("reports no working days left at the end of the month", () => {
    expect(suggestFor({ ...base, today: "2026-11-30", cutoffPassed: true, needed: 4 })).toEqual({
      needed: 4,
      workingDaysLeft: 0,
      fromDate: null,
      startsToday: false,
      dayQty: null,
      weekQty: null,
      weekDueDate: null,
      dueDate: null,
    });
  });

  it("throws on a negative or fractional need", () => {
    expect(() => suggestFor({ ...base, needed: -1 })).toThrow();
    expect(() => suggestFor({ ...base, needed: 1.5 })).toThrow();
  });
});