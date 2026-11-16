import Link from "next/link";
import { Suspense } from "react";
import { EntryCard } from "@/components/entry-card";
import { ReviewControls } from "@/components/review-controls";
import { describeQuantity } from "@/lib/describe-quantity";
import { formatIstDateTime, formatShortDate } from "@/lib/format-time";
import { getCurrentActor } from "@/server/current-actor";
import {
  listHandled,
  listQueue,
  listQueueSellers,
  type HandledItem,
  type QueueOrder,
} from "@/server/entries";

type SearchParams = Promise<{ order?: string; seller?: string }>;

function linkTo(order: QueueOrder, seller?: string): string {
  const params = new URLSearchParams();
  if (order === "oldest") params.set("order", "oldest");
  if (seller) params.set("seller", seller);
  const query = params.toString();
  return query ? `/approvals?${query}` : "/approvals";
}

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs ${
    active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
  }`;

function outcome(item: HandledItem): { text: string; style: string } {
  if (item.decision === "REJECTED") return { text: "Rejected", style: "text-red-700" };
  if (item.level === "FIRST") return { text: "Approved (first level)", style: "text-slate-700" };
  return { text: "Verified", style: "text-green-700" };
}

async function Body({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const params = await searchParams;
  const order: QueueOrder = params.order === "oldest" ? "oldest" : "newest";
  const sellerId =
    typeof params.seller === "string" && /^[A-Za-z0-9]{10,40}$/.test(params.seller)
      ? params.seller
      : undefined;

  const [items, sellers, handled] = await Promise.all([
    listQueue(actor, { order, sellerId }),
    listQueueSellers(actor),
    listHandled(actor, 15),
  ]);
  const total = sellers.reduce((sum, s) => sum + s.count, 0);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold">Approvals</h1>
      <p className="mt-1 text-sm text-slate-600">
        {total > 0 ? `${total} waiting for you` : "Nothing is waiting for you."}
      </p>

      {total > 0 ? (
        <>
          <nav aria-label="Sort" className="mt-3 flex gap-2">
            <Link href={linkTo("newest", sellerId)} className={chip(order === "newest")}>
              Newest first
            </Link>
            <Link href={linkTo("oldest", sellerId)} className={chip(order === "oldest")}>
              Oldest first
            </Link>
          </nav>
          <nav aria-label="Employee" className="mt-2 flex flex-wrap gap-2">
            <Link href={linkTo(order)} className={chip(sellerId === undefined)}>
              Everyone ({total})
            </Link>
            {sellers.map((seller) => (
              <Link
                key={seller.userId}
                href={linkTo(order, seller.userId)}
                className={chip(sellerId === seller.userId)}
              >
                {seller.name} ({seller.count})
              </Link>
            ))}
          </nav>
        </>
      ) : null}

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

export default function ApprovalsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}