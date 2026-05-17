"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DocumentList } from "@/components/DocumentList";
import { UploadDocumentForm } from "@/components/UploadDocumentForm";
import { SkeletonCard } from "@/components/SkeletonCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { useDocuments } from "@/hooks/useDocuments";
import { useCreateDocumentMutation } from "@/hooks/useCreateDocumentMutation";
import { useDeleteDocumentMutation } from "@/hooks/useDeleteDocumentMutation";
import type {
  CreateDocumentRequest,
  Document,
  DocumentResourceType,
} from "@/types/api";

interface DocumentsPanelProps {
  resourceType: DocumentResourceType;
  resourceId: string;
}

export function DocumentsPanel({ resourceType, resourceId }: DocumentsPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const documentsQuery = useDocuments({ resourceType, resourceId });
  const createMutation = useCreateDocumentMutation();
  const deleteMutation = useDeleteDocumentMutation();

  function closeSheet() {
    setOpen(false);
    setFormError(null);
  }

  async function handleSubmit(data: CreateDocumentRequest): Promise<Document | void> {
    setFormError(null);
    try {
      const created = await createMutation.mutateAsync(data);
      closeSheet();
      return created;
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to upload document",
      );
    }
  }

  async function handleDelete(doc: Document) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete document "${doc.name}"?`)
    ) {
      return;
    }
    setDeletingId(doc.id);
    try {
      await deleteMutation.mutateAsync({ documentId: doc.id });
    } catch {
      // intentionally swallowed; refetch reflects truth
    } finally {
      setDeletingId(null);
    }
  }

  const documents = documentsQuery.data?.documents ?? [];
  const ready = Boolean(resourceType && resourceId);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Documents</h2>
          <p className="text-xs text-slate-500">
            Attach contracts, brochures, receipts, and other files to this resource.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ready ? (
            <PollIndicator
              isFetching={documentsQuery.isFetching}
              isError={documentsQuery.isError}
              dataUpdatedAt={documentsQuery.dataUpdatedAt}
              onRetry={() => documentsQuery.refetch()}
            />
          ) : null}
          <Button onClick={() => setOpen(true)} disabled={!ready}>
            Upload document
          </Button>
        </div>
      </div>

      {!ready ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          Select a resource type and ID to view documents.
        </div>
      ) : documentsQuery.isError ? (
        <ErrorBanner
          message="Failed to load documents."
          onRetry={() => documentsQuery.refetch()}
        />
      ) : documentsQuery.isLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <DocumentList
          documents={documents}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}

      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (!o) closeSheet();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Upload document</SheetTitle>
            <SheetDescription>
              Provide the document name and a URL where the file is hosted.
            </SheetDescription>
          </SheetHeader>

          {open && ready ? (
            <UploadDocumentForm
              resourceType={resourceType}
              resourceId={resourceId}
              isSubmitting={createMutation.isPending}
              error={formError}
              onCancel={closeSheet}
              onSubmit={handleSubmit}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
