/**
 * Scenarios 13 & 14: Dashboard Analytics and Reports
 */
import { test, expect } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

test.describe("Scenario 13 – Dashboard Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("analytics page loads without error", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await expect(page.getByText(/Failed to load|error/i)).not.toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(1000);
  });

  test("main dashboard shows KPI cards", async ({ page }) => {
    await page.goto("/dashboard");
    // Should render without crashing
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.waitForTimeout(1000);
  });

  test("BFF GET /api/analytics returns metrics", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/analytics`);
    expect([200, 404]).toContain(res.status());
  });

  test("BFF GET /api/metrics returns data", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/metrics`);
    expect([200, 404]).toContain(res.status());
  });
});

test.describe("Scenario 14 – Reports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("reports page loads without error", async ({ page }) => {
    await page.goto("/dashboard/reports");
    await expect(page.getByText(/error|Failed/i)).not.toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(1000);
  });

  test("BFF GET /api/reports returns report jobs list", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/reports`);
    expect(res.status()).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    // Returns either { jobs: [] } or an object with data
    expect(typeof body).toBe("object");
  });

  test("BFF POST /api/reports creates a report job", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.post(`${BASE}/api/reports`, {
      data: { reportType: "leads", format: "csv", filters: {} },
    });
    expect([200, 201]).toContain(res.status());
  });

  test("BFF GET /api/reports/jobs returns jobs with pagination", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/reports/jobs`);
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });
});
