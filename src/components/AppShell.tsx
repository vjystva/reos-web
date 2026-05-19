"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, ListChecks, Building2, CheckSquare, FileText, Users, BarChart2, MessageSquare, LifeBuoy, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Building2 },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: ListChecks },
  { href: "/dashboard/dealers", label: "Dealers", icon: Users },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart2 },
  { href: "/dashboard/communications", label: "Communications", icon: MessageSquare },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/workflows", label: "Workflows", icon: GitBranch },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even on failure, push to login — cookies are server-set, the client
      // can do nothing useful with a logout error.
    }
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold text-slate-900">
            REOS
          </Link>
          <nav aria-label="Main navigation" className="hidden sm:flex gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      <nav
        aria-label="Mobile navigation"
        className="flex sm:hidden border-t border-slate-200 bg-white"
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active ? "text-slate-900" : "text-slate-500",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
