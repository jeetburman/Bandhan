import Link from "next/link";
import { Suspense } from "react";
import { EntryCard } from "@/components/entry-card";
import { MeTabs } from "@/components/me-tabs";
import { isPending } from "@/domain/entries/workflow";
import { getCurrentActor } from "@/server/current-actor";
import { listMyEntries } from "@/server/entries";

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const entries = await listMyEntries(actor, 30);
  const waiting = entries.filter((entry) => isPending(entry.status)).length;

  return (
    <main className="mx-auto max-w-2xl p-4">
      <MeTabs />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">My sales</h1>
        <Link
          href="/me/new"
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Record a sale
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {waiting > 0 ? `${waiting} waiting for approval` : "Nothing is waiting for approval."}
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You have not recorded any sales yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </main>
  );
}

export default function MySalesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body />
    </Suspense>
  );
}