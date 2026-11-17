import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { TargetEditor } from "@/components/target-editor";
import { formatShortDate } from "@/lib/format-time";
import { monthLabel } from "@/lib/month-label";
import { homePathFor } from "@/lib/roles";
import { getCurrentActor } from "@/server/current-actor";
import { loadEmployeeTargets } from "@/server/target-grid";

async function Body({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected
  if (actor.role !== "BRANCH_MANAGER") redirect(homePathFor(actor.role));

  const data = await loadEmployeeTargets(actor, userId);
  if (!data) notFound();

  const from =
    data.effectiveFrom === null
      ? null
      : data.effectiveFrom === data.today
        ? "today"
        : formatShortDate(data.effectiveFrom);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Link href="/branch/targets" className="text-sm text-slate-600">
        ← All employees
      </Link>
      <h1 className="mt-2 text-xl font-semibold">{data.person.name}</h1>
      <p className="text-sm text-slate-600">
        {data.person.designation} · {monthLabel(data.month)}
      </p>

      {data.planVersion === null ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No plan has been published for this branch this month yet.
        </p>
      ) : from === null ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No working days are left this month, so targets can&apos;t be changed.
        </p>
      ) : (
        <>
          <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            Changes apply from {from}. Days that have already closed keep their targets, and a target
            can&apos;t drop below what has already fallen due.
          </p>
          <div className="mt-4">
            <TargetEditor userId={data.person.id} cells={data.cells} />
          </div>
        </>
      )}
    </main>
  );
}

export default function EmployeeTargetsPage({ params }: { params: Promise<{ userId: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body params={params} />
    </Suspense>
  );
}