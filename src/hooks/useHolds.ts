import { useQuery } from '@tanstack/react-query';
import type { HoldsResponse } from '@/types/api';

export type HoldStatus = 'active' | 'released' | 'converted' | 'expired';

export function holdStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Active',
    released: 'Released',
    converted: 'Converted',
    expired: 'Expired',
  };
  return map[status] ?? status;
}

export function holdStatusClass(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-success',
    released: 'badge-neutral',
    converted: 'badge-primary',
    expired: 'badge-warning',
  };
  return map[status] ?? 'badge-neutral';
}

export function holdIsExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export function holdMinutesRemaining(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 60_000));
}

export function holdTimeRemainingLabel(expiresAt: string): string {
  if (holdIsExpired(expiresAt)) return 'Expired';
  const mins = holdMinutesRemaining(expiresAt);
  if (mins < 60) return `${mins}m remaining`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m remaining` : `${hrs}h remaining`;
}

async function fetchHolds(params: Record<string, string>): Promise<HoldsResponse> {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `/api/holds?${qs}` : '/api/holds';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`holds fetch failed: ${res.status}`);
  return res.json();
}

export function useHolds(params: Record<string, string> = {}) {
  return useQuery<HoldsResponse>({
    queryKey: ['holds', params],
    queryFn: () => fetchHolds(params),
    staleTime: 25_000,
    refetchInterval: 30_000,
  });
}
