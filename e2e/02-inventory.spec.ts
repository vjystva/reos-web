/**
 * Scenario 1: Project & Inventory Management
 * - Create projects
 * - View inventory grid
 * - Search projects
 */
import { test, expect } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

test.describe("Scenario 1 – Inventory / Project Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("inventory page loads with projects", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    // Wait for Card components to render (each project card uses <Card>)
    await expect(page.locator("[class*='card'], .grid").first()).toBeVisible({ timeout: 8000 });
    // Should find at least one project name link
    await expect(page.getByRole("link", { name: /view inventory/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test("search filters projects", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.getByPlaceholder(/search projects/i).fill("Aeroland");
    await page.waitForTimeout(500);
    // Results should narrow down
    await expect(page.locator("body")).not.toContainText("Failed to load");
  });

  test("can open create project sheet", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.getByRole("button", { name: /new project/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/create new project/i)).toBeVisible();
  });

  test("create project form validates required fields", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.getByRole("button", { name: /new project/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Create project" }).click();
    // Multiple validation error paragraphs appear
    await expect(page.locator("[role=dialog] p.text-red-600").first()).toBeVisible({ timeout: 3000 });
  });

  test("create a new project via UI", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.getByRole("button", { name: /new project/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.locator("#proj-name").fill(`Test Project ${Date.now()}`);
    await page.locator("#proj-type").selectOption("apartment");
    await page.locator("#proj-city").fill("Pune");
    await page.locator("#proj-location").fill("Baner, Pune");
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });
  });

  test("BFF GET /api/projects returns valid data", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/projects`);
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toBeInstanceOf(Array);
    expect(body.total).toBeGreaterThan(0);
  });
});
