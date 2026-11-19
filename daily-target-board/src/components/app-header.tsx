import { roleLabel } from "@/lib/roles";
import { signOutAction } from "@/server/auth-actions";
import type { Actor } from "@/server/permissions";

export function AppHeader({ actor }: { actor: Actor }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{actor.name}</p>
        <p className="text-xs text-slate-500">{roleLabel(actor.role)}</p>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          Sign out
        </button>
      </form>
    </header>
  );
}