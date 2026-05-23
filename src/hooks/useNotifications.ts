"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  NotificationsResponseSchema,
  type NotificationsResponse,
} from "@/types/api";

// ---------------------------------------------------------------------------
// Params & query-string builder
// ---------------------------------------------------------------------------

export interface UseNotificationsParams {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

function buildQs(params: UseNotificationsParams, filter?: string): string {
  const qs = new URLSearchParams();
  if (filter && filter !== "All") qs.set("type", filter);
  if (params.unreadOnly) qs.set("unreadOnly", "true");
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  return qs.toString();
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchNotifications(
  qs: string,
): Promise<NotificationsResponse> {
  const url = qs ? `/api/notifications?${qs}` : "/api/notifications";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`notifications_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = NotificationsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("notifications_shape_mismatch");
  return parsed.data;
}

async function markRead(id: string): Promise<void> {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`mark_read_failed_${res.status}`);
}

async function markAllRead(): Promise<void> {
  const res = await fetch("/api/notifications/read-all", { method: "POST" });
  if (!res.ok) throw new Error(`mark_all_read_failed_${res.status}`);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the notification list for the logged-in user.
 *
 * Supports two calling conventions:
 *   useNotifications()                    — no filter
 *   useNotifications("lead")              — filter by type
 *   useNotifications({unreadOnly: true})  — legacy params object
 */
export function useNotifications(
  filterOrParams?: string | UseNotificationsParams,
  _params: UseNotificationsParams = {},
) {
  let filter: string | undefined;
  let params: UseNotificationsParams;

  if (typeof filterOrParams === "string") {
    filter = filterOrParams;
    params = _params;
  } else {
    filter = undefined;
    params = filterOrParams ?? {};
  }

  const qs = buildQs(params, filter);

  return useQuery({
    queryKey: ["notifications", qs],
    queryFn: () => fetchNotifications(qs),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });
}

/** Marks a single notification as read (POST). */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: markRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/** Marks every notification for the current user as read (POST). */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
