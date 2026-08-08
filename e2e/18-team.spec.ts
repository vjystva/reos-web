/**
 * Scenario 17 – Team page regression suite.
 *
 * The Team page survived the contract audit intact: `useUsers` →
 * `GET /api/users` → `GET /auth/users`, `useCreateUserMutation` →
 * `POST /api/users` → `POST /auth/users` (CreateUserDto: email, password,
 * role) and the quota filter → `GET /api/sales-targets?period=`
 * (SalesTargetsController.list accepts `assigneeId` and `period`) all line up.
 *
 * These tests lock that alignment down, because the failure modes here are the
 * silent kind: the roster renders fine while every quota column is empty, or
 * the role select drifts away from the backend's `@IsIn` allow-list and every
 * submit 400s.
 */
import { test, expect } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

const SHOTS = "test-results";

interface SalesTarget {
  id: string;
  assigneeId: string;
  period: string;
}

test.describe("Scenario 17 – Team", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("roster renders real users with no error banner", async ({ page }) => {
    await page.goto("/dashboard/team");
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

    expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);
    await expect(page.getByText(/Could not load team members/i)).toHaveCount(0);

    // Row emails must come from the API, not a placeholder.
    const users = (await (
      await page.request.get(`${BASE}/api/users`)
    ).json()) as { data: { email: string }[]; total: number };
    expect(users.total).toBeGreaterThan(0);
    await expect(page.locator("tbody")).toContainText(users.data[0].email);

    await page.screenshot({
      path: `${SHOTS}/team-roster.png`,
      fullPage: true,
    });
  });

  test("quota tiles resolve against sales-targets (not the 'unavailable' fallback)", async ({
    page,
  }) => {
    const res = await page.request.get(`${BASE}/api/sales-targets`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: SalesTarget[] };
    expect(Array.isArray(body.data)).toBe(true);

    await page.goto("/dashboard/team");
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);

    // "unavailable" is the hint MetricCard shows only when the targets query
    // errored — its presence means the quota/achieved tiles are lying.
    await expect(page.getByText("unavailable", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText(/Sales targets could not be loaded/i),
    ).toHaveCount(0);
  });

  test("quota period filter re-queries sales-targets with the period param", async ({
    page,
  }) => {
    await page.goto("/dashboard/team");
    await expect(page.locator("#team-period")).toBeVisible();

    for (const period of ["monthly", "quarterly"] as const) {
      const [res] = await Promise.all([
        page.waitForResponse((r) =>
          r.url().includes(`/api/sales-targets?period=${period}`),
        ),
        page.selectOption("#team-period", period),
      ]);
      expect(res.status()).toBe(200);

      const body = (await res.json()) as { data: SalesTarget[] };
      // The backend filters server-side; whatever comes back must match.
      for (const t of body.data) expect(t.period).toBe(period);
    }

    await expect(page.locator("table")).toBeVisible();
    await expect(page.getByText(/Could not load team members/i)).toHaveCount(0);

    await page.selectOption("#team-period", "");
    await page.waitForTimeout(1000);
    await expect(page.locator("#team-period")).toHaveValue("");

    await page.screenshot({
      path: `${SHOTS}/team-quota-filter.png`,
      fullPage: true,
    });
  });

  test("role select only offers roles the backend accepts", async ({ page }) => {
    await page.goto("/dashboard/team");
    await page.getByRole("button", { name: /add user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const values = await page
      .locator('[role="dialog"] select option')
      .evaluateAll((opts) => (opts as HTMLOptionElement[]).map((o) => o.value));

    // Mirrors CreateUserDto: @IsIn(['sales_manager','sales_agent','dealer']).
    expect(values.sort()).toEqual(
      ["dealer", "sales_agent", "sales_manager"].sort(),
    );
  });

  test("adding a user creates a real account that shows up in the roster", async ({
    page,
  }) => {
    const email = `e2e.team.${Date.now()}@reos.com`;

    await page.goto("/dashboard/team");
    await page.getByRole("button", { name: /add user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.locator('[role="dialog"] input[type="email"]').fill(email);
    await page
      .locator('[role="dialog"] input[type="password"]')
      .fill("E2eTeam@123!");
    await page.locator('[role="dialog"] select').selectOption("sales_agent");

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/users") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Create user" }).click(),
    ]);
    expect(res.status()).toBe(201);

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });

    // Reload so the assertion is against server state.
    await page.reload();
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("tbody")).toContainText(email, {
      timeout: 10_000,
    });

    const users = (await (
      await page.request.get(`${BASE}/api/users`)
    ).json()) as { data: { email: string; role: string }[] };
    const created = users.data.find((u) => u.email === email);
    expect(created?.role).toBe("sales_agent");

    await page.screenshot({
      path: `${SHOTS}/team-user-created.png`,
      fullPage: true,
    });
  });

  test("add-user form reports validation errors before calling the API", async ({
    page,
  }) => {
    await page.goto("/dashboard/team");

    const posts: number[] = [];
    page.on("response", (r) => {
      if (r.url().endsWith("/api/users") && r.request().method() === "POST") {
        posts.push(r.status());
      }
    });

    await page.getByRole("button", { name: /add user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Left blank rather than malformed: `input[type=email]` with a malformed
    // value is rejected by the browser's own constraint validation, so React's
    // onSubmit (and therefore the zod check under test) never runs.
    await page.locator('[role="dialog"] input[type="password"]').fill("short");
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page.locator("p.text-red-600").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(posts).toHaveLength(0);
  });
});
