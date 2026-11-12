const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day it is in India at the given moment, as "YYYY-MM-DD". */
export function istBusinessDate(moment: Date): string {
  if (Number.isNaN(moment.getTime())) throw new Error("Invalid date");
  const parts = Object.fromEntries(formatter.formatToParts(moment).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}