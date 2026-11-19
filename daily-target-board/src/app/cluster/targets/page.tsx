import Link from "next/link";
import { Suspense } from "react";
import { BranchPicker } from "@/components/branch-picker";
import { istBusinessDate } from "@/lib/ist";
import { monthLabel } from "@/lib/month-label";
import { listPickerBranches } from "@/server/branch-overview";
import { getCurrentActor } from "@/server/current-actor";

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const month = istBusinessDate(new Date()).slice(0, 7);
  const branches = await listPickerBranches(actor);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold">Branch targets</h1>
      <p className="mt-1 text-sm text-slate-600">
        {monthLabel(month)} · choose a branch to set its monthly targets. Branch managers then divide
        them among their employees.
      </p>

      <div className="mt-4">
        <BranchPicker branches={branches} current={null} basePath="/cluster/targets" allLabel={null} />
      </div>

      <ul className="mt-4 space-y-2">
        {branches.map((branch) => (
          <li key={branch.code}>
            <Link
              href={`/cluster/targets/${branch.code}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4"
            >
              <span className="text-sm font-medium">{branch.name}</span>
              <span className="text-xs text-slate-500">Edit targets →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function ClusterTargetsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body />
    </Suspense>
  );
}