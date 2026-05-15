"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PollIndicatorProps {
  isFetching: boolean;
  isError: boolean;
  dataUpdatedAt: number | undefined;
  onRetry?: () => void;
}

/**
 * Shows "Updated Ns ago" with a spinner while fetching and an amber
 * "refresh failed — retry" message on error. Tick once per second.
 */
export function PollIndicator({
  isFetching,
  isError,
  dataUpdatedAt,
  onRetry,
}: PollIndicatorProps) {
  const [, force] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (isError) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
        aria-live="polite"
      >
        <RotateCw className="h-3 w-3" aria-hidden="true" />
        refresh failed — retry
      </button>
    );
  }

  const seconds = dataUpdatedAt
    ? Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000))
    : null;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-slate-500"
      aria-live="polite"
    >
      <RotateCw
        className={cn("h-3 w-3", isFetching && "animate-spin")}
        aria-hidden="true"
      />
      {seconds === null ? "Loading…" : `updated ${seconds}s ago`}
    </span>
  );
}
