/** When a working day closes, in Indian Standard Time. Change it here to change it everywhere. */
export const DAILY_CUTOFF = { hour: 18, minute: 0 } as const;

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function istMinutesOfDay(moment: Date): number {
  if (Number.isNaN(moment.getTime())) throw new Error("Invalid date");
  const parts = Object.fromEntries(clock.formatToParts(moment).map((p) => [p.type, p.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** True once the day's cut-off time has passed in India at the given moment. */
export function cutoffPassed(
  moment: Date,
  cutoff: { hour: number; minute: number } = DAILY_CUTOFF,
): boolean {
  return istMinutesOfDay(moment) >= cutoff.hour * 60 + cutoff.minute;
}

/** "6:00 PM" */
export function cutoffLabel(cutoff: { hour: number; minute: number } = DAILY_CUTOFF): string {
  const period = cutoff.hour >= 12 ? "PM" : "AM";
  const hour12 = cutoff.hour % 12 === 0 ? 12 : cutoff.hour % 12;
  return `${hour12}:${String(cutoff.minute).padStart(2, "0")} ${period}`;
}