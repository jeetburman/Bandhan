import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { navItemsFor } from "@/lib/nav";
import { canAccessSection, homePathFor, type Section } from "@/lib/roles";
import { getCurrentActor } from "@/server/current-actor";
import { AppHeader } from "./app-header";
import { AppNav } from "./app-nav";
import { BottomNav } from "./bottom-nav";

/** The real access check. The proxy is only a convenience, and this is what enforces it. */
export async function Gate({ section, children }: { section: Section; children: ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (!canAccessSection(actor.role, section)) redirect(homePathFor(actor.role));

  return (
    <>
      <AppHeader actor={actor} />
      <div className="page-pad">{children}</div>
      <Suspense fallback={<BottomNav items={navItemsFor(actor.role)} badges={{}} />}>
        <AppNav actor={actor} />
      </Suspense>
    </>
  );
}