import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BranchDetailView } from "@/components/branch-detail-view";
import { istBusinessDate } from "@/lib/ist";
import { loadOwnBranchDetail } from "@/server/branch-overview";
import { getCurrentActor } from "@/server/current-actor";

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected
  if (actor.role === "CLUSTER_HEAD") redirect("/cluster");

  const today = istBusinessDate(new Date());
  const detail = await loadOwnBranchDetail(actor, today.slice(0, 7), today);
  if (!detail) notFound();

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Link
        href="/branch/targets"
        className="block rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white"
      >
        Assign employee targets
      </Link>
      <BranchDetailView detail={detail} />
    </main>
  );
}

export default function BranchPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body />
    </Suspense>
  );
}