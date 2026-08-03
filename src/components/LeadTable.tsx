"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { LeadStageBadge } from "@/components/LeadStageBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { Lead } from "@/types/api";

interface LeadTableProps {
  leads: Lead[];
  total?: number;
  isLoading?: boolean;
  isError?: boolean;
  enableSort?: boolean;
}

type SortKey = "name" | "aiScore" | "createdAt";

const COLUMNS: {
  key: string;
  label: string;
  sortKey?: SortKey;
  numeric?: boolean;
}[] = [
  { key: "name", label: "Name", sortKey: "name" },
  { key: "stage", label: "Stage" },
  { key: "temperature", label: "Temp" },
  { key: "score", label: "Score", sortKey: "aiScore", numeric: true },
  { key: "dealer", label: "Dealer" },
  { key: "createdAt", label: "Created", sortKey: "createdAt", numeric: true },
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
    <Table role="grid">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((col) => {
            const active = enableSort && col.sortKey === sort;
            const ariaSort: "ascending" | "descending" | "none" = active
              ? order === "asc"
                ? "ascending"
                : "descending"
              : "none";
            return (
              <TableHead
                key={col.key}
                numeric={col.numeric}
                aria-sort={col.sortKey ? ariaSort : undefined}
              >
                {enableSort && col.sortKey ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.sortKey!)}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                      active ? "text-foreground" : ""
                    }`}
                  >
                    {col.label}
                    <span aria-hidden="true" className="text-[9px]">
                      {active ? (order === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isError ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={COLUMNS.length}
              className="py-6 text-center text-xs text-destructive"
            >
              Failed to load leads.
            </TableCell>
          </TableRow>
        ) : isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              {COLUMNS.map((col) => (
                <TableCell key={col.key}>
                  <Skeleton className="h-3 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : leads.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={COLUMNS.length}
              className="py-6 text-center text-xs text-muted-foreground"
            >
              No leads match your filters.
            </TableCell>
          </TableRow>
        ) : (
          leads.map((lead) => (
            <TableRow
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
              className="cursor-pointer focus:bg-muted/60 focus:outline-none"
            >
              <TableCell className="font-medium text-foreground">
                {lead.name}
              </TableCell>
              <TableCell>
                <LeadStageBadge stage={lead.stage} />
              </TableCell>
              <TableCell>
                <TemperatureBadge temperature={lead.temperature} />
              </TableCell>
              <TableCell numeric className="font-semibold text-foreground">
                {lead.aiScore ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {lead.assignedDealer?.name ?? "—"}
              </TableCell>
              <TableCell numeric className="text-muted-foreground">
                {formatDate(lead.createdAt)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
