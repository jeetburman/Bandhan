import { describe, expect, it } from "vitest";
import { canManageHoliday, canPublishPlan, type Role } from "./permissions";

const person = (role: Role, branchId: string | null, clusterId = "c1") => ({
  role,
  branchId,
  clusterId,
});

describe("canPublishPlan", () => {
  it("allows a branch manager of that branch", () => {
    expect(canPublishPlan(person("BRANCH_MANAGER", "b1"), "b1")).toBe(true);
  });

  it("refuses a branch manager of another branch", () => {
    expect(canPublishPlan(person("BRANCH_MANAGER", "b2"), "b1")).toBe(false);
  });

  it("refuses everyone else, including the Cluster Head", () => {
    expect(canPublishPlan(person("CLUSTER_HEAD", null), "b1")).toBe(false);
    expect(canPublishPlan(person("SUPERVISOR", "b1"), "b1")).toBe(false);
    expect(canPublishPlan(person("STAFF", "b1"), "b1")).toBe(false);
  });
});

describe("canManageHoliday", () => {
  it("lets the Cluster Head manage cluster-wide and branch holidays in their cluster", () => {
    const head = person("CLUSTER_HEAD", null);
    expect(canManageHoliday(head, { clusterId: "c1", branchId: null })).toBe(true);
    expect(canManageHoliday(head, { clusterId: "c1", branchId: "b1" })).toBe(true);
  });

  it("refuses a Cluster Head from another cluster", () => {
    expect(
      canManageHoliday(person("CLUSTER_HEAD", null, "c2"), { clusterId: "c1", branchId: null }),
    ).toBe(false);
  });

  it("lets a branch manager manage only their own branch", () => {
    const manager = person("BRANCH_MANAGER", "b1");
    expect(canManageHoliday(manager, { clusterId: "c1", branchId: "b1" })).toBe(true);
    expect(canManageHoliday(manager, { clusterId: "c1", branchId: "b2" })).toBe(false);
  });

  it("refuses a branch manager for a cluster-wide holiday", () => {
    expect(
      canManageHoliday(person("BRANCH_MANAGER", "b1"), { clusterId: "c1", branchId: null }),
    ).toBe(false);
  });

  it("refuses a branch manager from another cluster", () => {
    expect(
      canManageHoliday(person("BRANCH_MANAGER", "b1", "c2"), { clusterId: "c1", branchId: "b1" }),
    ).toBe(false);
  });

  it("refuses supervisors and staff", () => {
    expect(canManageHoliday(person("SUPERVISOR", "b1"), { clusterId: "c1", branchId: "b1" })).toBe(false);
    expect(canManageHoliday(person("STAFF", "b1"), { clusterId: "c1", branchId: "b1" })).toBe(false);
  });
});