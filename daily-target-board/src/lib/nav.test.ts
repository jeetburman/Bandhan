import { describe, expect, it } from "vitest";
import { activeNavHref, navItemsFor } from "./nav";
import { canAccessSection, type Role, type Section } from "./roles";

const ROLES: Role[] = ["STAFF", "SUPERVISOR", "BRANCH_MANAGER", "CLUSTER_HEAD"];
const hrefs = (role: Role) => navItemsFor(role).map((item) => item.href);

describe("navItemsFor", () => {
  it("only links to sections the role is allowed to open", () => {
    for (const role of ROLES) {
      for (const item of navItemsFor(role)) {
        const section = item.href.split("/")[1] as Section;
        expect(canAccessSection(role, section)).toBe(true);
      }
    }
  });

  it("never gives the Cluster Head an approvals or personal-sales link", () => {
    expect(hrefs("CLUSTER_HEAD")).toEqual(["/cluster", "/cluster/targets"]);
  });

  it("gives approvals to supervisors and branch managers, and to nobody else", () => {
    expect(hrefs("SUPERVISOR")).toContain("/approvals");
    expect(hrefs("BRANCH_MANAGER")).toContain("/approvals");
    expect(hrefs("STAFF")).not.toContain("/approvals");
    expect(hrefs("CLUSTER_HEAD")).not.toContain("/approvals");
  });

  it("gives target assignment to branch managers only", () => {
    expect(hrefs("BRANCH_MANAGER")).toContain("/branch/targets");
    for (const role of ["STAFF", "SUPERVISOR", "CLUSTER_HEAD"] as const) {
      expect(hrefs(role)).not.toContain("/branch/targets");
    }
  });

  it("has no repeated links or labels", () => {
    for (const role of ROLES) {
      const items = navItemsFor(role);
      expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
      expect(new Set(items.map((i) => i.label)).size).toBe(items.length);
    }
  });

  it("returns a copy, so callers cannot change the shared list", () => {
    navItemsFor("STAFF").pop();
    expect(navItemsFor("STAFF")).toHaveLength(3);
  });
});

describe("activeNavHref", () => {
  const supervisor = navItemsFor("SUPERVISOR");
  const clusterHead = navItemsFor("CLUSTER_HEAD");
  const manager = navItemsFor("BRANCH_MANAGER");

  it("picks the most specific match", () => {
    expect(activeNavHref(supervisor, "/me")).toBe("/me");
    expect(activeNavHref(supervisor, "/me/new")).toBe("/me/new");
  });

  it("keeps pages without their own tab under the nearest one", () => {
    expect(activeNavHref(supervisor, "/me/sales")).toBe("/me");
    expect(activeNavHref(manager, "/me/new")).toBe("/me");
  });

  it("keeps branch pages under Cluster, and target pages under Targets", () => {
    expect(activeNavHref(clusterHead, "/cluster/B06")).toBe("/cluster");
    expect(activeNavHref(clusterHead, "/cluster/targets")).toBe("/cluster/targets");
    expect(activeNavHref(clusterHead, "/cluster/targets/B06")).toBe("/cluster/targets");
    expect(activeNavHref(manager, "/branch/targets/abc123")).toBe("/branch/targets");
  });

  it("does not match a different path that merely starts the same", () => {
    expect(activeNavHref(supervisor, "/members")).toBeNull();
  });

  it("is null when no tab matches", () => {
    expect(activeNavHref(navItemsFor("STAFF"), "/approvals")).toBeNull();
  });
});