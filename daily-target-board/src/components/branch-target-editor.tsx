"use client";

import { useActionState, useState } from "react";
import { formatQty } from "@/lib/money";
import { parseTargetText } from "@/lib/parse-target";
import { formatRupeesPlain } from "@/lib/rupees";
import { saveBranchTargetsAction } from "@/server/branch-target-actions";
import type { BranchTargetCell } from "@/server/branch-targets";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base disabled:bg-slate-100";

function toInput(cell: BranchTargetCell): string {
  if (cell.current === 0) return "";
  return cell.unit === "AMOUNT" ? formatRupeesPlain(cell.current) : String(cell.current);
}

function tryParse(cell: BranchTargetCell, text: string): number | null {
  try {
    return parseTargetText(cell.unit, text);
  } catch {
    return null;
  }
}

export function BranchTargetEditor({
  branchCode,
  cells,
}: {
  branchCode: string;
  cells: BranchTargetCell[];
}) {
  const [state, formAction, pending] = useActionState(saveBranchTargetsAction, { error: null });
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(cells.map((cell) => [cell.code, toInput(cell)])),
  );
  const [note, setNote] = useState("");

  const rows = cells.map((cell) => {
    const parsed = tryParse(cell, values[cell.code] ?? "");
    return {
      cell,
      parsed,
      changed: !cell.locked && parsed !== null && parsed !== cell.current,
      below: !cell.locked && parsed !== null && parsed < cell.minQty,
    };
  });
  const changedCount = rows.filter((row) => row.changed).length;
  const hasProblem = rows.some((row) => !row.cell.locked && (row.parsed === null || row.below));
  const canSave = !pending && changedCount > 0 && !hasProblem;

  return (
    <form action={formAction} className="pb-36">
      <input type="hidden" name="branchCode" value={branchCode} />

      <ul className="space-y-3">
        {rows.map(({ cell, parsed, changed, below }) => {
          const fmt = (quantity: number) => formatQty(cell.unit, quantity);

          let hint: { text: string; style: string } | null = null;
          if (cell.locked) {
            hint = {
              text: "No working days are left this month, so this can't be changed.",
              style: "text-slate-500",
            };
          } else if (parsed === null) {
            hint = { text: "Enter a valid number.", style: "text-red-700" };
          } else if (below) {
            hint = {
              text: `Can't go below ${fmt(cell.minQty)}, because that much has already fallen due.`,
              style: "text-red-700",
            };
          } else if (changed) {
            const delta = parsed - cell.current;
            hint = {
              text: `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta))} from the current target`,
              style: "text-slate-700",
            };
          }

          const mismatch =
            !cell.locked && parsed !== null && cell.allocated !== null && cell.allocated !== parsed
              ? `Employee targets add up to ${fmt(cell.allocated)}, which is ${fmt(
                  Math.abs(cell.allocated - parsed),
                )} ${cell.allocated > parsed ? "above" : "below"} this.`
              : null;

          return (
            <li key={cell.code} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{cell.name}</p>
                {cell.scope === "BRANCH" ? (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    Whole branch
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {cell.current > 0 ? `Current: ${fmt(cell.current)}` : "No target yet"}
              </p>
              {cell.allocated !== null ? (
                <p className="text-xs text-slate-500">
                  Assigned to employees: {fmt(cell.allocated)}
                </p>
              ) : null}
              {cell.change ? (
                <p className="mt-2 rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-900">
                  {cell.change.text}
                  {cell.change.note ? ` · ${cell.change.note}` : ""}
                </p>
              ) : null}

              <input type="hidden" name={`was_${cell.code}`} value={String(cell.current)} />
              <label className="mt-3 block text-xs font-medium text-slate-600">
                New target{cell.unit === "AMOUNT" ? " (₹)" : ""}
                <input
                  name={`t_${cell.code}`}
                  inputMode={cell.unit === "AMOUNT" ? "decimal" : "numeric"}
                  value={values[cell.code] ?? ""}
                  disabled={cell.locked}
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [cell.code]: event.target.value }))
                  }
                  placeholder={cell.unit === "AMOUNT" ? "e.g. 5,65,00,000" : "e.g. 90"}
                  className={FIELD}
                />
              </label>
              {hint ? <p className={`mt-1 text-xs ${hint.style}`}>{hint.text}</p> : null}
              {mismatch ? <p className="mt-1 text-xs text-amber-800">{mismatch}</p> : null}
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
          placeholder="Shown to the branch manager beside the change"
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
          {pending ? (
            <p className="mb-2 text-xs text-slate-500">Saving… this can take a few seconds.</p>
          ) : null}
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