export type Role = "STAFF" | "SUPERVISOR" | "BRANCH_MANAGER" | "CLUSTER_HEAD";
export type Section = "me" | "team" | "branch" | "cluster";

const RANK: Record<Role, number> = {
  STAFF: 0,
  SUPERVISOR: 1,
  BRANCH_MANAGER: 2,
  CLUSTER_HEAD: 3,
};

const MIN_ROLE_FOR: Record<Section, Role> = {
  me: "STAFF",
  team: "SUPERVISOR",
  branch: "BRANCH_MANAGER",
  cluster: "CLUSTER_HEAD",
};

const HOME: Record<Role, string> = {
  STAFF: "/me",
  SUPERVISOR: "/team",
  BRANCH_MANAGER: "/branch",
  CLUSTER_HEAD: "/cluster",
};

const LABELS: Record<Role, string> = {
  STAFF: "Staff",
  SUPERVISOR: "Supervisor",
  BRANCH_MANAGER: "Branch manager",
  CLUSTER_HEAD: "Cluster head",
};

/** A role can open its own section and every section below it. */
export function canAccessSection(role: Role, section: Section): boolean {
  return RANK[role] >= RANK[MIN_ROLE_FOR[section]];
}

export function homePathFor(role: Role): string {
  return HOME[role];
}

export function roleLabel(role: Role): string {
  return LABELS[role];
}