import { navItemsFor } from "@/lib/nav";
import { countQueue } from "@/server/entries";
import type { Actor } from "@/server/permissions";
import { BottomNav } from "./bottom-nav";

/** The tab bar with the approvals count. Roles with no approvals list never see a number. */
export async function AppNav({ actor }: { actor: Actor }) {
  const count = await countQueue(actor);
  const badges: Record<string, number> = count !== null && count > 0 ? { "/approvals": count } : {};
  return <BottomNav items={navItemsFor(actor.role)} badges={badges} />;
}