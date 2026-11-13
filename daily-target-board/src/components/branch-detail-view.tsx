import { formatQty } from "@/lib/money";
import { monthLabel } from "@/lib/month-label";
import type { BranchDetail, Figure } from "@/server/branch-overview";
import { PlanChip } from "./plan-chip";

function FigureRow({ figure }: { figure: Figure }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="text-slate-700">{figure.name}</span>
      <span className="text-right tabular-nums">
        <span className="font-medium">{formatQty(figure.unit, figure.dueQty)}</span>
        <span className="text-slate-500"> of {formatQty(figure.unit, figure.monthQty)}</span>
      </span>
    </div>
  );
}

export function BranchDetailView({ detail }: { detail: BranchDetail }) {
  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{detail.branch.name}</h1>
          <p className="text-sm text-slate-600">
            {monthLabel(detail.month)} · as of {detail.today}
          </p>
        </div>
        <PlanChip version={detail.planVersion} stale={detail.planStale} />
      </div>

      {detail.planVersion === null ? (
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

          <section className="mt-4">
            <h2 className="text-sm font-semibold">Branch totals</h2>
            <p className="text-xs text-slate-500">
              What has fallen due by today, out of the monthly target. Achieved figures arrive
              with progress entries.
            </p>
            <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
              {detail.totals.map((f) => (
                <FigureRow key={f.metricId} figure={f} />
              ))}
            </div>
          </section>

          {detail.branchWide.length > 0 ? (
            <section className="mt-4">
              <h2 className="text-sm font-semibold">Shared by the whole branch</h2>
              <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
                {detail.branchWide.map((f) => (
                  <FigureRow key={f.metricId} figure={f} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="text-sm font-semibold">Employees ({detail.employees.length})</h2>
            <ul className="mt-2 space-y-2">
              {detail.employees.map((employee) => (
                <li key={employee.userId}>
                  <details className="rounded-xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3">
                      <span className="text-sm font-medium">{employee.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{employee.designation}</span>
                    </summary>
                    <div className="divide-y divide-slate-100 border-t border-slate-100 px-4">
                      {employee.figures.length === 0 ? (
                        <p className="py-3 text-sm text-slate-500">No personal targets.</p>
                      ) : (
                        employee.figures.map((f) => <FigureRow key={f.metricId} figure={f} />)
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}