import { describe, expect, it } from "vitest";
import type { Role } from "../lib/roles";
import type { EntryStatus } from "../domain/entries/workflow";
import { canSubmitEntry, handledWhere, isInQueue, queueWhere, reviewLevelFor } from "./entry-policy";

const actor = (id: string, role: Role, branchId: string | null) => ({ id, role, branchId });

const BH1 = actor("bh1", "BRANCH_MANAGER", "b1");
const ABH1 = actor("abh1", "BRANCH_MANAGER", "b1");
const BH2 = actor("bh2", "BRANCH_MANAGER", "b2");
const SM1 = actor("sm1", "SUPERVISOR", "b1");
const SM2 = actor("sm2", "SUPERVISOR", "b2");
const CH = actor("ch", "CLUSTER_HEAD", null);
const CRO1 = actor("cro1", "STAFF", "b1");

const sale = (
  sellerId: string,
  branchId: string,
  sellerReportsToId: string | null,
  status: EntryStatus = "SUBMITTED",
) => ({ branchId, sellerId, sellerReportsToId, status });

const SE_IN_B1 = sale("se1", "b1", "sm1"); // a Sales Executive reporting to sm1
const CRO_IN_B1 = sale("cro1", "b1", "bh1");
const CRO_IN_B2 = sale("cro2", "b2", "bh2");

describe("reviewLevelFor: branch managers", () => {
  it("lets the BH and the ABH of a branch give final approval, equally", () => {
    expect(reviewLevelFor(BH1, SE_IN_B1)).toBe("FINAL");
    expect(reviewLevelFor(ABH1, SE_IN_B1)).toBe("FINAL");
    expect(reviewLevelFor(BH1, CRO_IN_B1)).toBe("FINAL");
    expect(reviewLevelFor(ABH1, CRO_IN_B1)).toBe("FINAL");
  });

  it("never lets a branch manager review another branch's sale", () => {
    expect(reviewLevelFor(BH1, CRO_IN_B2)).toBeNull();
    expect(reviewLevelFor(ABH1, CRO_IN_B2)).toBeNull();
    expect(reviewLevelFor(BH2, CRO_IN_B1)).toBeNull();
    expect(reviewLevelFor(BH2, SE_IN_B1)).toBeNull();
  });

  it("never lets anyone review their own sale", () => {
    expect(reviewLevelFor(ABH1, sale("abh1", "b1", "bh1"))).toBeNull();
    expect(reviewLevelFor(BH1, sale("abh1", "b1", "bh1"))).toBe("FINAL");
  });
});

describe("reviewLevelFor: supervisors", () => {
  it("gives a supervisor first-level review of their own direct reports", () => {
    expect(reviewLevelFor(SM1, SE_IN_B1)).toBe("FIRST");
  });

  it("refuses a supervisor anyone who does not report to them", () => {
    expect(reviewLevelFor(SM1, CRO_IN_B1)).toBeNull();
  });

  it("refuses a supervisor in another branch, even if the reporting line matches", () => {
    expect(reviewLevelFor(SM2, SE_IN_B1)).toBeNull();
    expect(reviewLevelFor(SM1, sale("se9", "b2", "sm1"))).toBeNull();
  });

  it("never lets a supervisor review their own sale", () => {
    expect(reviewLevelFor(SM1, sale("sm1", "b1", "sm1"))).toBeNull();
  });
});

describe("reviewLevelFor: Cluster Head and staff", () => {
  it("never lets the Cluster Head review anything", () => {
    for (const entry of [SE_IN_B1, CRO_IN_B1, CRO_IN_B2]) {
      expect(reviewLevelFor(CH, entry)).toBeNull();
    }
  });

  it("never lets staff review anything, not even a colleague's sale", () => {
    expect(reviewLevelFor(CRO1, SE_IN_B1)).toBeNull();
    expect(reviewLevelFor(CRO1, sale("cro3", "b1", "bh1"))).toBeNull();
  });

  it("fails closed for a branch manager with no branch", () => {
    expect(reviewLevelFor(actor("x", "BRANCH_MANAGER", null), SE_IN_B1)).toBeNull();
  });
});

describe("isInQueue", () => {
  it("shows a branch manager open entries in their own branch only", () => {
    expect(isInQueue(BH1, sale("se1", "b1", "sm1", "SUBMITTED"))).toBe(true);
    expect(isInQueue(BH1, sale("se1", "b1", "sm1", "L1_APPROVED"))).toBe(true);
    expect(isInQueue(BH1, sale("se1", "b1", "sm1", "VERIFIED"))).toBe(false);
    expect(isInQueue(BH1, sale("se1", "b1", "sm1", "REJECTED"))).toBe(false);
    expect(isInQueue(BH1, CRO_IN_B2)).toBe(false);
  });

  it("shows a supervisor only fresh entries from their direct reports", () => {
    expect(isInQueue(SM1, sale("se1", "b1", "sm1", "SUBMITTED"))).toBe(true);
    expect(isInQueue(SM1, sale("se1", "b1", "sm1", "L1_APPROVED"))).toBe(false);
    expect(isInQueue(SM1, CRO_IN_B1)).toBe(false);
  });

  it("shows the Cluster Head and staff nothing", () => {
    expect(isInQueue(CH, SE_IN_B1)).toBe(false);
    expect(isInQueue(CRO1, SE_IN_B1)).toBe(false);
  });
});

describe("queueWhere", () => {
  it("filters a branch manager's queue to their own branch, without their own sales", () => {
    expect(queueWhere(BH1)).toEqual({
      branchId: "b1",
      userId: { not: "bh1" },
      status: { in: ["SUBMITTED", "L1_APPROVED"] },
    });
  });

  it("filters a supervisor's queue to their own reports in their branch", () => {
    expect(queueWhere(SM1)).toEqual({
      branchId: "b1",
      userId: { not: "sm1" },
      status: { in: ["SUBMITTED"] },
      user: { reportsToId: "sm1" },
    });
  });

  it("gives the Cluster Head, staff and a branchless manager no queue at all", () => {
    expect(queueWhere(CH)).toBeNull();
    expect(queueWhere(CRO1)).toBeNull();
    expect(queueWhere(actor("x", "BRANCH_MANAGER", null))).toBeNull();
  });
});

describe("canSubmitEntry", () => {
  it("lets everyone with a branch record sales, except the Cluster Head", () => {
    expect(canSubmitEntry(CRO1)).toBe(true);
    expect(canSubmitEntry(SM1)).toBe(true);
    expect(canSubmitEntry(ABH1)).toBe(true);
    expect(canSubmitEntry(CH)).toBe(false);
  });

  it("refuses anyone without a branch", () => {
    expect(canSubmitEntry({ role: "STAFF", branchId: null })).toBe(false);
  });
});

describe("handledWhere", () => {
  it("shows a branch manager the reviews made in their own branch only", () => {
    expect(handledWhere(BH1)).toEqual({ entry: { branchId: "b1" } });
    expect(handledWhere(ABH1)).toEqual({ entry: { branchId: "b1" } });
    expect(handledWhere(BH2)).toEqual({ entry: { branchId: "b2" } });
  });

  it("shows a supervisor reviews of their own reports in their own branch", () => {
    expect(handledWhere(SM1)).toEqual({ entry: { branchId: "b1", user: { reportsToId: "sm1" } } });
  });

  it("gives the Cluster Head, staff and a branchless manager no history", () => {
    expect(handledWhere(CH)).toBeNull();
    expect(handledWhere(CRO1)).toBeNull();
    expect(handledWhere(actor("x", "BRANCH_MANAGER", null))).toBeNull();
  });
});