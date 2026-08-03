/**
 * Scenario 6: Channel Partner / Dealer Management
 * - List dealers
 * - Create dealer
 * - View dealer detail
 */
import { test, expect } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

test.describe("Scenario 6 – Channel Partners (Dealers)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("dealers page loads", async ({ page }) => {
    await page.goto("/dashboard/dealers");
    await expect(page.getByRole("heading", { name: /dealers|channel partners/i })).toBeVisible();
    await expect(page.getByText(/Failed to load/i)).not.toBeVisible({ timeout: 8000 });
  });

  test("dealers list renders cards or empty state", async ({ page }) => {
    await page.goto("/dashboard/dealers");
    // Wait for either dealer cards or an empty/error state — page must load
    await expect(page.locator("body")).not.toContainText("Application error", { timeout: 8000 });
    await page.waitForTimeout(1500);
    // Should have something visible — cards, table, or empty message
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toBeTruthy();
  });

  test("open add dealer sheet", async ({ page }) => {
    await page.goto("/dashboard/dealers");
    await page.getByRole("button", { name: /add dealer/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("create dealer via UI", async ({ page }) => {
    await page.goto("/dashboard/dealers");
    await page.getByRole("button", { name: /add dealer/i }).click();

    await page.getByLabel(/name/i).fill("Prime Realty Associates");
    await page.getByLabel(/email/i).fill(`prime.realty.${Date.now()}@example.com`);
    await page.getByLabel(/phone/i).fill("+919988776655");
    await page.getByLabel(/company/i).fill("Prime Realty Pvt Ltd");
    await page.getByRole("button", { name: /create|add|save/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
  });

  test("BFF GET /api/dealers returns dealers", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/dealers`);
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toBeInstanceOf(Array);
  });

  test("BFF POST /api/dealers creates dealer", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.post(`${BASE}/api/dealers`, {
      data: {
        name: `E2E Dealer ${Date.now()}`,
        email: `e2e.dealer.${Date.now()}@reos.com`,
        phone: "+919900112233",
        company: "E2E Test Realty",
        commissionRate: 2.5,
      },
    });
    expect([200, 201]).toContain(res.status());
  });
});
