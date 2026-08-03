import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { MetricsResponseSchema } from "@/types/api";
import { isDemoRequest, DEMO_METRICS } from "@/lib/demo";

/**
 * Fan-out aggregator for the dashboard metrics cards.
 *
 * Fetches leads, bookings, and unit counts in parallel. Unit counts come from
 * /analytics/overview which returns availableUnits/bookedUnits — the
 * /units endpoint is project-scoped and cannot return global counts.
 *
 * Promise.allSettled means a single failure never discards the others.
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isDemoRequest(req)) return NextResponse.json(DEMO_METRICS, { status: 200 });

  const [leadsAll, leadsHot, bookings, overview] = await Promise.allSettled([
    proxyFetch(req, "/leads?pageSize=1").then(async (r) => {
      if (!r.ok) throw new Error(`leads ${r.status}`);
      const b = await r.json() as { total?: number };
      if (typeof b.total !== "number") throw new Error("no total");
      return b.total;
    }),
    proxyFetch(req, "/leads?temperature=hot&pageSize=1").then(async (r) => {
      if (!r.ok) throw new Error(`hot_leads ${r.status}`);
      const b = await r.json() as { total?: number };
      if (typeof b.total !== "number") throw new Error("no total");
      return b.total;
    }),
    proxyFetch(req, "/bookings?pageSize=1").then(async (r) => {
      if (!r.ok) throw new Error(`bookings ${r.status}`);
      const b = await r.json() as { total?: number };
      if (typeof b.total !== "number") throw new Error("no total");
      return b.total;
    }),
    proxyFetch(req, "/analytics/overview").then(async (r) => {
      if (!r.ok) throw new Error(`overview ${r.status}`);
      return r.json() as Promise<{ availableUnits?: number; bookedUnits?: number; totalUnits?: number }>;
    }),
  ]);

  const failed: string[] = [];

  function val<T>(result: PromiseSettledResult<T>, label: string): T | null {
    if (result.status === "fulfilled") return result.value;
    failed.push(label);
    return null;
  }

  const ov = val(overview, "unitsAvailable");

  const body = {
    totalLeads: val(leadsAll, "totalLeads"),
    hotLeads: val(leadsHot, "hotLeads"),
    bookings: val(bookings, "bookings"),
    units: {
      available: ov?.availableUnits ?? null,
      blocked: null,
      booked: ov?.bookedUnits ?? null,
    },
    failed,
  };

  const status = failed.length >= 4 ? 502 : 200;

  const parsed = MetricsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "metrics_shape_mismatch" }, { status: 500 });
  }
  return NextResponse.json(parsed.data, { status });
}
