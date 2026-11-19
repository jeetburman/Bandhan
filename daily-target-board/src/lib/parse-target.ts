import { parseRupeesToPaise } from "./rupees";

/**
 * What someone typed into a target box, as whole units: paise for an amount, a count otherwise.
 * An empty box means 0. Throws an Error with a readable message when it is not a number.
 */
export function parseTargetText(unit: "COUNT" | "AMOUNT", text: string): number {
  if (unit === "AMOUNT") return parseRupeesToPaise(text);

  const cleaned = text.trim().replace(/,/g, "");
  if (cleaned === "") return 0;
  if (!/^\d{1,6}$/.test(cleaned)) throw new Error("enter a whole number.");
  return Number(cleaned);
}