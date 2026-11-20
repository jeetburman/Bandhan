import { cutoffLabel } from "@/lib/cutoff";
import { formatShortDate } from "@/lib/format-time";
import { formatQty } from "@/lib/money";
import { monthLabel } from "@/lib/month-label";
import type { BranchDetail, EmployeeFigures } from "@/server/branch-overview";
import { PerformanceRow } from "./performance-row";
import { PlanChip } from "./plan-chip";

function EmployeeChip({ employee }: { employee: EmployeeFigures }) {
  if (employee.figures.length === 0) return null;
  if (employee.behindCount > 0) {
    return (
      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
        {employee.behindCount} behind
      </span>
    );
  }
  const allDone = employee.figures.every((f) => f.performance.outlook === "ACHIEVED");
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
        allDone ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"
      }`}
    >
      {allDone ? "All achieved" : "None behind"}
    </span>
  );
}

export function BranchDetailView({ detail }: { detail: BranchDetail }) {
  const hasPlan = detail.planVersion !== null;
  const { days } = detail;

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{detail.branch.name}</h1>
          <p className="text-sm text-slate-600">
            {monthLabel(detail.month)} · as of {formatShortDate(detail.today)}
          </p>
        </div>
        <PlanChip version={detail.planVersion} stale={detail.planStale} />
      </div>

      {!hasPlan ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No plan has been published for this branch this month yet.
        </p>
      ) : (
        <>
          {detail.planStale ? (
            <p className="mt-4 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
              Holidays changed after this plan was published. The branch manager needs to
              re-publish it.
            </p>
          ) : null}

          <p className="mt-3 text-xs text-slate-500">
            {days.elapsed} of {days.total} working days done · {days.remaining} left · a day closes
            at {cutoffLabel()}. Only verified sales count.
          </p>

          <section className="mt-4">
            <h2 className="text-sm font-semibold">Branch totals</h2>
            <p className="text-xs text-slate-500">
              All verified sales in the branch, against what employees have been assigned. The dark
              mark on each bar is where the plan says the branch should be today.
            </p>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
              {detail.totals.map((total) => (
                <li key={total.metricId}>
                  <PerformanceRow figure={total} showProjection />
                  {total.branchTargetQty !== null && total.branchTargetQty !== total.monthQty ? (
                    <p className="-mt-1 pb-3 text-xs text-amber-800">
                      Employee targets add up to {formatQty(total.unit, total.monthQty)}, which is{" "}
                      {formatQty(total.unit, Math.abs(total.branchTargetQty - total.monthQty))}{" "}
                      {total.monthQty < total.branchTargetQty ? "below" : "above"} the Cluster
                      Head&apos;s target of {formatQty(total.unit, total.branchTargetQty)}.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {detail.branchWide.length > 0 ? (
            <section className="mt-4">
              <h2 className="text-sm font-semibold">Shared by the whole branch</h2>
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
                {detail.branchWide.map((f) => (
                  <li key={f.metricId}>
                    <PerformanceRow figure={f} showProjection />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Employees ({detail.employees.length})</h2>
        {hasPlan ? <p className="text-xs text-slate-500">Most behind first.</p> : null}
        <ul className="mt-2 space-y-2">
          {detail.employees.map((employee) => (
            <li key={employee.userId}>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{employee.name}</span>
                    <span className="block text-xs text-slate-500">{employee.designation}</span>
                  </span>
                  <EmployeeChip employee={employee} />
                </summary>
                <div className="divide-y divide-slate-100 border-t border-slate-100 px-4">
                  {employee.figures.length === 0 ? (
                    <p className="py-3 text-sm text-slate-500">
                      {hasPlan ? "No personal targets." : "No plan published yet."}
                    </p>
                  ) : (
                    employee.figures.map((f) => <PerformanceRow key={f.metricId} figure={f} />)
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}