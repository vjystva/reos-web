"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GenerateReportRequest, ReportJob } from "@/types/api";

async function queueReport(body: GenerateReportRequest): Promise<ReportJob> {
  const res = await fetch("/api/reports/jobs", {
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
      "Failed to queue report";
    throw new Error(msg);
  }
  return res.json() as Promise<ReportJob>;
}

export function useQueueReportMutation() {
  const queryClient = useQueryClient();
  return useMutation<ReportJob, Error, GenerateReportRequest>({
    mutationFn: queueReport,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
