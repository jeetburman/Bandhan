"use client";

import { useActionState, useState } from "react";
import type { FormCategory } from "@/server/catalog";
import { submitSaleAction } from "@/server/entry-actions";
import { Picker, type PickerOption } from "./picker";

const FIELD = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function SaleForm({
  catalog,
  today,
  minDate,
}: {
  catalog: FormCategory[];
  today: string;
  minDate: string;
}) {
  const [state, formAction, pending] = useActionState(submitSaleAction, { error: null });

  // Everything is held in state, so a mistake never wipes what was typed.
  const [productCode, setProductCode] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [units, setUnits] = useState("1");
  const [amount, setAmount] = useState("");
  const [activityDate, setActivityDate] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const productOptions: PickerOption[] = catalog.flatMap((category) =>
    category.products.map((p) => ({ value: p.code, label: p.name, section: category.name })),
  );
  const product = catalog.flatMap((category) => category.products).find((p) => p.code === productCode);

  const missingOption = product ? product.groups.some((g) => g.isRequired && !selected[g.code]) : true;
  const missingAmount = product?.needsAmount ? amount.trim() === "" : false;
  const canSubmit = !pending && product !== undefined && !missingOption && !missingAmount;

  return (
    <form action={formAction} className="space-y-4">
      <Picker
        label="Product"
        name="productCode"
        options={productOptions}
        value={productCode}
        onChange={(code) => {
          setProductCode(code);
          setSelected({});
        }}
        placeholder="Choose a product"
      />

      {product?.groups.map((group) => (
        <Picker
          key={`${product.code}-${group.code}`}
          label={group.name}
          name={`opt_${group.code}`}
          options={group.options.map((o) => ({ value: o.code, label: o.name, section: o.section }))}
          value={selected[group.code] ?? ""}
          onChange={(code) => setSelected((previous) => ({ ...previous, [group.code]: code }))}
        />
      ))}

      {product ? (
        product.needsUnits ? (
          <label className="block text-sm font-medium">
            Number sold
            <input
              name="units"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={units}
              onChange={(event) => setUnits(event.target.value)}
              required
              className={FIELD}
            />
          </label>
        ) : (
          <input type="hidden" name="units" value="1" />
        )
      ) : null}

      {product ? (
        product.needsAmount ? (
          <label className="block text-sm font-medium">
            Amount (₹)
            <input
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              placeholder="e.g. 50,000"
              className={FIELD}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Accounts: the opening balance. Insurance: the premium. Loans: the amount disbursed.
            </span>
          </label>
        ) : (
          <input type="hidden" name="amount" value="" />
        )
      ) : null}

      <label className="block text-sm font-medium">
        Date of sale
        <input
          name="activityDate"
          type="date"
          value={activityDate}
          onChange={(event) => setActivityDate(event.target.value)}
          min={minDate}
          max={today}
          required
          className={FIELD}
        />
      </label>

      <label className="block text-sm font-medium">
        Reference (optional)
        <input
          name="reference"
          maxLength={40}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="An application or request number"
          className={FIELD}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Never enter a customer&apos;s name or ID here.
        </span>
      </label>

      <label className="block text-sm font-medium">
        Note (optional)
        <textarea
          name="note"
          maxLength={200}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={FIELD}
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record sale"}
      </button>
    </form>
  );
}