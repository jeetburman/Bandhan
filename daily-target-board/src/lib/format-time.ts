import { dayOfWeek } from "../domain/calendar/calendar";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-11" becomes "Wed 11 Nov". */
export function formatShortDate(date: string): string {
  const weekday = dayOfWeek(date); // also validates the date
  const [, month, day] = date.split("-");
  return `${DAYS[weekday]} ${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

const stamp = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** A moment in time, shown in Indian Standard Time. */
export function formatIstDateTime(moment: Date): string {
  return stamp.format(moment);
}