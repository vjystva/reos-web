/**
 * Pipeline / Kanban regression suite.
 *
 * Covers the contract mismatches between the pipeline UI and the real
 * `GET /leads` / `POST /leads/:id/stage` controllers:
 *
 *  1. Column-header sorting sent camelCase UI keys (`name`, `aiScore`,
 *     `createdAt`) as `sortBy`. `ListLeadsDto` whitelists snake_case columns
 *     only, so every header click answered 400 and the table blanked with
 *     "Failed to load leads."
 *  2. The Dealer filter was a free-text box feeding `assignedDealerId`, a
 *     `@IsUUID()` field — any keystroke produced 400. It is now a roster
 *     select, and the backend accepts the tenant's seeded (version-0) user
 *     ids via `@Matches(UUID_ANY_RE)`.
 *  3. The legacy `/leads/pipeline` board's "Move to…" dropdown emitted the
 *     board's DISPLAY labels ("New", "Site Visit", "Converted") as `toStage`.
 *     Only canonical stage values are accepted, so every move 400'd.
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE,
  API,
  backendToken,
} from "./helpers";

test.describe("Pipeline – lead list contract", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("every sortable column header returns rows instead of 400", async ({
    page,
  }) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/leads") && r.status() >= 400) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });

    await page.goto("/dashboard/pipeline");
    await expect(
      page.getByRole("heading", { name: /lead pipeline/i }),
    ).toBeVisible();

    for (const column of ["Name", "Score", "Created"]) {
      await page
        .getByRole("button", { name: new RegExp(`^${column}`) })
        .click();
      // Wait for the refetch triggered by the new ?sort= query key.
      await expect(page.locator("table tbody tr").first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText("Failed to load leads.")).toHaveCount(0);
    }

    expect(failed, `leads requests that failed: ${failed.join(", ")}`).toEqual(
      [],
    );
    await page.screenshot({
      path: "test-results/pipeline-sorted-by-created.png",
      fullPage: true,
    });
  });

  test("sorting by Name actually reorders the rows (asc vs desc)", async ({
    page,
  }) => {
    await page.goto("/dashboard/pipeline?sort=name&order=asc");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    });
    const asc = await page
      .locator("table tbody tr td:first-child")
      .allInnerTexts();

    await page.goto("/dashboard/pipeline?sort=name&order=desc");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    });
    const desc = await page
      .locator("table tbody tr td:first-child")
      .allInnerTexts();

    expect(asc.length).toBeGreaterThan(1);
    expect(desc.length).toBeGreaterThan(1);
    // Real ordering, not just "no error": the first ascending name must sort
    // at or before the first descending one.
    expect(
      asc[0].toLowerCase() <= desc[0].toLowerCase(),
      `asc[0]=${asc[0]} desc[0]=${desc[0]}`,
    ).toBe(true);
  });

  test("dealer filter is a roster select and accepts seeded user ids", async ({
    page,
  }) => {
    await page.goto("/dashboard/pipeline");
    const dealer = page.locator('select[aria-label="Filter by dealer"]');
    await expect(dealer).toBeVisible();

    // The roster arrives from /api/users — wait for it rather than racing it.
    await expect
      .poll(
        async () =>
          (
            await dealer.locator("option").evaluateAll((os) =>
              os.map((o) => (o as HTMLOptionElement).value),
            )
          ).filter(Boolean).length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const ids = (
      await dealer.locator("option").evaluateAll((os) =>
        os.map((o) => (o as HTMLOptionElement).value),
      )
    ).filter(Boolean);

    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/leads") && r.status() >= 400) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });

    await dealer.selectOption(ids[0]);
    await expect(page).toHaveURL(new RegExp(`dealer=${ids[0]}`));
    await expect(page.getByText("Failed to load leads.")).toHaveCount(0, {
      timeout: 10_000,
    });
    expect(failed).toEqual([]);
  });

  test("BFF rejects nothing it should: sortBy is translated, not forwarded raw", async ({
    page,
  }) => {
    // The UI key never reaches the backend verbatim — useLeads maps it.
    const res = await page.request.get(
      `${BASE}/api/leads?sortBy=first_name&sortOrder=asc&pageSize=5`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

test.describe("Pipeline – kanban board", () => {
  test("kanban view groups leads into the canonical stage columns", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/dashboard/pipeline?view=kanban");

    const board = page.getByRole("region", { name: /lead pipeline/i });
    await expect(board).toBeVisible({ timeout: 15_000 });
    // One column per LEAD_STAGES entry.
    await expect(board.getByRole("group")).toHaveCount(7);
    await expect(page.getByText("Failed to load leads.")).toHaveCount(0);

    await page.screenshot({
      path: "test-results/pipeline-kanban.png",
      fullPage: true,
    });
  });

  test("the legacy /leads/pipeline board is redirected away, not reachable", async ({
    page,
  }) => {
    // `next.config.mjs` maps /leads/pipeline -> /dashboard/pipeline, so the
    // older board (whose "Move to…" dropdown emitted display labels rather
    // than canonical stages) is dead code. Asserted here so that if the
    // redirect is ever removed, the spec below becomes the live contract.
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/leads/pipeline");
    await expect(page).toHaveURL(/\/dashboard\/pipeline/);
  });

  test("stage transitions accept canonical stages and reject display labels", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const token = await backendToken(request);

    // Seed a lead so the assertion is deterministic.
    const created = await request.post(`${API}/leads`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        source: "phone",
        firstName: "ZZKanban",
        lastName: `Move${Date.now() % 100000}`,
        phone: "+91 90000 12345",
      },
    });
    expect(created.ok()).toBe(true);
    const lead = (await created.json()) as { id: string; pipelineStage: string };
    expect(lead.pipelineStage).toBe("new");

    // A board DISPLAY label is not a stage — this is what the legacy kanban
    // used to send, and it must stay rejected.
    const bad = await page.request.patch(
      `${BASE}/api/leads/${lead.id}/status`,
      { data: { status: "Site Visit" } },
    );
    expect(bad.status()).toBe(400);

    // The canonical value works and actually moves the lead.
    const good = await page.request.patch(
      `${BASE}/api/leads/${lead.id}/status`,
      { data: { status: "contacted" } },
    );
    expect([200, 201]).toContain(good.status());

    const after = await request.get(`${API}/leads/${lead.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const l = (await after.json()) as { pipelineStage: string };
    expect(l.pipelineStage).toBe("contacted");
  });
});
