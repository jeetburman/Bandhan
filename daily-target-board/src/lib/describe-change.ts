import type { TargetChange } from "../domain/dashboard/change-history";
import { formatQty } from "./money";

/** "Changed on Thu 12 Nov: was ₹50,00,000 (+₹2,00,000)" */
export function describeChange(
  unit: "COUNT" | "AMOUNT",
  change: Pick<TargetChange, "kind" | "previousTotal" | "delta">,
  dateLabel: string,
): string {
  if (change.kind === "NEW") return `New target added on ${dateLabel}`;
  const sign = change.delta > 0 ? "+" : "−";
  return (
    `Changed on ${dateLabel}: was ${formatQty(unit, change.previousTotal)} ` +
    `(${sign}${formatQty(unit, Math.abs(change.delta))})`
  );
}