"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NotificationList } from "@/components/NotificationList";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnreadCount } from "@/hooks/useUnreadCount";

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const { data: countData } = useUnreadCount();
  const unread = countData?.count ?? 0;

  const notificationsQuery = useNotifications({ limit: 20 });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      >
        <span>Notifications</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto">
            <NotificationList
              notifications={notificationsQuery.data?.data ?? []}
              isLoading={notificationsQuery.isLoading}
              isError={notificationsQuery.isError}
              onRetry={() => void notificationsQuery.refetch()}
              onItemClick={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
