import type { Prisma } from "@prisma/client";
import { reviewableStatuses, type EntryStatus, type ReviewLevel } from "../domain/entries/workflow";
import type { Actor } from "./permissions";

type PolicyActor = Pick<Actor, "id" | "role" | "branchId">;

export interface EntryRelation {
  /** The branch the sale was made in. */
  branchId: string;
  sellerId: string;
  sellerReportsToId: string | null;
}

export interface EntryContext extends EntryRelation {
  status: EntryStatus;
}

/** Only people who belong to a branch record sales. The Cluster Head records none. */
export function canSubmitEntry(actor: Pick<Actor, "role" | "branchId">): boolean {
  return actor.role !== "CLUSTER_HEAD" && actor.branchId !== null;
}

/**
 * The level at which this person may review this entry, or null if they may not.
 * - Never across branches: a reviewer must belong to the branch the sale was made in.
 * - Never your own sale.
 * - A branch manager (BH or ABH) gives the final verification.
 * - A supervisor gives a first approval, only to people who report to them.
 * - The Cluster Head, who has no branch, can never review anything.
 */
export function reviewLevelFor(actor: PolicyActor, entry: EntryRelation): ReviewLevel | null {
  if (actor.branchId === null || actor.branchId !== entry.branchId) return null;
  if (actor.id === entry.sellerId) return null;
  if (actor.role === "BRANCH_MANAGER") return "FINAL";
  if (actor.role === "SUPERVISOR" && entry.sellerReportsToId === actor.id) return "FIRST";
  return null;
}

/** Is this entry waiting in this person's approval list right now? */
export function isInQueue(actor: PolicyActor, entry: EntryContext): boolean {
  const level = reviewLevelFor(actor, entry);
  return level !== null && reviewableStatuses(level).includes(entry.status);
}

/** The same rule as `isInQueue`, as a database filter. null means this person has no queue. */
export function queueWhere(actor: PolicyActor): Prisma.ProgressEntryWhereInput | null {
  if (actor.branchId === null) return null;
  const base = { branchId: actor.branchId, userId: { not: actor.id } };

  if (actor.role === "BRANCH_MANAGER") {
    return { ...base, status: { in: [...reviewableStatuses("FINAL")] } };
  }
  if (actor.role === "SUPERVISOR") {
    return {
      ...base,
      status: { in: [...reviewableStatuses("FIRST")] },
      user: { reportsToId: actor.id },
    };
  }
  return null;
}

/**
 * The reviews this person may look back on. A branch manager sees every review made in their
 * branch, and a supervisor sees reviews of their own reports. null means no approvals section.
 */
export function handledWhere(actor: PolicyActor): Prisma.ApprovalWhereInput | null {
  if (actor.branchId === null) return null;
  if (actor.role === "BRANCH_MANAGER") return { entry: { branchId: actor.branchId } };
  if (actor.role === "SUPERVISOR") {
    return { entry: { branchId: actor.branchId, user: { reportsToId: actor.id } } };
  }
  return null;
}