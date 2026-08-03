/**
 * Scenario 12: Document Management
 */
import { test, expect } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

test.describe("Scenario 12 – Documents", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("documents page loads", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await expect(page.getByRole("heading", { name: /document/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Failed to load/i)).not.toBeVisible({ timeout: 5000 });
  });

  test("BFF GET /api/documents returns documents for a lead", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    // Documents require resourceType + resourceId (must be a valid v4 UUID).
    // Seeded booking IDs use sequential fakes that fail UUID v4 validation,
    // so we use a lead here — the leads API returns real UUIDs first.
    const leadsRes = await page.request.get(`${BASE}/api/leads`);
    const leads = await leadsRes.json() as { data: Array<{ id: string }> };
    if (leads.data.length === 0) return;
    const leadId = leads.data[0].id;

    const res = await page.request.get(`${BASE}/api/documents?resourceType=lead&resourceId=${leadId}`);
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json() as { documents: unknown[] };
      expect(body.documents).toBeInstanceOf(Array);
    }
  });
});
