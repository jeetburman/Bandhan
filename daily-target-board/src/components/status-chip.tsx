import { statusLabel, type EntryStatus } from "@/domain/entries/workflow";

const STYLES: Record<EntryStatus, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  L1_APPROVED: "bg-slate-100 text-slate-700",
  VERIFIED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function StatusChip({ status }: { status: EntryStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STYLES[status]}`}>
      {statusLabel(status)}
    </span>
  );
}