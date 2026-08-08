/**
 * Settings → Lead routing (/dashboard/settings/routing).
 *
 * The page has no bulk-save endpoint upstream, so Save flushes a DIFF:
 *   PUT  /lead-routing-rules/routing-mode   (strategy toggle)
 *   DELETE /lead-routing-rules/:id          (removed rows)
 *   PATCH  /lead-routing-rules/:id          (changed rows)
 *   POST   /lead-routing-rules              (new rows)
 *   PATCH  /lead-routing-rules/reorder      (moved rows)
 *
 * Every one of those legs is exercised here, and each is asserted by RELOADING
 * the page and checking the persisted state — a mutation that 200s but doesn't
 * round-trip is exactly the failure mode this suite exists to catch.
 *
 * Specific regressions pinned below:
 *
 *  1. `UPDATE ... RETURNING` / `DELETE ... RETURNING` under TypeORM's Postgres
 *     driver returns `[rows, affected]`, not `rows`. The service read `rows[0]`
 *     directly, so PATCH :id answered `{"id":"undefined", ...}` and PUT
 *     routing-mode answered `{}`. Both bodies then failed BFF zod validation
 *     and surfaced to the user as a 502 "Failed to save lead routing", even
 *     though the write had committed.
 *  2. Same root cause: `rows.length === 0` was never true, so DELETE and
 *     reorder on an unknown id returned 204/200 instead of 404.
 *  3. `@IsUUID()` / `z.string().uuid()` enforce RFC 4122 versioning, which
 *     rejects seeded ids such as `b0000000-...-0001` (demo builder admin) and
 *     `d1000000-...-0001` ("Skyline Heights") — ids the dropdowns legitimately
 *     offer. Saving such a rule died with an opaque `validation_error`.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

const SLOW = 120_000;
/** Flat under test-results/, matching 10-lead-detail.spec.ts. */
const SHOTS = "test-results/routing";

/** Seeded ids whose UUID version nibble is 0 — the case regression #3 covers. */
const SEED_ADMIN_ID = "b0000000-0000-0000-0000-000000000001";

const rules = (page: Page) => page.locator('ul[role="list"] > li');

async function gotoRouting(page: Page) {
  await page.goto("/dashboard/settings/routing");
  await expect(page.getByRole("heading", { name: /lead routing/i })).toBeVisible({
    timeout: SLOW,
  });
  // Wait out the skeletons so `rules()` counts real rows.
  await expect(page.getByRole("button", { name: /add rule/i })).toBeEnabled({
    timeout: SLOW,
  });
  await page.waitForTimeout(1500);
}

async function save(page: Page) {
  await page.getByRole("button", { name: /^Save$/ }).click();
  // Save disables itself while in flight and again once the draft is clean.
  await expect(page.getByRole("button", { name: /^Save$/ })).toBeDisabled({
    timeout: 30_000,
  });
}

/** Removes every rule and restores round-robin, straight through the API. */
async function resetRouting(page: Page) {
  const list = await page.request.get(`${BASE}/api/lead-routing-rules`);
  if (list.ok()) {
    const body = (await list.json()) as { data: Array<{ id: string }> };
    for (const r of body.data) {
      await page.request.delete(`${BASE}/api/lead-routing-rules/${r.id}`);
    }
  }
  await page.request.put(`${BASE}/api/lead-routing-rules/routing-mode`, {
    data: { routingMode: "round_robin" },
  });
}

/** Adds a draft row in the UI and picks source + owner. */
async function addDraftRule(page: Page, source: string, ownerId?: string) {
  await page.getByRole("button", { name: /add rule/i }).click();
  const row = rules(page).last();
  await row.getByLabel(/^Source for rule/).selectOption(source);
  const owner = row.getByLabel(/^Owner for rule/);
  if (ownerId) {
    await owner.selectOption(ownerId);
  } else {
    const values = await owner.locator("option").evaluateAll((os) =>
      (os as HTMLOptionElement[]).map((o) => o.value).filter(Boolean),
    );
    await owner.selectOption(values[0]);
  }
}

test.describe("Settings → Lead routing – diff-based save round-trips", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await resetRouting(page);
  });

  test.afterEach(async ({ page }) => {
    await resetRouting(page);
  });

  test("page loads with no error banner", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoRouting(page);
    await expect(
      page.getByText(/Failed to load lead routing settings/i),
    ).not.toBeVisible();
    await page.screenshot({ path: `${SHOTS}-01-empty.png`, fullPage: true });
  });

  test("create a rule → persists across a reload", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoRouting(page);
    expect(await rules(page).count()).toBe(0);

    // Regression #3: target the seeded, non-RFC-4122 admin id explicitly.
    await addDraftRule(page, "web_form", SEED_ADMIN_ID);
    await save(page);

    // No opaque validation_error banner.
    await expect(page.getByText(/validation_error/i)).not.toBeVisible();
    await page.screenshot({ path: `${SHOTS}-02-rule-created.png`, fullPage: true });

    await page.reload();
    await gotoRouting(page);
    expect(await rules(page).count()).toBe(1);
    await expect(rules(page).first().getByLabel(/^Source for rule/)).toHaveValue(
      "web_form",
    );
    await expect(rules(page).first().getByLabel(/^Owner for rule/)).toHaveValue(
      SEED_ADMIN_ID,
    );
  });

  test("edit a rule (pause it) → persists across a reload", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoRouting(page);
    await addDraftRule(page, "phone", SEED_ADMIN_ID);
    await save(page);

    await page.reload();
    await gotoRouting(page);
    const toggle = rules(page)
      .first()
      .getByRole("button", { name: /^(Active|Paused)$/ });
    await expect(toggle).toHaveText("Active");

    await toggle.click();
    await save(page);
    // Regression #1: the PATCH response used to be garbage -> BFF 502.
    await expect(page.getByText(/Failed to save lead routing/i)).not.toBeVisible();

    await page.reload();
    await gotoRouting(page);
    await expect(
      rules(page).first().getByRole("button", { name: /^(Active|Paused)$/ }),
    ).toHaveText("Paused");
    await page.screenshot({ path: `${SHOTS}-03-rule-paused.png`, fullPage: true });
  });

  test("reorder rules → new order persists across a reload", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoRouting(page);
    await addDraftRule(page, "web_form", SEED_ADMIN_ID);
    await addDraftRule(page, "whatsapp", SEED_ADMIN_ID);
    await save(page);

    await page.reload();
    await gotoRouting(page);
    const order = async (): Promise<string[]> => {
      const n = await rules(page).count();
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        out.push(
          await rules(page).nth(i).getByLabel(/^Source for rule/).inputValue(),
        );
      }
      return out;
    };

    expect(await order()).toEqual(["web_form", "whatsapp"]);
    await page.screenshot({ path: `${SHOTS}-04-order-before.png`, fullPage: true });

    await rules(page).nth(1).getByRole("button", { name: /Move rule 2 up/ }).click();
    await save(page);

    await page.reload();
    await gotoRouting(page);
    expect(await order()).toEqual(["whatsapp", "web_form"]);
    await page.screenshot({ path: `${SHOTS}-05-order-after.png`, fullPage: true });
  });

  test("delete a rule → stays deleted across a reload", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoRouting(page);
    await addDraftRule(page, "csv_import", SEED_ADMIN_ID);
    await save(page);

    await page.reload();
    await gotoRouting(page);
    expect(await rules(page).count()).toBe(1);

    await rules(page).first().getByRole("button", { name: /Remove rule 1/ }).click();
    await save(page);

    await page.reload();
    await gotoRouting(page);
    expect(await rules(page).count()).toBe(0);
  });

  test("strategy toggle → mode persists across a reload", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoRouting(page);
    const strategy = page.getByRole("group", { name: /assignment strategy/i });
    const ruleBased = strategy.getByRole("button", { name: /rule based/i });

    await expect(ruleBased).toHaveAttribute("aria-pressed", "false");
    await ruleBased.click();
    await save(page);
    // Regression #1: PUT routing-mode used to answer `{}` -> BFF 502.
    await expect(page.getByText(/Failed to save lead routing/i)).not.toBeVisible();

    await page.reload();
    await gotoRouting(page);
    await expect(
      page
        .getByRole("group", { name: /assignment strategy/i })
        .getByRole("button", { name: /rule based/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `${SHOTS}-06-mode-rules.png`, fullPage: true });

    // And back again.
    await page
      .getByRole("group", { name: /assignment strategy/i })
      .getByRole("button", { name: /round robin/i })
      .click();
    await save(page);
    await page.reload();
    await gotoRouting(page);
    await expect(
      page
        .getByRole("group", { name: /assignment strategy/i })
        .getByRole("button", { name: /round robin/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("Reset discards unsaved edits", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoRouting(page);
    await addDraftRule(page, "web_form", SEED_ADMIN_ID);
    expect(await rules(page).count()).toBe(1);

    await page.getByRole("button", { name: /^Reset$/ }).click();
    expect(await rules(page).count()).toBe(0);

    await page.reload();
    await gotoRouting(page);
    expect(await rules(page).count()).toBe(0);
  });
});

test.describe("Lead routing BFF/API contract", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await resetRouting(page);
  });

  test.afterEach(async ({ page }) => {
    await resetRouting(page);
  });

  test("PUT routing-mode returns the new mode, not an empty body", async ({
    page,
  }) => {
    const res = await page.request.put(
      `${BASE}/api/lead-routing-rules/routing-mode`,
      { data: { routingMode: "rules" } },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ routingMode: "rules" });

    const read = await page.request.get(
      `${BASE}/api/lead-routing-rules/routing-mode`,
    );
    expect(await read.json()).toEqual({ routingMode: "rules" });
  });

  test("PATCH :id returns the fully hydrated rule, not undefined columns", async ({
    page,
  }) => {
    const created = await page.request.post(`${BASE}/api/lead-routing-rules`, {
      data: {
        source: "web_form",
        projectId: null,
        targetDealerId: SEED_ADMIN_ID,
        priority: 0,
        isActive: true,
      },
    });
    expect(created.status()).toBe(201);
    const rule = (await created.json()) as { id: string };

    const patched = await page.request.patch(
      `${BASE}/api/lead-routing-rules/${rule.id}`,
      { data: { source: null, isActive: false } },
    );
    expect(patched.status()).toBe(200);
    const body = (await patched.json()) as Record<string, unknown>;

    expect(body.id).toBe(rule.id);
    expect(body.id).not.toBe("undefined");
    expect(body.targetDealerId).toBe(SEED_ADMIN_ID);
    expect(body.source).toBeNull();
    expect(body.isActive).toBe(false);
    expect(body.createdAt).toBeTruthy();
  });

  test("a rule targeting a seeded non-RFC-4122 uuid is accepted", async ({
    page,
  }) => {
    // Both `z.string().uuid()` (BFF) and `@IsUUID()` (Nest DTO) used to reject
    // these ids, making 6 of the tenant's routable users unselectable.
    const res = await page.request.post(`${BASE}/api/lead-routing-rules`, {
      data: {
        source: "whatsapp",
        projectId: "d1000000-0000-0000-0000-000000000001",
        targetDealerId: SEED_ADMIN_ID,
        priority: 0,
        isActive: true,
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.targetDealerId).toBe(SEED_ADMIN_ID);
    expect(body.projectId).toBe("d1000000-0000-0000-0000-000000000001");
  });

  test("DELETE on an unknown id is a 404, not a silent success", async ({
    page,
  }) => {
    const res = await page.request.delete(
      `${BASE}/api/lead-routing-rules/211f2aba-9764-44ac-b36e-606528ad98f6`,
    );
    expect(res.status()).toBe(404);
  });

  test("reorder referencing an unknown id is a 404 and changes nothing", async ({
    page,
  }) => {
    const created = await page.request.post(`${BASE}/api/lead-routing-rules`, {
      data: { targetDealerId: SEED_ADMIN_ID, priority: 0, isActive: true },
    });
    const rule = (await created.json()) as { id: string };

    const res = await page.request.patch(
      `${BASE}/api/lead-routing-rules/reorder`,
      {
        data: {
          rules: [
            { id: rule.id, priority: 5 },
            { id: "211f2aba-9764-44ac-b36e-606528ad98f6", priority: 6 },
          ],
        },
      },
    );
    expect(res.status()).toBe(404);

    // The whole batch runs in the request transaction, so the good row's
    // priority must have rolled back too.
    const list = await page.request.get(`${BASE}/api/lead-routing-rules`);
    const body = (await list.json()) as {
      data: Array<{ id: string; priority: number }>;
    };
    expect(body.data.find((r) => r.id === rule.id)?.priority).toBe(0);
  });
});
