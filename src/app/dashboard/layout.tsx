import * as React from "react";
import { AppShell } from "@/components/AppShell";
import { ChatWidget } from "@/components/ChatWidget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      {children}
      {/* Internal AI assistant — mounted only under /dashboard/**, never on
          /login (which the root layout covers). */}
      <ChatWidget />
    </AppShell>
  );
}
