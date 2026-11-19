"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, type NavIcon, type NavItem } from "@/lib/nav";

function Icon({ name }: { name: NavIcon }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
          <path d="M16 5a3 3 0 0 1 0 6M21 20v-1a5 5 0 0 0-3-4.5" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      );
  }
}

export function BottomNav({
  items,
  badges,
}: {
  items: NavItem[];
  /** A count to show on a tab, keyed by its link. */
  badges: Record<string, number>;
}) {
  const pathname = usePathname();
  const active = activeNavHref(items, pathname);

  return (
    <nav
      aria-label="Main"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white"
    >
      <ul className="mx-auto flex h-14 max-w-2xl">
        {items.map((item) => {
          const isActive = item.href === active;
          const badge = badges[item.href] ?? 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-xs ${
                  isActive ? "font-semibold text-slate-900" : "text-slate-500"
                }`}
              >
                <span className="relative">
                  <Icon name={item.icon} />
                  {badge > 0 ? (
                    <span className="absolute -right-3 -top-1.5 min-w-4 rounded-full bg-sky-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}