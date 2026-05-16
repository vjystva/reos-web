"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  BookingCreatedSchema,
  type BookingCreated,
  type CreateBookingRequest,
  type UnitsResponse,
} from "@/types/api";

export class BookingConflictError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "BookingConflictError";
    this.status = status;
    this.body = body;
  }
}

async function postBooking(
  vars: CreateBookingRequest,
): Promise<BookingCreated> {
  const res = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vars),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : null) ||
      (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : null) ||
      `booking_failed_${res.status}`;
    throw new BookingConflictError(res.status, body, message);
  }

  const parsed = BookingCreatedSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("booking_shape_mismatch");
  }
  return parsed.data;
}

type UnitsCacheEntry = [QueryKey, UnitsResponse | undefined];

interface MutationContext {
  snapshots: UnitsCacheEntry[];
}

/**
 * POST /api/bookings with optimistic unit status update.
 *
 *   onMutate  — snapshot every cached `['units', ...]` query and patch the
 *               target unit's status to `'blocked'`.
 *   onError   — restore each snapshot (rollback).
 *   onSettled — invalidate the units queries so the server's truth replaces
 *               the optimistic value on the next refetch (covers both 409
 *               race recovery and stale optimistic state on 5xx).
 *
 * Uses `setQueriesData` (plural) because the units cache is keyed by
 * `['units', projectId, towerId, filtersHash]` — multiple filter permutations
 * may have the target unit cached.
 */
export function useBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation<BookingCreated, Error, CreateBookingRequest, MutationContext>({
    mutationFn: postBooking,

    onMutate: async ({ unitId }) => {
      await queryClient.cancelQueries({ queryKey: ["units"] });

      const snapshots = queryClient.getQueriesData<UnitsResponse>({
        queryKey: ["units"],
      }) as UnitsCacheEntry[];

      queryClient.setQueriesData<UnitsResponse>(
        { queryKey: ["units"] },
        (old) => {
          if (!old || !Array.isArray(old.data)) return old;
          return {
            ...old,
            data: old.data.map((u) =>
              u.id === unitId ? { ...u, status: "blocked" } : u,
            ),
          };
        },
      );

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      if (!context?.snapshots) return;
      for (const [key, value] of context.snapshots) {
        queryClient.setQueryData(key, value);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });
}
