"use client";

import * as React from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import type { Notification } from "@/types/api";

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

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  isPending: boolean;
}

function NotificationItem({
  notification: n,
  onMarkRead,
  isPending,
}: NotificationItemProps) {
  const unread = !n.isRead;
  return (
    <li
      style={{
        padding: "12px",
        borderBottom: "1px solid #e2e8f0",
        background: unread ? "#f8fafc" : "#ffffff",
        opacity: unread ? 1 : 0.75,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {unread && (
              <span
                aria-label="unread"
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#1e293b",
                  flexShrink: 0,
                }}
              />
            )}
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: unread ? 600 : 400,
                color: unread ? "#0f172a" : "#475569",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {n.title}
            </p>
          </div>
          {n.body && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "12px",
                color: "#64748b",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {n.body}
            </p>
          )}
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            {formatTimestamp(n.createdAt)}
          </p>
        </div>
        {unread && (
          <button
            type="button"
            onClick={() => onMarkRead(n.id)}
            disabled={isPending}
            style={{
              flexShrink: 0,
              fontSize: "12px",
              color: "#64748b",
              background: "none",
              border: "none",
              cursor: isPending ? "not-allowed" : "pointer",
              padding: "2px 0",
              textDecoration: "underline",
            }}
            aria-label={`Mark "${n.title}" as read`}
          >
            Mark read
          </button>
        )}
      </div>
    </li>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const { data, isLoading, isError, refetch } = useNotifications({ limit: 20 });
  const markRead = useMarkNotificationRead();

  const notifications: Notification[] = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Close panel when clicking outside
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          position: "relative",
          background: "none",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          padding: "6px 10px",
          cursor: "pointer",
          fontSize: "18px",
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <span aria-hidden="true">&#128276;</span>
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "#ef4444",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "9999px",
              minWidth: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "360px",
            maxWidth: "calc(100vw - 16px)",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Notifications
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px",
                color: "#64748b",
                padding: "0",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>

          {/* Body */}
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {isLoading && (
              <div
                aria-busy="true"
                style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "14px" }}
              >
                Loading notifications…
              </div>
            )}

            {isError && (
              <div style={{ padding: "16px" }}>
                <p style={{ color: "#ef4444", fontSize: "14px", margin: "0 0 8px" }}>
                  Failed to load notifications.
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  style={{
                    fontSize: "13px",
                    color: "#3b82f6",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !isError && notifications.length === 0 && (
              <p
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: "14px",
                  margin: 0,
                }}
              >
                No notifications yet.
              </p>
            )}

            {!isLoading && !isError && notifications.length > 0 && (
              <ul
                role="list"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={(id) => markRead.mutate(id)}
                    isPending={markRead.isPending}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
