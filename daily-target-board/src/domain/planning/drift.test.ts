import { describe, expect, it } from "vitest";
import { calendarDrift } from "./drift";

describe("calendarDrift", () => {
  it("is not stale when the holidays match", () => {
    expect(calendarDrift(["2026-11-11", "2026-11-24"], ["2026-11-11", "2026-11-24"])).toEqual({
      added: [],
      removed: [],
      stale: false,
    });
  });

  it("is not stale when there are no holidays on either side", () => {
    expect(calendarDrift([], []).stale).toBe(false);
  });

  it("reports an added holiday", () => {
    expect(calendarDrift(["2026-11-11"], ["2026-11-11", "2026-11-18"])).toEqual({
      added: ["2026-11-18"],
      removed: [],
      stale: true,
    });
  });

  it("reports a removed holiday", () => {
    expect(calendarDrift(["2026-11-11", "2026-11-24"], ["2026-11-11"])).toEqual({
      added: [],
      removed: ["2026-11-24"],
      stale: true,
    });
  });

  it("reports an added and a removed holiday together", () => {
    const drift = calendarDrift(["2026-11-11"], ["2026-11-18"]);
    expect(drift.added).toEqual(["2026-11-18"]);
    expect(drift.removed).toEqual(["2026-11-11"]);
    expect(drift.stale).toBe(true);
  });

  it("ignores order and duplicates", () => {
    expect(
      calendarDrift(["2026-11-24", "2026-11-11"], ["2026-11-11", "2026-11-24", "2026-11-11"]).stale,
    ).toBe(false);
  });
});