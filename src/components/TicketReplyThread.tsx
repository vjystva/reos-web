"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateReplyRequestSchema,
  type CreateReplyRequest,
  type TicketReply,
} from "@/types/api";

interface TicketReplyThreadProps {
  replies: TicketReply[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (body: CreateReplyRequest) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function TicketReplyThread({
  replies,
  isSubmitting,
  error,
  onSubmit,
}: TicketReplyThreadProps) {
  const [body, setBody] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = CreateReplyRequestSchema.safeParse({ body: body.trim() });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Invalid reply");
      return;
    }
    setFieldError(null);
    onSubmit(result.data);
    setBody("");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">
        Conversation ({replies.length})
      </h2>

      {replies.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No replies yet. Be the first to respond.
        </div>
      ) : (
        <ul role="list" className="space-y-3">
          {replies.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-slate-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-900">
                  {r.authorName ?? r.authorId ?? "Unknown"}
                </span>
                <span className="text-xs text-slate-500">
                  {formatTime(r.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {r.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-2 border-t border-slate-200 pt-4"
        noValidate
      >
        {error && <ErrorBanner message={error} />}
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="reply-body"
        >
          Add a reply
        </label>
        <textarea
          id="reply-body"
          rows={3}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your reply…"
          className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
          required
        />
        {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </form>
    </div>
  );
}
