/** The most a single sale can be worth: Rs 100 crore, in paise. */
export const MAX_SALE_PAISE = 100_00_00_000 * 100;

/**
 * Turn what someone typed into whole paise.
 * "50000", "50,000.50" and "₹ 1,00,000" are fine. An empty box means 0.
 */
export function parseRupeesToPaise(text: string): number {
  const cleaned = text.trim().replace(/^₹\s*/, "").replace(/,/g, "");
  if (cleaned === "") return 0;

  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new Error("Enter the amount in rupees, for example 50000 or 50,000.50");

  const paise = Number(match[1]) * 100 + (match[2] ? Number(match[2].padEnd(2, "0")) : 0);
  if (paise > MAX_SALE_PAISE) throw new Error("That amount is too large.");
  return paise;
}