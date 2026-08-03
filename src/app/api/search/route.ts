import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { z } from "zod";

const SearchResultSchema = z.object({
  id: z.string(),
  type: z.enum(["lead", "project", "booking"]),
  title: z.string(),
  subtitle: z.string(),
});

const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0 }, { status: 200 });
  }

  const qs = new URLSearchParams(url.searchParams);
  const upstream = await proxyFetch(req, `/search?${qs.toString()}`);

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream_error" }, { status: upstream.status });
  }

  let json: unknown;
  try { json = await upstream.json(); } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  const parsed = SearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
