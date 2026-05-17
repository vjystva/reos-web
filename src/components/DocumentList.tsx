"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Document, DocumentFileType } from "@/types/api";

interface DocumentListProps {
  documents: Document[];
  onDelete: (doc: Document) => void;
  deletingId?: string | null;
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fileTypeLabel(t: DocumentFileType): string {
  return t.toUpperCase();
}

function formatCreatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DocumentList({
  documents,
  onDelete,
  deletingId,
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        No documents attached yet. Click <strong>Upload document</strong> to add one.
      </div>
    );
  }

  return (
    <ul role="list" className="space-y-3">
      {documents.map((doc) => {
        const isDeleting = deletingId === doc.id;
        return (
          <li
            key={doc.id}
            className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
            role="listitem"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 break-words">
                  {doc.name}
                </h3>
                <Badge variant="secondary">{fileTypeLabel(doc.fileType)}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Size: {formatFileSize(doc.fileSize)}</span>
                <span>Uploaded: {formatCreatedAt(doc.createdAt)}</span>
                <span>
                  Linked to:{" "}
                  <span className="font-mono">
                    {doc.resourceType}/{doc.resourceId}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Download
              </a>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(doc)}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
