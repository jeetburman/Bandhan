import { describe, expect, it } from "vitest";
import {
  branchPlanSentence,
  clusterSentence,
  furthestLine,
  peopleLine,
  plainPlanLine,
  statusLabel,
} from "./plain-words";

describe("statusLabel", () => {
  it("uses the agreed words", () => {
    expect(statusLabel("BEHIND")).toBe("Behind the plan");
    expect(statusLabel("SLIGHTLY_BEHIND")).toBe("A little behind");
    expect(statusLabel("ON_TRACK")).toBe("On track");
    expect(statusLabel("ACHIEVED")).toBe("Achieved");
    expect(statusLabel("NO_PLAN")).toBe("No plan yet");
  });
});

describe("plainPlanLine", () => {
  it("says how far behind an amount is", () => {
    expect(
      plainPlanLine("AMOUNT", {
        outlook: "BEHIND",
        expectedQty: 1_700_000_000,
        behindQty: 580_000_000,
        aheadQty: 0,
      }),
    ).toBe("Should be ₹1,70,00,000 by now. ₹58,00,000 behind.");
  });

  it("says how far ahead a count is, and when it is level", () => {
    expect(
      plainPlanLine("COUNT", { outlook: "ON_PACE", expectedQty: 36, behindQty: 0, aheadQty: 2 }),
    ).toBe("Should be 36 by now. 2 ahead.");
    expect(
      plainPlanLine("COUNT", { outlook: "ON_PACE", expectedQty: 9, behindQty: 0, aheadQty: 0 }),
    ).toBe("Should be 9 by now. Right on plan.");
  });

  it("handles a met target and a month that has just started", () => {
    expect(
      plainPlanLine("COUNT", { outlook: "ACHIEVED", expectedQty: 9, behindQty: 0, aheadQty: 4 }),
    ).toBe("Target met.");
    expect(
      plainPlanLine("COUNT", { outlook: "NOT_STARTED", expectedQty: 0, behindQty: 0, aheadQty: 0 }),
    ).toBe("Nothing was due yet.");
  });
});

describe("sentences", () => {
  it("states the plan for a branch", () => {
    expect(branchPlanSentence(55)).toBe("The plan says 55% by now.");
  });

  it("gives the cluster a plain verdict", () => {
    expect(clusterSentence("BEHIND", 55)).toBe("The plan says 55% by now, so the cluster is behind the plan.");
    expect(clusterSentence("SLIGHTLY_BEHIND", 55)).toContain("a little behind");
    expect(clusterSentence("ON_TRACK", 55)).toContain("on track");
  });

  it("counts people with the right verb", () => {
    expect(peopleLine(7, 10)).toBe("7 of 10 people with targets are behind.");
    expect(peopleLine(1, 14)).toBe("1 of 14 people with targets is behind.");
    expect(peopleLine(0, 10)).toBe("Nobody is behind.");
    expect(peopleLine(0, 0)).toBe("Nobody has personal targets yet.");
  });

  it("names the furthest behind products, or says all is close", () => {
    expect(furthestLine(["Fixed deposit value", "Savings accounts"])).toBe(
      "Furthest behind: Fixed deposit value, Savings accounts.",
    );
    expect(furthestLine([])).toBe("Everything is close to plan.");
  });
});