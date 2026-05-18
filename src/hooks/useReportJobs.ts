"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ReportJobsResponseSchema,
  type ReportJobsResponse,
} from "@/types/api";

async function fetchReportJobs(): Promise<ReportJobsResponse> {
  const res = await fetch("/api/reports");
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch report jobs",
    );
  }
  const json = await res.json();
  const parsed = ReportJobsResponseSchema.safeParse(json);
  if (!parsed.success) {
    // Tolerate missing/empty payload — render empty state instead of error.
    return { jobs: [] };
  }
  return parsed.data;
}

export function useReportJobs() {
  return useQuery<ReportJobsResponse, Error>({
    queryKey: ["reports"],
    queryFn: fetchReportJobs,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
