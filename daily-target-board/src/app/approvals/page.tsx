import { Suspense } from "react";
import { EntryCard } from "@/components/entry-card";
import { ReviewControls } from "@/components/review-controls";
import { describeQuantity } from "@/lib/describe-quantity";
import { formatIstDateTime, formatShortDate } from "@/lib/format-time";
import { getCurrentActor } from "@/server/current-actor";
import { listHandled, listQueue, type HandledItem } from "@/server/entries";

function outcome(item: HandledItem): { text: string; style: string } {
  if (item.decision === "REJECTED") return { text: "Rejected", style: "text-red-700" };
  if (item.level === "FIRST") return { text: "Approved (first level)", style: "text-slate-700" };
  return { text: "Verified", style: "text-green-700" };
}

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const [items, handled] = await Promise.all([listQueue(actor), listHandled(actor, 15)]);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold">Approvals</h1>
      <p className="mt-1 text-sm text-slate-600">
        {items.length > 0
          ? `${items.length} waiting for you, oldest first`
          : "Nothing is waiting for you."}
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <EntryCard
            key={item.id}
            entry={item}
            seller={{ name: item.sellerName, designation: item.sellerDesignation }}
          >
            {item.level === "FIRST" ? (
              <p className="mt-2 text-xs text-slate-500">
                Your approval is provisional. The branch manager gives the final approval.
              </p>
            ) : null}
            <ReviewControls entryId={item.id} level={item.level} />
          </EntryCard>
        ))}
      </ul>

      <h2 className="mt-8 text-sm font-semibold">Recently handled</h2>
      {handled.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Nothing yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {handled.map((item) => {
            const result = outcome(item);
            return (
              <li key={item.approvalId} className="px-4 py-3">
                <p className="text-sm font-semibold">
                  {item.sellerName}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {item.sellerDesignation}
                  </span>
                </p>
                <p className="text-sm">
                  {item.entry.productName}
                  {item.entry.optionSummary ? ` · ${item.entry.optionSummary}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {describeQuantity(item.entry.units, item.entry.amountPaise)} · sold{" "}
                  {formatShortDate(item.entry.activityDate)}
                </p>
                <p className={`mt-1 text-xs ${result.style}`}>
                  {result.text} by {item.reviewerName} · {formatIstDateTime(item.at)}
                  {item.reason ? ` · ${item.reason}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body />
    </Suspense>
  );
}