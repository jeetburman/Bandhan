import type { Role } from "../lib/roles";
export type { Role };

export interface Actor {
  id: string;
  email: string;
  name: string;
  role: Role;
  clusterId: string;
  branchId: string | null;
}

/** Only a branch manager (BH or ABH) of that very branch can publish its plan. */
export function canPublishPlan(
  actor: Pick<Actor, "role" | "branchId">,
  branchId: string,
): boolean {
  return actor.role === "BRANCH_MANAGER" && actor.branchId === branchId;
}

export interface HolidayScope {
  clusterId: string;
  /** null means a holiday for the whole cluster. */
  branchId: string | null;
}

/**
 * The Cluster Head can manage holidays anywhere in their cluster, for the whole cluster
 * or for one branch. A branch manager can manage only their own branch's holidays.
 */
export function canManageHoliday(
  actor: Pick<Actor, "role" | "clusterId" | "branchId">,
  scope: HolidayScope,
): boolean {
  if (actor.clusterId !== scope.clusterId) return false;
  if (actor.role === "CLUSTER_HEAD") return true;
  if (actor.role === "BRANCH_MANAGER") {
    return scope.branchId !== null && actor.branchId === scope.branchId;
  }
  return false;
}