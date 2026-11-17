import { describe, expect, it } from "vitest";
import { formatRupeesPlain, parseRupeesToPaise } from "./rupees";

describe("formatRupeesPlain", () => {
  it("groups in lakhs and crores without a currency sign", () => {
    expect(formatRupeesPlain(500_000_000)).toBe("50,00,000");
    expect(formatRupeesPlain(10_000_000_000)).toBe("10,00,00,000");
  });

  it("shows paise only when there are any", () => {
    expect(formatRupeesPlain(5_000_050)).toBe("50,000.50");
    expect(formatRupeesPlain(0)).toBe("0");
  });

  it("round-trips through the parser", () => {
    for (const paise of [0, 100, 150, 5_000_050, 500_000_000, 10_000_000_000]) {
      expect(parseRupeesToPaise(formatRupeesPlain(paise))).toBe(paise);
    }
  });

  it("rejects a negative or fractional amount of paise", () => {
    expect(() => formatRupeesPlain(-1)).toThrow();
    expect(() => formatRupeesPlain(1.5)).toThrow();
  });
});