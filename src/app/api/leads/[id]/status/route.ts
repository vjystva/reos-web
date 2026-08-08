import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { z } from "zod";

const UpdateStatusBodySchema = z.object({
  status: z.string().min(1, "status is required"),
  /**
   * Required by the backend when `status === "lost"` — it answers 400
   * "lostReason is required when moving to lost" without it.
   */
  lostReason: z.string().min(1).max(500).optional(),
  /**
   * Free-form transition commentary. Required by the backend for the
   * `lost -> new` reactivation path.
   */
  note: z.string().min(1).max(500).optional(),
});

/**
 * PATCH /api/leads/[id]/status — moves a lead to a new pipeline status.
 *
 * Proxies to backend `POST /leads/:id/stage` with body
 * `{ toStage, lostReason?, note? }`. This is the ONLY stage-transition path:
 * backend `UpdateLeadDto` (PATCH /leads/:id) deliberately excludes
 * `pipeline_stage`, so sending `{ stage }` there is rejected by the global
 * whitelist validator.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = UpdateStatusBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  // Backend uses POST /leads/:id/stage with { toStage, lostReason?, note? }.
  // Optional keys are omitted entirely rather than sent as undefined/null —
  // the backend runs a whitelisting validation pipe.
  const upstreamPayload: Record<string, string> = {
    toStage: parsed.data.status,
  };
  if (parsed.data.lostReason) upstreamPayload.lostReason = parsed.data.lostReason;
  if (parsed.data.note) upstreamPayload.note = parsed.data.note;

  const upstream = await proxyFetch(
    req,
    `/leads/${encodeURIComponent(id)}/stage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamPayload),
    },
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let upstreamBody: unknown;
  try {
    upstreamBody = await upstream.json();
  } catch {
    upstreamBody = {};
  }

  return NextResponse.json(upstreamBody, { status: upstream.status });
}
