import { describe, expect, it } from "vitest";
import { canAccessSection, homePathFor, roleLabel, type Role, type Section } from "./roles";

const ROLES: Role[] = ["STAFF", "SUPERVISOR", "BRANCH_MANAGER", "CLUSTER_HEAD"];
const SECTIONS: Section[] = ["me", "team", "branch", "cluster", "approvals"];

describe("canAccessSection", () => {
  const expected: Record<Role, Section[]> = {
    STAFF: ["me"],
    SUPERVISOR: ["me", "team", "approvals"],
    BRANCH_MANAGER: ["me", "team", "branch", "approvals"],
    CLUSTER_HEAD: ["team", "branch", "cluster"],
  };

  for (const role of ROLES) {
    it(`gives ${role} exactly the sections it should have`, () => {
      expect(SECTIONS.filter((section) => canAccessSection(role, section))).toEqual(expected[role]);
    });
  }

  it("never gives the Cluster Head approvals or personal sales", () => {
    expect(canAccessSection("CLUSTER_HEAD", "approvals")).toBe(false);
    expect(canAccessSection("CLUSTER_HEAD", "me")).toBe(false);
  });

  it("never gives staff the approvals section", () => {
    expect(canAccessSection("STAFF", "approvals")).toBe(false);
  });
});

describe("homePathFor", () => {
  it("sends each role to its own section", () => {
    expect(homePathFor("STAFF")).toBe("/me");
    expect(homePathFor("SUPERVISOR")).toBe("/team");
    expect(homePathFor("BRANCH_MANAGER")).toBe("/branch");
    expect(homePathFor("CLUSTER_HEAD")).toBe("/cluster");
  });

  it("always lands somewhere the role is allowed to open", () => {
    for (const role of ROLES) {
      expect(canAccessSection(role, homePathFor(role).slice(1) as Section)).toBe(true);
    }
  });
});

describe("roleLabel", () => {
  it("has a readable label for every role", () => {
    for (const role of ROLES) expect(roleLabel(role).length).toBeGreaterThan(0);
  });
});