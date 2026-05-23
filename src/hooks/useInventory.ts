"use client";

import { useQuery } from "@tanstack/react-query";

export interface InventoryFilters {
  status?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  floor?: number;
  page?: number;
  pageSize?: number;
}

export interface InventoryUnit {
  id: string;
  unitNumber: string;
  type: string;
  floor: number;
  price: number;
  status: "available" | "reserved" | "sold" | string;
}

export interface InventoryResponse {
  units: InventoryUnit[];
  total: number;
  page: number;
  pageSize: number;
}

function buildQueryString(filters: InventoryFilters): string {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.type) qs.set("type", filters.type);
  if (filters.minPrice != null) qs.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) qs.set("maxPrice", String(filters.maxPrice));
  if (filters.floor != null) qs.set("floor", String(filters.floor));
  if (filters.page != null) qs.set("page", String(filters.page));
  if (filters.pageSize != null) qs.set("pageSize", String(filters.pageSize));
  return qs.toString();
}

async function fetchInventory(
  filters: InventoryFilters,
): Promise<InventoryResponse> {
  const qs = buildQueryString(filters);
  const url = qs ? `/api/inventory?${qs}` : `/api/inventory`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`inventory_fetch_failed_${res.status}`);
  const json = await res.json();
  return json as InventoryResponse;
}

/**
 * Fetches the flat unit inventory list with optional filter params.
 * Polls every 30 s to keep availability fresh.
 */
export function useInventory(filters: InventoryFilters = {}) {
  return useQuery({
    queryKey: ["inventory", filters],
    queryFn: () => fetchInventory(filters),
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
