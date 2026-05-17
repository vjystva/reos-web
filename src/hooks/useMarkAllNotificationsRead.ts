"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

async function markAllRead(): Promise<void> {
  const res = await fetch("/api/notifications/read-all", { method: "POST" });
  if (!res.ok) {
    throw new Error(`mark_all_read_failed_${res.status}`);
  }
}

/**
 * Marks every notification for the current user as read. Invalidates both the
 * list and the unread-count badge.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
  });
}
