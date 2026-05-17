"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/api";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { useMarkAllNotificationsRead } from "@/hooks/useMarkAllNotificationsRead";

interface NotificationListProps {
  notifications: Notification[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onItemClick?: () => void;
  emptyMessage?: string;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function NotificationList({
  notifications,
  isLoading,
  isError,
  onRetry,
  onItemClick,
  emptyMessage = "No notifications yet.",
}: NotificationListProps) {
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const hasUnread = notifications.some((n) => !n.isRead);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-slate-200 bg-white p-3"
          >
            <Skeleton className="mb-2 h-4 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Failed to load notifications."
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {notifications.length} {notifications.length === 1 ? "item" : "items"}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={!hasUnread || markAllRead.isPending}
        >
          {markAllRead.isPending ? "Marking..." : "Mark all read"}
        </Button>
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {notifications.map((n) => {
            const unread = !n.isRead;
            const Wrapper: React.ElementType = n.link ? Link : "div";
            const wrapperProps = n.link
              ? { href: n.link, onClick: onItemClick }
              : {};
            return (
              <li
                key={n.id}
                className={cn(
                  "rounded-md border bg-white p-3 transition-colors",
                  unread
                    ? "border-slate-300"
                    : "border-slate-200 opacity-75",
                )}
              >
                <Wrapper
                  {...wrapperProps}
                  className={cn(
                    "block",
                    n.link && "hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {unread ? (
                          <span
                            aria-label="unread"
                            className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-slate-900"
                          />
                        ) : null}
                        <p
                          className={cn(
                            "truncate text-sm",
                            unread
                              ? "font-semibold text-slate-900"
                              : "font-normal text-slate-700",
                          )}
                        >
                          {n.title}
                        </p>
                      </div>
                      {n.body ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                          {n.body}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatTimestamp(n.createdAt)}
                      </p>
                    </div>
                    {unread ? (
                      <button
                        type="button"
                        className="shrink-0 text-xs text-slate-500 hover:text-slate-900 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          markRead.mutate(n.id);
                        }}
                        disabled={markRead.isPending}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </Wrapper>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
