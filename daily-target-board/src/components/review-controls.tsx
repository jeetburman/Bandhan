"use client";

import { useActionState } from "react";
import { reviewEntryAction } from "@/server/entry-actions";

export function ReviewControls({ entryId, level }: { entryId: string; level: "FIRST" | "FINAL" }) {
  const [state, formAction, pending] = useActionState(reviewEntryAction, { error: null });

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="entryId" value={entryId} />
      <input
        name="reason"
        maxLength={200}
        placeholder="Reason (needed to reject)"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          name="intent"
          value="approve"
          disabled={pending}
          className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {level === "FIRST" ? "Approve" : "Verify"}
        </button>
        <button
          type="submit"
          name="intent"
          value="reject"
          disabled={pending}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </form>
  );
}