"use client";

import { useQuery } from "@tanstack/react-query";
import {
  RoutingModeResponseSchema,
  type RoutingModeResponse,
} from "@/types/api";

async function fetchRoutingMode(): Promise<RoutingModeResponse> {
  const res = await fetch("/api/lead-routing-rules/routing-mode");
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(err.message ?? err.error ?? "Failed to fetch routing mode");
  }
  const parsed = RoutingModeResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("routing_mode_shape_mismatch");
  return parsed.data;
}

/**
 * Tenant lead-assignment strategy ('round_robin' | 'rules'). Settings data —
 * no polling; it only changes when someone saves this page.
 */
export function useRoutingMode() {
  return useQuery<RoutingModeResponse, Error>({
    queryKey: ["routing-mode"],
    queryFn: fetchRoutingMode,
    staleTime: 60_000,
    refetchInterval: false,
    retry: 1,
  });
}
