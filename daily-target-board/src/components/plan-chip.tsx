export function PlanChip({ version, stale }: { version: number | null; stale: boolean }) {
  if (version === null) {
    return (
      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
        No plan yet
      </span>
    );
  }
  if (stale) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
        v{version} · needs re-publish
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
      v{version} · up to date
    </span>
  );
}