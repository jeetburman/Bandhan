import type { Role } from "./roles";

export type NavIcon = "home" | "target" | "plus" | "list" | "check" | "users" | "sliders";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

const ITEMS: Record<Role, readonly NavItem[]> = {
  STAFF: [
    { href: "/me", label: "Targets", icon: "target" },
    { href: "/me/new", label: "Record", icon: "plus" },
    { href: "/me/sales", label: "My sales", icon: "list" },
  ],
  SUPERVISOR: [
    { href: "/me", label: "Targets", icon: "target" },
    { href: "/me/new", label: "Record", icon: "plus" },
    { href: "/team", label: "Team", icon: "users" },
    { href: "/approvals", label: "Approvals", icon: "check" },
  ],
  BRANCH_MANAGER: [
    { href: "/branch", label: "Branch", icon: "home" },
    { href: "/branch/targets", label: "Assign", icon: "sliders" },
    { href: "/approvals", label: "Approvals", icon: "check" },
    { href: "/me", label: "Me", icon: "target" },
  ],
  CLUSTER_HEAD: [
    { href: "/cluster", label: "Cluster", icon: "home" },
    { href: "/cluster/targets", label: "Targets", icon: "sliders" },
  ],
};

export function navItemsFor(role: Role): NavItem[] {
  return [...ITEMS[role]];
}

/** The tab that matches the page: the longest link that the current path starts with. */
export function activeNavHref(items: readonly NavItem[], pathname: string): string | null {
  let best: string | null = null;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.length)) best = item.href;
  }
  return best;
}