/** A calendar day in Indian Standard Time, written "YYYY-MM-DD". */
export type BusinessDate = string;

export interface CalendarConfig {
  /** Days of the week that are always off. 0 = Sunday ... 6 = Saturday. */
  weeklyOffDays: readonly number[];
  /** Which Saturdays of the month are off: 1 = first, 2 = second, and so on. */
  offSaturdays: readonly number[];
  /** Festival and national holidays that apply to this branch. */
  holidays: ReadonlySet<BusinessDate>;
}