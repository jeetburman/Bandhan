import Link from "next/link";
import { Suspense } from "react";
import { BranchPicker } from "@/components/branch-picker";
import { PlanChip } from "@/components/plan-chip";
import { istBusinessDate } from "@/lib/ist";
import { monthLabel } from "@/lib/month-label";
import { listPickerBranches, loadClusterOverview } from "@/server/branch-overview";
import { getCurrentActor } from "@/server/current-actor";

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const month = istBusinessDate(new Date()).slice(0, 7);
  const [overview, pickerBranches] = await Promise.all([
    loadClusterOverview(actor, month),
    listPickerBranches(actor),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold">{overview.clusterName}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {monthLabel(month)} · {overview.cards.length} branches
      </p>

      <div className="mt-4">
        <BranchPicker branches={pickerBranches} current={null} />
      </div>

      <ul className="mt-4 space-y-2">
        {overview.cards.map((card) => (
          <li key={card.code}>
            <Link
              href={`/cluster/${card.code}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{card.name}</p>
                <p className="text-xs text-slate-500">{card.headcount} people</p>
              </div>
              <PlanChip version={card.planVersion} stale={card.planStale} />
            </Link>
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