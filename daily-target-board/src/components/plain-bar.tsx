import type { StatusKey } from "@/domain/performance/branch-status";
import { barColour } from "./status-pill";

/** How far along, with a dark mark where the plan says it should be. */
export function PlainBar({
  percent,
  expected,
  status,
  label,
}: {
  percent: number;
  expected: number;
  status: StatusKey;
  label: string;
}) {
  return (
    <div
      className="relative h-2.5 rounded-full bg-slate-200"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`h-2.5 rounded-full ${barColour(status)}`} style={{ width: `${percent}%` }} />
      {expected > 0 && expected < 100 ? (
        <div
          className="absolute -top-1 h-[18px] w-[3px] rounded bg-slate-900"
          style={{ left: `${expected}%` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}