import { listVisiblePeople } from "@/server/people";
import type { Actor } from "@/server/permissions";

export async function PeopleList({ actor }: { actor: Actor }) {
  const people = await listVisiblePeople(actor);

  return (
    <section className="mt-4">
      <p className="text-sm text-slate-600">
        {people.length} {people.length === 1 ? "person" : "people"} visible to you
      </p>
      <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {people.map((person) => (
          <li key={person.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{person.name}</p>
              <p className="text-xs text-slate-500">{person.designation}</p>
            </div>
            <span className="text-xs text-slate-500">{person.branchCode ?? "Cluster"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}