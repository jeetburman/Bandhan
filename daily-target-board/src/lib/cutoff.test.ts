import { describe, expect, it } from "vitest";
import { cutoffLabel, cutoffPassed } from "./cutoff";

describe("cutoffPassed", () => {
  it("is false one minute before 6:00 PM IST", () => {
    expect(cutoffPassed(new Date("2026-11-12T12:29:59Z"))).toBe(false);
  });

  it("is true at 6:00 PM IST exactly", () => {
    expect(cutoffPassed(new Date("2026-11-12T12:30:00Z"))).toBe(true);
  });

  it("stays true until IST midnight, then resets for the next day", () => {
    expect(cutoffPassed(new Date("2026-11-12T18:29:00Z"))).toBe(true); // 11:59 PM IST
    expect(cutoffPassed(new Date("2026-11-12T18:30:00Z"))).toBe(false); // 12:00 AM IST
  });

  it("is false in the morning", () => {
    expect(cutoffPassed(new Date("2026-11-12T04:00:00Z"))).toBe(false); // 9:30 AM IST
  });

  it("follows a different cut-off when given one", () => {
    expect(cutoffPassed(new Date("2026-11-12T12:00:00Z"), { hour: 17, minute: 30 })).toBe(true);
    expect(cutoffPassed(new Date("2026-11-12T11:59:00Z"), { hour: 17, minute: 30 })).toBe(false);
  });

  it("throws on an invalid date", () => {
    expect(() => cutoffPassed(new Date("nonsense"))).toThrow();
  });
});

describe("cutoffLabel", () => {
  it("reads naturally", () => {
    expect(cutoffLabel()).toBe("6:00 PM");
    expect(cutoffLabel({ hour: 9, minute: 30 })).toBe("9:30 AM");
    expect(cutoffLabel({ hour: 0, minute: 0 })).toBe("12:00 AM");
    expect(cutoffLabel({ hour: 12, minute: 5 })).toBe("12:05 PM");
  });
});