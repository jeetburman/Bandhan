import { formatRupees } from "./money";

/** "₹50,000", "3 units", or "₹50,000 · 2 units". */
export function describeQuantity(units: number, amountPaise: number): string {
  const parts: string[] = [];
  if (amountPaise > 0) parts.push(formatRupees(amountPaise));
  if (units > 1 || amountPaise === 0) parts.push(`${units} ${units === 1 ? "unit" : "units"}`);
  return parts.join(" · ");
}