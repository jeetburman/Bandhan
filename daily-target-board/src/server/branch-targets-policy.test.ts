import { describe, expect, it } from "vitest";
import type { Role } from "../lib/roles";
import { canSetBranchTargets } from "./permissions";

const actor = (role: Role, clusterId = "c1") => ({ role, clusterId });
const branch = { clusterId: "c1" };

describe("canSetBranchTargets", () => {
  it("lets the Cluster Head set targets for a branch in their own cluster", () => {
    expect(canSetBranchTargets(actor("CLUSTER_HEAD"), branch)).toBe(true);
  });

  it("refuses a Cluster Head from another cluster", () => {
    expect(canSetBranchTargets(actor("CLUSTER_HEAD", "c2"), branch)).toBe(false);
  });

  it("refuses branch managers, supervisors and staff", () => {
    for (const role of ["BRANCH_MANAGER", "SUPERVISOR", "STAFF"] as const) {
      expect(canSetBranchTargets(actor(role), branch)).toBe(false);
    }
  });
});