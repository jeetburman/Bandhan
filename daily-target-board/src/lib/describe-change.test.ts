import { describe, expect, it } from "vitest";
import { describeChange } from "./describe-change";

describe("describeChange", () => {
  it("shows what an amount was and how far it moved", () => {
    expect(
      describeChange("AMOUNT", { kind: "CHANGED", previousTotal: 500_000_000, delta: 20_000_000 }, "Thu 12 Nov"),
    ).toBe("Changed on Thu 12 Nov: was ₹50,00,000 (+₹2,00,000)");
  });

  it("shows a cut with a minus sign", () => {
    expect(
      describeChange("AMOUNT", { kind: "CHANGED", previousTotal: 500_000_000, delta: -50_000_000 }, "Fri 13 Nov"),
    ).toBe("Changed on Fri 13 Nov: was ₹50,00,000 (−₹5,00,000)");
  });

  it("shows counts as plain numbers", () => {
    expect(describeChange("COUNT", { kind: "CHANGED", previousTotal: 7, delta: 3 }, "Thu 12 Nov")).toBe(
      "Changed on Thu 12 Nov: was 7 (+3)",
    );
  });

  it("describes a brand-new target", () => {
    expect(describeChange("COUNT", { kind: "NEW", previousTotal: 0, delta: 2 }, "Thu 12 Nov")).toBe(
      "New target added on Thu 12 Nov",
    );
  });
});