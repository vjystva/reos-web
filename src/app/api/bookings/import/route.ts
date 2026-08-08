import { NextRequest, NextResponse } from "next/server";
import { handleCsvImportProxy } from "@/lib/csvImportProxy";

/**
 * POST /api/bookings/import — bulk CSV booking import.
 *
 * Proxies to backend `POST /bookings/import/csv`
 * (`@Roles('sales_agent','sales_manager','builder_admin','dealer')`).
 *
 * Lead/unit reference resolution, ambiguity detection and the
 * unit-availability check all happen per row upstream; their reasons
 * ("ambiguous unit", "Unit is not available for booking") arrive in
 * `rejected[].reason` and are shown verbatim.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleCsvImportProxy(req, "/bookings/import/csv", {
    defaultFilename: "bookings.csv",
  });
}
