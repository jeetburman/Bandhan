import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BranchPicker } from "@/components/branch-picker";
import { BranchTargetEditor } from "@/components/branch-target-editor";
import { monthLabel } from "@/lib/month-label";
import { listPickerBranches } from "@/server/branch-overview";
import { loadBranchTargetsForEditing } from "@/server/branch-targets";
import { getCurrentActor } from "@/server/current-actor";

type Params = Promise<{ code: string }>;
type SearchParams = Promise<{ saved?: string }>;

async function Body({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { code } = await params;
  const { saved } = await searchParams;
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const [data, branches] = await Promise.all([
    loadBranchTargetsForEditing(actor, code),
    listPickerBranches(actor),
  ]);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Link href="/cluster/targets" className="text-sm text-slate-600">
        ← All branches
      </Link>
      <div className="mt-2">
        <BranchPicker
          branches={branches}
          current={data.branch.code}
          basePath="/cluster/targets"
          allLabel={null}
        />
      </div>
      <h1 className="mt-4 text-xl font-semibold">{data.branch.name}</h1>
      <p className="text-sm text-slate-600">{monthLabel(data.month)}</p>

      {saved === "1" ? (
        <p role="status" className="mt-3 rounded-xl bg-green-100 p-3 text-sm text-green-900">
          Targets updated. The branch manager can see what changed.
        </p>
      ) : null}

      <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
        You set the branch&apos;s targets. The branch manager divides them among employees, so changing
        a number here never alters an employee&apos;s own target.
      </p>

      <div className="mt-4">
        <BranchTargetEditor
          key={data.cells.map((cell) => cell.current).join("|")}
          branchCode={data.branch.code}
          cells={data.cells}
        />
      </div>
    </main>
  );
}

export default function BranchTargetsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}