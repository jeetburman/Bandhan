import { describe, expect, it } from "vitest";
import type { Role } from "../lib/roles";
import { canViewBranch } from "./policy";

const actor = (role: Role, branchId: string | null, clusterId = "c1") => ({
  role,
  branchId,
  clusterId,
});

const branch = { id: "b1", clusterId: "c1" };

describe("canViewBranch", () => {
  it("lets the Cluster Head open any branch in their cluster", () => {
    expect(canViewBranch(actor("CLUSTER_HEAD", null), branch)).toBe(true);
    expect(canViewBranch(actor("CLUSTER_HEAD", null), { id: "b2", clusterId: "c1" })).toBe(true);
  });

  it("refuses a Cluster Head from another cluster", () => {
    expect(canViewBranch(actor("CLUSTER_HEAD", null, "c2"), branch)).toBe(false);
  });

  it("lets a branch manager open only their own branch", () => {
    expect(canViewBranch(actor("BRANCH_MANAGER", "b1"), branch)).toBe(true);
    expect(canViewBranch(actor("BRANCH_MANAGER", "b2"), branch)).toBe(false);
  });

  it("fails closed for a branch manager with no branch", () => {
    expect(canViewBranch(actor("BRANCH_MANAGER", null), branch)).toBe(false);
  });

  it("refuses supervisors and staff", () => {
    expect(canViewBranch(actor("SUPERVISOR", "b1"), branch)).toBe(false);
    expect(canViewBranch(actor("STAFF", "b1"), branch)).toBe(false);
  });
});