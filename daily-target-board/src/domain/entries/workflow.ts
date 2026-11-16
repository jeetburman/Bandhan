import { addDays, dayOfWeek } from "../calendar/calendar";
import type { BusinessDate } from "../calendar/types";

export type EntryStatus = "SUBMITTED" | "L1_APPROVED" | "VERIFIED" | "REJECTED";
export type ReviewLevel = "FIRST" | "FINAL";
export type ReviewAction = "APPROVE" | "REJECT";

/** A sale can be recorded for today or up to this many days back. */
export const MAX_BACKDATE_DAYS = 7;

/** Someone who needs no verification (the ABH) has their sales counted straight away. */
export function initialStatus(requiresVerification: boolean): {
  status: EntryStatus;
  autoVerified: boolean;
} {
  return requiresVerification
    ? { status: "SUBMITTED", autoVerified: false }
    : { status: "VERIFIED", autoVerified: true };
}

/** The statuses a reviewer at this level may act on. */
export function reviewableStatuses(level: ReviewLevel): readonly EntryStatus[] {
  return level === "FIRST" ? ["SUBMITTED"] : ["SUBMITTED", "L1_APPROVED"];
}

/**
 * The only way an entry changes status.
 * - A supervisor (FIRST) can approve provisionally or reject an entry that is still SUBMITTED.
 * - A branch manager (FINAL) can verify or reject an entry that is SUBMITTED or L1_APPROVED.
 * - A VERIFIED or REJECTED entry never changes again.
 */
export function nextStatus(
  current: EntryStatus,
  level: ReviewLevel,
  action: ReviewAction,
): EntryStatus {
  if (!reviewableStatuses(level).includes(current)) {
    throw new Error(`An entry that is ${current} cannot be reviewed at the ${level} level`);
  }
  if (action === "REJECT") return "REJECTED";
  return level === "FIRST" ? "L1_APPROVED" : "VERIFIED";
}

/** Only verified sales count towards a target. */
export function countsTowardProgress(status: EntryStatus): boolean {
  return status === "VERIFIED";
}

export function isPending(status: EntryStatus): boolean {
  return status === "SUBMITTED" || status === "L1_APPROVED";
}

const LABELS: Record<EntryStatus, string> = {
  SUBMITTED: "Waiting for approval",
  L1_APPROVED: "Waiting for final approval",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export function statusLabel(status: EntryStatus): string {
  return LABELS[status];
}

/** Today or up to MAX_BACKDATE_DAYS back. Never the future. */
export function checkActivityDate(activityDate: BusinessDate, today: BusinessDate): void {
  dayOfWeek(activityDate); // throws if it is not a real date
  if (activityDate > today) throw new Error("The sale date cannot be in the future.");
  if (activityDate < addDays(today, -MAX_BACKDATE_DAYS)) {
    throw new Error(`Sales can only be recorded for the last ${MAX_BACKDATE_DAYS} days.`);
  }
}