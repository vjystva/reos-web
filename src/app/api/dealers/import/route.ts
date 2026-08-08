import { NextRequest, NextResponse } from "next/server";
import { handleCsvImportProxy } from "@/lib/csvImportProxy";

/**
 * POST /api/dealers/import — bulk CSV dealer import.
 *
 * Proxies to backend `POST /dealers/import/csv`
 * (`@Roles('builder_admin','sales_manager')`, `FileInterceptor('file')`).
 * A dealer whose email already exists in the tenant comes back as a per-row
 * rejection, not a whole-file failure.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleCsvImportProxy(req, "/dealers/import/csv", {
    defaultFilename: "dealers.csv",
  });
}
