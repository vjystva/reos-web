/**
 * Scenario 5: Team Management
 * - List team members
 * - Create sales_manager, sales_agent
 * - Role badges render correctly
 */
import { test, expect } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

test.describe("Scenario 5 – Team Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("team page loads and shows users", async ({ page }) => {
    await page.goto("/dashboard/team");
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    // Wait for table to render
    await expect(page.locator("table")).toBeVisible({ timeout: 8000 });
    const rows = page.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("team sidebar link is visible", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /team/i })).toBeVisible();
  });

  test("team users show correct role badges", async ({ page }) => {
    await page.goto("/dashboard/team");
    await expect(page.locator("table")).toBeVisible({ timeout: 8000 });
    // At least one of these role badges should be visible
    const hasBadge = await page.getByText(/Sales Manager|Sales Agent|Channel Partner/i).count();
    expect(hasBadge).toBeGreaterThan(0);
  });

  test("open add user sheet", async ({ page }) => {
    await page.goto("/dashboard/team");
    await page.getByRole("button", { name: /add user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/add team member/i)).toBeVisible();
  });

  test("add user form validates required fields", async ({ page }) => {
    await page.goto("/dashboard/team");
    await page.getByRole("button", { name: /add user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Create user" }).click();
    // Validation errors appear in red paragraphs under each field
    await expect(page.locator("p.text-red-600").first()).toBeVisible({ timeout: 3000 });
  });

  test("create a sales_manager via UI", async ({ page }) => {
    const email = `manager.test.${Date.now()}@reos.com`;
    await page.goto("/dashboard/team");
    await page.getByRole("button", { name: /add user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.locator("dialog input[type=email], [role=dialog] input[type=email]").fill(email);
    await page.locator("dialog input[type=password], [role=dialog] input[type=password]").fill("Manager@123!");
    await page.locator("dialog select, [role=dialog] select").selectOption("sales_manager");
    await page.getByRole("button", { name: "Create user" }).click();

    // Dialog should close on success
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });
  });

  test("BFF GET /api/users returns team data", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/users`);
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toBeInstanceOf(Array);
    expect(body.total).toBeGreaterThan(0);
  });

  test("BFF POST /api/users creates a dealer user", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const email = `dealer.test.${Date.now()}@reos.com`;
    const res = await page.request.post(`${BASE}/api/users`, {
      data: { email, password: "Dealer@123!", role: "dealer" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json() as { email: string; role: string };
    expect(body.email).toBe(email);
    expect(body.role).toBe("dealer");
  });
});
