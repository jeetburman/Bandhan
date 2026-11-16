import Link from "next/link";
import type { MetricCard } from "@/domain/dashboard/metric-card";
import type { RedShade } from "@/domain/status/status";
import { cutoffLabel } from "@/lib/cutoff";
import { formatShortDate } from "@/lib/format-time";
import { formatQty } from "@/lib/money";
import { monthLabel } from "@/lib/month-label";
import type { MyDashboard } from "@/server/my-dashboard";

const SHADE: Record<RedShade, { edge: string; chip: string }> = {
  LIGHT: { edge: "border-l-red-300", chip: "bg-red-100 text-red-800" },
  MEDIUM: { edge: "border-l-red-400", chip: "bg-red-300 text-red-950" },
  STRONG: { edge: "border-l-red-600", chip: "bg-red-600 text-white" },
  DARK: { edge: "border-l-red-900", chip: "bg-red-900 text-white" },
};

function suggestionLines(card: MetricCard): string[] {
  const s = card.suggestion;
  const fmt = (q: number) => formatQty(card.unit, q);
  if (card.state === "ACHIEVED") return [];
  if (s.needed === 0) return ["Everything still needed is already waiting for approval."];
  if (s.fromDate === null) {
    return [`No working days are left this month. ${fmt(s.needed)} is still needed.`];
  }

  const lines: string[] = [];
  if (card.pacing === "DAILY" && s.dayQty !== null) {
    lines.push(
      s.startsToday
        ? `Today: ${fmt(s.dayQty)}`
        : `Next working day (${formatShortDate(s.fromDate)}): ${fmt(s.dayQty)}`,
    );
  }
  if (s.weekQty !== null && s.weekDueDate) {
    lines.push(`By ${formatShortDate(s.weekDueDate)}: ${fmt(s.weekQty)}`);
  }
  if (card.pacing === "MONTHLY" && s.dueDate) {
    lines.push(`By ${formatShortDate(s.dueDate)}: ${fmt(s.needed)}`);
  }
  return lines;
}

function planNote(card: MetricCard): string | null {
  const s = card.suggestion;
  const fmt = (q: number) => formatQty(card.unit, q);
  if (!s.fromDate) return null;
  if (card.pacing === "DAILY" && s.dayQty !== null && card.planned.day !== null && s.dayQty !== card.planned.day) {
    return `The original plan for ${s.startsToday ? "today" : formatShortDate(s.fromDate)} was ${fmt(card.planned.day)}.`;
  }
  if (card.pacing === "WEEKLY" && s.weekQty !== null && card.planned.week !== null && s.weekQty !== card.planned.week) {
    return `The original plan for this week was ${fmt(card.planned.week)}.`;
  }
  return null;
}

function Card({ card }: { card: MetricCard }) {
  const fmt = (q: number) => formatQty(card.unit, q);
  const edge =
    card.state === "BEHIND" && card.shade
      ? SHADE[card.shade].edge
      : card.state === "ACHIEVED"
        ? "border-l-green-500"
        : "border-l-slate-300";
  const lines = suggestionLines(card);
  const note = planNote(card);

  return (
    <li className={`rounded-xl border border-l-4 border-slate-200 bg-white p-4 ${edge}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{card.name}</p>
        {card.state === "ACHIEVED" ? (
          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
            Achieved
          </span>
        ) : card.state === "BEHIND" && card.shade ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${SHADE[card.shade].chip}`}>
            {card.label} · {fmt(card.behindQty)} behind
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            On track
          </span>
        )}
      </div>

      <p className="mt-2 text-lg font-semibold tabular-nums">
        {fmt(card.verifiedQty)}
        <span className="text-sm font-normal text-slate-500"> of {fmt(card.monthTotal)} verified</span>
      </p>

      <div
        className="mt-2 h-2 rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={card.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${card.name} progress`}
      >
        <div
          className={`h-2 rounded-full ${card.state === "ACHIEVED" ? "bg-green-600" : "bg-slate-700"}`}
          style={{ width: `${card.percent}%` }}
        />
      </div>

      {card.pendingQty > 0 ? (
        <p className="mt-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {fmt(card.pendingQty)} awaiting approval
          </span>
        </p>
      ) : null}

      {card.state !== "ACHIEVED" ? (
        <p className="mt-2 text-xs text-slate-500">
          Still to do: {fmt(card.remaining)}
          {card.suggestion.workingDaysLeft > 0
            ? ` · ${card.suggestion.workingDaysLeft} working days left`
            : ""}
        </p>
      ) : null}

      {lines.length > 0 ? (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold text-slate-600">Suggested</p>
          {lines.map((line) => (
            <p key={line} className="text-sm">
              {line}
            </p>
          ))}
          {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

export function MyDashboardView({ dashboard }: { dashboard: MyDashboard }) {
  const { cards, branchGoals } = dashboard;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">My targets</h1>
          <p className="text-sm text-slate-600">
            {monthLabel(dashboard.month)} · {formatShortDate(dashboard.today)}
          </p>
        </div>
        <Link
          href="/me/new"
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Record a sale
        </Link>
      </div>

      {!dashboard.todayIsWorkingDay ? (
        <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
          Today is not a working day. Suggestions start from the next working day.
        </p>
      ) : dashboard.cutoffPassed ? (
        <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
          Today closed at {cutoffLabel()}. Suggestions now start from the next working day.
        </p>
      ) : null}

      {dashboard.planVersion === null ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No plan has been published for your branch this month yet.
        </p>
      ) : cards.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You have no personal targets this month. Your branch figures are on the Home page.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-600">
            {dashboard.behind} behind · {dashboard.onTrack} on track · {dashboard.achieved} achieved
          </p>
          <ul className="mt-3 space-y-3">
            {cards.map((card) => (
              <Card key={card.metricId} card={card} />
            ))}
          </ul>
        </>
      )}

      {branchGoals.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Shared with your branch</h2>
          <p className="text-xs text-slate-500">
            Anyone in the branch can complete these. They never count against you personally.
          </p>
          <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
            {branchGoals.map((goal) => (
              <div key={goal.metricId} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="text-slate-700">{goal.name}</span>
                <span className="tabular-nums">
                  <span className="font-medium">{formatQty(goal.unit, goal.verified)}</span>
                  <span className="text-slate-500"> of {formatQty(goal.unit, goal.target)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-slate-500">
        A working day closes at {cutoffLabel()}. Only verified sales count. Suggestions are
        recalculated from what is still left each time you open this page.
      </p>
    </div>
  );
}