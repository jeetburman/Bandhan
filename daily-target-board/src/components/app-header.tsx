import Link from "next/link";
import { Suspense } from "react";
import { homePathFor, roleLabel } from "@/lib/roles";
import { signOutAction } from "@/server/auth-actions";
import type { Actor } from "@/server/permissions";
import { ApprovalsLink } from "./approvals-link";

export function AppHeader({ actor }: { actor: Actor }) {
  const home = homePathFor(actor.role);
  const sells = actor.role !== "CLUSTER_HEAD";

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{actor.name}</p>
          <p className="text-xs text-slate-500">{roleLabel(actor.role)}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            Sign out
          </button>
        </form>
      </div>
      <nav className="mt-2 flex gap-4 text-sm">
        {home !== "/me" ? <Link href={home}>Home</Link> : null}
        {sells ? <Link href="/me">My sales</Link> : null}
        <Suspense fallback={null}>
          <ApprovalsLink actor={actor} />
        </Suspense>
      </nav>
    </header>
  );
}