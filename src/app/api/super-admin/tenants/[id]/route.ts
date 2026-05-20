import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { TenantSchema, TenantStatsSchema, UpdateTenantRequestSchema } from "@/types/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const upstream = await proxyFetch(req, `/super-admin/tenants/${id}`);
  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (upstream.status === 404) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!upstream.ok) return NextResponse.json({ error: "upstream_error" }, { status: upstream.status });
  let json: unknown;
  try { json = await upstream.json(); } catch { return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 }); }
  const parsed = TenantStatsSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  return NextResponse.json(parsed.data, { status: 200 });
}

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsedBody = UpdateTenantRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) return NextResponse.json({ error: "validation_error", details: parsedBody.error.flatten() }, { status: 400 });
  const upstream = await proxyFetch(req, `/super-admin/tenants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsedBody.data),
  });
  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (upstream.status === 404) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch {}
    return NextResponse.json(errBody, { status: upstream.status });
  }
  let json: unknown;
  try { json = await upstream.json(); } catch { return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 }); }
  const parsed = TenantSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  return NextResponse.json(parsed.data, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const upstream = await proxyFetch(req, `/super-admin/tenants/${id}`, { method: "DELETE" });
  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (upstream.status === 404) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!upstream.ok) return NextResponse.json({ error: "upstream_error" }, { status: upstream.status });
  let json: unknown;
  try { json = await upstream.json(); } catch { return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 }); }
  const parsed = TenantSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  return NextResponse.json(parsed.data, { status: 200 });
}
