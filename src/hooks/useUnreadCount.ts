"use client";

import { useQuery } from "@tanstack/react-query";
import {
  UnreadCountResponseSchema,
  type UnreadCountResponse,
} from "@/types/api";

async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  const res = await fetch("/api/notifications/unread-count");
  if (!res.ok) throw new Error(`unread_count_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = UnreadCountResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("unread_count_shape_mismatch");
  return parsed.data;
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });
}
