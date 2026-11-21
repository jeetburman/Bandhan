import type { Performance } from "../domain/performance/performance";
import { formatRate } from "./format-rate";

const days = (n: number) => `${n} working ${n === 1 ? "day" : "days"}`;

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * How the pace reads on screen. Counts use whole numbers only: "10 done in 14 working days ·
 * needs 15 more in the 7 working days left". Amounts keep a whole-rupee daily rate.
 */
export function formatPace(unit: "COUNT" | "AMOUNT", p: Performance): string | null {
  const parts: string[] = [];

  if (unit === "AMOUNT") {
    if (p.currentRate !== null) parts.push(`doing ${formatRate("AMOUNT", p.currentRate)}`);
    if (p.outlook === "NO_DAYS_LEFT") parts.push("no working days left");
    else if (p.requiredRate !== null && p.remainingQty > 0) {
      parts.push(`needs ${formatRate("AMOUNT", p.requiredRate)}`);
    }
  } else {
    if (p.elapsedWorkingDays > 0) {
      parts.push(`${p.verifiedClosedQty} done in ${days(p.elapsedWorkingDays)}`);
    }
    if (p.remainingQty > 0) {
      if (p.remainingWorkingDays === 0) parts.push("no working days left");
      else {
        const more = p.verifiedQty > 0 ? " more" : "";
        parts.push(`needs ${p.remainingQty}${more} in the ${days(p.remainingWorkingDays)} left`);
      }
    }
  }

  return parts.length > 0 ? capitalise(parts.join(" · ")) : null;
}