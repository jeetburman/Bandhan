import type { CalendarConfig } from "../domain/calendar/types";
import { db } from "../lib/db";

/** Sundays are always off, and so are the 2nd and 4th Saturdays. */
export const WEEKLY_OFF_DAYS: readonly number[] = [0];
export const OFF_SATURDAYS: readonly number[] = [2, 4];

/** The calendar a branch works to in a month: the weekly pattern plus cluster and branch holidays. */
export async function loadCalendar(
  clusterId: string,
  branchId: string,
  month: string,
): Promise<{ calendar: CalendarConfig; holidays: string[] }> {
  const rows = await db.holiday.findMany({
    where: { clusterId, date: { startsWith: month }, OR: [{ branchId: null }, { branchId }] },
  });
  const dates = new Set(rows.map((row) => row.date));
  return {
    calendar: { weeklyOffDays: WEEKLY_OFF_DAYS, offSaturdays: OFF_SATURDAYS, holidays: dates },
    holidays: [...dates].sort(),
  };
}