export type CreditBasis = "UNITS" | "AMOUNT";

export interface CreditRule {
  metricCode: string;
  basis: CreditBasis;
}

export interface CatalogOption {
  code: string;
  isActive: boolean;
  credits: CreditRule[];
}

export interface CatalogOptionGroup {
  code: string;
  isRequired: boolean;
  isActive: boolean;
  options: CatalogOption[];
}

export interface CatalogProduct {
  code: string;
  isActive: boolean;
  credits: CreditRule[];
  optionGroups: CatalogOptionGroup[];
}

export interface Sale {
  /** Chosen option per group: { VARIANT: "ELITE", SOURCE: "RENEWAL" } */
  selectedOptions: Readonly<Record<string, string>>;
  /** Number of items sold. At least 1. */
  units: number;
  /** Sale amount in paise. 0 when the product has no amount. */
  amountPaise: number;
}

export interface Credit {
  metricCode: string;
  /** Items for a UNITS credit, paise for an AMOUNT credit. Always above 0. */
  quantity: number;
}

/**
 * Work out which metrics a sale credits, and by how much.
 *
 * - A product credits its own metrics. A chosen option can credit more.
 * - If a product and an option credit the same metric, the option's rule wins and the
 *   metric is credited once. Two options that disagree on the same metric is a
 *   catalogue mistake and throws.
 * - A UNITS credit is worth `units`. An AMOUNT credit is worth `amountPaise`, which
 *   must then be above 0.
 * - Results are sorted by metric code so the output is stable.
 *
 * The caller stores the result with the entry, so later catalogue edits never rewrite history.
 */
export function computeCredits(product: CatalogProduct, sale: Sale): Credit[] {
  if (!product.isActive) {
    throw new Error(`Product ${product.code} is no longer available`);
  }
  if (!Number.isInteger(sale.units) || sale.units < 1) {
    throw new Error(`Units must be a whole number of at least 1, got ${sale.units}`);
  }
  if (!Number.isInteger(sale.amountPaise) || sale.amountPaise < 0) {
    throw new Error(`Amount must be a non-negative whole number of paise, got ${sale.amountPaise}`);
  }

  const groupCodes = new Set(product.optionGroups.map((group) => group.code));
  for (const chosenGroup of Object.keys(sale.selectedOptions)) {
    if (!groupCodes.has(chosenGroup)) {
      throw new Error(`Product ${product.code} has no option group "${chosenGroup}"`);
    }
  }

  // Start from the product's own rules.
  const rules = new Map<string, CreditBasis>();
  for (const rule of product.credits) {
    rules.set(rule.metricCode, rule.basis);
  }

  // Collect rules from the chosen options.
  const optionRules = new Map<string, CreditBasis>();
  for (const group of product.optionGroups) {
    const chosenCode = sale.selectedOptions[group.code];

    if (chosenCode === undefined) {
      if (group.isRequired && group.isActive) {
        throw new Error(`Please choose a value for "${group.code}"`);
      }
      continue;
    }

    if (!group.isActive) {
      throw new Error(`Option group "${group.code}" is no longer available`);
    }
    const option = group.options.find((candidate) => candidate.code === chosenCode);
    if (!option) {
      throw new Error(`"${chosenCode}" is not an option of "${group.code}"`);
    }
    if (!option.isActive) {
      throw new Error(`Option "${chosenCode}" is no longer available`);
    }

    for (const rule of option.credits) {
      const existing = optionRules.get(rule.metricCode);
      if (existing !== undefined && existing !== rule.basis) {
        throw new Error(`Chosen options disagree on how to credit ${rule.metricCode}`);
      }
      optionRules.set(rule.metricCode, rule.basis);
    }
  }

  // Option rules override product rules for the same metric.
  for (const [metricCode, basis] of optionRules) {
    rules.set(metricCode, basis);
  }

  const credits: Credit[] = [];
  for (const [metricCode, basis] of rules) {
    const quantity = basis === "UNITS" ? sale.units : sale.amountPaise;
    if (quantity === 0) {
      throw new Error(`An amount is required: ${metricCode} is credited by value`);
    }
    credits.push({ metricCode, quantity });
  }

  return credits.sort((a, b) => (a.metricCode < b.metricCode ? -1 : a.metricCode > b.metricCode ? 1 : 0));
}