import { describe, expect, it } from "vitest";
import { parseRupeesToPaise } from "./rupees";

describe("parseRupeesToPaise", () => {
  it("reads whole rupees, with or without commas", () => {
    expect(parseRupeesToPaise("50000")).toBe(5_000_000);
    expect(parseRupeesToPaise("50,000")).toBe(5_000_000);
    expect(parseRupeesToPaise("1,00,000")).toBe(10_000_000);
  });

  it("reads paise", () => {
    expect(parseRupeesToPaise("50,000.50")).toBe(5_000_050);
    expect(parseRupeesToPaise("0.5")).toBe(50);
    expect(parseRupeesToPaise("12.05")).toBe(1_205);
  });

  it("accepts a rupee sign and surrounding spaces", () => {
    expect(parseRupeesToPaise("₹ 2,500 ")).toBe(250_000);
  });

  it("treats an empty box as zero", () => {
    expect(parseRupeesToPaise("")).toBe(0);
    expect(parseRupeesToPaise("   ")).toBe(0);
  });

  it("rejects anything else", () => {
    expect(() => parseRupeesToPaise("abc")).toThrow();
    expect(() => parseRupeesToPaise("-5")).toThrow();
    expect(() => parseRupeesToPaise("1.234")).toThrow();
    expect(() => parseRupeesToPaise(".50")).toThrow();
    expect(() => parseRupeesToPaise("1e5")).toThrow();
  });

  it("rejects an absurdly large amount", () => {
    expect(() => parseRupeesToPaise("999999999999")).toThrow();
  });
});