import {
  BarChart2,
  BookOpen,
  Building2,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Sidebar navigation model.
 *
 * Items are grouped into labelled sections (Overview / Pipeline / Network).
 * Role visibility is per *item* — a group renders only when the current role
 * can see at least one of its items.
 *
 * `roles: null` means "every role". The demo `admin` role is treated as
 * `builder_admin` (see `visibleNav`), matching `src/lib/unitTransitions.ts`.
 *
 * The nav intentionally surfaces a *subset* of the routes on disk: pages with
 * no equivalent section in the product's reference IA (analytics, notifications,
 * holds, commissions, documents, comms, workflows, support, audit, targets)
 * stay implemented and reachable by direct URL, but are not linked here.
 */

export type AppRole =
  | "builder_admin"
  | "sales_manager"
  | "sales_agent"
  | "dealer"
  | "customer"
  | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** `null` = visible to every role. */
  roles: readonly AppRole[] | null;
}

export interface NavGroup {
  /** Uppercase micro-label rendered by `SidebarGroupLabel`. */
  label: string;
  items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/dashboard/pipeline", label: "Pipeline", icon: ListChecks, roles: ["builder_admin", "sales_manager", "sales_agent", "dealer"] },
      { href: "/dashboard/bookings", label: "Bookings", icon: BookOpen, roles: ["builder_admin", "sales_manager", "sales_agent", "dealer"] },
      { href: "/dashboard/inventory", label: "Inventory", icon: Building2, roles: ["builder_admin", "sales_manager", "sales_agent", "dealer"] },
      { href: "/dashboard/site-visits", label: "Site Visits", icon: CalendarDays, roles: ["builder_admin", "sales_manager", "sales_agent"] },
      { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare, roles: ["builder_admin", "sales_manager", "sales_agent"] },
      /*
        Sits next to Bookings because that is where its two subjects live: a
        discount request is raised from the bookings table, a hold extension
        from a held unit.

        `sales_agent` IS included even though an agent cannot approve anything:
        `GET /approvals` returns an agent only the requests they raised, so the
        page is their "where did my request get to" view. The Approve/Reject
        buttons are role-gated inside the page (`canResolveApprovals`) and the
        backend re-checks both the role and self-approval.
      */
      { href: "/dashboard/approvals", label: "Approvals", icon: ShieldCheck, roles: ["builder_admin", "sales_manager", "sales_agent", "admin"] },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/dashboard/import", label: "Import", icon: Upload, roles: ["builder_admin", "sales_manager", "sales_agent"] },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart2, roles: ["builder_admin", "sales_manager"] },
      { href: "/dashboard/dealers", label: "Dealers", icon: Users, roles: ["builder_admin", "sales_manager"] },
      { href: "/dashboard/team", label: "Team", icon: UserPlus, roles: ["builder_admin", "sales_manager"] },
      { href: "/dashboard/settings/routing", label: "Settings", icon: Settings, roles: ["builder_admin", "admin"] },
    ],
  },
];

/** Flat list, in render order. */
export const ALL_NAV: readonly NavItem[] = NAV_GROUPS.flatMap(
  (group) => group.items,
);

function canSee(item: NavItem, role: AppRole | null): boolean {
  if (!role) return true; // show everything while the role is still loading
  if (!item.roles) return true; // null = all roles
  // "admin" is the demo role — treat it as builder_admin
  const effective = role === "admin" ? "builder_admin" : role;
  return (item.roles as readonly string[]).includes(effective);
}

export function visibleNav(role: AppRole | null): NavItem[] {
  return ALL_NAV.filter((item) => canSee(item, role));
}

/** Groups with at least one visible item, each pruned to its visible items. */
export function visibleGroups(role: AppRole | null): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => canSee(item, role)),
  })).filter((group) => group.items.length > 0);
}

/** Exact match for the dashboard root, prefix match everywhere else. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return href !== "/dashboard" && pathname.startsWith(`${href}/`);
}

const ROLE_LABELS: Record<AppRole, string> = {
  builder_admin: "Builder Admin",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  dealer: "Dealer",
  customer: "Customer",
  admin: "Admin",
};

export function roleLabel(role: AppRole | null): string {
  return role ? (ROLE_LABELS[role] ?? titleCase(role)) : "";
}

function titleCase(value: string): string {
  return value
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Prefer the tenant's real name (`tenants.name`, e.g. "REOS Demo Builder").
 * Only title-cases a slug-shaped fallback (`demo-tenant` → `Demo Tenant`) —
 * never pass a raw uuid `tenantId` here, it will render mangled. Falls back
 * to the product name when nothing is available.
 */
export function tenantLabel(tenantName: string | null | undefined): string {
  if (!tenantName) return "reOS";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(tenantName) ? "reOS" : titleCase(tenantName);
}

/** `asha.rao@demo.com` → `Asha Rao`. */
export function userLabel(email: string | null | undefined): string {
  if (!email) return "Signed in";
  const local = email.split("@")[0];
  // Defensive: never title-case a raw id if something upstream falls back
  // to one — a mangled uuid is worse than the neutral "Signed in" label.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(local)) return "Signed in";
  return titleCase(local);
}
