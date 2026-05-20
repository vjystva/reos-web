"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RunReportJobResponse } from "@/types/api";

async function runReportJob(jobId: string): Promise<RunReportJobResponse> {
  const res = await fetch(
    `/api/reports/jobs/${encodeURIComponent(jobId)}/run`,
    { method: "POST" },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to run report job";
    throw new Error(msg);
  }
  return res.json() as Promise<RunReportJobResponse>;
}

export function useRunReportMutation() {
  const queryClient = useQueryClient();
  return useMutation<RunReportJobResponse, Error, string>({
    mutationFn: runReportJob,
    onSuccess: (_data, jobId) => {
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", jobId] });
    },
  });
}
