import { NextRequest, NextResponse } from "next/server";
import {
  LoginRequestSchema,
  UpstreamLoginResponseSchema,
} from "@/types/api";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/api";

const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;

function backendBaseUrl(): string {
  return process.env.REOS_API_BASE_URL ?? "http://localhost:3001";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", message: parsed.error.message },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "upstream_unreachable" },
      { status: 502 },
    );
  }

  if (upstream.status === 401) {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_error" },
      { status: 502 },
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

  const validated = UpstreamLoginResponseSchema.safeParse(json);
  if (!validated.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  const { accessToken, refreshToken, expiresIn, user } = validated.data;
  const accessMaxAge = expiresIn ?? DEFAULT_ACCESS_TTL_SECONDS;

  const res = NextResponse.json({ user }, { status: 200 });
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
  return res;
}
