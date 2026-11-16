import { Suspense } from "react";
import { MyDashboardView } from "@/components/my-dashboard-view";
import { getCurrentActor } from "@/server/current-actor";
import { loadMyDashboard } from "@/server/my-dashboard";

async function Body() {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  const dashboard = await loadMyDashboard(actor);
  return (
    <main className="mx-auto max-w-2xl p-4">
      <MyDashboardView dashboard={dashboard} />
    </main>
  );
}

export default function MePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Body />
    </Suspense>
  );
}