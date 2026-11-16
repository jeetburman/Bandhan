import { describe, expect, it } from "vitest";
import {
  checkActivityDate,
  countsTowardProgress,
  initialStatus,
  isPending,
  nextStatus,
  reviewableStatuses,
  statusLabel,
  type EntryStatus,
} from "./workflow";

const ALL: EntryStatus[] = ["SUBMITTED", "L1_APPROVED", "VERIFIED", "REJECTED"];

describe("initialStatus", () => {
  it("starts a normal employee's sale as SUBMITTED", () => {
    expect(initialStatus(true)).toEqual({ status: "SUBMITTED", autoVerified: false });
  });

  it("counts a sale straight away when no verification is needed", () => {
    expect(initialStatus(false)).toEqual({ status: "VERIFIED", autoVerified: true });
  });
});

describe("nextStatus: supervisor (FIRST)", () => {
  it("approves a submitted entry provisionally", () => {
    expect(nextStatus("SUBMITTED", "FIRST", "APPROVE")).toBe("L1_APPROVED");
  });

  it("can reject a submitted entry", () => {
    expect(nextStatus("SUBMITTED", "FIRST", "REJECT")).toBe("REJECTED");
  });

  it("cannot act on anything else", () => {
    for (const status of ["L1_APPROVED", "VERIFIED", "REJECTED"] as const) {
      expect(() => nextStatus(status, "FIRST", "APPROVE")).toThrow();
      expect(() => nextStatus(status, "FIRST", "REJECT")).toThrow();
    }
  });
});

describe("nextStatus: branch manager (FINAL)", () => {
  it("verifies a submitted or supervisor-approved entry", () => {
    expect(nextStatus("SUBMITTED", "FINAL", "APPROVE")).toBe("VERIFIED");
    expect(nextStatus("L1_APPROVED", "FINAL", "APPROVE")).toBe("VERIFIED");
  });

  it("can reject a submitted or supervisor-approved entry", () => {
    expect(nextStatus("SUBMITTED", "FINAL", "REJECT")).toBe("REJECTED");
    expect(nextStatus("L1_APPROVED", "FINAL", "REJECT")).toBe("REJECTED");
  });

  it("can never change a finished entry", () => {
    for (const status of ["VERIFIED", "REJECTED"] as const) {
      expect(() => nextStatus(status, "FINAL", "APPROVE")).toThrow();
      expect(() => nextStatus(status, "FINAL", "REJECT")).toThrow();
    }
  });
});

describe("reviewableStatuses", () => {
  it("lets a supervisor see only fresh entries, and a branch manager see both open ones", () => {
    expect(reviewableStatuses("FIRST")).toEqual(["SUBMITTED"]);
    expect(reviewableStatuses("FINAL")).toEqual(["SUBMITTED", "L1_APPROVED"]);
  });
});

describe("progress and labels", () => {
  it("counts only verified sales", () => {
    expect(ALL.filter(countsTowardProgress)).toEqual(["VERIFIED"]);
  });

  it("treats SUBMITTED and L1_APPROVED as pending", () => {
    expect(ALL.filter(isPending)).toEqual(["SUBMITTED", "L1_APPROVED"]);
  });

  it("has a label for every status", () => {
    for (const status of ALL) expect(statusLabel(status).length).toBeGreaterThan(0);
  });
});

describe("checkActivityDate", () => {
  const today = "2026-11-12";

  it("accepts today and the oldest allowed day", () => {
    expect(() => checkActivityDate("2026-11-12", today)).not.toThrow();
    expect(() => checkActivityDate("2026-11-05", today)).not.toThrow();
  });

  it("rejects the future and anything too old", () => {
    expect(() => checkActivityDate("2026-11-13", today)).toThrow();
    expect(() => checkActivityDate("2026-11-04", today)).toThrow();
  });

  it("rejects a date that does not exist", () => {
    expect(() => checkActivityDate("2026-02-30", today)).toThrow();
  });
});