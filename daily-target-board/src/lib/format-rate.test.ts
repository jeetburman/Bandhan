import { describe, expect, it } from "vitest";
import { formatRate } from "./format-rate";

describe("formatRate", () => {
  it("shows an amount as whole rupees with lakh grouping", () => {
    expect(formatRate("AMOUNT", 23_809_524)).toBe("₹2,38,095 a day");
    expect(formatRate("AMOUNT", 0)).toBe("₹0 a day");
  });

  it("shows small counts with decimals and large ones without", () => {
    expect(formatRate("COUNT", 0.3333)).toBe("0.33 a day");
    expect(formatRate("COUNT", 2.5)).toBe("2.5 a day");
    expect(formatRate("COUNT", 12.4)).toBe("12 a day");
    expect(formatRate("COUNT", 1)).toBe("1 a day");
    expect(formatRate("COUNT", 0)).toBe("0 a day");
  });

  it("rejects a negative or non-numeric rate", () => {
    expect(() => formatRate("COUNT", -1)).toThrow();
    expect(() => formatRate("COUNT", Number.NaN)).toThrow();
    expect(() => formatRate("AMOUNT", Number.POSITIVE_INFINITY)).toThrow();
  });
});