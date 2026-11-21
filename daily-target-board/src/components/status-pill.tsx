import type { StatusKey } from "@/domain/performance/branch-status";
import { statusLabel } from "@/lib/plain-words";

const PILL: Record<StatusKey, string> = {
  BEHIND: "bg-red-100 text-red-800",
  SLIGHTLY_BEHIND: "bg-amber-100 text-amber-900",
  ON_TRACK: "bg-green-100 text-green-800",
  ACHIEVED: "bg-green-100 text-green-800",
  NO_PLAN: "bg-slate-100 text-slate-700",
};

const BAR: Record<StatusKey, string> = {
  BEHIND: "bg-red-600",
  SLIGHTLY_BEHIND: "bg-amber-600",
  ON_TRACK: "bg-green-600",
  ACHIEVED: "bg-green-600",
  NO_PLAN: "bg-slate-400",
};

export function barColour(status: StatusKey): string {
  return BAR[status];
}

export function StatusPill({ status }: { status: StatusKey }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${PILL[status]}`}>
      {statusLabel(status)}
    </span>
  );
}