"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { UnitStatusBadge } from "@/components/UnitStatusBadge";
import { inr } from "@/lib/utils";
import type { Tower, Unit } from "@/types/api";

interface UnitTableProps {
  units: Unit[];
  /** Tower list for the project — used to resolve `towerId` to a name. */
  towers?: Tower[];
  projectName?: string | null;
  isLoading: boolean;
}

const COLUMNS: { key: string; label: string; numeric?: boolean }[] = [
  { key: "unit", label: "Unit" },
  { key: "project", label: "Project" },
  { key: "tower", label: "Tower" },
  { key: "floor", label: "Floor", numeric: true },
  { key: "type", label: "Type" },
  // `units.area_sqft` is the chargeable area, not the carpet area — the old
  // "Carpet sqft" label was a mislabel, and since backend migration 033
  // carpet area is a distinct, optional column. The full super/carpet/balcony
  // breakdown lives in the unit slide-over rather than widening this table.
  { key: "area", label: "Area sqft", numeric: true },
  { key: "price", label: "Price", numeric: true },
  { key: "status", label: "Status" },
  { key: "buyer", label: "Buyer" },
];

/**
 * `UnitSchema` is `.passthrough()`, so the buyer may arrive nested under a
 * booking/lead or flattened — resolved defensively, "—" when absent.
 */
function buyerName(unit: Unit): string | null {
  const raw = unit as Record<string, unknown>;
  const candidates: unknown[] = [
    raw.buyer,
    raw.customer,
    raw.lead,
    (raw.booking as Record<string, unknown> | undefined)?.lead,
    (raw.booking as Record<string, unknown> | undefined)?.customer,
    raw.buyerName,
    raw.customerName,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (c && typeof c === "object") {
      const o = c as Record<string, unknown>;
      const n = o.name ?? o.fullName;
      if (typeof n === "string" && n.trim()) return n.trim();
      const joined = `${typeof o.firstName === "string" ? o.firstName : ""} ${
        typeof o.lastName === "string" ? o.lastName : ""
      }`.trim();
      if (joined) return joined;
    }
  }
  return null;
}

export function UnitTable({
  units,
  towers,
  projectName,
  isLoading,
}: UnitTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const towerName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of towers ?? []) map.set(t.id, t.name);
    return map;
  }, [towers]);

  function openUnit(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("unit", id);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <Table role="grid">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((c) => (
            <TableHead key={c.key} numeric={c.numeric}>
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              {COLUMNS.map((c) => (
                <TableCell key={c.key}>
                  <Skeleton className="h-3 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : units.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={COLUMNS.length}
              className="py-6 text-center text-xs text-muted-foreground"
            >
              No units match the current filters.
            </TableCell>
          </TableRow>
        ) : (
          units.map((u) => {
            const areaSqft = u.areaSqft ?? u.area ?? null;
            const price = u.effectivePrice ?? u.listPrice ?? null;
            return (
              <TableRow
                key={u.id}
                tabIndex={0}
                role="button"
                aria-label={`Open unit ${u.unitNumber ?? u.id}`}
                onClick={() => openUnit(u.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openUnit(u.id);
                  }
                }}
                className="cursor-pointer focus:bg-muted/60 focus:outline-none"
              >
                <TableCell className="font-mono font-medium tabular-nums text-foreground">
                  {u.unitNumber ?? u.id.slice(0, 8)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {projectName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.towerId ? (towerName.get(u.towerId) ?? "—") : "—"}
                </TableCell>
                <TableCell numeric className="text-foreground">
                  {typeof u.floor === "number" ? u.floor : "—"}
                </TableCell>
                <TableCell className="text-foreground">
                  {typeof u.bedrooms === "number" ? `${u.bedrooms} BHK` : "—"}
                </TableCell>
                <TableCell numeric className="text-foreground">
                  {areaSqft != null ? areaSqft.toLocaleString("en-IN") : "—"}
                </TableCell>
                <TableCell numeric className="font-semibold text-foreground">
                  {price != null ? inr(price) : "—"}
                </TableCell>
                <TableCell>
                  <UnitStatusBadge status={u.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {buyerName(u) ?? "—"}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
