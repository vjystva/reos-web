import * as React from "react";
import { useUnitPricing, UnitPricingNotFoundError } from "@/hooks/useUnitPricing";
import { formatCurrency } from "@/lib/formatCurrency";

interface PricingWidgetProps {
  unitId: string;
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className={`h-4 animate-pulse rounded bg-slate-200 ${width}`}
      aria-hidden="true"
    />
  );
}

function PricingWidgetSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <SkeletonLine width="w-1/2" />
      <SkeletonLine width="w-3/4" />
      <SkeletonLine width="w-2/3" />
      <SkeletonLine width="w-1/3" />
      <SkeletonLine width="w-full" />
    </div>
  );
}

/**
 * Confidence badge — colour reflects certainty level.
 *   >=0.8  green (high)
 *   >=0.5  amber (medium)
 *   <0.5   red   (low)
 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const colorClass =
    pct >= 80
      ? "bg-green-100 text-green-800"
      : pct >= 50
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {pct}% confidence
    </span>
  );
}

export function PricingWidget({ unitId }: PricingWidgetProps) {
  const { data, isLoading, isError, error } = useUnitPricing(unitId);

  if (isLoading) {
    return <PricingWidgetSkeleton />;
  }

  if (isError) {
    const isNotFound = error instanceof UnitPricingNotFoundError;
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        {isNotFound
          ? "Pricing not available for this unit."
          : "Failed to load pricing. Please try again."}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      {/* Estimated price */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Estimated Price
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
            {formatCurrency(data.estimatedPrice)}
          </p>
        </div>
        <ConfidenceBadge confidence={data.confidence} />
      </div>

      {/* Price range */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Price Range
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-slate-700">
          {formatCurrency(data.priceRange.low)}
          {" — "}
          {formatCurrency(data.priceRange.high)}
        </p>
      </div>

      {/* Price per sqft */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Price / sqft
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-slate-700">
          {formatCurrency(data.pricePerSqft)}
        </p>
      </div>

      {/* Adjustment factors */}
      {data.adjustmentFactors.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Adjustment Factors
          </p>
          <ul className="mt-1 space-y-0.5">
            {data.adjustmentFactors.map((factor) => (
              <li key={factor} className="text-sm text-slate-700">
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
