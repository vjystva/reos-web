import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

/**
 * GET /api/inventory — BFF proxy for the flat unit inventory endpoint.
 * Forwards all query params (status, type, minPrice, maxPrice, floor,
 * page, pageSize) verbatim to the backend /units endpoint.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const incoming = new URL(req.url);
  const qs = incoming.searchParams.toString();
  const backendPath = qs ? `/units?${qs}` : `/units`;

  const upstream = await proxyFetch(req, backendPath);

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
