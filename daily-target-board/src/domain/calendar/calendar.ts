import type { BusinessDate, CalendarConfig } from "./types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_SEARCH_DAYS = 366;

/** Parse "YYYY-MM-DD" into a UTC Date. Throws if the text is not a real calendar day. */
function parse(date: BusinessDate): Date {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new Error(`Invalid business date: "${date}"`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  // JavaScript silently rolls 30 Feb over into March, so read the parts back.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid business date: "${date}"`);
  }
  return parsed;
}

function format(date: Date): BusinessDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: BusinessDate, days: number): BusinessDate {
  const result = parse(date);
  result.setUTCDate(result.getUTCDate() + days);
  return format(result);
}

export function isWorkingDay(date: BusinessDate, config: CalendarConfig): boolean {
  const parsed = parse(date); // also validates the string

  const weekday = parsed.getUTCDay();
  if (config.weeklyOffDays.includes(weekday)) return false;

  // The 8th-14th is always the 2nd occurrence of its weekday, and so on.
  const occurrence = Math.ceil(parsed.getUTCDate() / 7);
  if (weekday === 6 && config.offSaturdays.includes(occurrence)) return false;

  if (config.holidays.has(date)) return false;
  return true;
}

export function nextWorkingDay(date: BusinessDate, config: CalendarConfig): BusinessDate {
  let current = date;
  for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
    current = addDays(current, 1);
    if (isWorkingDay(current, config)) return current;
  }
  // A config where every day is off would otherwise loop forever.
  throw new Error("No working day found within a year: check the calendar config");
}

export function workingDaysInRange(
  start: BusinessDate,
  end: BusinessDate,
  config: CalendarConfig,
): BusinessDate[] {
  parse(start);
  parse(end);

  const days: BusinessDate[] = [];
  // Plain string comparison is correct for zero-padded ISO dates.
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (isWorkingDay(day, config)) days.push(day);
  }
  return days;
}

export function dayOfWeek(date: BusinessDate): number {
  return parse(date).getUTCDay();
}

/** First and last calendar day of a "YYYY-MM" month. Throws on an invalid month. */
export function monthRange(month: string): { start: BusinessDate; end: BusinessDate } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Invalid month: "${month}"`);

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) throw new Error(`Invalid month: "${month}"`);

  return {
    start: format(new Date(Date.UTC(year, monthNumber - 1, 1))),
    // Day 0 of the *next* month is the last day of this one.
    end: format(new Date(Date.UTC(year, monthNumber, 0))),
  };
}