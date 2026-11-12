import { addDays, dayOfWeek, monthRange, workingDaysInRange } from "../calendar/calendar";
import type { BusinessDate, CalendarConfig } from "../calendar/types";
import { distribute } from "./distribute";

export type Pacing = "DAILY" | "WEEKLY" | "MONTHLY";
export type SliceKind = "DAY" | "WEEK" | "MONTH";

export interface PlannedSlice {
  kind: SliceKind;
  /** First calendar day the slice covers (clipped to the plan's start date). */
  periodStart: BusinessDate;
  /** Last calendar day the slice covers (clipped to the end of the month). */
  periodEnd: BusinessDate;
  /** The working day on which this slice is judged met or missed. */
  dueDate: BusinessDate;
  /** Working days inside the period. This is the slice's weight when splitting. */
  workingDays: number;
  /** Whole units: a count, or paise for amounts. */
  plannedQty: number;
}

export interface PlanInput {
  /** "YYYY-MM" */
  month: string;
  /** Total to plan from startDate to the end of the month. A whole number. */
  quantity: number;
  pacing: Pacing;
  /** First day the plan applies to. Defaults to the first of the month. */
  startDate?: BusinessDate;
  /** Weekly offs plus the merged cluster and branch holidays. */
  calendar: CalendarConfig;
}

type Period = Omit<PlannedSlice, "plannedQty">;

/** The Monday on or before the given date. */
function weekStartOf(date: BusinessDate): BusinessDate {
  // Sunday is 0, so (day + 6) % 7 is the number of days since Monday.
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

function dailyPeriods(workingDays: BusinessDate[]): Period[] {
  return workingDays.map((day) => ({
    kind: "DAY" as const,
    periodStart: day,
    periodEnd: day,
    dueDate: day,
    workingDays: 1,
  }));
}

/** Weeks run Monday to Sunday, clipped to the plan window. Weeks with no working day vanish. */
function weeklyPeriods(
  workingDays: BusinessDate[],
  start: BusinessDate,
  monthEnd: BusinessDate,
): Period[] {
  const byWeek = new Map<BusinessDate, BusinessDate[]>();
  for (const day of workingDays) {
    const key = weekStartOf(day);
    const group = byWeek.get(key);
    if (group) group.push(day);
    else byWeek.set(key, [day]);
  }

  return Array.from(byWeek.entries()).map(([weekStart, days]) => {
    const weekEnd = addDays(weekStart, 6);
    return {
      kind: "WEEK" as const,
      periodStart: weekStart < start ? start : weekStart,
      periodEnd: weekEnd > monthEnd ? monthEnd : weekEnd,
      dueDate: days[days.length - 1],
      workingDays: days.length,
    };
  });
}

function monthlyPeriod(
  workingDays: BusinessDate[],
  start: BusinessDate,
  monthEnd: BusinessDate,
): Period[] {
  return [
    {
      kind: "MONTH" as const,
      periodStart: start,
      periodEnd: monthEnd,
      dueDate: workingDays[workingDays.length - 1],
      workingDays: workingDays.length,
    },
  ];
}

export function planSlices(input: PlanInput): PlannedSlice[] {
  const { month, quantity, pacing, calendar } = input;

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity must be a non-negative integer, got ${quantity}`);
  }

  const range = monthRange(month);
  const start = input.startDate ?? range.start;

  dayOfWeek(start); // throws if the text is not a real calendar day
  if (start < range.start || start > range.end) {
    throw new Error(`Start date ${start} is outside month ${month}`);
  }

  const workingDays = workingDaysInRange(start, range.end, calendar);
  if (workingDays.length === 0) {
    if (quantity > 0) {
      throw new Error(`No working days left in ${month} from ${start} to plan this target`);
    }
    return [];
  }

  let periods: Period[];
  switch (pacing) {
    case "DAILY":
      periods = dailyPeriods(workingDays);
      break;
    case "WEEKLY":
      periods = weeklyPeriods(workingDays, start, range.end);
      break;
    case "MONTHLY":
      periods = monthlyPeriod(workingDays, start, range.end);
      break;
    default:
      throw new Error(`Unknown pacing: ${String(pacing)}`);
  }

  // Each period's weight is its number of working days, so a short week carries less.
  const shares = distribute(
    quantity,
    periods.map((period) => period.workingDays),
  );
  return periods.map((period, i) => ({ ...period, plannedQty: shares[i] }));
}