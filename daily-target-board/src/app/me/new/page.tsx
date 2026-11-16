import { Suspense } from "react";
import { addDays } from "@/domain/calendar/calendar";
import { MAX_BACKDATE_DAYS } from "@/domain/entries/workflow";
import { SaleForm } from "@/components/sale-form";
import { istBusinessDate } from "@/lib/ist";
import { listCatalogForForm } from "@/server/catalog";
import { getCurrentActor } from "@/server/current-actor";
import { requiresApproval } from "@/server/entries";

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const today = istBusinessDate(new Date());
  const [catalog, needsApproval] = await Promise.all([
    listCatalogForForm(),
    requiresApproval(actor.id),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold">Record a sale</h1>
      <p className="mt-1 text-sm text-slate-600">
        {needsApproval
          ? "Your branch manager will be asked to approve it. It counts towards your target once verified."
          : "Your sales count towards your target straight away."}
      </p>
      <div className="mt-4">
        <SaleForm catalog={catalog} today={today} minDate={addDays(today, -MAX_BACKDATE_DAYS)} />
      </div>
    </main>
  );
}

export default function NewSalePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body />
    </Suspense>
  );
}
