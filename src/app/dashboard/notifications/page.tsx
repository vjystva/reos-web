"use client";

import * as React from "react";
import { NotificationList } from "@/components/NotificationList";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationsPage() {
  const query = useNotifications({ limit: 50 });

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Notifications</h1>
      <div className="max-w-2xl">
        <NotificationList
          notifications={query.data?.data ?? []}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyMessage="You're all caught up — no notifications."
        />
      </div>
    </div>
  );
}
