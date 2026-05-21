"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

async function markRead(notificationId: string): Promise<void> {
  const res = await fetch(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
  );
  if (!res.ok) {
    throw new Error(`mark_read_failed_${res.status}`);
  }
}

/**
 * Marks a single notification as read. On success invalidates both the
 * notification list and the unread-count badge so the UI reflects the change
 * within a refetch cycle.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: markRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
  });
}
