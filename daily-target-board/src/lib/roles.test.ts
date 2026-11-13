import { describe, expect, it } from "vitest";
import { canAccessSection, homePathFor, roleLabel, type Role, type Section } from "./roles";

const ROLES: Role[] = ["STAFF", "SUPERVISOR", "BRANCH_MANAGER", "CLUSTER_HEAD"];
const SECTIONS: Section[] = ["me", "team", "branch", "cluster"];

describe("canAccessSection", () => {
  const expected: Record<Role, Section[]> = {
    STAFF: ["me"],
    SUPERVISOR: ["me", "team"],
    BRANCH_MANAGER: ["me", "team", "branch"],
    CLUSTER_HEAD: ["me", "team", "branch", "cluster"],
  };

  for (const role of ROLES) {
    it(`gives ${role} exactly the sections it should have`, () => {
      const allowed = SECTIONS.filter((section) => canAccessSection(role, section));
      expect(allowed).toEqual(expected[role]);
    });
  }
});

describe("homePathFor", () => {
  it("sends each role to its own section", () => {
    expect(homePathFor("STAFF")).toBe("/me");
    expect(homePathFor("SUPERVISOR")).toBe("/team");
    expect(homePathFor("BRANCH_MANAGER")).toBe("/branch");
    expect(homePathFor("CLUSTER_HEAD")).toBe("/cluster");
  });

  it("always lands somewhere the role is allowed to open", () => {
    const sectionOfHome = (path: string) => path.slice(1) as Section;
    for (const role of ROLES) {
      expect(canAccessSection(role, sectionOfHome(homePathFor(role)))).toBe(true);
    }
  });
});

describe("roleLabel", () => {
  it("has a readable label for every role", () => {
    for (const role of ROLES) expect(roleLabel(role).length).toBeGreaterThan(0);
  });
});