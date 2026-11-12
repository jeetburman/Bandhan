import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  METRICS,
  PRODUCTS,
  type CreditRuleSeed,
  type ProductSeed,
} from "../../../prisma/catalog-data";
import { computeCredits, type CatalogProduct } from "./credits";

const hasDuplicates = (codes: string[]) => new Set(codes).size !== codes.length;
const metricCodes = new Set(METRICS.map((m) => m.code));

const allCreditRules = (): CreditRuleSeed[] =>
  PRODUCTS.flatMap((p) => [
    ...p.credits,
    ...(p.groups ?? []).flatMap((g) => g.options.flatMap((o) => o.credits ?? [])),
  ]);

const toCatalogProduct = (p: ProductSeed): CatalogProduct => ({
  code: p.code,
  isActive: true,
  credits: p.credits,
  optionGroups: (p.groups ?? []).map((g) => ({
    code: g.code,
    isRequired: g.isRequired ?? true,
    isActive: true,
    options: g.options.map((o) => ({ code: o.code, isActive: true, credits: o.credits ?? [] })),
  })),
});

describe("catalogue data", () => {
  it("has unique metric, category and product codes", () => {
    expect(hasDuplicates(METRICS.map((m) => m.code))).toBe(false);
    expect(hasDuplicates(CATEGORIES.map((c) => c.code))).toBe(false);
    expect(hasDuplicates(PRODUCTS.map((p) => p.code))).toBe(false);
  });

  it("has unique group codes within a product and option codes within a group", () => {
    for (const p of PRODUCTS) {
      expect(hasDuplicates((p.groups ?? []).map((g) => g.code))).toBe(false);
      for (const g of p.groups ?? []) {
        expect(hasDuplicates(g.options.map((o) => o.code))).toBe(false);
      }
    }
  });

  it("puts every product in a known category", () => {
    const categoryCodes = new Set(CATEGORIES.map((c) => c.code));
    for (const p of PRODUCTS) {
      expect(categoryCodes.has(p.category)).toBe(true);
    }
  });

  it("only credits metrics that exist", () => {
    for (const rule of allCreditRules()) {
      expect(metricCodes.has(rule.metricCode)).toBe(true);
    }
  });

  it("gives every product at least one credit", () => {
    for (const p of PRODUCTS) {
      expect(p.credits.length).toBeGreaterThan(0);
    }
  });

  it("keeps Affluent Legacy as a monthly branch target", () => {
    const metric = METRICS.find((m) => m.code === "AFFLUENT_LEGACY_COUNT");
    expect(metric).toMatchObject({ scope: "BRANCH", pacing: "MONTHLY", unit: "COUNT" });
  });

  it("can compute credits for the first option of every group of every product", () => {
    for (const p of PRODUCTS) {
      const selectedOptions = Object.fromEntries(
        (p.groups ?? []).map((g) => [g.code, g.options[0].code]),
      );
      const credits = computeCredits(toCatalogProduct(p), {
        selectedOptions,
        units: 1,
        amountPaise: 100_000,
      });
      expect(credits.length).toBeGreaterThan(0);
      for (const credit of credits) {
        expect(metricCodes.has(credit.metricCode)).toBe(true);
      }
    }
  });
});