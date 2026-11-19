"use client";

import { useActionState, useState } from "react";
import { formatQty } from "@/lib/money";
import { formatRupeesPlain, parseRupeesToPaise } from "@/lib/rupees";
import { saveTargetsAction } from "@/server/target-actions";
import type { TargetCell } from "@/server/target-grid";

const PACING_LABEL = {
  DAILY: "Daily target",
  WEEKLY: "Weekly target",
  MONTHLY: "Month-end target",
} as const;

const FIELD = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";

function toInput(cell: TargetCell): string {
  if (cell.totalQty === 0) return "";
  return cell.unit === "AMOUNT" ? formatRupeesPlain(cell.totalQty) : String(cell.totalQty);
}

/** The number typed in the box, or null if it is not a valid target. */
function parseInput(cell: TargetCell, text: string): number | null {
  try {
    if (cell.unit === "AMOUNT") return parseRupeesToPaise(text);
    const cleaned = text.trim().replace(/,/g, "");
    if (cleaned === "") return 0;
    return /^\d{1,6}$/.test(cleaned) ? Number(cleaned) : null;
  } catch {
    return null;
  }
}

export function TargetEditor({ userId, cells }: { userId: string; cells: TargetCell[] }) {
  const [state, formAction, pending] = useActionState(saveTargetsAction, { error: null });
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(cells.map((cell) => [cell.code, toInput(cell)])),
  );
  const [note, setNote] = useState("");

  const rows = cells.map((cell) => {
    const parsed = parseInput(cell, values[cell.code] ?? "");
    return {
      cell,
      parsed,
      changed: parsed !== null && parsed !== cell.totalQty,
      below: parsed !== null && parsed < cell.minQty,
    };
  });
  const changedCount = rows.filter((row) => row.changed).length;
  const hasProblem = rows.some((row) => row.parsed === null || row.below);
  const canSave = !pending && changedCount > 0 && !hasProblem;

  return (
    <form action={formAction} className="pb-36">
      <input type="hidden" name="userId" value={userId} />

      <ul className="space-y-3">
        {rows.map(({ cell, parsed, changed, below }) => {
          const fmt = (quantity: number) => formatQty(cell.unit, quantity);
          let hint: { text: string; style: string } | null = null;
          if (parsed === null) {
            hint = { text: "Enter a valid number.", style: "text-red-700" };
          } else if (below) {
            hint = {
              text: `Can't go below ${fmt(cell.minQty)}, because that much has already fallen due.`,
              style: "text-red-700",
            };
          } else if (changed) {
            const delta = parsed - cell.totalQty;
            hint = {
              text: `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta))} from the current target`,
              style: "text-slate-700",
            };
          } else if (cell.minQty > 0) {
            hint = { text: `Lowest allowed: ${fmt(cell.minQty)} (already due)`, style: "text-slate-500" };
          }

          return (
            <li key={cell.code} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{cell.name}</p>
                <span className="shrink-0 text-xs text-slate-500">{PACING_LABEL[cell.pacing]}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {cell.totalQty > 0 ? `Current: ${fmt(cell.totalQty)}` : "No target yet"}
                {cell.baseQty > 0 && cell.adjustmentQty !== 0 ? ` · standard ${fmt(cell.baseQty)}` : ""}
              </p>
              {cell.change ? (
                <p className="mt-2 rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-900">
                  {cell.change.text}
                  {cell.change.note ? ` · ${cell.change.note}` : ""}
                </p>
              ) : null}

              <input type="hidden" name={`was_${cell.code}`} value={String(cell.totalQty)} />
              <label className="mt-3 block text-xs font-medium text-slate-600">
                New target{cell.unit === "AMOUNT" ? " (₹)" : ""}
                <input
                  name={`t_${cell.code}`}
                  inputMode={cell.unit === "AMOUNT" ? "decimal" : "numeric"}
                  value={values[cell.code] ?? ""}
                  onChange={(event) => setValues((prev) => ({ ...prev, [cell.code]: event.target.value }))}
                  placeholder={cell.unit === "AMOUNT" ? "e.g. 50,00,000" : "e.g. 5"}
                  className={FIELD}
                />
              </label>
              {hint ? <p className={`mt-1 text-xs ${hint.style}`}>{hint.text}</p> : null}
            </li>
          );
        })}
      </ul>

      <label className="mt-4 block text-sm font-medium">
        Reason (optional)
        <input
          name="note"
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Shown to the employee beside the change"
          className={FIELD}
        />
      </label>

      <div className="above-bottom-nav fixed inset-x-0 z-30 border-t border-slate-200 bg-white p-3">
        <div className="mx-auto max-w-2xl">
          {state.error ? (
            <p role="alert" className="mb-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
          {pending ? <p className="mb-2 text-xs text-slate-500">Saving… this can take a few seconds.</p> : null}
          <button
            type="submit"
            disabled={!canSave}
            className="w-full rounded-lg bg-slate-900 px-3 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {changedCount > 0
              ? `Save ${changedCount} change${changedCount === 1 ? "" : "s"}`
              : "Nothing changed"}
          </button>
        </div>
      </div>
    </form>
  );
}