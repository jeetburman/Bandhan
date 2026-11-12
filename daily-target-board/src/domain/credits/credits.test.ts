import { describe, expect, it } from "vitest";
import {
  computeCredits,
  type CatalogProduct,
  type Credit,
  type Sale,
} from "./credits";

const toMap = (credits: Credit[]) =>
  Object.fromEntries(credits.map((c) => [c.metricCode, c.quantity]));

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  selectedOptions: {},
  units: 1,
  amountPaise: 0,
  ...overrides,
});

const savings: CatalogProduct = {
  code: "SAVINGS",
  isActive: true,
  credits: [
    { metricCode: "SA_COUNT", basis: "UNITS" },
    { metricCode: "CASA_VALUE", basis: "AMOUNT" },
  ],
  optionGroups: [
    {
      code: "VARIANT",
      isRequired: true,
      isActive: true,
      options: [
        { code: "ELITE", isActive: true, credits: [] },
        {
          code: "SB_LEGACY",
          isActive: true,
          credits: [{ metricCode: "AFFLUENT_LEGACY_COUNT", basis: "UNITS" }],
        },
        { code: "OLD_VARIANT", isActive: false, credits: [] },
      ],
    },
  ],
};

const current: CatalogProduct = {
  code: "CURRENT",
  isActive: true,
  credits: [
    { metricCode: "CA_COUNT", basis: "UNITS" },
    { metricCode: "CASA_VALUE", basis: "AMOUNT" },
  ],
  optionGroups: [],
};

const fixedDeposit: CatalogProduct = {
  code: "FIXED_DEPOSIT",
  isActive: true,
  credits: [{ metricCode: "FD_VALUE", basis: "AMOUNT" }],
  optionGroups: [
    {
      code: "SOURCE",
      isRequired: true,
      isActive: true,
      options: [
        { code: "FRESH", isActive: true, credits: [] },
        { code: "RENEWAL", isActive: true, credits: [] },
      ],
    },
    {
      code: "TYPE",
      isRequired: false,
      isActive: true,
      options: [{ code: "CUMULATIVE", isActive: true, credits: [] }],
    },
  ],
};

const card: CatalogProduct = {
  code: "CREDIT_CARD",
  isActive: true,
  credits: [{ metricCode: "CARD_COUNT", basis: "UNITS" }],
  optionGroups: [],
};

describe("computeCredits: crediting", () => {
  it("credits both the count and the CASA value for a savings account", () => {
    const credits = computeCredits(
      savings,
      sale({ selectedOptions: { VARIANT: "ELITE" }, amountPaise: 50_000_000 }),
    );
    expect(toMap(credits)).toEqual({ SA_COUNT: 1, CASA_VALUE: 50_000_000 });
  });

  it("also credits the branch Affluent Legacy target for a Legacy variant", () => {
    const credits = computeCredits(
      savings,
      sale({ selectedOptions: { VARIANT: "SB_LEGACY" }, amountPaise: 50_000_000 }),
    );
    expect(toMap(credits)).toEqual({
      SA_COUNT: 1,
      CASA_VALUE: 50_000_000,
      AFFLUENT_LEGACY_COUNT: 1,
    });
  });

  it("credits a Rs 6 lakh current account to both CA count and CASA value", () => {
    const credits = computeCredits(current, sale({ amountPaise: 60_000_000 }));
    expect(toMap(credits)).toEqual({ CA_COUNT: 1, CASA_VALUE: 60_000_000 });
  });

  it("credits several units at once", () => {
    const credits = computeCredits(
      savings,
      sale({ selectedOptions: { VARIANT: "ELITE" }, units: 3, amountPaise: 90_000_000 }),
    );
    expect(toMap(credits)).toEqual({ SA_COUNT: 3, CASA_VALUE: 90_000_000 });
  });

  it("counts an FD renewal towards the FD value", () => {
    const credits = computeCredits(
      fixedDeposit,
      sale({ selectedOptions: { SOURCE: "RENEWAL" }, amountPaise: 10_000_000_000 }),
    );
    expect(toMap(credits)).toEqual({ FD_VALUE: 10_000_000_000 });
  });

  it("allows an optional group to be left out", () => {
    expect(() =>
      computeCredits(
        fixedDeposit,
        sale({ selectedOptions: { SOURCE: "FRESH" }, amountPaise: 1_000_000 }),
      ),
    ).not.toThrow();
  });

  it("credits a card by count and ignores any amount", () => {
    const credits = computeCredits(card, sale({ amountPaise: 500_000 }));
    expect(toMap(credits)).toEqual({ CARD_COUNT: 1 });
  });

  it("lets an option's rule beat the product's rule, crediting the metric once", () => {
    const product: CatalogProduct = {
      code: "P",
      isActive: true,
      credits: [{ metricCode: "M", basis: "UNITS" }],
      optionGroups: [
        {
          code: "G",
          isRequired: true,
          isActive: true,
          options: [{ code: "O", isActive: true, credits: [{ metricCode: "M", basis: "AMOUNT" }] }],
        },
      ],
    };
    const credits = computeCredits(product, sale({ selectedOptions: { G: "O" }, amountPaise: 700 }));
    expect(credits).toEqual([{ metricCode: "M", quantity: 700 }]);
  });

  it("returns credits sorted by metric code", () => {
    const credits = computeCredits(
      savings,
      sale({ selectedOptions: { VARIANT: "SB_LEGACY" }, amountPaise: 1_000 }),
    );
    expect(credits.map((c) => c.metricCode)).toEqual([
      "AFFLUENT_LEGACY_COUNT",
      "CASA_VALUE",
      "SA_COUNT",
    ]);
  });
});

describe("computeCredits: invalid sales", () => {
  it("throws when a required option is missing", () => {
    expect(() => computeCredits(savings, sale({ amountPaise: 1_000 }))).toThrow();
  });

  it("throws on an unknown option group", () => {
    expect(() =>
      computeCredits(savings, sale({ selectedOptions: { VARIANT: "ELITE", COLOUR: "RED" }, amountPaise: 1_000 })),
    ).toThrow();
  });

  it("throws on an unknown option", () => {
    expect(() =>
      computeCredits(savings, sale({ selectedOptions: { VARIANT: "NOPE" }, amountPaise: 1_000 })),
    ).toThrow();
  });

  it("throws when the chosen option is no longer active", () => {
    expect(() =>
      computeCredits(savings, sale({ selectedOptions: { VARIANT: "OLD_VARIANT" }, amountPaise: 1_000 })),
    ).toThrow();
  });

  it("throws when the chosen option group is no longer active", () => {
    const retired: CatalogProduct = {
      ...savings,
      optionGroups: [{ ...savings.optionGroups[0], isActive: false }],
    };
    expect(() =>
      computeCredits(retired, sale({ selectedOptions: { VARIANT: "ELITE" }, amountPaise: 1_000 })),
    ).toThrow();
  });

  it("throws when the product is no longer active", () => {
    expect(() => computeCredits({ ...card, isActive: false }, sale())).toThrow();
  });

  it("throws when a value-based metric has no amount", () => {
    expect(() =>
      computeCredits(savings, sale({ selectedOptions: { VARIANT: "ELITE" }, amountPaise: 0 })),
    ).toThrow();
  });

  it("throws on zero, negative or fractional units", () => {
    expect(() => computeCredits(card, sale({ units: 0 }))).toThrow();
    expect(() => computeCredits(card, sale({ units: -1 }))).toThrow();
    expect(() => computeCredits(card, sale({ units: 1.5 }))).toThrow();
  });

  it("throws on a negative or fractional amount", () => {
    expect(() => computeCredits(current, sale({ amountPaise: -1 }))).toThrow();
    expect(() => computeCredits(current, sale({ amountPaise: 10.5 }))).toThrow();
  });

  it("throws when two chosen options disagree on how to credit a metric", () => {
    const product: CatalogProduct = {
      code: "P",
      isActive: true,
      credits: [],
      optionGroups: [
        {
          code: "A",
          isRequired: true,
          isActive: true,
          options: [{ code: "A1", isActive: true, credits: [{ metricCode: "M", basis: "UNITS" }] }],
        },
        {
          code: "B",
          isRequired: true,
          isActive: true,
          options: [{ code: "B1", isActive: true, credits: [{ metricCode: "M", basis: "AMOUNT" }] }],
        },
      ],
    };
    expect(() =>
      computeCredits(product, sale({ selectedOptions: { A: "A1", B: "B1" }, amountPaise: 100 })),
    ).toThrow();
  });
});