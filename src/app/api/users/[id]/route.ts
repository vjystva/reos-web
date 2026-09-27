import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { z } from "zod";

/**
 * PATCH body accepted from the browser. Mirrors the backend `UpdateUserDto`
 * exactly — the backend's global ValidationPipe runs with
 * `forbidNonWhitelisted: true`, so forwarding any undeclared key (e.g. `email`)
 * would come back as a 400 rather than being ignored.
 *
 * `name: ""` is preserved, not stripped: it is the "clear the name" signal and
 * the backend normalises blank to SQL NULL.
 */
const UpdateUserBodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  role: z.enum(["sales_manager", "sales_agent", "dealer"]).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Shape of the row the backend returns from `PATCH /auth/users/:id`. Slightly
 * wider than the list row: it always carries `isActive` and `tenantId`.
 */
const UpdatedUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullish(),
  role: z.string(),
  isActive: z.boolean().optional(),
  tenantId: z.string().optional(),
  createdAt: z.string().optional(),
});

/**
 * PATCH /api/users/[id] — partial update of a tenant user (builder_admin only,
 * enforced upstream). Proxies to `PATCH /auth/users/:id`.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsedBody = UpdateUserBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(
    req,
    `/auth/users/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedBody.data),
    },
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch {
      /* keep default */
    }
    return NextResponse.json(errBody, { status: upstream.status });
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
  const parsed = UpdatedUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
