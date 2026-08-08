import { NextRequest, NextResponse } from "next/server";
import { handleCsvImportProxy } from "@/lib/csvImportProxy";

/**
 * POST /api/tasks/import — bulk CSV task import.
 *
 * Proxies to backend `POST /tasks/import/csv`
 * (`@Roles('builder_admin','sales_manager','sales_agent','dealer')`).
 *
 * Sits alongside `src/app/api/tasks/route.ts` (list/create) and
 * `src/app/api/tasks/[taskId]/…`. Next resolves the static `import` segment
 * before the dynamic `[taskId]`, so this never collides with task detail.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleCsvImportProxy(req, "/tasks/import/csv", {
    defaultFilename: "tasks.csv",
  });
}
