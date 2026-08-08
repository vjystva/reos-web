"use client";

import { extractApiErrorMessage } from "@/lib/mutationError";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RoutingModeResponse, UpdateRoutingModeRequest } from "@/types/api";

async function updateRoutingMode(
  body: UpdateRoutingModeRequest,
): Promise<RoutingModeResponse> {
  const res = await fetch("/api/lead-routing-rules/routing-mode", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(await extractApiErrorMessage(res, "Failed to update routing mode"));
  }
  return res.json() as Promise<RoutingModeResponse>;
}

/** PUT /lead-routing-rules/routing-mode — builder_admin only upstream. */
export function useUpdateRoutingModeMutation() {
  const queryClient = useQueryClient();
  return useMutation<RoutingModeResponse, Error, UpdateRoutingModeRequest>({
    mutationFn: updateRoutingMode,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["routing-mode"] });
    },
  });
}
