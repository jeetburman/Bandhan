import { formatRupees } from "./money";

/** A pace, per working day. "₹2,38,095 a day", "0.33 a day", "2.5 a day". */
export function formatRate(unit: "COUNT" | "AMOUNT", perDay: number): string {
  if (!Number.isFinite(perDay) || perDay < 0) {
    throw new Error(`A rate must be zero or more, got ${perDay}`);
  }

  if (unit === "AMOUNT") {
    // perDay is in paise. Whole rupees are plenty for a pace.
    return `${formatRupees(Math.round(perDay / 100) * 100)} a day`;
  }

  const digits = perDay >= 10 ? 0 : perDay >= 1 ? 1 : 2;
  const text = new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(perDay);
  return `${text} a day`;
}