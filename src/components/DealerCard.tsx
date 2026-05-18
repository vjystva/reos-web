"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealerStatusBadge } from "@/components/DealerStatusBadge";
import type { Dealer } from "@/types/api";

interface DealerCardProps {
  dealer: Dealer;
  onEdit?: (dealer: Dealer) => void;
}

export function DealerCard({ dealer, onEdit }: DealerCardProps) {
  return (
    <article
      className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      aria-label={`Dealer ${dealer.name}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 break-words">
            {dealer.name}
          </h3>
          {dealer.region ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {dealer.region}
            </p>
          ) : null}
        </div>
        <DealerStatusBadge status={dealer.status} />
      </header>

      <div className="space-y-1 text-xs text-slate-600">
        {dealer.email ? (
          <div className="inline-flex items-center gap-1">
            <Mail className="h-3 w-3" aria-hidden="true" />
            <span className="break-all">{dealer.email}</span>
          </div>
        ) : null}
        {dealer.phone ? (
          <div className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" aria-hidden="true" />
            <span>{dealer.phone}</span>
          </div>
        ) : null}
        {dealer.commissionRate != null ? (
          <div className="text-slate-500">
            Commission:{" "}
            <span className="font-semibold text-slate-700">
              {dealer.commissionRate}%
            </span>
          </div>
        ) : null}
      </div>

      <footer className="flex items-center gap-2 pt-1">
        <Link
          href={`/dashboard/dealers/${dealer.id}`}
          className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          View
        </Link>
        {onEdit ? (
          <Button size="sm" variant="outline" onClick={() => onEdit(dealer)}>
            Edit
          </Button>
        ) : null}
      </footer>
    </article>
  );
}
