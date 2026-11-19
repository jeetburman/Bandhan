import { describe, expect, it } from "vitest";
import { parseTargetText } from "./parse-target";

describe("parseTargetText", () => {
  it("reads counts, with or without commas, and an empty box as zero", () => {
    expect(parseTargetText("COUNT", "7")).toBe(7);
    expect(parseTargetText("COUNT", " 1,200 ")).toBe(1200);
    expect(parseTargetText("COUNT", "")).toBe(0);
  });

  it("rejects anything that is not a whole number for a count", () => {
    for (const bad of ["abc", "-1", "1.5", "1e3", "9999999"]) {
      expect(() => parseTargetText("COUNT", bad)).toThrow();
    }
  });

  it("reads amounts in rupees as paise", () => {
    expect(parseTargetText("AMOUNT", "50,00,000")).toBe(500_000_000);
    expect(parseTargetText("AMOUNT", "50,000.50")).toBe(5_000_050);
    expect(parseTargetText("AMOUNT", "")).toBe(0);
  });

  it("rejects a bad amount", () => {
    expect(() => parseTargetText("AMOUNT", "lots")).toThrow();
  });
});