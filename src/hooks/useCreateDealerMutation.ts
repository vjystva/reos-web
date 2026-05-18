import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateDealerRequest, Dealer } from "@/types/api";

async function createDealer(body: CreateDealerRequest): Promise<Dealer> {
  const res = await fetch("/api/dealers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to create dealer";
    throw new Error(msg);
  }
  return res.json() as Promise<Dealer>;
}

export function useCreateDealerMutation() {
  const queryClient = useQueryClient();
  return useMutation<Dealer, Error, CreateDealerRequest>({
    mutationFn: createDealer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dealers"] });
    },
  });
}
