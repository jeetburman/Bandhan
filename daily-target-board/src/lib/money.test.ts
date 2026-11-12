import { describe, expect, it } from "vitest";
import { formatQty, formatRupees } from "./money";

describe("formatRupees", () => {
  it("uses lakh and crore grouping", () => {
    expect(formatRupees(500_000_000)).toBe("₹50,00,000");
    expect(formatRupees(130_000_000)).toBe("₹13,00,000");
    expect(formatRupees(4_000_000)).toBe("₹40,000");
    expect(formatRupees(10_000_000_000)).toBe("₹10,00,00,000");
  });

  it("shows paise only when there are any", () => {
    expect(formatRupees(23_809_524)).toBe("₹2,38,095.24");
    expect(formatRupees(150)).toBe("₹1.50");
    expect(formatRupees(100)).toBe("₹1");
    expect(formatRupees(0)).toBe("₹0");
  });

  it("rejects fractions of a paisa", () => {
    expect(() => formatRupees(1.5)).toThrow();
  });
});

describe("formatQty", () => {
  it("prints counts plainly and amounts as rupees", () => {
    expect(formatQty("COUNT", 7)).toBe("7");
    expect(formatQty("AMOUNT", 4_000_000)).toBe("₹40,000");
  });
});