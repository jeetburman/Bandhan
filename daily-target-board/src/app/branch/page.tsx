import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BranchDetailView } from "@/components/branch-detail-view";
import { PublishPlanButton } from "@/components/publish-plan-button";
import { istBusinessDate } from "@/lib/ist";
import { monthLabel } from "@/lib/month-label";
import { loadOwnBranchDetail } from "@/server/branch-overview";
import { getCurrentActor } from "@/server/current-actor";
import { countQueue } from "@/server/entries";
import { loadBranchPlanStatus } from "@/server/plan-status";

function listNames(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected
  if (actor.role === "CLUSTER_HEAD") redirect("/cluster");

  const today = istBusinessDate(new Date());
  const [detail, status, waiting] = await Promise.all([
    loadOwnBranchDetail(actor, today.slice(0, 7), today),
    loadBranchPlanStatus(actor),
    countQueue(actor),
  ]);
  if (!detail || !status) notFound();

  const reasons: string[] = [];
  if (status.holidaysChanged) reasons.push("holidays changed");
  if (status.branchWideChanged.length > 0) {
    reasons.push(`${listNames(status.branchWideChanged)} target changed`);
  }
  const changed = status.individualChanged.length;

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="grid grid-cols-2 gap-3">
        <Link href="/approvals" className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-semibold tabular-nums">{waiting ?? 0}</p>
          <p className="text-xs text-slate-600">waiting for approval</p>
        </Link>
        <Link href="/branch/targets" className="rounded-xl bg-slate-900 p-4 text-white">
          <p className="text-sm font-medium">Assign employee targets</p>
          <p className="mt-1 text-xs text-slate-300">
            {changed > 0
              ? `Cluster Head changed ${changed} branch target${changed === 1 ? "" : "s"}`
              : "Set what each person should achieve"}
          </p>
        </Link>
      </div>

      {status.planVersion === null ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">
            No plan has been published for {monthLabel(status.month)} yet. Publishing builds
            every employee&apos;s daily and weekly targets from the monthly ones.
          </p>
          <PublishPlanButton label="Publish plan" />
        </div>
      ) : status.needsRepublish ? (
        <div className="mt-4 rounded-xl bg-amber-100 p-4">
          <p className="text-sm text-amber-900">
            Your plan is out of date: {reasons.join(" and ")}. Republish to refresh it. Employee
            targets stay as they are.
          </p>
          {status.canPublish ? (
            <PublishPlanButton label="Apply changes and republish" />
          ) : (
            <p className="mt-2 text-xs text-amber-900">
              No working days are left this month, so it can&apos;t be republished.
            </p>
          )}
        </div>
      ) : changed > 0 ? (
        <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          The Cluster Head changed {listNames(status.individualChanged)}. Review the difference
          under Assign employee targets.
        </p>
      ) : null}

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