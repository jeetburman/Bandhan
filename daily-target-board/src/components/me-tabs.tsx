"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/me", label: "Targets" },
  { href: "/me/sales", label: "Sales log" },
];

export function MeTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="My pages" className="mb-4 flex gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className={`rounded-full border px-4 py-1.5 text-sm ${
            pathname === tab.href
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}