"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DealerCard } from "@/components/DealerCard";
import { DealerForm } from "@/components/DealerForm";
import { SkeletonCard } from "@/components/SkeletonCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { useDealers } from "@/hooks/useDealers";
import { useCreateDealerMutation } from "@/hooks/useCreateDealerMutation";
import { useUpdateDealerMutation } from "@/hooks/useUpdateDealerMutation";
import type { CreateDealerRequest, Dealer } from "@/types/api";

type SheetMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; dealer: Dealer };

type StatusFilter = "all" | "active" | "inactive";

export default function DealersPage() {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [regionFilter, setRegionFilter] = React.useState("");
  const [sheet, setSheet] = React.useState<SheetMode>({ kind: "closed" });
  const [formError, setFormError] = React.useState<string | null>(null);

  // isActive maps to status: "active" → true, "inactive" → false, "all" → undef
  const isActive =
    statusFilter === "active"
      ? true
      : statusFilter === "inactive"
        ? false
        : undefined;

  const dealersQuery = useDealers({
    isActive,
    region: regionFilter.trim() || undefined,
  });

  const createMutation = useCreateDealerMutation();
  const updateMutation = useUpdateDealerMutation();

  function closeSheet() {
    setSheet({ kind: "closed" });
    setFormError(null);
  }

  async function handleCreate(data: CreateDealerRequest) {
    setFormError(null);
    try {
      await createMutation.mutateAsync(data);
      closeSheet();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create dealer",
      );
    }
  }

  async function handleUpdate(dealerId: string, data: CreateDealerRequest) {
    setFormError(null);
    try {
      await updateMutation.mutateAsync({ dealerId, body: data });
      closeSheet();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update dealer",
      );
    }
  }

  const dealers = dealersQuery.data?.dealers ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dealers</h1>
          <p className="text-sm text-slate-500">
            Manage channel partners, regions, and commissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PollIndicator
            isFetching={dealersQuery.isFetching}
            isError={dealersQuery.isError}
            dataUpdatedAt={dealersQuery.dataUpdatedAt}
            onRetry={() => dealersQuery.refetch()}
          />
          <Button onClick={() => setSheet({ kind: "create" })}>
            Add dealer
          </Button>
        </div>
      </header>

      <section className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="block text-xs font-medium text-slate-700"
            htmlFor="filter-region"
          >
            Region
          </label>
          <Input
            id="filter-region"
            type="text"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            placeholder="Search by region"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label
            className="block text-xs font-medium text-slate-700"
            htmlFor="filter-status"
          >
            Status
          </label>
          <Select
            id="filter-status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as StatusFilter)
            }
            className="w-40"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </section>

      {dealersQuery.isError ? (
        <ErrorBanner
          message="Failed to load dealers."
          onRetry={() => dealersQuery.refetch()}
        />
      ) : dealersQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : dealers.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
          No dealers match these filters. Click &ldquo;Add dealer&rdquo; to get
          started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {dealers.map((dealer) => (
            <DealerCard
              key={dealer.id}
              dealer={dealer}
              onEdit={(d) => setSheet({ kind: "edit", dealer: d })}
            />
          ))}
        </div>
      )}

      <Sheet
        open={sheet.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheet.kind === "edit" ? "Edit dealer" : "Add dealer"}
            </SheetTitle>
            <SheetDescription>
              {sheet.kind === "edit"
                ? "Update the dealer details below."
                : "Fill in the details and click Create dealer."}
            </SheetDescription>
          </SheetHeader>

          {sheet.kind !== "closed" ? (
            <DealerForm
              initial={sheet.kind === "edit" ? sheet.dealer : null}
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              error={formError}
              onCancel={closeSheet}
              submitLabel={
                sheet.kind === "edit" ? "Save changes" : "Create dealer"
              }
              onSubmit={(data) => {
                if (sheet.kind === "edit") {
                  void handleUpdate(sheet.dealer.id, data);
                } else {
                  void handleCreate(data);
                }
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
