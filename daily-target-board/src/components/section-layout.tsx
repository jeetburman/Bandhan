import { Suspense, type ReactNode } from "react";
import type { Section } from "@/lib/roles";
import { Gate } from "./gate";

export function SectionLayout({ section, children }: { section: Section; children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <Gate section={section}>{children}</Gate>
    </Suspense>
  );
}