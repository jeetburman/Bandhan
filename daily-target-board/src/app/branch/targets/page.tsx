import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { formatShortDate } from "@/lib/format-time";
import { formatQty } from "@/lib/money";
import { monthLabel } from "@/lib/month-label";
import { homePathFor } from "@/lib/roles";
import { getCurrentActor } from "@/server/current-actor";
import { loadTargetsOverview, type OverviewMetric } from "@/server/target-grid";

type SearchParams = Promise<{ saved?: string }>;

function comparison(metric: OverviewMetric): { text: string; style: string } {
  if (metric.branchTarget === null) {
    return { text: "No branch target set", style: "bg-slate-100 text-slate-700" };
  }
  const diff = metric.allocated - metric.branchTarget;
  if (diff === 0) return { text: "Matches the branch target", style: "bg-green-100 text-green-800" };
  const amount = formatQty(metric.unit, Math.abs(diff));
  return diff > 0
    ? { text: `${amount} above the branch target`, style: "bg-amber-100 text-amber-900" }
    : { text: `${amount} below the branch target`, style: "bg-amber-100 text-amber-900" };
}

async function Body({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected
  if (actor.role !== "BRANCH_MANAGER") redirect(homePathFor(actor.role));

  const params = await searchParams;
  const overview = await loadTargetsOverview(actor);
  if (!overview) notFound();

  const savedName =
    typeof params.saved === "string"
      ? overview.people.find((person) => person.id === params.saved)?.name
      : undefined;
  const from =
    overview.effectiveFrom === null
      ? null
      : overview.effectiveFrom === overview.today
        ? "today"
        : formatShortDate(overview.effectiveFrom);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Link href="/branch" className="text-sm text-slate-600">
        ← Branch
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Employee targets</h1>
      <p className="text-sm text-slate-600">
        {overview.branchName} · {monthLabel(overview.month)}
      </p>

      {savedName ? (
        <p role="status" className="mt-3 rounded-xl bg-green-100 p-3 text-sm text-green-900">
          Targets updated for {savedName}.
        </p>
      ) : null}

      {overview.planVersion === null ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No plan has been published for this branch this month yet.
        </p>
      ) : (
        <>
          <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            {from
              ? `Changes apply from ${from}. Days that have already closed keep their targets.`
              : "No working days are left this month, so targets can't be changed."}
          </p>

          <section className="mt-6">
            <h2 className="text-sm font-semibold">What you have assigned</h2>
            <p className="text-xs text-slate-500">All employees added up, against the Cluster Head&apos;s target.</p>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
              {overview.metrics.map((metric) => {
                const result = comparison(metric);
                return (
                  <li key={metric.metricId} className="py-3">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-slate-700">{metric.name}</span>
                      <span className="tabular-nums">
                        <span className="font-medium">{formatQty(metric.unit, metric.allocated)}</span>
                        {metric.branchTarget !== null ? (
                          <span className="text-slate-500"> of {formatQty(metric.unit, metric.branchTarget)}</span>
                        ) : null}
                      </span>
                    </div>
                    <p className="mt-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${result.style}`}>{result.text}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold">Employees ({overview.people.length})</h2>
            <ul className="mt-2 space-y-2">
              {overview.people.map((person) => {
                const card = (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{person.name}</p>
                      <p className="text-xs text-slate-500">{person.designation}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {person.isSelf
                        ? "You"
                        : !person.editable
                          ? "Not editable"
                          : person.targetCount > 0
                            ? `${person.targetCount} targets`
                            : "No targets"}
                    </span>
                  </div>
                );
                return (
                  <li key={person.id}>
                    {person.editable ? (
                      <Link
                        href={`/branch/targets/${person.id}`}
                        className="block rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        {card}
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">{card}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

export default function TargetsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}