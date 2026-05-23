"use client";

import * as React from "react";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import type { Notification } from "@/types/api";

// ---------------------------------------------------------------------------
// Type filter options
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "lead", label: "lead" },
  { value: "booking", label: "booking" },
  { value: "task", label: "task" },
  { value: "system", label: "system" },
] as const;

// ---------------------------------------------------------------------------
// Relative timestamp formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diffMs = now - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60)
    return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24)
    return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Skeleton loading row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-md border border-slate-200 bg-white p-4">
      <div className="mb-2 h-4 w-1/3 rounded bg-slate-200" />
      <div className="mb-1 h-3 w-2/3 rounded bg-slate-100" />
      <div className="h-3 w-1/4 rounded bg-slate-100" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification card
// ---------------------------------------------------------------------------

interface NotificationCardProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  isMarkingRead: boolean;
}

function NotificationCard({
  notification,
  onMarkRead,
  isMarkingRead,
}: NotificationCardProps) {
  const { id, title, body, isRead, createdAt } = notification;

  return (
    <div
      className={`rounded-md border bg-white p-4 transition-colors ${
        isRead
          ? "border-slate-200"
          : "border-l-4 border-l-blue-500 border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm ${
              isRead ? "font-normal text-slate-800" : "font-bold text-slate-900"
            }`}
          >
            {title}
          </p>
          {body && (
            <p className="mt-1 text-sm text-slate-500">{body}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {formatRelativeTime(createdAt)}
          </p>
        </div>
        {!isRead && (
          <button
            type="button"
            disabled={isMarkingRead}
            onClick={() => onMarkRead(id)}
            className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Mark as read
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const [typeFilter, setTypeFilter] = React.useState("");
  const [markAllError, setMarkAllError] = React.useState<string | null>(null);

  const notificationsQuery = useNotifications(typeFilter || undefined);
  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();

  const notifications = notificationsQuery.data?.data ?? [];

  async function handleMarkRead(id: string) {
    try {
      await markReadMutation.mutateAsync(id);
    } catch {
      // error is surfaced via mutation state if needed
    }
  }

  async function handleMarkAllRead() {
    setMarkAllError(null);
    try {
      await markAllReadMutation.mutateAsync();
    } catch (err) {
      setMarkAllError(
        err instanceof Error ? err.message : "Failed to mark all as read",
      );
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
      </header>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={markAllReadMutation.isPending}
          onClick={() => void handleMarkAllRead()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {markAllReadMutation.isPending ? "Marking…" : "Mark all read"}
        </button>
      </div>

      {/* Mark-all error */}
      {markAllError && (
        <p
          role="alert"
          className="rounded bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {markAllError}
        </p>
      )}

      {/* Content */}
      {notificationsQuery.isError ? (
        /* Error state */
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-4"
        >
          <p className="text-sm text-red-700">
            Failed to load notifications.
          </p>
          <button
            type="button"
            onClick={() => void notificationsQuery.refetch()}
            className="mt-2 rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : notificationsQuery.isLoading ? (
        /* Loading skeleton */
        <div className="space-y-3" aria-label="Loading notifications">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : notifications.length === 0 ? (
        /* Empty state */
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-slate-500">No notifications</p>
        </div>
      ) : (
        /* Notification list */
        <ul role="list" className="space-y-3">
          {notifications.map((n) => (
            <li key={n.id}>
              <NotificationCard
                notification={n}
                onMarkRead={(id) => void handleMarkRead(id)}
                isMarkingRead={
                  markReadMutation.isPending &&
                  markReadMutation.variables === n.id
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
