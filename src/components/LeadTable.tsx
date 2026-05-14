"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { Badge } from "@/components/ui/badge";
import { SkeletonRow } from "@/components/SkeletonCard";
import { stageLabel, formatDate } from "@/lib/utils";
import type { Lead } from "@/types/api";

interface LeadTableProps {
  leads: Lead[];
  total?: number;
  isLoading?: boolean;
  isError?: boolean;
  enableSort?: boolean;
}

type SortKey = "name" | "aiScore" | "createdAt";

const COLUMNS: { key: string; label: string; sortKey?: SortKey }[] = [
  { key: "name", label: "Name", sortKey: "name" },
  { key: "stage", label: "Stage" },
  { key: "temperature", label: "Temp" },
  { key: "score", label: "Score", sortKey: "aiScore" },
  { key: "dealer", label: "Dealer" },
  { key: "createdAt", label: "Created", sortKey: "createdAt" },
];

export function LeadTable({
  leads,
  isLoading,
  isError,
  enableSort = true,
}: LeadTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const sort = params.get("sort") as SortKey | null;
  const order = (params.get("order") as "asc" | "desc" | null) ?? "asc";

  function openLead(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("leadId", id);
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleSort(key: SortKey) {
    const next = new URLSearchParams(params.toString());
    if (sort !== key) {
      next.set("sort", key);
      next.set("order", "asc");
    } else if (order === "asc") {
      next.set("order", "desc");
    } else {
      next.delete("sort");
      next.delete("order");
    }
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table role="grid" className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {COLUMNS.map((col) => {
              const active = enableSort && col.sortKey === sort;
              const ariaSort: "ascending" | "descending" | "none" = active
                ? order === "asc"
                  ? "ascending"
                  : "descending"
                : "none";
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={col.sortKey ? ariaSort : undefined}
                  className="px-4 py-2 text-left font-medium text-slate-600"
                >
                  {enableSort && col.sortKey ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.sortKey!)}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      {col.label}
                      <span aria-hidden="true">
                        {active ? (order === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isError ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="px-4 py-6 text-center text-sm text-red-700"
              >
                Failed to load leads.
              </td>
            </tr>
          ) : isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} cols={COLUMNS.length} />
            ))
          ) : leads.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="px-4 py-6 text-center text-sm text-slate-500"
              >
                No leads match your filters.
              </td>
            </tr>
          ) : (
            leads.map((lead) => (
              <tr
                key={lead.id}
                tabIndex={0}
                role="button"
                aria-label={`Open detail for ${lead.name}`}
                onClick={() => openLead(lead.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLead(lead.id);
                  }
                }}
                className="cursor-pointer hover:bg-slate-50 focus:bg-slate-100 focus:outline-none"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {lead.name}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {stageLabel(lead.stage)}
                </td>
                <td className="px-4 py-3">
                  <TemperatureBadge temperature={lead.temperature} />
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{lead.aiScore ?? "—"}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {lead.assignedDealer?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {formatDate(lead.createdAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
