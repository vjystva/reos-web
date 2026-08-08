"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorBanner } from "@/components/ErrorBanner";
import { StatusPill } from "@/components/StatusPill";
import { paymentModeLabel, paymentStatusTone } from "@/lib/bookingTone";
import { formatDate, inr } from "@/lib/utils";
import type { Payment } from "@/types/api";

interface PaymentHistoryTableProps {
  payments: Payment[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onBounce: (paymentId: string) => void;
  bouncingId: string | null;
}

const COLUMNS: { key: string; label: string; numeric?: boolean }[] = [
  { key: "date", label: "Date", numeric: true },
  { key: "amount", label: "Amount", numeric: true },
  { key: "mode", label: "Mode" },
  { key: "reference", label: "Ref #" },
  { key: "receipt", label: "Receipt" },
  { key: "status", label: "Status" },
  { key: "actions", label: "" },
];

export function PaymentHistoryTable({
  payments,
  isLoading,
  isError,
  onRetry,
  onBounce,
  bouncingId,
}: PaymentHistoryTableProps) {
  if (isError) {
    return (
      <ErrorBanner message="Could not load payment history." onRetry={onRetry} />
    );
  }

  return (
    <Table>
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
          Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              {COLUMNS.map((c) => (
                <TableCell key={c.key}>
                  <Skeleton className="h-3 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : !payments || payments.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={COLUMNS.length}
              className="py-6 text-center text-xs text-muted-foreground"
            >
              No payments recorded yet.
            </TableCell>
          </TableRow>
        ) : (
          payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell numeric className="text-muted-foreground">
                {formatDate(p.createdAt)}
              </TableCell>
              <TableCell numeric className="font-semibold text-foreground">
                {inr(p.amount)}
              </TableCell>
              <TableCell className="text-foreground">
                {paymentModeLabel(p.mode)}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {p.referenceNumber ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {p.receiptNumber ?? "—"}
              </TableCell>
              <TableCell>
                <StatusPill tone={paymentStatusTone(p.status)}>
                  {p.status === "bounced" ? "Bounced" : "Cleared"}
                </StatusPill>
              </TableCell>
              <TableCell className="text-right">
                {p.status !== "bounced" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={bouncingId === p.id}
                    onClick={() => onBounce(p.id)}
                  >
                    {bouncingId === p.id ? "…" : "Bounce"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
