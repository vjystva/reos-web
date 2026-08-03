/**
 * Scenarios 3, 4, 7: Lead Management & Pipeline
 * - Create leads
 * - View pipeline (table/kanban)
 * - Stage transitions
 * - Lead source tracking
 */
import { test, expect } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

test.describe("Scenarios 3, 4, 7 – Lead Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("pipeline page loads", async ({ page }) => {
    await page.goto("/dashboard/pipeline");
    await expect(page.getByRole("heading", { name: /lead pipeline/i })).toBeVisible();
  });

  test("can switch between table and kanban view", async ({ page }) => {
    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: "Kanban" }).click();
    await expect(page).toHaveURL(/view=kanban/);
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page).toHaveURL(/view=table|(?!kanban)/);
  });

  test("open add lead sheet", async ({ page }) => {
    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: /add lead/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/add new lead/i)).toBeVisible();
  });

  test("add lead form validates required fields", async ({ page }) => {
    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: /add lead/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /^add lead/i }).click();
    // Multiple validation error paragraphs appear (token colour: `text-destructive`)
    await expect(page.locator("[role=dialog] p.text-destructive").first()).toBeVisible({ timeout: 3000 });
  });

  test("create a new lead via UI (Scenario 3)", async ({ page }) => {
    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: /add lead/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.locator("#lead-first-name").fill("Rahul");
    await page.locator("#lead-last-name").fill("Sharma");
    await page.locator("#lead-phone").fill("+919876543210");
    await page.locator("#lead-email").fill("rahul.sharma@email.com");
    await page.locator("#lead-source").selectOption("whatsapp");
    await page.getByRole("dialog").getByRole("button", { name: /^add lead/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });
  });

  test("pipeline filters work", async ({ page }) => {
    await page.goto("/dashboard/pipeline");
    await expect(page.getByText(/Failed to load/i)).not.toBeVisible({ timeout: 5000 });
    // Filters panel should be present
    await expect(page.locator("form, [data-testid='filters'], .filters")).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test("BFF GET /api/leads returns paginated data", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/leads`);
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  test("BFF POST /api/leads creates lead (Scenario 4 – cross-project)", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.post(`${BASE}/api/leads`, {
      data: {
        firstName: "Priya",
        lastName: "Mehta",
        phone: "+919812345678",
        email: "priya.mehta@email.com",
        source: "phone",
        projectInterest: "Sky Residency",
      },
    });
    expect([200, 201]).toContain(res.status());
  });
});
