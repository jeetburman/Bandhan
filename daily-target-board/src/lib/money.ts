const wholeRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const withPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Paise to rupees with lakh/crore grouping, e.g. 500000000 becomes "₹50,00,000". */
export function formatRupees(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new Error(`Paise must be a safe whole number, got ${paise}`);
  }
  return paise % 100 === 0 ? wholeRupees.format(paise / 100) : withPaise.format(paise / 100);
}

/** A count prints as a plain number, an amount as rupees. */
export function formatQty(unit: "COUNT" | "AMOUNT", quantity: number): string {
  return unit === "AMOUNT" ? formatRupees(quantity) : String(quantity);
}