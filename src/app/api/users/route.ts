import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { z } from "zod";

const CreateUserBodySchema = z.object({
  email: z.string().email("Enter a valid email"),
  // Optional display name. Blank collapses to "omitted" so we never forward
  // `name: ""` — the backend would store it as NULL regardless, and its
  // ValidationPipe runs `forbidNonWhitelisted`, so only declared keys may go up.
  name: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["sales_manager", "sales_agent", "dealer"]),
});

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  // `.nullish()`: backend sends `null` for "no name on record", and a
  // pre-migration-035 backend omits the key entirely.
  name: z.string().nullish(),
  role: z.string(),
  isActive: z.boolean().optional(),
  tenantId: z.string().optional(),
  createdAt: z.string().optional(),
});

const UsersResponseSchema = z.object({
  data: z.array(UserSchema),
  total: z.number(),
});

/**
 * GET /api/users — list tenant users (builder_admin + sales_manager).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/auth/users");

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let json: unknown;
  try { json = await upstream.json(); } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  // Backend returns array — wrap into envelope
  if (Array.isArray(json)) {
    json = { data: json, total: (json as unknown[]).length };
  }

  const parsed = UsersResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * POST /api/users — create a user (builder_admin only).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateUserBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, "/auth/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let json: unknown;
  try { json = await upstream.json(); } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(json, { status: 201 });
}
