import type { ClusterSummary } from "@/domain/performance/branch-status";
import { clusterSentence } from "@/lib/plain-words";
import { PlainBar } from "./plain-bar";

export function ClusterSummaryCard({ summary }: { summary: ClusterSummary }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">The whole cluster</p>
      <p className="mt-1">
        <span className="text-4xl font-bold">{summary.percentDone}%</span>{" "}
        <span className="text-sm text-slate-600">of the target done</span>
      </p>
      <div className="mt-3">
        <PlainBar
          percent={summary.percentDone}
          expected={summary.expectedPercent}
          status={summary.status}
          label="Cluster progress"
        />
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {clusterSentence(summary.status, summary.expectedPercent)}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xl font-bold">
            {summary.peopleBehind} of {summary.peopleWithTargets}
          </p>
          <p className="text-sm text-slate-600">people are behind</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xl font-bold">{summary.branchesBehind}</p>
          <p className="text-sm text-slate-600">
            {summary.branchesBehind === 1 ? "branch is" : "branches are"} behind the plan
          </p>
        </div>
      </div>
    </section>
  );
}