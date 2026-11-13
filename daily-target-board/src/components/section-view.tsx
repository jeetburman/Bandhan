import { Suspense } from "react";
import { getCurrentActor } from "@/server/current-actor";
import { PeopleList } from "./people-list";

interface SectionViewProps {
  title: string;
  note: string;
  people: boolean;
}

async function SectionBody({ title, note, people }: SectionViewProps) {
  const actor = await getCurrentActor();
  if (!actor) return null; // the gate has already redirected

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{note}</p>
      {people ? (
        <PeopleList actor={actor} />
      ) : (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          Signed in as {actor.name}.
        </p>
      )}
    </main>
  );
}

export function SectionView(props: SectionViewProps) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <SectionBody {...props} />
    </Suspense>
  );
}