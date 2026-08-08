import { NextRequest, NextResponse } from "next/server";
import { handleCsvImportProxy } from "@/lib/csvImportProxy";

/**
 * POST /api/leads/import — bulk CSV lead import.
 *
 * Proxies a multipart upload to the backend `POST /leads/import/csv`
 * (`FileInterceptor('file')`, 5 MB cap, 500-row cap, roles sales_manager /
 * builder_admin) and validates the `{ imported, rejected[] }` result.
 *
 * The transport logic (buffer re-encode so `proxyFetch` can safely replay
 * after a token refresh, demo-mode fallback, verbatim upstream error
 * passthrough) now lives in `@/lib/csvImportProxy` and is shared with the
 * units / dealers / bookings / tasks importers. Behaviour here is unchanged —
 * `src/app/api/leads/__tests__/import.test.ts` covers it.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleCsvImportProxy(req, "/leads/import/csv", {
    defaultFilename: "leads.csv",
  });
}
