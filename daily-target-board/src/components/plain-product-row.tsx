import { productStatus } from "@/domain/performance/branch-status";
import type { Performance } from "@/domain/performance/performance";
import { formatQty } from "@/lib/money";
import { plainPlanLine } from "@/lib/plain-words";
import { PlainBar } from "./plain-bar";
import { StatusPill } from "./status-pill";

/** One product in plain words: how much is done, where the plan says it should be, the gap. */
export function PlainProductRow({
  name,
  unit,
  performance,
}: {
  name: string;
  unit: "COUNT" | "AMOUNT";
  performance: Performance;
}) {
  const status = productStatus(performance);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold">{name}</p>
        <StatusPill status={status} />
      </div>
      <p className="mt-1 text-sm">
        <span className="font-semibold">{formatQty(unit, performance.verifiedQty)}</span> of{" "}
        {formatQty(unit, performance.monthTotal)} done
      </p>
      <div className="mt-2">
        <PlainBar
          percent={performance.percentDone}
          expected={performance.expectedPercent}
          status={status}
          label={`${name} progress`}
        />
      </div>
      <p className="mt-2 text-sm text-slate-600">{plainPlanLine(unit, performance)}</p>
    </div>
  );
}