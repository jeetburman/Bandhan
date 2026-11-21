import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BranchCard } from "@/components/branch-card";
import { ClusterSummaryCard } from "@/components/cluster-summary-card";
import { monthLabel } from "@/lib/month-label";
import { loadClusterView } from "@/server/cluster-summary";
import { getCurrentActor } from "@/server/current-actor";

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const view = await loadClusterView(actor);
  if (!view) notFound();

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-[22px] font-bold">{view.clusterName}</h1>
      <p className="text-sm text-slate-600">
        {monthLabel(view.month)} · {view.cards.length} branches · {view.headcount} people
      </p>

      {view.overall ? (
        <div className="mt-4">
          <ClusterSummaryCard summary={view.overall} />
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No branch has published a plan for this month yet.
        </p>
      )}

      <h2 className="mt-6 text-[15px] font-semibold">Your branches</h2>
      <p className="text-sm text-slate-600">The ones that need you first are at the top.</p>
      <ul className="mt-3 space-y-3">
        {view.cards.map((card) => (
          <li key={card.code}>
            <BranchCard card={card} />
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function ClusterPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body />
    </Suspense>
  );
}