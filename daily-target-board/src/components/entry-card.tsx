import type { ReactNode } from "react";
import { describeQuantity } from "@/lib/describe-quantity";
import { formatIstDateTime, formatShortDate } from "@/lib/format-time";
import type { EntryView } from "@/server/entries";
import { StatusChip } from "./status-chip";

export function EntryCard({
  entry,
  seller,
  children,
}: {
  entry: EntryView;
  seller?: { name: string; designation: string };
  children?: ReactNode;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          {seller ? (
            <p className="text-sm font-semibold">
              {seller.name}
              <span className="ml-2 text-xs font-normal text-slate-500">{seller.designation}</span>
            </p>
          ) : null}
          <p className="text-sm font-medium">{entry.productName}</p>
          {entry.optionSummary ? (
            <p className="text-xs text-slate-500">{entry.optionSummary}</p>
          ) : null}
        </div>
        <StatusChip status={entry.status} />
      </div>

      <p className="mt-2 text-sm">{describeQuantity(entry.units, entry.amountPaise)}</p>
      <p className="mt-1 text-xs text-slate-500">
        Sold {formatShortDate(entry.activityDate)} · recorded {formatIstDateTime(entry.submittedAt)}
        {entry.reference ? ` · Ref ${entry.reference}` : ""}
      </p>
      {entry.note ? <p className="mt-1 text-xs text-slate-600">{entry.note}</p> : null}
      {entry.status === "REJECTED" && entry.rejectionReason ? (
        <p className="mt-2 text-sm text-red-700">Rejected: {entry.rejectionReason}</p>
      ) : null}
      {children}
    </li>
  );
}