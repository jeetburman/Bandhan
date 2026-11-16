import {
  addDays,
  dayOfWeek,
  isWorkingDay,
  monthRange,
  nextWorkingDay,
  workingDaysInRange,
} from "../calendar/calendar";
import type { BusinessDate, CalendarConfig } from "../calendar/types";
import { planSlices, type Pacing } from "../distribution/plan-slices";

export interface SuggestInput {
  /** "YYYY-MM" */
  month: string;
  today: BusinessDate;
  /** True once today's cut-off has passed. */
  cutoffPassed: boolean;
  calendar: CalendarConfig;
  pacing: Pacing;
  /** What is still needed this month. Whole units: a count, or paise. */
  needed: number;
}

export interface Suggestion {
  needed: number;
  workingDaysLeft: number;
  /** The first working day the advice covers. null when no working day is left this month. */
  fromDate: BusinessDate | null;
  /** True when fromDate is today, because the day is still open. */
  startsToday: boolean;
  /** Daily targets only: the amount for fromDate. */
  dayQty: number | null;
  /** Daily and weekly targets: the amount due by the end of fromDate's week. */
  weekQty: number | null;
  /** The working day that weekly amount is due by. */
  weekDueDate: BusinessDate | null;
  /** The last working day of the month. */
  dueDate: BusinessDate | null;
}

/** Today while it is still open, otherwise the next working day. */
export function firstPlanningDay(
  today: BusinessDate,
  cutoffPassed: boolean,
  calendar: CalendarConfig,
): BusinessDate {
  if (!cutoffPassed && isWorkingDay(today, calendar)) return today;
  return nextWorkingDay(today, calendar);
}

/**
 * Spread what is still needed over the working days that are left.
 * Because it starts from what is left, it rises when someone falls behind and falls when
 * they get ahead. It never stores anything, so it is always up to date.
 */
export function suggestFor(input: SuggestInput): Suggestion {
  const { month, today, cutoffPassed, calendar, pacing, needed } = input;
  if (!Number.isSafeInteger(needed) || needed < 0) {
    throw new Error(`Needed quantity must be a non-negative whole number, got ${needed}`);
  }

  const range = monthRange(month);
  const fromDate = firstPlanningDay(today, cutoffPassed, calendar);

  if (fromDate > range.end || fromDate < range.start) {
    return {
      needed,
      workingDaysLeft: 0,
      fromDate: null,
      startsToday: false,
      dayQty: null,
      weekQty: null,
      weekDueDate: null,
      dueDate: null,
    };
  }

  const days = workingDaysInRange(fromDate, range.end, calendar);
  const slices = planSlices({ month, quantity: needed, pacing, startDate: fromDate, calendar });
  const sum = (items: { plannedQty: number }[]) => items.reduce((acc, s) => acc + s.plannedQty, 0);

  let dayQty: number | null = null;
  let weekQty: number | null = null;
  let weekDueDate: BusinessDate | null = null;

  if (pacing === "DAILY") {
    // Weeks run Monday to Sunday.
    const weekEnd = addDays(fromDate, (7 - dayOfWeek(fromDate)) % 7);
    const inWeek = slices.filter((slice) => slice.dueDate <= weekEnd);
    dayQty = slices[0].plannedQty;
    weekQty = sum(inWeek);
    weekDueDate = inWeek[inWeek.length - 1].dueDate;
  } else if (pacing === "WEEKLY") {
    weekQty = slices[0].plannedQty;
    weekDueDate = slices[0].dueDate;
  }

  return {
    needed,
    workingDaysLeft: days.length,
    fromDate,
    startsToday: fromDate === today,
    dayQty,
    weekQty,
    weekDueDate,
    dueDate: days[days.length - 1],
  };
}