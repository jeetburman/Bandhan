export type Role = "STAFF" | "SUPERVISOR" | "BRANCH_MANAGER" | "CLUSTER_HEAD";
export type Section = "me" | "team" | "branch" | "cluster" | "approvals";

const ALLOWED: Record<Section, readonly Role[]> = {
  // Everyone who sells. The Cluster Head has no personal targets and records no sales.
  me: ["STAFF", "SUPERVISOR", "BRANCH_MANAGER"],
  team: ["SUPERVISOR", "BRANCH_MANAGER", "CLUSTER_HEAD"],
  branch: ["BRANCH_MANAGER", "CLUSTER_HEAD"],
  cluster: ["CLUSTER_HEAD"],
  // Approval requests never go to the Cluster Head.
  approvals: ["SUPERVISOR", "BRANCH_MANAGER"],
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

export function canAccessSection(role: Role, section: Section): boolean {
  return ALLOWED[section].includes(role);
}

export function homePathFor(role: Role): string {
  return HOME[role];
}

export function roleLabel(role: Role): string {
  return LABELS[role];
}