export type Basis = "UNITS" | "AMOUNT";

export interface CreditRuleSeed {
  metricCode: string;
  basis: Basis;
}

export interface MetricSeed {
  code: string;
  name: string;
  unit: "COUNT" | "AMOUNT";
  scope: "INDIVIDUAL" | "BRANCH";
  pacing: "DAILY" | "WEEKLY" | "MONTHLY";
}

export interface CategorySeed {
  code: string;
  name: string;
}

export interface OptionSeed {
  code: string;
  name: string;
  /** Only used to group options in a dropdown, e.g. "Retail" or "Salary". */
  section?: string;
  /** Extra metrics this option credits, on top of the product's own. */
  credits?: CreditRuleSeed[];
}

export interface OptionGroupSeed {
  code: string;
  name: string;
  isRequired?: boolean; // defaults to true
  options: OptionSeed[];
}

export interface ProductSeed {
  code: string;
  name: string;
  /** Category code. */
  category: string;
  /** Metrics credited by any sale of this product. */
  credits: CreditRuleSeed[];
  groups?: OptionGroupSeed[];
}

const units = (metricCode: string): CreditRuleSeed => ({ metricCode, basis: "UNITS" });
const amount = (metricCode: string): CreditRuleSeed => ({ metricCode, basis: "AMOUNT" });

const variants = (section: string, items: [code: string, name: string][]): OptionSeed[] =>
  items.map(([code, name]) => ({ code, name, section }));

export const METRICS: MetricSeed[] = [
  { code: "FD_VALUE", name: "Fixed deposit value", unit: "AMOUNT", scope: "INDIVIDUAL", pacing: "DAILY" },
  { code: "SA_COUNT", name: "Savings accounts", unit: "COUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "CA_COUNT", name: "Current accounts", unit: "COUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "CASA_VALUE", name: "CASA value", unit: "AMOUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "LOAN_VALUE", name: "Loan value", unit: "AMOUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "CARD_COUNT", name: "Credit cards", unit: "COUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "LIFE_INSURANCE_VALUE", name: "Life insurance premium", unit: "AMOUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "GENERAL_INSURANCE_VALUE", name: "General insurance premium", unit: "AMOUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "MF_VALUE", name: "Mutual fund value", unit: "AMOUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "SIP_COUNT", name: "SIPs", unit: "COUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  { code: "DEMAT_COUNT", name: "Demat accounts", unit: "COUNT", scope: "INDIVIDUAL", pacing: "WEEKLY" },
  // One shared target for the whole branch: a sale by anyone in the branch credits it.
  { code: "AFFLUENT_LEGACY_COUNT", name: "Affluent Legacy accounts", unit: "COUNT", scope: "BRANCH", pacing: "MONTHLY" },
];

export const CATEGORIES: CategorySeed[] = [
  { code: "ACCOUNTS", name: "Accounts" },
  { code: "DEPOSITS", name: "Deposits" },
  { code: "LOANS", name: "Loans" },
  { code: "CARDS", name: "Cards" },
  { code: "INSURANCE_INVESTMENTS", name: "Insurance & investments" },
];

const loan = (code: string, name: string, groups?: OptionGroupSeed[]): ProductSeed => ({
  code,
  name,
  category: "LOANS",
  credits: [amount("LOAN_VALUE")],
  groups,
});

export const PRODUCTS: ProductSeed[] = [
  // ---------- Accounts ----------
  {
    code: "SAVINGS",
    name: "Savings account",
    category: "ACCOUNTS",
    credits: [units("SA_COUNT"), amount("CASA_VALUE")],
    groups: [
      {
        code: "VARIANT",
        name: "Variant",
        options: [
          // Legacy variants also count towards the branch's Affluent Legacy target.
          // If the NRI Legacy variant should count too, add the same credit to it below.
          {
            code: "SB_LEGACY",
            name: "SB-Legacy",
            section: "Retail",
            credits: [units("AFFLUENT_LEGACY_COUNT")],
          },
          ...variants("Retail", [
            ["ELITE_PLUS", "Elite Plus"],
            ["ELITE", "Elite"],
            ["PREMIUM", "Premium"],
            ["AVNI", "Avni"],
            ["ADVANTAGE", "Advantage"],
            ["CLASSIC", "Classic"],
            ["STANDARD", "Standard"],
            ["DIGI_REGULAR", "Digi Regular"],
            ["SANCHAY", "Sanchay"],
          ]),
          ...variants("Other", [
            ["NEO_PLUS", "Neo+ Digital"],
            ["SPECIAL", "Special"],
            ["PENSION", "Pension"],
            ["PMJDY", "PMJDY"],
            ["BSBDA", "BSBDA"],
            ["BSBDA_SMALL", "BSBDA Small"],
          ]),
          ...variants("Salary", [
            ["SHAURYA", "Shaurya"],
            ["SHAURYA_ELITE", "Shaurya Elite"],
            ["GOVT_SALARY", "Government Salary"],
            ["PREMIUM_SALARY", "Premium Salary"],
          ]),
          ...variants("NRI", [
            ["NRI_LEGACY", "Legacy (NRI)"],
            ["NRI_ELITE_PLUS", "Elite Plus (NRI)"],
            ["NRI_ELITE", "Elite (NRI)"],
            ["NRI_PREMIUM", "Premium (NRI)"],
            ["NRI_STANDARD", "Standard (NRI)"],
          ]),
        ],
      },
    ],
  },
  {
    code: "CURRENT",
    name: "Current account",
    category: "ACCOUNTS",
    credits: [units("CA_COUNT"), amount("CASA_VALUE")],
    groups: [
      {
        code: "VARIANT",
        name: "Variant",
        options: [
          ...variants("Business", [
            ["BIZ_ELITE", "Biz Elite"],
            ["BIZ_PREMIUM", "Biz Premium"],
            ["BIZ_ADVANTAGE", "Biz Advantage"],
            ["BIZ_STANDARD", "Biz Standard"],
            ["SEL", "SEL"],
            ["BIZ_DELUXE", "Biz Deluxe"],
            ["BIZ_PRO", "Biz Pro"],
            ["STARTUP_CA", "Startup CA"],
          ]),
          ...variants("Special", [
            ["TASC", "TASC"],
            ["GOS", "GOS"],
            ["BANKS", "Banks"],
          ]),
        ],
      },
    ],
  },

  // ---------- Deposits ----------
  {
    code: "FIXED_DEPOSIT",
    name: "Fixed deposit",
    category: "DEPOSITS",
    credits: [amount("FD_VALUE")],
    groups: [
      {
        code: "SIZE",
        name: "Size",
        options: [
          { code: "BULK", name: "Bulk FD (above ₹3 crore)" },
          { code: "RETAIL", name: "Retail FD (below ₹3 crore)" },
        ],
      },
      {
        code: "TYPE",
        name: "Type",
        options: [
          { code: "CUMULATIVE", name: "Cumulative" },
          { code: "MONTHLY", name: "Monthly interest" },
          { code: "QUARTERLY", name: "Quarterly interest" },
          { code: "SHORT_TERM", name: "Short-term (under 180 days)" },
          { code: "TAX_SAVING", name: "Tax-saving" },
        ],
      },
      {
        code: "SOURCE",
        name: "Source of money",
        options: [
          { code: "FRESH", name: "Fresh fund" },
          { code: "EXISTING", name: "Existing fund" },
          { code: "RENEWAL", name: "Renewal" },
        ],
      },
    ],
  },

  // ---------- Loans ----------
  loan("HOME_LOAN", "Home loan"),
  loan("VEHICLE_LOAN", "Vehicle loan", [
    {
      code: "VEHICLE_TYPE",
      name: "Vehicle type",
      options: [
        { code: "FOUR_WHEELER", name: "Four-wheeler" },
        { code: "TWO_WHEELER", name: "Two-wheeler" },
      ],
    },
  ]),
  loan("PERSONAL_LOAN", "Personal loan"),
  loan("LOAN_AGAINST_PROPERTY", "Loan against property"),
  loan("COMMERCIAL_VEHICLE_LOAN", "Commercial vehicle loan"),
  loan("PROJECT_LOAN", "Project loan"),
  loan("BUSINESS_LOAN", "Business loan"),
  loan("CASH_CREDIT", "Cash credit"),
  loan("OVERDRAFT", "Overdraft"),
  loan("GROUP_LOAN", "Group loan"),

  // ---------- Cards ----------
  {
    code: "CREDIT_CARD",
    name: "Credit card",
    category: "CARDS",
    credits: [units("CARD_COUNT")],
    groups: [
      {
        code: "CARD_TYPE",
        name: "Card type",
        options: [
          { code: "SPARK", name: "Spark" },
          { code: "IGNITE", name: "Ignite" },
          { code: "FLARE", name: "Flare" },
          { code: "LUMINIA", name: "Luminia" },
        ],
      },
    ],
  },

  // ---------- Insurance and investments (third-party products) ----------
  {
    code: "LIFE_INSURANCE",
    name: "Life insurance",
    category: "INSURANCE_INVESTMENTS",
    credits: [amount("LIFE_INSURANCE_VALUE")],
    groups: [
      {
        code: "PLAN_TYPE",
        name: "Plan type",
        options: [
          { code: "UNIT_LINKED", name: "Unit-linked plan" },
          { code: "PENSION_PLAN", name: "Pension plan" },
          { code: "TRADITIONAL_PARTICIPATING", name: "Traditional (participating)" },
          { code: "TRADITIONAL_NON_PARTICIPATING", name: "Traditional (non-participating)" },
          { code: "PROTECTION_TERM", name: "Protection / term plan" },
        ],
      },
    ],
  },
  {
    code: "GENERAL_INSURANCE",
    name: "General insurance",
    category: "INSURANCE_INVESTMENTS",
    credits: [amount("GENERAL_INSURANCE_VALUE")],
  },
  {
    code: "MUTUAL_FUND",
    name: "Mutual fund",
    category: "INSURANCE_INVESTMENTS",
    credits: [amount("MF_VALUE")],
  },
  {
    code: "SIP",
    name: "Mutual fund SIP",
    category: "INSURANCE_INVESTMENTS",
    credits: [units("SIP_COUNT")],
  },
  {
    code: "DEMAT",
    name: "Demat trading account",
    category: "INSURANCE_INVESTMENTS",
    credits: [units("DEMAT_COUNT")],
  },
];