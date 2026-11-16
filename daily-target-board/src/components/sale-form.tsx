"use client";

import { useActionState, useState } from "react";
import type { FormCategory, FormOption } from "@/server/catalog";
import { submitSaleAction } from "@/server/entry-actions";

const FIELD = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

/** Options grouped under their section headings (Retail, Salary, NRI...) when they have them. */
function OptionList({ options }: { options: FormOption[] }) {
  const sections: string[] = [];
  for (const option of options) {
    if (option.section && !sections.includes(option.section)) sections.push(option.section);
  }
  if (sections.length === 0) {
    return (
      <>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </>
    );
  }
  return (
    <>
      {sections.map((section) => (
        <optgroup key={section} label={section}>
          {options
            .filter((option) => option.section === section)
            .map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

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
  const [productCode, setProductCode] = useState("");
  const product = catalog.flatMap((category) => category.products).find((p) => p.code === productCode);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm font-medium">
        Product
        <select
          name="productCode"
          required
          value={productCode}
          onChange={(event) => setProductCode(event.target.value)}
          className={FIELD}
        >
          <option value="">Choose a product</option>
          {catalog.map((category) => (
            <optgroup key={category.code} label={category.name}>
              {category.products.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {product?.groups.map((group) => (
        <label key={`${product.code}-${group.code}`} className="block text-sm font-medium">
          {group.name}
          <select name={`opt_${group.code}`} required={group.isRequired} defaultValue="" className={FIELD}>
            <option value="">Choose…</option>
            <OptionList options={group.options} />
          </select>
        </label>
      ))}

      {product ? (
        product.needsUnits ? (
          <label className="block text-sm font-medium">
            Number sold
            <input
              key={`${product.code}-units`}
              name="units"
              type="number"
              min={1}
              max={999}
              defaultValue={1}
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
              key={`${product.code}-amount`}
              name="amount"
              inputMode="decimal"
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
          defaultValue={today}
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
          placeholder="An application or request number"
          className={FIELD}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Never enter a customer's name or ID here.
        </span>
      </label>

      <label className="block text-sm font-medium">
        Note (optional)
        <textarea name="note" maxLength={200} rows={2} className={FIELD} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record sale"}
      </button>
    </form>
  );
}