import { NextRequest, NextResponse } from "next/server";
import { handleCsvImportProxy } from "@/lib/csvImportProxy";

/**
 * POST /api/projects/[projectId]/units/import — bulk CSV unit import.
 *
 * Proxies to backend `POST /projects/:projectId/units/import/csv`
 * (`@Roles('builder_admin')`).
 *
 * Nested under the project because the upstream import is PROJECT-SCOPED by
 * URL — there is no `project_id` CSV column. This mirrors the nesting already
 * used by `src/app/api/projects/[projectId]/towers/route.ts` and
 * `…/units/route.ts` rather than inventing a flat route with a query param.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { projectId: string } },
): Promise<NextResponse> {
  const { projectId } = ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "missing_project_id" }, { status: 400 });
  }

  return handleCsvImportProxy(
    req,
    `/projects/${encodeURIComponent(projectId)}/units/import/csv`,
    { defaultFilename: "units.csv" },
  );
}
