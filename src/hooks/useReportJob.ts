"use client";

import { useQuery } from "@tanstack/react-query";
import { ReportJobSchema, type ReportJob } from "@/types/api";

async function fetchReportJob(jobId: string): Promise<ReportJob> {
  const res = await fetch(`/api/reports/${encodeURIComponent(jobId)}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch report job",
    );
  }
  const json = await res.json();
  const parsed = ReportJobSchema.safeParse(json);
  if (!parsed.success) throw new Error("report_job_shape_mismatch");
  return parsed.data;
}

/**
 * Polls a single report job every 5s while its status is queued or processing.
 * Stops polling once the job is `completed` or `failed`.
 */
export function useReportJob(jobId: string | null | undefined) {
  return useQuery<ReportJob, Error>({
    queryKey: ["reports", jobId],
    queryFn: () => fetchReportJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        status === "queued" ||
        status === "running" ||
        status === "processing"
      ) {
        return 5_000;
      }
      return false;
    },
    refetchIntervalInBackground: false,
  });
}
