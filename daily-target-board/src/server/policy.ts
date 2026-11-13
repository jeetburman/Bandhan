import type { Prisma } from "@prisma/client";
import type { Actor } from "./permissions";

export type VisibilityScope =
  | { kind: "SELF"; userId: string }
  | { kind: "TEAM"; userId: string }
  | { kind: "BRANCH"; branchId: string }
  | { kind: "CLUSTER"; clusterId: string };

export interface ScopeTarget {
  id: string;
  clusterId: string;
  branchId: string | null;
  reportsToId: string | null;
}

type ScopeActor = Pick<Actor, "id" | "role" | "clusterId" | "branchId">;

/**
 * How much of the organisation this person may see.
 * A branch manager with no branch is a data mistake, so it fails closed to "self".
 */
export function visibilityScope(actor: ScopeActor): VisibilityScope {
  switch (actor.role) {
    case "CLUSTER_HEAD":
      return { kind: "CLUSTER", clusterId: actor.clusterId };
    case "BRANCH_MANAGER":
      return actor.branchId
        ? { kind: "BRANCH", branchId: actor.branchId }
        : { kind: "SELF", userId: actor.id };
    case "SUPERVISOR":
      return { kind: "TEAM", userId: actor.id };
    case "STAFF":
      return { kind: "SELF", userId: actor.id };
  }
}

/** The one definition of what each scope contains. */
export function matchesScope(scope: VisibilityScope, target: ScopeTarget): boolean {
  switch (scope.kind) {
    case "SELF":
      return target.id === scope.userId;
    case "TEAM":
      return target.id === scope.userId || target.reportsToId === scope.userId;
    case "BRANCH":
      return target.branchId === scope.branchId;
    case "CLUSTER":
      return target.clusterId === scope.clusterId;
  }
}

export function canViewUser(actor: ScopeActor, target: ScopeTarget): boolean {
  return matchesScope(visibilityScope(actor), target);
}

/** The same rule as `matchesScope`, written as a database filter. Keep the two in step. */
export function userWhere(scope: VisibilityScope): Prisma.UserWhereInput {
  switch (scope.kind) {
    case "SELF":
      return { id: scope.userId };
    case "TEAM":
      return { OR: [{ id: scope.userId }, { reportsToId: scope.userId }] };
    case "BRANCH":
      return { branchId: scope.branchId };
    case "CLUSTER":
      return { clusterId: scope.clusterId };
  }
}
/**
 * The Cluster Head can open any branch in their cluster. A branch manager can open only
 * their own branch. Supervisors and staff see people, never branch-level figures.
 */
export function canViewBranch(
  actor: Pick<Actor, "role" | "clusterId" | "branchId">,
  branch: { id: string; clusterId: string },
): boolean {
  if (actor.clusterId !== branch.clusterId) return false;
  if (actor.role === "CLUSTER_HEAD") return true;
  if (actor.role === "BRANCH_MANAGER") return actor.branchId === branch.id;
  return false;
}