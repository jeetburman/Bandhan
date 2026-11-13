import { Suspense } from "react";
import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/roles";
import { getCurrentActor } from "@/server/current-actor";

async function Redirector() {
  const actor = await getCurrentActor();
  redirect(actor ? homePathFor(actor.role) : "/login");
  return null;
}

export default function Home() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Redirector />
    </Suspense>
  );
}