import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BranchDetailView } from "@/components/branch-detail-view";
import { BranchPicker } from "@/components/branch-picker";
import { istBusinessDate } from "@/lib/ist";
import { listPickerBranches, loadBranchDetail } from "@/server/branch-overview";
import { getCurrentActor } from "@/server/current-actor";

async function Body({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const today = istBusinessDate(new Date());
  const [detail, pickerBranches] = await Promise.all([
    loadBranchDetail(actor, code, today.slice(0, 7), today),
    listPickerBranches(actor),
  ]);
  if (!detail) notFound();

  return (
    <main className="mx-auto max-w-2xl p-4">
      <BranchPicker branches={pickerBranches} current={detail.branch.code} />
      <BranchDetailView detail={detail} />
    </main>
  );
}

export default function BranchPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body params={params} />
    </Suspense>
  );
}