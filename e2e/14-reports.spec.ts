/**
 * Scenario 15 – Reports regression suite.
 *
 * Guards the four frontend/backend contract defects found on
 * /dashboard/reports. Every test asserts a real business outcome (a job that
 * actually completes, a CSV that actually downloads, a panel that actually
 * shows the tenant's numbers), not merely "no console error".
 *
 * Bugs covered:
 *   R1  POST /api/reports forwarded dateFrom/dateTo/projectId at the top level.
 *       The backend `CreateReportDto` accepts { reportType, format, filters? }
 *       under a global ValidationPipe with forbidNonWhitelisted, so picking any
 *       date on the Generate report form returned
 *       400 "property dateFrom should not exist".
 *   R2  GET /api/reports forwarded rows keyed on `id`; the client contract
 *       wants `jobId` (and rejects null format/rowCount/downloadUrl). Every row
 *       failed `ReportJobsResponseSchema`, `useReportJobs` swallowed the parse
 *       failure and returned { jobs: [] }, so "Recent exports" always read
 *       "No reports generated yet" — on a clean HTTP 200.
 *   R3  Report jobs never left status 'queued': ReportsService.processJob ran
 *       fire-and-forget on the pooled connection, which has no RLS tenant
 *       context and cannot see the uncommitted row. No job ever produced a
 *       rowCount or a Download link.
 *   R4  GET /reports/:id/download 500'd — it selected `name`/`stage` from
 *       `leads` and `total_amount` from `bookings`; none of those columns
 *       exist (first_name/last_name, pipeline_stage, booking_amount).
 *   R5  /analytics/leads-by-source did not exist on the backend. The BFF turned
 *       the 404 into `{ data: [] }`, so "Source-wise conversion" silently
 *       showed a zeroed Leads column.
 *   R6  POST /api/reports/jobs/:id/run proxied to /reports/:id/run, which
 *       matches no handler (the real route is /reports/jobs/:id/run) — 404.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

const SHOTS = "test-results";

interface ReportJob {
  jobId: string;
  status: string;
  reportType: string;
  format: string;
  rowCount?: number;
  downloadUrl?: string;
}

/**
 * The `<Card>` wrapper for a titled panel. `CardTitle` renders an <h3>, and
 * the Card root is the only `div.rounded-md.border` that contains it, so this
 * scopes to header + content together (a naive `div:has(text)` chain resolves
 * to the header alone and never sees the table).
 */
function panelCard(page: Page, title: string) {
  return page
    .locator("div.rounded-md.border")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .first();
}

async function generateReport(
  page: Page,
  body: Record<string, unknown>,
): Promise<{ status: number; job: ReportJob }> {
  const res = await page.request.post(`${BASE}/api/reports`, { data: body });
  const job = (await res.json()) as ReportJob;
  return { status: res.status(), job };
}

test.describe("Scenario 15 – Reports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  // -------------------------------------------------------------------------
  // R1 — the generate form's date range must not 400
  // -------------------------------------------------------------------------

  test("R1: generating a report with a date range succeeds (dates land in filters)", async ({
    page,
  }) => {
    const { status, job } = await generateReport(page, {
      reportType: "leads",
      format: "csv",
      dateFrom: "2026-01-01",
      dateTo: "2026-08-01",
    });

    expect(status).toBe(201);
    expect(job.jobId).toBeTruthy();

    // The dates must have survived the translation into `filters`, not been
    // dropped on the floor to dodge the 400.
    const detail = await page.request.get(
      `${BASE}/api/reports/${job.jobId}`,
    );
    expect(detail.status()).toBe(200);
    const body = (await detail.json()) as {
      parameters?: Record<string, string>;
    };
    expect(body.parameters?.dateFrom).toBe("2026-01-01");
    expect(body.parameters?.dateTo).toBe("2026-08-01");
  });

  test("R1: submitting the Generate report form with dates does not error", async ({
    page,
  }) => {
    await page.goto("/dashboard/reports");
    await expect(
      page.getByRole("heading", { name: /reports & analytics/i }),
    ).toBeVisible();

    const form = page.locator("form").filter({ hasText: "Generate Report" });
    await form.locator('input[type="date"]').first().fill("2026-02-01");
    await form.locator('input[type="date"]').nth(1).fill("2026-08-01");

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/reports") && r.request().method() === "POST",
      ),
      form.getByRole("button", { name: /generate report/i }).click(),
    ]);

    expect(response.status()).toBe(201);
    const created = (await response.json()) as ReportJob;
    expect(created.jobId).toBeTruthy();

    await page.screenshot({
      path: `${SHOTS}/reports-generate-with-dates.png`,
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // R2 + R3 — the exports panel lists real, completed jobs
  // -------------------------------------------------------------------------

  test("R2: GET /api/reports returns jobs keyed on jobId", async ({ page }) => {
    await generateReport(page, { reportType: "leads", format: "csv" });

    const res = await page.request.get(`${BASE}/api/reports`);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { jobs: ReportJob[] };
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body.jobs.length).toBeGreaterThan(0);
    for (const job of body.jobs.slice(0, 5)) {
      expect(typeof job.jobId).toBe("string");
      expect(job.jobId.length).toBeGreaterThan(0);
      expect(["csv", "json"]).toContain(job.format);
    }
  });

  test("R2: Recent exports panel lists jobs instead of the empty state", async ({
    page,
  }) => {
    await generateReport(page, { reportType: "leads", format: "csv" });

    await page.goto("/dashboard/reports");
    const panel = panelCard(page, "Recent exports");

    await expect(panel).not.toContainText(/No reports generated yet/i, {
      timeout: 10_000,
    });
    await expect(
      panel.getByRole("link", { name: /download/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: `${SHOTS}/reports-recent-exports.png`,
      fullPage: true,
    });
  });

  test("R3: a generated job reaches 'completed' with a real row count", async ({
    page,
  }) => {
    const { job } = await generateReport(page, {
      reportType: "leads",
      format: "csv",
    });

    expect(job.status).toBe("completed");
    expect(typeof job.rowCount).toBe("number");
    expect(job.rowCount as number).toBeGreaterThan(0);
    expect(job.downloadUrl).toContain(job.jobId);
  });

  // -------------------------------------------------------------------------
  // R4 — the Download action actually returns a CSV
  // -------------------------------------------------------------------------

  for (const [reportType, header] of [
    ["leads", "id,first_name,last_name,email,phone,pipeline_stage,created_at"],
    ["bookings", "id,unit_id,booking_amount,status,created_at"],
    ["payments", "id,booking_id,amount,payment_mode,status,created_at"],
    ["site_visits", "id,lead_id,scheduled_at,status,created_at"],
  ] as const) {
    test(`R4: ${reportType} report downloads a CSV with the real schema columns`, async ({
      page,
    }) => {
      const { job } = await generateReport(page, { reportType, format: "csv" });
      expect(job.status).toBe("completed");

      const res = await page.request.get(
        `${BASE}/api/reports/${job.jobId}/download`,
      );
      expect(res.status()).toBe(200);

      const csv = await res.text();
      expect(csv.split("\n")[0]).toBe(header);
    });
  }

  test("R4: clicking Download in the exports panel serves a CSV", async ({
    page,
  }) => {
    const { job } = await generateReport(page, {
      reportType: "leads",
      format: "csv",
    });

    await page.goto("/dashboard/reports");
    const link = page.getByRole("link", { name: /download/i }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });

    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/api\/reports\/[0-9a-f-]+\/download$/);

    const res = await page.request.get(`${BASE}${href}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain(",");

    // The panel is ordered newest-first, so the job just created is on top.
    expect(href).toContain(job.jobId);
  });

  // -------------------------------------------------------------------------
  // R5 — source panel shows the tenant's real channel mix
  // -------------------------------------------------------------------------

  test("R5: /api/analytics/leads-by-source returns real counts, not an empty array", async ({
    page,
  }) => {
    const res = await page.request.get(
      `${BASE}/api/analytics/leads-by-source`,
    );
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      data: { source: string; count: number }[];
    };
    expect(body.data.length).toBeGreaterThan(0);

    const total = body.data.reduce((sum, row) => sum + row.count, 0);
    expect(total).toBeGreaterThan(0);

    // Must agree with the tenant's lead total from the overview endpoint.
    const overview = (await (
      await page.request.get(`${BASE}/api/analytics/overview`)
    ).json()) as { totalLeads: number };
    expect(total).toBe(overview.totalLeads);
  });

  test("R5: Source-wise conversion panel renders a non-zero Leads column", async ({
    page,
  }) => {
    await page.goto("/dashboard/reports");

    const panel = panelCard(page, "Source-wise conversion");

    await expect(panel.locator("tbody tr").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel).not.toContainText(/Could not load the source mix/i);
    await expect(panel).not.toContainText(/No leads in this range/i);

    // Every source row must carry a real lead count — the whole point of the
    // bug was a silently zeroed column.
    const leadCounts = await panel
      .locator("tbody tr td:nth-child(2)")
      .allInnerTexts();
    expect(leadCounts.length).toBeGreaterThan(0);
    const numeric = leadCounts.map((t) => Number(t.trim()));
    expect(numeric.some((n) => n > 0)).toBe(true);

    await page.screenshot({
      path: `${SHOTS}/reports-source-conversion.png`,
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // Panels + filters
  // -------------------------------------------------------------------------

  test("all four analytics panels load without an error banner", async ({
    page,
  }) => {
    await page.goto("/dashboard/reports");
    await expect(
      page.getByRole("heading", { name: /reports & analytics/i }),
    ).toBeVisible();

    for (const title of [
      "Funnel drop-off",
      "Source-wise conversion",
      "Sales owner performance",
      "Channel partner ROI",
    ]) {
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
    }

    await page.waitForTimeout(2500);
    for (const message of [
      /Could not load the funnel/i,
      /Could not load the source mix/i,
      /Could not load the sales team/i,
      /Could not load partner performance/i,
      /Failed to load headline metrics/i,
    ]) {
      await expect(page.getByText(message)).toHaveCount(0);
    }

    // Funnel must be populated from real pipeline data.
    const funnel = panelCard(page, "Funnel drop-off");
    await expect(funnel.locator("tbody tr").first()).toBeVisible({
      timeout: 10_000,
    });
    expect(await funnel.locator("tbody tr").count()).toBeGreaterThan(0);

    await page.screenshot({
      path: `${SHOTS}/reports-panels.png`,
      fullPage: true,
    });
  });

  test("range and project filters re-query without breaking the panels", async ({
    page,
  }) => {
    await page.goto("/dashboard/reports");
    await expect(page.locator("#report-range")).toBeVisible();

    await page.selectOption("#report-range", "365");
    await page.waitForTimeout(1200);
    await expect(page.locator("#report-range")).toHaveValue("365");
    // The source panel's header echoes the active range label.
    await expect(panelCard(page, "Source-wise conversion")).toContainText(
      "Last 12 months",
    );

    const projectValues = await page
      .locator("#report-project option")
      .evaluateAll((opts) =>
        (opts as HTMLOptionElement[]).map((o) => o.value).filter(Boolean),
      );
    expect(projectValues.length).toBeGreaterThan(0);

    await page.selectOption("#report-project", projectValues[0]);
    await page.waitForTimeout(1500);

    // Filters are client+server side; the page must stay healthy either way.
    await expect(page.getByText(/Could not load the source mix/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /reset filters/i })).toBeVisible();

    await page.getByRole("button", { name: /reset filters/i }).click();
    await page.waitForTimeout(800);
    await expect(page.locator("#report-range")).toHaveValue("90");
    await expect(page.locator("#report-project")).toHaveValue("");
  });

  // -------------------------------------------------------------------------
  // R6 — queue a job, then actually run it
  // -------------------------------------------------------------------------

  test("R6: queueing a job then running it drives it to completed", async ({
    page,
  }) => {
    const queued = await page.request.post(`${BASE}/api/reports/jobs`, {
      data: { reportType: "leads", parameters: {} },
    });
    // `report_jobs.format` is NOT NULL — this used to 500 because the queue
    // path never set one.
    expect(queued.status()).toBe(201);

    const job = (await queued.json()) as {
      id?: string;
      jobId?: string;
      status: string;
    };
    const id = job.jobId ?? job.id;
    expect(id).toBeTruthy();
    expect(job.status).toBe("queued");

    const res = await page.request.post(`${BASE}/api/reports/jobs/${id}/run`);
    const text = await res.text();

    // The regression being guarded: the proxy used to hit /reports/:id/run,
    // which no handler declares, so this came back as a routing 404.
    expect(res.status()).not.toBe(404);
    expect(text).not.toContain("Cannot POST");
    expect(res.status()).toBe(200);

    // Narrowed to the client contract { jobId, status } by the BFF.
    const ran = JSON.parse(text) as { jobId: string; status: string };
    expect(ran.jobId).toBe(id);
    expect(ran.status).toBe("completed");

    // And the job really moved — re-read it.
    const after = (await (
      await page.request.get(`${BASE}/api/reports/jobs/${id}`)
    ).json()) as { status: string };
    expect(after.status).toBe("completed");
  });
});
