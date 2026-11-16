import { Suspense } from "react";
import { EntryCard } from "@/components/entry-card";
import { ReviewControls } from "@/components/review-controls";
import { getCurrentActor } from "@/server/current-actor";
import { listQueue } from "@/server/entries";

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const items = await listQueue(actor);

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