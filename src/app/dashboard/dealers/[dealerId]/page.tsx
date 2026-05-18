"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorBanner } from "@/components/ErrorBanner";
import { DealerStatusBadge } from "@/components/DealerStatusBadge";
import { DealerForm } from "@/components/DealerForm";
import { useDealer } from "@/hooks/useDealer";
import { useUpdateDealerMutation } from "@/hooks/useUpdateDealerMutation";
import { useDeactivateDealerMutation } from "@/hooks/useDeactivateDealerMutation";
import type { CreateDealerRequest } from "@/types/api";

interface PageProps {
  params: { dealerId: string };
}

export default function DealerDetailPage({ params }: PageProps) {
  const { dealerId } = params;
  const router = useRouter();
  const { data: dealer, isLoading, isError, refetch } = useDealer(dealerId);
  const updateMutation = useUpdateDealerMutation();
  const deactivateMutation = useDeactivateDealerMutation();

  const [editOpen, setEditOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deactivateError, setDeactivateError] = React.useState<string | null>(
    null,
  );

  async function handleUpdate(data: CreateDealerRequest) {
    setFormError(null);
    try {
      await updateMutation.mutateAsync({ dealerId, body: data });
      setEditOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update dealer",
      );
    }
  }

  async function handleDeactivate() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Deactivate dealer "${dealer?.name ?? dealerId}"? They will no longer be assigned new leads.`,
      )
    ) {
      return;
    }
    setDeactivateError(null);
    try {
      await deactivateMutation.mutateAsync({ dealerId });
      router.push("/dashboard/dealers");
    } catch (err) {
      setDeactivateError(
        err instanceof Error ? err.message : "Failed to deactivate dealer",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (isError || !dealer) {
    return (
      <div className="p-2">
        <ErrorBanner
          message="Could not load dealer details."
          onRetry={() => void refetch()}
        />
        <div className="mt-3">
          <Link
            href="/dashboard/dealers"
            className="text-sm text-slate-600 hover:underline"
          >
            ← Back to dealers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/dealers"
          className="text-sm text-slate-600 hover:underline"
        >
          ← Dealers
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-semibold text-slate-900">{dealer.name}</h1>
      </div>

      {deactivateError ? <ErrorBanner message={deactivateError} /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <DealerStatusBadge status={dealer.status} />
            </div>
            {dealer.email ? (
              <div className="text-sm">
                <span className="text-slate-500">Email: </span>
                <span className="text-slate-900">{dealer.email}</span>
              </div>
            ) : null}
            {dealer.phone ? (
              <div className="text-sm">
                <span className="text-slate-500">Phone: </span>
                <span className="text-slate-900">{dealer.phone}</span>
              </div>
            ) : null}
            {dealer.region ? (
              <div className="text-sm">
                <span className="text-slate-500">Region: </span>
                <span className="text-slate-900">{dealer.region}</span>
              </div>
            ) : null}
            {dealer.commissionRate != null ? (
              <div className="text-sm">
                <span className="text-slate-500">Commission rate: </span>
                <span className="font-semibold text-slate-900">
                  {dealer.commissionRate}%
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={
                deactivateMutation.isPending || dealer.status === "inactive"
              }
            >
              {deactivateMutation.isPending ? "Deactivating…" : "Deactivate"}
            </Button>
          </div>
        </div>
      </section>

      <Sheet
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false);
            setFormError(null);
          }
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit dealer</SheetTitle>
            <SheetDescription>
              Update the dealer details below.
            </SheetDescription>
          </SheetHeader>
          {editOpen ? (
            <DealerForm
              initial={dealer}
              isSubmitting={updateMutation.isPending}
              error={formError}
              onCancel={() => {
                setEditOpen(false);
                setFormError(null);
              }}
              submitLabel="Save changes"
              onSubmit={(data) => void handleUpdate(data)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
