import type { StatusTone } from "@/components/StatusPill";
import type {
  Commission,
  Dealer,
  DealerKycStatus,
  DealerPerformance,
  DealerStatus,
} from "@/types/api";

/**
 * Shared channel-partner (dealer) performance model.
 *
 * Used by /dashboard/dealers (roster + KPI tiles), the dealer detail page and
 * the "Channel partner ROI" panel on /dashboard/reports, so all three agree
 * on what "payout due" and "commission cost" mean.
 *
 * Provenance:
 *   - leads / bookings / conversion / revenue → `GET /api/dealers/performance`
 *   - payout due / paid / commission cost     → `GET /api/commissions`
 *   - RERA id / KYC / commission rate / status→ `GET /api/dealers`
 */

/* -------------------------------------------------------------------------
 * Visual conventions — one source of truth for every partner surface.
 * ---------------------------------------------------------------------- */

export const DEALER_STATUS_TONE: Record<DealerStatus, StatusTone> = {
  active: "good",
  inactive: "neutral",
  suspended: "bad",
};

export const DEALER_STATUS_LABEL: Record<DealerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

/** KYC is a compliance gate: verified passes, pending nags, rejected blocks. */
export const KYC_TONE: Record<DealerKycStatus, StatusTone> = {
  verified: "good",
  pending: "warn",
  rejected: "bad",
};

export const KYC_LABEL: Record<DealerKycStatus, string> = {
  verified: "Verified",
  pending: "Pending",
  rejected: "Rejected",
};

export function dealerStatusTone(status: string | null | undefined): StatusTone {
  return DEALER_STATUS_TONE[(status ?? "") as DealerStatus] ?? "neutral";
}

export function dealerStatusLabel(status: string | null | undefined): string {
  return DEALER_STATUS_LABEL[(status ?? "") as DealerStatus] ?? "Unknown";
}

export function kycTone(status: string | null | undefined): StatusTone {
  return KYC_TONE[(status ?? "") as DealerKycStatus] ?? "neutral";
}

export function kycLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return KYC_LABEL[status as DealerKycStatus] ?? status;
}

/** Commission rows the builder still owes the partner. */
const DUE_STATUSES = new Set(["pending", "approved"]);

export interface CommissionTotals {
  /** pending + approved — money committed but not yet paid out. */
  due: number;
  paid: number;
  /** due + paid (cancelled rows excluded). */
  booked: number;
  rows: number;
}

const EMPTY_TOTALS: CommissionTotals = { due: 0, paid: 0, booked: 0, rows: 0 };

export function commissionTotalsByDealer(
  commissions: Commission[],
): Map<string, CommissionTotals> {
  const map = new Map<string, CommissionTotals>();
  for (const c of commissions) {
    if (c.status === "cancelled") continue;
    const amount = Number.parseFloat(c.amount);
    if (!Number.isFinite(amount)) continue;
    const acc = map.get(c.dealerId) ?? { ...EMPTY_TOTALS };
    if (DUE_STATUSES.has(c.status)) acc.due += amount;
    if (c.status === "paid") acc.paid += amount;
    acc.booked += amount;
    acc.rows += 1;
    map.set(c.dealerId, acc);
  }
  return map;
}

export function totalCommissionDue(commissions: Commission[]): number {
  return commissions
    .filter((c) => DUE_STATUSES.has(c.status))
    .reduce((sum, c) => {
      const n = Number.parseFloat(c.amount);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
}

/**
 * The performance endpoint may report conversion as a 0..1 ratio or an
 * already-scaled 0..100 percentage — same convention `TopDealersTable` uses.
 */
export function conversionPercent(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  return rate <= 1 ? rate * 100 : rate;
}

export interface PartnerRow {
  dealerId: string;
  name: string;
  firm: string | null;
  email: string | null;
  phone: string | null;
  reraId: string | null;
  kycStatus: string | null;
  status: string;
  commissionRate: number | null;
  /** null when the performance endpoint has no row for this partner. */
  leads: number | null;
  bookings: number | null;
  conversion: number | null;
  revenue: number | null;
  payoutDue: number;
  payoutPaid: number;
  /**
   * What the partner's business costs in commission. Real commission rows win;
   * when a partner has none we fall back to `revenue × commissionRate` and set
   * `commissionEstimated` so the UI can mark it "~".
   */
  commissionCost: number | null;
  commissionEstimated: boolean;
}

export interface BuildPartnerRowsArgs {
  dealers: Dealer[];
  performance: DealerPerformance[];
  commissions: Commission[];
}

export function buildPartnerRows({
  dealers,
  performance,
  commissions,
}: BuildPartnerRowsArgs): PartnerRow[] {
  const perfById = new Map(performance.map((p) => [p.dealerId, p]));
  const commissionsById = commissionTotalsByDealer(commissions);

  return dealers.map<PartnerRow>((d) => {
    const perf = perfById.get(d.id);
    const totals = commissionsById.get(d.id);
    const rate = d.commissionRate ?? null;
    const revenue = perf?.revenue ?? null;

    const hasRealCommission = (totals?.rows ?? 0) > 0;
    const estimated =
      !hasRealCommission && rate != null && revenue != null && revenue > 0;

    return {
      dealerId: d.id,
      name: d.name,
      firm: d.company ?? null,
      email: d.email ?? null,
      phone: d.phone ?? null,
      reraId: d.reraId ?? null,
      kycStatus: d.kycStatus ?? null,
      status: d.status,
      commissionRate: rate,
      leads: perf?.leadCount ?? null,
      bookings: perf?.bookingCount ?? null,
      conversion: conversionPercent(perf?.conversionRate),
      revenue,
      payoutDue: totals?.due ?? 0,
      payoutPaid: totals?.paid ?? 0,
      commissionCost: hasRealCommission
        ? (totals as CommissionTotals).booked
        : estimated
          ? (revenue as number) * ((rate as number) / 100)
          : null,
      commissionEstimated: estimated,
    };
  });
}

export interface PartnerTotals {
  partners: number;
  leads: number;
  bookings: number;
  revenue: number;
  payoutDue: number;
  /** Partners matched to a row in the performance endpoint. */
  withPerformance: number;
}

export function sumPartnerRows(rows: PartnerRow[]): PartnerTotals {
  return rows.reduce<PartnerTotals>(
    (acc, r) => ({
      partners: acc.partners + 1,
      leads: acc.leads + (r.leads ?? 0),
      bookings: acc.bookings + (r.bookings ?? 0),
      revenue: acc.revenue + (r.revenue ?? 0),
      payoutDue: acc.payoutDue + r.payoutDue,
      withPerformance: acc.withPerformance + (r.leads != null ? 1 : 0),
    }),
    {
      partners: 0,
      leads: 0,
      bookings: 0,
      revenue: 0,
      payoutDue: 0,
      withPerformance: 0,
    },
  );
}
