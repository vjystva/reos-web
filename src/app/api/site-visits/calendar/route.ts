import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { TenantSiteVisitsResponseSchema } from "@/types/api";

/**
 * GET /api/site-visits/calendar
 *   ?from=<iso>&to=<iso>&status=<status>&assignedAgentId=<uuid>&projectId=<uuid>
 *
 * Tenant-wide site-visit listing for the calendar view. Proxies to the
 * existing backend `GET /site-visits` (ListSiteVisitsDto), mapping
 * from/to → scheduledFrom/scheduledTo.
 *
 * Distinct from `/api/site-visits`, which is booking-scoped (requires
 * `bookingId`) and normalises to the booking-shaped `SiteVisitSchema`. That
 * route is untouched.
 *
 * The backend caps pageSize at 100, so a busy month can span several pages;
 * this route drains up to MAX_PAGES and returns a single flat envelope.
 */

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

type Envelope = {
  data: unknown[];
  total: number;
  page?: number;
  pageSize?: number;
};

function buildUpstreamQs(url: URL, page: number): string {
  const qs = new URLSearchParams();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const assignedAgentId = url.searchParams.get("assignedAgentId");
  const projectId = url.searchParams.get("projectId");
  const leadId = url.searchParams.get("leadId");

  if (from) qs.set("scheduledFrom", from);
  if (to) qs.set("scheduledTo", to);
  if (status) qs.set("status", status);
  if (assignedAgentId) qs.set("assignedAgentId", assignedAgentId);
  if (projectId) qs.set("projectId", projectId);
  if (leadId) qs.set("leadId", leadId);
  qs.set("page", String(page));
  qs.set("pageSize", String(PAGE_SIZE));
  return qs.toString();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);

  const collected: unknown[] = [];
  let total = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const upstream = await proxyFetch(
      req,
      `/site-visits?${buildUpstreamQs(url, page)}`,
    );

    if (upstream.status === 401) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: "upstream_error", message: body },
        { status: upstream.status },
      );
    }

    let json: unknown;
    try {
      json = await upstream.json();
    } catch {
      return NextResponse.json(
        { error: "upstream_shape_mismatch" },
        { status: 502 },
      );
    }

    // Tolerate a bare array (older/stubbed upstreams) as well as the
    // paginated envelope the Nest controller returns.
    const envelope: Envelope = Array.isArray(json)
      ? { data: json, total: json.length }
      : (json as Envelope);

    if (!envelope || !Array.isArray(envelope.data)) {
      return NextResponse.json(
        { error: "upstream_shape_mismatch" },
        { status: 502 },
      );
    }

    collected.push(...envelope.data);
    total = typeof envelope.total === "number" ? envelope.total : collected.length;

    if (envelope.data.length < PAGE_SIZE || collected.length >= total) break;
  }

  const parsed = TenantSiteVisitsResponseSchema.safeParse({
    data: collected,
    total: Math.max(total, collected.length),
    page: 1,
    pageSize: collected.length,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
