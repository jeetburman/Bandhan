import { workingDaysInRange } from "./calendar";
import type { BusinessDate, CalendarConfig } from "./types";

export interface HolidayImpact {
  /** Working days from the holiday date to month end, as things stand. */
  before: number;
  /** The same count once the holiday is added. */
  after: number;
}

/**
 * How many working days a new holiday takes out of the rest of the month.
 * A date that is already off, such as a Sunday or an existing holiday, changes nothing.
 */
export function holidayImpact(
  holidayDate: BusinessDate,
  monthEnd: BusinessDate,
  calendar: CalendarConfig,
): HolidayImpact {
  const before = workingDaysInRange(holidayDate, monthEnd, calendar).length;
  const after = workingDaysInRange(holidayDate, monthEnd, {
    ...calendar,
    holidays: new Set([...calendar.holidays, holidayDate]),
  }).length;
  return { before, after };
}