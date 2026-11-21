import Link from "next/link";
import { sortByGap, type BranchSummary } from "@/domain/performance/branch-status";
import { monthLabel } from "@/lib/month-label";
import { branchPlanSentence } from "@/lib/plain-words";
import type { BranchDetail } from "@/server/branch-overview";
import { PlainBar } from "./plain-bar";
import { PlainProductRow } from "./plain-product-row";
import { StatusPill } from "./status-pill";

export function ChBranchView({
  detail,
  summary,
}: {
  detail: BranchDetail;
  summary: BranchSummary | null;
}) {
  const hasPlan = detail.planVersion !== null;
  const products = sortByGap(detail.totals, (total) => total.performance);
  const needHelp = detail.employees.filter((employee) => employee.behindCount > 0).slice(0, 5);

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold">{detail.branch.name}</h1>
          <p className="text-sm text-slate-600">
            {monthLabel(detail.month)} · {detail.employees.length} people
          </p>
        </div>
        <StatusPill status={summary ? summary.status : "NO_PLAN"} />
      </div>

      {!hasPlan || !summary ? (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No plan has been published for this branch this month yet.
        </p>
      ) : (
        <>
          {detail.planStale ? (
            <p className="mt-4 rounded-2xl bg-amber-100 p-3 text-sm text-amber-900">
              Holidays changed after the plan was published. The branch manager needs to publish it
              again.
            </p>
          ) : null}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p>
              <span className="text-4xl font-bold">{summary.percentDone}%</span>{" "}
              <span className="text-sm text-slate-600">of the target done</span>
            </p>
            <div className="mt-3">
              <PlainBar
                percent={summary.percentDone}
                expected={summary.expectedPercent}
                status={summary.status}
                label={`${detail.branch.name} progress`}
              />
            </div>
            <p className="mt-2 text-sm text-slate-600">{branchPlanSentence(summary.expectedPercent)}</p>
          </section>

          <h2 className="mt-6 text-[15px] font-semibold">Product by product</h2>
          <p className="text-sm text-slate-600">Furthest behind the plan first.</p>
          <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
            {products.map((total) => (
              <PlainProductRow
                key={total.metricId}
                name={total.name}
                unit={total.unit}
                performance={total.performance}
              />
            ))}
          </div>

          {detail.branchWide.length > 0 ? (
            <>
              <h2 className="mt-6 text-[15px] font-semibold">Shared by the whole branch</h2>
              <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
                {detail.branchWide.map((figure) => (
                  <PlainProductRow
                    key={figure.metricId}
                    name={figure.name}
                    unit={figure.unit}
                    performance={figure.performance}
                  />
                ))}
              </div>
            </>
          ) : null}

          <h2 className="mt-6 text-[15px] font-semibold">People who need help first</h2>
          {needHelp.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Nobody is behind.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
              {needHelp.map((employee) => (
                <li key={employee.userId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{employee.name}</p>
                    <p className="text-sm text-slate-600">{employee.designation}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-[13px] font-semibold text-red-800">
                    {employee.behindCount} behind
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h2 className="mt-6 text-[15px] font-semibold">Everyone in this branch ({detail.employees.length})</h2>
      <ul className="mt-2 space-y-2">
        {detail.employees.map((employee) => (
          <li key={employee.userId}>
            <details className="rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{employee.name}</span>
                  <span className="block text-sm text-slate-600">{employee.designation}</span>
                </span>
                {employee.figures.length > 0 ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                      employee.behindCount > 0 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                    }`}
                  >
                    {employee.behindCount > 0 ? `${employee.behindCount} behind` : "Nothing behind"}
                  </span>
                ) : null}
              </summary>
              <div className="divide-y divide-slate-100 border-t border-slate-100 px-4">
                {employee.figures.length === 0 ? (
                  <p className="py-3 text-sm text-slate-600">No personal targets.</p>
                ) : (
                  sortByGap(employee.figures, (figure) => figure.performance).map((figure) => (
                    <PlainProductRow
                      key={figure.metricId}
                      name={figure.name}
                      unit={figure.unit}
                      performance={figure.performance}
                    />
                  ))
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>

      <Link
        href={`/cluster/targets/${detail.branch.code}`}
        className="mt-6 block rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium"
      >
        Edit this branch&apos;s targets
      </Link>
    </div>
  );
}