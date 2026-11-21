import Link from "next/link";
import { branchPlanSentence, furthestLine, peopleLine } from "@/lib/plain-words";
import type { ClusterBranchCard } from "@/server/cluster-summary";
import { PlainBar } from "./plain-bar";
import { StatusPill } from "./status-pill";

export function BranchCard({ card }: { card: ClusterBranchCard }) {
  const summary = card.summary;

  return (
    <Link href={`/cluster/${card.code}`} className="block rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[17px] font-semibold">{card.name}</p>
        <StatusPill status={summary ? summary.status : "NO_PLAN"} />
      </div>
      <p className="text-sm text-slate-600">{card.headcount} people</p>

      {summary ? (
        <>
          <p className="mt-3">
            <span className="text-3xl font-bold">{summary.percentDone}%</span>{" "}
            <span className="text-sm text-slate-600">of the target done</span>
          </p>
          <div className="mt-2">
            <PlainBar
              percent={summary.percentDone}
              expected={summary.expectedPercent}
              status={summary.status}
              label={`${card.name} progress`}
            />
          </div>
          <p className="mt-2 text-sm text-slate-600">{branchPlanSentence(summary.expectedPercent)}</p>
          <p className="mt-2 text-sm">{peopleLine(summary.peopleBehind, summary.peopleWithTargets)}</p>
          <p className="text-sm">{furthestLine(summary.furthest)}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          No plan has been published for this branch this month yet.
        </p>
      )}
    </Link>
  );
}