import * as React from "react";
import { formatCurrency } from "@/lib/formatCurrency";
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
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-slate-100 last:border-0">
            <td className="py-1.5 text-slate-600">{r.label}</td>
            <td className="py-1.5 text-right font-mono tabular-nums text-slate-900">
              {formatCurrency(r.value)}
            </td>
          </tr>
        ))}
        <tr className="border-t-2 border-slate-300">
          <td className="pt-2 font-semibold text-slate-900">Effective price</td>
          <td className="pt-2 text-right font-mono font-bold tabular-nums text-slate-900">
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
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-900">Effective price</span>
        <span className="font-mono font-bold tabular-nums text-slate-900">
          {effectivePrice != null ? formatCurrency(effectivePrice) : "—"}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        Detailed breakdown unavailable for this unit.
      </p>
    </div>
  );
}
