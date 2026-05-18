"use client";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ReportJobRow } from "@/components/ReportJobRow";
import { useReportJobs } from "@/hooks/useReportJobs";

export function ReportJobsList() {
  const { data, isLoading, isError, refetch } = useReportJobs();
  if (isLoading) return <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>;
  if (isError) return <ErrorBanner message="Could not load reports." onRetry={() => void refetch()} />;
  if (!data?.jobs?.length) return <p className="text-sm text-slate-500 py-4 text-center">No reports generated yet. Use the form to generate your first report.</p>;
  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm">
      {data.jobs.map((job) => <ReportJobRow key={job.jobId} job={job} />)}
    </div>
  );
}
