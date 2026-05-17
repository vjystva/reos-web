import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { MilestonesResponseSchema } from "@/types/api";
import { isDemoRequest, getDemoMilestones } from "@/lib/demo";

/**
 * GET /api/payment-schedules/[scheduleId]/milestones
 *
 * Proxies to GET /payment-schedules/:id/milestones on the backend.
 * Returns milestones with amount_paid, status, and overdue flag.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
): Promise<NextResponse> {
  const { scheduleId } = await params;

  if (isDemoRequest(req)) {
    return NextResponse.json(getDemoMilestones(scheduleId), { status: 200 });
  }

  const upstream = await proxyFetch(
    req,
    `/payment-schedules/${scheduleId}/milestones`,
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (upstream.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  // Normalise array to paginated envelope.
  if (Array.isArray(json)) {
    json = { data: json, total: (json as unknown[]).length };
  }

  const parsed = MilestonesResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
