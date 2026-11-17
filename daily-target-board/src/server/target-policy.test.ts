import { describe, expect, it } from "vitest";
import type { Role } from "../lib/roles";
import { canEditTargetsOf, type ScopeTarget } from "./policy";

type Person = ScopeTarget & { isBranchContact: boolean };

const person = (
  id: string,
  role: Role,
  clusterId: string,
  branchId: string | null,
  reportsToId: string | null,
  isBranchContact = false,
): Person => ({ id, role, clusterId, branchId, reportsToId, isBranchContact });

const CH = person("ch", "CLUSTER_HEAD", "c1", null, null);
const BH1 = person("bh1", "BRANCH_MANAGER", "c1", "b1", "ch", true);
const ABH1 = person("abh1", "BRANCH_MANAGER", "c1", "b1", "bh1");
const ABH2 = person("abh2", "BRANCH_MANAGER", "c1", "b1", "bh1");
const SM1 = person("sm1", "SUPERVISOR", "c1", "b1", "bh1");
const SE1 = person("se1", "STAFF", "c1", "b1", "sm1");
const CRO1 = person("cro1", "STAFF", "c1", "b1", "bh1");
const BH2 = person("bh2", "BRANCH_MANAGER", "c1", "b2", "ch", true);
const CRO2 = person("cro2", "STAFF", "c1", "b2", "bh2");

describe("canEditTargetsOf", () => {
  it("lets the Branch Head set targets for anyone else in the branch, ABHs included", () => {
    for (const target of [ABH1, ABH2, SM1, SE1, CRO1]) {
      expect(canEditTargetsOf(BH1, target)).toBe(true);
    }
  });

  it("never lets anyone set their own targets", () => {
    expect(canEditTargetsOf(BH1, BH1)).toBe(false);
    expect(canEditTargetsOf(ABH1, ABH1)).toBe(false);
  });

  it("lets an ABH set targets for staff and supervisors, but not for the BH or another ABH", () => {
    for (const target of [SM1, SE1, CRO1]) expect(canEditTargetsOf(ABH1, target)).toBe(true);
    expect(canEditTargetsOf(ABH1, BH1)).toBe(false);
    expect(canEditTargetsOf(ABH1, ABH2)).toBe(false);
  });

  it("never crosses branches", () => {
    expect(canEditTargetsOf(BH1, CRO2)).toBe(false);
    expect(canEditTargetsOf(BH2, CRO1)).toBe(false);
    expect(canEditTargetsOf(ABH1, CRO2)).toBe(false);
  });

  it("refuses supervisors, staff and the Cluster Head", () => {
    expect(canEditTargetsOf(SM1, SE1)).toBe(false);
    expect(canEditTargetsOf(CRO1, SE1)).toBe(false);
    expect(canEditTargetsOf(CH, CRO1)).toBe(false);
  });

  it("fails closed for a branch manager with no branch", () => {
    const orphan = person("x", "BRANCH_MANAGER", "c1", null, null);
    expect(canEditTargetsOf(orphan, CRO1)).toBe(false);
  });
});