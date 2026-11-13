import { describe, expect, it } from "vitest";
import type { Role } from "../lib/roles";
import { canViewUser, userWhere, visibilityScope, type ScopeTarget } from "./policy";

interface Person extends ScopeTarget {
  role: Role;
}

const person = (
  id: string,
  role: Role,
  clusterId: string,
  branchId: string | null,
  reportsToId: string | null,
): Person => ({ id, role, clusterId, branchId, reportsToId });

const ORG: Person[] = [
  person("ch", "CLUSTER_HEAD", "c1", null, null),
  person("bh1", "BRANCH_MANAGER", "c1", "b1", "ch"),
  person("abh1", "BRANCH_MANAGER", "c1", "b1", "bh1"),
  person("sm1", "SUPERVISOR", "c1", "b1", "bh1"),
  person("se1", "STAFF", "c1", "b1", "sm1"),
  person("se2", "STAFF", "c1", "b1", "sm1"),
  person("se1sub", "STAFF", "c1", "b1", "se1"), // reports to a Sales Executive
  person("cro1", "STAFF", "c1", "b1", "bh1"),
  person("bh2", "BRANCH_MANAGER", "c1", "b2", "ch"),
  person("cro2", "STAFF", "c1", "b2", "bh2"),
  person("other", "STAFF", "c2", "b9", null), // a different cluster
];

const find = (id: string): Person => {
  const found = ORG.find((p) => p.id === id);
  if (!found) throw new Error(`No such person: ${id}`);
  return found;
};

const visibleTo = (id: string): string[] =>
  ORG.filter((target) => canViewUser(find(id), target))
    .map((target) => target.id)
    .sort();

describe("canViewUser", () => {
  it("lets staff see only themselves", () => {
    expect(visibleTo("cro1")).toEqual(["cro1"]);
    expect(visibleTo("se1")).toEqual(["se1"]);
  });

  it("lets a supervisor see themselves and direct reports only", () => {
    expect(visibleTo("sm1")).toEqual(["se1", "se2", "sm1"]);
  });

  it("does not let a supervisor see a report's report, a peer, or their own boss", () => {
    const visible = visibleTo("sm1");
    expect(visible).not.toContain("se1sub");
    expect(visible).not.toContain("cro1");
    expect(visible).not.toContain("bh1");
  });

  it("lets a branch manager see the whole branch and nothing else", () => {
    const wholeBranch = ORG.filter((p) => p.branchId === "b1")
      .map((p) => p.id)
      .sort();
    expect(visibleTo("bh1")).toEqual(wholeBranch);
    expect(visibleTo("bh1")).not.toContain("cro2");
    expect(visibleTo("bh1")).not.toContain("ch");
  });

  it("gives the assistant branch head exactly the branch head's view", () => {
    expect(visibleTo("abh1")).toEqual(visibleTo("bh1"));
  });

  it("lets the cluster head see everyone in the cluster and no one outside it", () => {
    const wholeCluster = ORG.filter((p) => p.clusterId === "c1")
      .map((p) => p.id)
      .sort();
    expect(visibleTo("ch")).toEqual(wholeCluster);
    expect(visibleTo("ch")).not.toContain("other");
  });

  it("keeps a different cluster's people isolated", () => {
    expect(visibleTo("other")).toEqual(["other"]);
  });
});

describe("visibilityScope", () => {
  it("fails closed for a branch manager with no branch", () => {
    const orphan = { id: "x", role: "BRANCH_MANAGER" as const, clusterId: "c1", branchId: null };
    expect(visibilityScope(orphan)).toEqual({ kind: "SELF", userId: "x" });
  });

  it("maps each role to its scope", () => {
    expect(visibilityScope(find("cro1")).kind).toBe("SELF");
    expect(visibilityScope(find("sm1")).kind).toBe("TEAM");
    expect(visibilityScope(find("bh1")).kind).toBe("BRANCH");
    expect(visibilityScope(find("ch")).kind).toBe("CLUSTER");
  });
});

describe("userWhere", () => {
  it("renders each scope as a database filter", () => {
    expect(userWhere({ kind: "SELF", userId: "u" })).toEqual({ id: "u" });
    expect(userWhere({ kind: "TEAM", userId: "u" })).toEqual({
      OR: [{ id: "u" }, { reportsToId: "u" }],
    });
    expect(userWhere({ kind: "BRANCH", branchId: "b" })).toEqual({ branchId: "b" });
    expect(userWhere({ kind: "CLUSTER", clusterId: "c" })).toEqual({ clusterId: "c" });
  });
});