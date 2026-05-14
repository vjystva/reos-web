import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { MetricsResponseSchema } from "@/types/api";

/**
 * Fan-out aggregator for the dashboard metrics cards.
 *
 * Six independent upstream calls run via Promise.allSettled. Each fulfilled
 * slot supplies a `total` integer; each rejected slot becomes `null` and its
 * label is appended to `failed[]`.
 *
 *   - 200 + failed=[]               → all six succeeded
 *   - 200 + failed=[some]           → partial: client renders last-good per card
 *   - 502 + failed=[all six labels] → catastrophic
 *
 * This is deliberately Promise.allSettled (not Promise.all) so a single
 * rejection does not discard the other five successful results.
 */

type SlotKey =
  | "totalLeads"
  | "hotLeads"
  | "bookings"
  | "unitsAvailable"
  | "unitsBlocked"
  | "unitsBooked";

interface Slot {
  key: SlotKey;
  path: string;
}

const SLOTS: Slot[] = [
  { key: "totalLeads", path: "/leads?pageSize=1" },
  { key: "hotLeads", path: "/leads?temperature=hot&pageSize=1" },
  { key: "bookings", path: "/bookings?pageSize=1" },
  { key: "unitsAvailable", path: "/units?status=available&pageSize=1" },
  { key: "unitsBlocked", path: "/units?status=blocked&pageSize=1" },
  { key: "unitsBooked", path: "/units?status=booked&pageSize=1" },
];

async function fetchTotal(req: NextRequest, path: string): Promise<number> {
  const res = await proxyFetch(req, path);
  if (!res.ok) {
    throw new Error(`upstream ${res.status} for ${path}`);
  }
  const body = (await res.json()) as { total?: unknown };
  if (typeof body?.total !== "number") {
    throw new Error(`missing total in upstream response for ${path}`);
  }
  return body.total;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const settled = await Promise.allSettled(
    SLOTS.map((slot) => fetchTotal(req, slot.path)),
  );

  const failed: string[] = [];
  const results: Record<SlotKey, number | null> = {
    totalLeads: null,
    hotLeads: null,
    bookings: null,
    unitsAvailable: null,
    unitsBlocked: null,
    unitsBooked: null,
  };

  settled.forEach((entry, i) => {
    const slot = SLOTS[i];
    if (entry.status === "fulfilled") {
      results[slot.key] = entry.value;
    } else {
      failed.push(slot.key);
    }
  });

  const body = {
    totalLeads: results.totalLeads,
    hotLeads: results.hotLeads,
    bookings: results.bookings,
    units: {
      available: results.unitsAvailable,
      blocked: results.unitsBlocked,
      booked: results.unitsBooked,
    },
    failed,
  };

  const status = failed.length === SLOTS.length ? 502 : 200;

  // Self-check: serialise via Zod so any drift is caught loud.
  const parsed = MetricsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "metrics_shape_mismatch" },
      { status: 500 },
    );
  }
  return NextResponse.json(parsed.data, { status });
}
