"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  isNavItemActive,
  roleLabel,
  tenantLabel,
  userLabel,
  visibleGroups,
  type AppRole,
} from "@/components/nav-config";

/**
 * Application chrome: dark-navy collapsible sidebar + slim sticky topbar.
 *
 *   <SidebarProvider>            flex row, owns open/collapsed state
 *     <Sidebar>                  16rem panel → 3rem icon rail → Sheet below lg
 *     <SidebarInset>             flex-1 column
 *       <header h-12>            trigger · identity · search · logout
 *       <div flex-1 p-4>         page content
 *
 * There is no mobile tab bar — below `lg` the `Sidebar` primitive swaps itself
 * for a `Sheet` drawer opened by the topbar trigger.
 */

interface AppShellProps {
  children: React.ReactNode;
}

export type { AppRole };

/**
 * Sidebar-header brand: the shared `BrandMark` bound to sidebar state, so the
 * wordmark hides when the rail is icon-collapsed and clicking closes the mobile
 * sheet. The markup itself lives in `@/components/BrandMark` — `MinimalShell`
 * renders the same block in its topbar.
 */
function SidebarBrand() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <BrandMark
      tone="sidebar"
      collapsed={collapsed}
      onNavigate={() => setOpenMobile(false)}
    />
  );
}

/** Grouped nav. A group renders only when the role can see ≥1 of its items. */
function AppNav({ role }: { role: AppRole | null }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const groups = React.useMemo(() => visibleGroups(role), [role]);

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-2">
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname ?? "", item.href);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  );
}

/** Two-line topbar identity: tenant, then `user · role`. */
function IdentityBlock({
  tenantName,
  email,
  role,
}: {
  tenantName: string | null;
  email: string | null;
  role: AppRole | null;
}) {
  const scope = roleLabel(role);
  return (
    <div className="flex min-w-0 flex-col justify-center leading-tight">
      <span className="truncate text-xs font-semibold text-foreground">
        {tenantLabel(tenantName)}
      </span>
      <span className="truncate text-[11px] text-muted-foreground">
        {userLabel(email)}
        {scope ? ` · ${scope}` : ""}
      </span>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();

  // Current user role, via the shared hook (nav shows all tabs while loading).
  const { data: currentUser } = useCurrentUser();
  const role = (currentUser?.role ?? null) as AppRole | null;

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // proceed to login even on error — cookie is server-set
    }
    router.push("/login");
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarBrand />
        </SidebarHeader>
        <SidebarContent>
          <AppNav role={role} />
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <IdentityBlock
            tenantName={currentUser?.tenantName ?? null}
            email={currentUser?.email ?? null}
            role={role}
          />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <GlobalSearch />
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
