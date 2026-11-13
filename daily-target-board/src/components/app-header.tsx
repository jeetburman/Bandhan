import { roleLabel } from "@/lib/roles";
import { signOutAction } from "@/server/auth-actions";
import type { Actor } from "@/server/permissions";

export function AppHeader({ actor }: { actor: Actor }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
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
    </header>
  );
}