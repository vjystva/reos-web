import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { z } from "zod";

const SalesTargetSchema = z.object({
  id: z.string(),
  tenantId: z.string().optional(),
  assigneeId: z.string(),
  period: z.string(),
  periodStart: z.string(),
  targetBookings: z.number().optional(),
  targetRevenue: z.union([z.string(), z.number()]).optional(),
  actualBookings: z.number().optional(),
  actualRevenue: z.union([z.string(), z.number()]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

const SalesTargetsResponseSchema = z.object({
  data: z.array(SalesTargetSchema),
  total: z.number().optional(),
}).or(z.array(SalesTargetSchema));

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const qs = url.search;
  const upstream = await proxyFetch(req, `/sales-targets${qs}`);

  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!upstream.ok) return NextResponse.json({ error: "upstream_error" }, { status: upstream.status });

  let json: unknown;
  try { json = await upstream.json(); } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  if (Array.isArray(json)) json = { data: json, total: (json as unknown[]).length };
  return NextResponse.json(json, { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const upstream = await proxyFetch(req, "/sales-targets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!upstream.ok) {
    let err: unknown = { error: "upstream_error" };
    try { err = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(err, { status: upstream.status });
  }

  const json = await upstream.json().catch(() => ({}));
  return NextResponse.json(json, { status: 201 });
}
