import * as React from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import type { UnitPriceConfig } from "@/types/api";

interface PricingBreakdownTableProps {
  config: UnitPriceConfig;
}

interface Row {
  label: string;
  value: number;
  negative?: boolean;
}

export function PricingBreakdownTable({ config }: PricingBreakdownTableProps) {
  const rows: Row[] = [
    { label: "Base price", value: config.basePrice },
    { label: "Floor premium", value: config.floorPremium },
    { label: "Facing premium", value: config.facingPremium },
    { label: "Corner premium", value: config.cornerPremium },
    { label: "Discount", value: -Math.abs(config.discount), negative: true },
  ];

  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-border last:border-0">
            <td className="py-1.5 text-muted-foreground">{r.label}</td>
            <td
              className={cn(
                "py-1.5 text-right font-mono tabular-nums",
                r.negative ? "text-destructive" : "text-foreground",
              )}
            >
              {formatCurrency(r.value)}
            </td>
          </tr>
        ))}
        <tr className="border-t border-border">
          <td className="pt-2 font-semibold text-foreground">Effective price</td>
          <td className="pt-2 text-right font-mono font-bold tabular-nums text-foreground">
            {formatCurrency(config.effectivePrice)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

interface PricingBreakdownFallbackProps {
  effectivePrice: number | null | undefined;
}

/**
 * Fallback rendered when `/api/units/:id/price-config` returns 404 (endpoint
 * not yet implemented on the backend per feasibility). Shows the single
 * effective price from the unit row itself with a small caption.
 */
export function PricingBreakdownFallback({
  effectivePrice,
}: PricingBreakdownFallbackProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">Effective price</span>
        <span className="font-mono font-bold tabular-nums text-foreground">
          {effectivePrice != null ? formatCurrency(effectivePrice) : "—"}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Detailed breakdown unavailable for this unit.
      </p>
    </div>
  );
}
