import type { Outlook } from "@/domain/performance/performance";
import { formatPace } from "@/lib/format-pace";
import { formatQty } from "@/lib/money";
import type { Figure } from "@/server/branch-overview";

const CHIP: Record<Outlook, { label: string; style: string }> = {
  ACHIEVED: { label: "Achieved", style: "bg-green-100 text-green-800" },
  ON_PACE: { label: "On pace", style: "bg-slate-100 text-slate-700" },
  BEHIND: { label: "Behind", style: "bg-red-100 text-red-800" },
  NOT_STARTED: { label: "Month just started", style: "bg-slate-100 text-slate-700" },
  NO_DAYS_LEFT: { label: "Month closed, short", style: "bg-red-100 text-red-800" },
};

function paceLine(figure: Figure): string {
  const p = figure.performance;
  const fmt = (quantity: number) => formatQty(figure.unit, quantity);
  if (p.expectedQty === 0 && p.verifiedQty === 0) return "Nothing was due yet.";

  const base = `${fmt(p.expectedQty)} expected by now`;
  if (p.behindQty > 0) return `${base} · ${fmt(p.behindQty)} behind`;
  if (p.aheadQty > 0) return `${base} · ${fmt(p.aheadQty)} ahead`;
  return `${base} · level with the plan`;
}

export function PerformanceRow({
  figure,
  showProjection = false,
}: {
  figure: Figure;
  showProjection?: boolean;
}) {
  const p = figure.performance;
  const fmt = (quantity: number) => formatQty(figure.unit, quantity);
  const chip = CHIP[p.outlook];
  const barColour =
    p.outlook === "ACHIEVED"
      ? "bg-green-600"
      : p.outlook === "BEHIND" || p.outlook === "NO_DAYS_LEFT"
        ? "bg-red-600"
        : "bg-slate-700";
  const rates = formatPace(figure.unit, figure.performance);
  const showMarker = p.expectedPercent > 0 && p.expectedPercent < 100;

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-800">{figure.name}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${chip.style}`}>{chip.label}</span>
      </div>

      <p className="mt-1 text-sm tabular-nums">
        <span className="font-medium">{fmt(p.verifiedQty)}</span>
        <span className="text-slate-500"> of {fmt(p.monthTotal)} verified</span>
      </p>

      <div
        className="relative mt-2 h-2 rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={p.percentDone}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${figure.name} progress`}
      >
        <div className={`h-2 rounded-full ${barColour}`} style={{ width: `${p.percentDone}%` }} />
        {showMarker ? (
          <div
            className="absolute -top-0.5 h-3 w-0.5 bg-slate-900"
            style={{ left: `${p.expectedPercent}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <p className="mt-1 text-xs text-slate-500">{paceLine(figure)}</p>
      {rates ? <p className="text-xs text-slate-500">{rates}</p> : null}
      {showProjection &&
      p.projectedQty !== null &&
      (p.outlook === "ON_PACE" || p.outlook === "BEHIND") ? (
        <p className="text-xs text-slate-500">
          At this pace: about {fmt(p.projectedQty)} by month end (estimate)
        </p>
      ) : null}
    </div>
  );
}