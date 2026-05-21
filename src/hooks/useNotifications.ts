"use client";

import { useQuery } from "@tanstack/react-query";
import {
  NotificationsResponseSchema,
  type NotificationsResponse,
} from "@/types/api";

export interface UseNotificationsParams {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

function buildQs(params: UseNotificationsParams): string {
  const qs = new URLSearchParams();
  if (params.unreadOnly) qs.set("unreadOnly", "true");
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  return qs.toString();
}

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

export function useNotifications(params: UseNotificationsParams = {}) {
  const qs = buildQs(params);
  return useQuery({
    queryKey: ["notifications", qs],
    queryFn: () => fetchNotifications(qs),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });
}
