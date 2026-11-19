"use client";

import { useActionState } from "react";
import { publishPlanAction } from "@/server/plan-actions";

export function PublishPlanButton({ label }: { label: string }) {
  const [state, formAction, pending] = useActionState(publishPlanAction, { error: null });

  return (
    <form action={formAction} className="mt-3">
      {state.error ? (
        <p role="alert" className="mb-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {pending ? (
        <p className="mb-2 text-xs text-slate-600">Publishing… this can take a few seconds.</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {label}
      </button>
    </form>
  );
}