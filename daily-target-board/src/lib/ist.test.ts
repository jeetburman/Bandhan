import { describe, expect, it } from "vitest";
import { istBusinessDate } from "./ist";

describe("istBusinessDate", () => {
  it("is still the same day one second before IST midnight", () => {
    expect(istBusinessDate(new Date("2026-11-12T18:29:59Z"))).toBe("2026-11-12");
  });

  it("rolls to the next day at IST midnight", () => {
    expect(istBusinessDate(new Date("2026-11-12T18:30:00Z"))).toBe("2026-11-13");
  });

  it("is the same day for early-morning UTC", () => {
    expect(istBusinessDate(new Date("2026-11-12T00:00:00Z"))).toBe("2026-11-12");
  });

  it("crosses a month boundary", () => {
    expect(istBusinessDate(new Date("2026-11-30T19:00:00Z"))).toBe("2026-12-01");
  });

  it("throws on an invalid date", () => {
    expect(() => istBusinessDate(new Date("nonsense"))).toThrow();
  });
});