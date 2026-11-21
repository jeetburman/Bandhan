import type { ProgressStatus, StatusKey } from "../domain/performance/branch-status";
import type { Performance } from "../domain/performance/performance";
import { formatQty } from "./money";

const LABELS: Record<StatusKey, string> = {
  BEHIND: "Behind the plan",
  SLIGHTLY_BEHIND: "A little behind",
  ON_TRACK: "On track",
  ACHIEVED: "Achieved",
  NO_PLAN: "No plan yet",
};

export function statusLabel(status: StatusKey): string {
  return LABELS[status];
}

/** "Should be ₹1,70,00,000 by now. ₹58,00,000 behind." */
export function plainPlanLine(
  unit: "COUNT" | "AMOUNT",
  p: Pick<Performance, "outlook" | "expectedQty" | "behindQty" | "aheadQty">,
): string {
  if (p.outlook === "ACHIEVED") return "Target met.";
  if (p.expectedQty === 0) return "Nothing was due yet.";

  const base = `Should be ${formatQty(unit, p.expectedQty)} by now.`;
  if (p.behindQty > 0) return `${base} ${formatQty(unit, p.behindQty)} behind.`;
  if (p.aheadQty > 0) return `${base} ${formatQty(unit, p.aheadQty)} ahead.`;
  return `${base} Right on plan.`;
}

export function branchPlanSentence(expectedPercent: number): string {
  return `The plan says ${expectedPercent}% by now.`;
}

export function clusterSentence(status: ProgressStatus, expectedPercent: number): string {
  const verdict =
    status === "BEHIND"
      ? "behind the plan"
      : status === "SLIGHTLY_BEHIND"
        ? "a little behind"
        : "on track";
  return `The plan says ${expectedPercent}% by now, so the cluster is ${verdict}.`;
}

export function peopleLine(behind: number, withTargets: number): string {
  if (withTargets === 0) return "Nobody has personal targets yet.";
  if (behind === 0) return "Nobody is behind.";
  return `${behind} of ${withTargets} people with targets ${behind === 1 ? "is" : "are"} behind.`;
}

export function furthestLine(names: readonly string[]): string {
  return names.length > 0 ? `Furthest behind: ${names.join(", ")}.` : "Everything is close to plan.";
}