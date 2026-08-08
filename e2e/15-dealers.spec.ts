/**
 * Scenario 16 – Channel partner (dealer) regression suite.
 *
 * Bugs covered:
 *   D1  DealerForm labelled Email "(optional)" and omitted it when blank, but
 *       `CreateDealerDto.email` is `@IsEmail()` (no @IsOptional) and
 *       `dealers.email` is NOT NULL — so "Add dealer" with a name only came
 *       back 400 "email must be an email" with no field to blame.
 *   D2  PATCH /dealers/:id answered
 *       200 {"id":"undefined","name":"undefined", ...}. TypeORM's postgres
 *       driver returns [rows, affectedCount] for UPDATE ... RETURNING, and the
 *       service read rows[0] (= the rows ARRAY). The same tuple made the
 *       `rows.length === 0` guard unreachable, so a PATCH against a dealer
 *       that does not exist returned 200 instead of 404.
 *   D3  PATCH /commissions/:id/status answered 200 {} for the same reason.
 *       The BFF validates that body against CommissionSchema, turned it into a
 *       502, and the dealer commission ledger surfaced "Failed to update
 *       commission status" — even though the row HAD moved. Approve /
 *       Mark paid / Cancel therefore looked permanently broken.
 *
 * Also exercises Deactivate (PATCH status=inactive, not a DELETE) end to end.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

const SHOTS = "test-results";

interface Dealer {
  id: string;
  name: string;
  email: string;
  status: string;
  reraId: string | null;
  kycStatus: string | null;
}

interface Commission {
  id: string;
  dealerId: string;
  status: string;
}

function unique(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function createDealer(page: Page, name: string): Promise<Dealer> {
  const res = await page.request.post(`${BASE}/api/dealers`, {
    data: {
      name,
      email: `${name.replace(/[^a-z0-9]+/gi, ".").toLowerCase()}@e2e.reos.com`,
      company: "E2E Partner Co",
      commissionRate: 2.5,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as Dealer;
}

async function getDealer(page: Page, id: string): Promise<Dealer> {
  const res = await page.request.get(`${BASE}/api/dealers/${id}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as Dealer;
}

test.describe("Scenario 16 – Channel partners", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  // -------------------------------------------------------------------------
  // D1 — email is required, and the form says so before the network call
  // -------------------------------------------------------------------------

  test("D1: Add dealer without an email is blocked in the form, not by a 400", async ({
    page,
  }) => {
    await page.goto("/dashboard/dealers");

    const posts: number[] = [];
    page.on("response", (r) => {
      if (
        r.url().endsWith("/api/dealers") &&
        r.request().method() === "POST"
      ) {
        posts.push(r.status());
      }
    });

    await page.getByRole("button", { name: /add dealer/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.locator("#dealer-name").fill(unique("No Email Partner"));
    await page.getByRole("button", { name: /create dealer/i }).click();

    // The submit is refused locally — the sheet stays open and, critically,
    // nothing is sent upstream (this used to be a 400 from the backend).
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(1000);
    expect(posts).toHaveLength(0);

    // The email field itself is what blocks it.
    const emailValidity = await page
      .locator("#dealer-email")
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
    expect(emailValidity).toBe(true);

    await page.screenshot({
      path: `${SHOTS}/dealers-email-required.png`,
      fullPage: true,
    });
  });

  test("D1: POST /api/dealers rejects a body with no email at the BFF", async ({
    page,
  }) => {
    const res = await page.request.post(`${BASE}/api/dealers`, {
      data: { name: unique("No Email Partner"), kycStatus: "pending" },
    });
    expect(res.status()).toBe(400);

    // Caught by CreateDealerRequestSchema in the BFF, so the caller gets a
    // field-level error instead of the backend's bare
    // "email must be an email".
    const body = (await res.json()) as {
      error?: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };
    expect(body.error).toBe("validation_error");
    expect(body.details?.fieldErrors?.email?.length).toBeGreaterThan(0);
  });

  test("D1: the email field is not labelled optional", async ({ page }) => {
    await page.goto("/dashboard/dealers");
    await page.getByRole("button", { name: /add dealer/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const emailLabel = page.locator('label[for="dealer-email"]');
    await expect(emailLabel).toBeVisible();
    await expect(emailLabel).not.toContainText(/optional/i);
  });

  test("D1: creating a dealer through the sheet persists it in the roster", async ({
    page,
  }) => {
    const name = unique("E2E Partner");
    const email = `e2e.partner.${Date.now()}@reos.com`;

    await page.goto("/dashboard/dealers");
    await page.getByRole("button", { name: /add dealer/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.locator("#dealer-name").fill(name);
    await page.locator("#dealer-email").fill(email);
    await page.locator("#dealer-phone").fill("+919812345678");
    await page.locator("#dealer-company").fill("E2E Partner Co");
    await page.locator("#dealer-rera-id").fill("UPRERAAGT-E2E-01");
    await page.getByRole("button", { name: /create dealer/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });

    // Reload — the row must come from the server, not from optimistic state.
    await page.reload();
    await expect(page.getByRole("link", { name })).toBeVisible({
      timeout: 10_000,
    });

    const listed = (await (
      await page.request.get(`${BASE}/api/dealers?limit=100`)
    ).json()) as { dealers: Dealer[] };
    const created = listed.dealers.find((d) => d.name === name);
    expect(created).toBeTruthy();
    expect(created?.email).toBe(email);
    expect(created?.reraId).toBe("UPRERAAGT-E2E-01");

    await page.screenshot({
      path: `${SHOTS}/dealers-created.png`,
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // D2 — PATCH returns the real updated row and 404s for a missing dealer
  // -------------------------------------------------------------------------

  test("D2: PATCH /api/dealers/:id returns the updated dealer, not an undefined row", async ({
    page,
  }) => {
    const dealer = await createDealer(page, unique("Patch Shape Partner"));

    const res = await page.request.patch(`${BASE}/api/dealers/${dealer.id}`, {
      data: { reraId: "RERA-PATCH-SHAPE", company: "Renamed Co" },
    });
    expect(res.status()).toBe(200);

    const updated = (await res.json()) as Dealer;
    expect(updated.id).toBe(dealer.id);
    expect(updated.id).not.toBe("undefined");
    expect(updated.name).toBe(dealer.name);
    expect(updated.reraId).toBe("RERA-PATCH-SHAPE");
    expect(["active", "inactive", "suspended"]).toContain(updated.status);
  });

  test("D2: PATCH /api/dealers/:id 404s for a dealer that does not exist", async ({
    page,
  }) => {
    const res = await page.request.patch(
      `${BASE}/api/dealers/11111111-2222-4333-8444-555555555555`,
      { data: { reraId: "NOPE" } },
    );
    expect(res.status()).toBe(404);
  });

  test("D2: editing a dealer's RERA id persists across a reload", async ({
    page,
  }) => {
    const dealer = await createDealer(page, unique("Rera Edit Partner"));
    const newRera = `UPRERAAGT-${Date.now()}`;

    await page.goto(`/dashboard/dealers/${dealer.id}`);
    await expect(page.getByRole("heading", { name: dealer.name })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator("#dealer-rera-id").fill(newRera);
    await page.locator("#dealer-kyc-status").selectOption("verified");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });

    // Hard reload: the value has to have reached Postgres.
    await page.reload();
    const reraFact = page
      .locator("div")
      .filter({ has: page.getByText("RERA id", { exact: true }) })
      .last();
    await expect(reraFact).toContainText(newRera, { timeout: 10_000 });
    await expect(page.getByText("Verified", { exact: true })).toBeVisible();

    const persisted = await getDealer(page, dealer.id);
    expect(persisted.reraId).toBe(newRera);
    expect(persisted.kycStatus).toBe("verified");

    await page.screenshot({
      path: `${SHOTS}/dealers-rera-persisted.png`,
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // Deactivate — a status transition, never a DELETE
  // -------------------------------------------------------------------------

  test("Deactivate sets status=inactive and returns to the roster", async ({
    page,
  }) => {
    const dealer = await createDealer(page, unique("Deactivate Partner"));
    expect(dealer.status).toBe("active");

    await page.goto(`/dashboard/dealers/${dealer.id}`);
    await expect(page.getByRole("heading", { name: dealer.name })).toBeVisible({
      timeout: 10_000,
    });

    page.once("dialog", (d) => void d.accept());

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/dealers/${dealer.id}`) &&
          r.request().method() === "PATCH",
      ),
      page.getByRole("button", { name: /deactivate/i }).click(),
    ]);
    expect(res.status()).toBe(200);

    await page.waitForURL(/\/dashboard\/dealers$/, { timeout: 10_000 });

    const after = await getDealer(page, dealer.id);
    expect(after.status).toBe("inactive");

    // The roster's Inactive filter must now include it.
    await page.selectOption("#filter-status", "inactive");
    await expect(page.getByRole("link", { name: dealer.name })).toBeVisible({
      timeout: 10_000,
    });

    await page.screenshot({
      path: `${SHOTS}/dealers-deactivated.png`,
      fullPage: true,
    });
  });

  test("status filter narrows the roster to active partners", async ({
    page,
  }) => {
    await page.goto("/dashboard/dealers");
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

    await page.selectOption("#filter-status", "active");
    await page.waitForTimeout(1500);

    const statuses = await page
      .locator("tbody tr td:nth-last-child(2)")
      .allInnerTexts();
    expect(statuses.length).toBeGreaterThan(0);
    for (const s of statuses) expect(s.trim()).toBe("Active");
  });

  // -------------------------------------------------------------------------
  // D3 — commission ledger actions really move the row
  // -------------------------------------------------------------------------

  test("D3: PATCH /api/commissions/:id/status returns the updated commission", async ({
    page,
  }) => {
    const commissions = (await (
      await page.request.get(`${BASE}/api/commissions`)
    ).json()) as Commission[];
    test.skip(commissions.length === 0, "tenant has no commission rows");

    const target = commissions[0];
    const original = target.status;

    const res = await page.request.patch(
      `${BASE}/api/commissions/${target.id}/status`,
      { data: { status: "approved" } },
    );
    expect(res.status()).toBe(200);

    const body = (await res.json()) as Commission;
    expect(body.id).toBe(target.id);
    expect(body.status).toBe("approved");

    await page.request.patch(`${BASE}/api/commissions/${target.id}/status`, {
      data: { status: original },
    });
  });

  test("D3: Approve then Mark paid moves the ledger status pill", async ({
    page,
  }) => {
    const commissions = (await (
      await page.request.get(`${BASE}/api/commissions`)
    ).json()) as Commission[];
    const dealers = (await (
      await page.request.get(`${BASE}/api/dealers?limit=100`)
    ).json()) as { dealers: Dealer[] };
    const dealerIds = new Set(dealers.dealers.map((d) => d.id));

    // `commissions.dealer_id` holds a dealers.id for auto-raised rows but a
    // users.id for some legacy hand-entered ones; only the former render a
    // ledger on a dealer page.
    const target = commissions.find((c) => dealerIds.has(c.dealerId));
    test.skip(!target, "no commission is attached to a real dealer row");

    const original = target!.status;
    await page.request.patch(`${BASE}/api/commissions/${target!.id}/status`, {
      data: { status: "pending" },
    });

    await page.goto(`/dashboard/dealers/${target!.dealerId}`);
    await expect(page.getByText("Commission ledger")).toBeVisible({
      timeout: 10_000,
    });

    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("Pending", { timeout: 10_000 });

    await page.screenshot({
      path: `${SHOTS}/dealers-commission-pending.png`,
      fullPage: true,
    });

    // pending -> approved
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(row).toContainText("Approved", { timeout: 10_000 });
    await expect(page.getByText(/Failed to update commission status/i)).toHaveCount(0);
    expect(
      ((await (
        await page.request.get(`${BASE}/api/commissions`)
      ).json()) as Commission[]).find((c) => c.id === target!.id)?.status,
    ).toBe("approved");

    // approved -> paid
    await row.getByRole("button", { name: "Mark paid" }).click();
    await expect(row).toContainText("Paid", { timeout: 10_000 });
    // Paid is terminal: no further actions offered.
    await expect(row.getByRole("button")).toHaveCount(0);

    const finalState = ((await (
      await page.request.get(`${BASE}/api/commissions`)
    ).json()) as Commission[]).find((c) => c.id === target!.id);
    expect(finalState?.status).toBe("paid");

    await page.screenshot({
      path: `${SHOTS}/dealers-commission-paid.png`,
      fullPage: true,
    });

    await page.request.patch(`${BASE}/api/commissions/${target!.id}/status`, {
      data: { status: original },
    });
  });

  test("D3: Cancel moves a pending commission to cancelled", async ({
    page,
  }) => {
    const commissions = (await (
      await page.request.get(`${BASE}/api/commissions`)
    ).json()) as Commission[];
    const dealers = (await (
      await page.request.get(`${BASE}/api/dealers?limit=100`)
    ).json()) as { dealers: Dealer[] };
    const dealerIds = new Set(dealers.dealers.map((d) => d.id));
    const target = commissions.find((c) => dealerIds.has(c.dealerId));
    test.skip(!target, "no commission is attached to a real dealer row");

    const original = target!.status;
    await page.request.patch(`${BASE}/api/commissions/${target!.id}/status`, {
      data: { status: "pending" },
    });

    await page.goto(`/dashboard/dealers/${target!.dealerId}`);
    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("Pending", { timeout: 10_000 });

    page.once("dialog", (d) => void d.accept());
    await row.getByRole("button", { name: "Cancel" }).click();
    await expect(row).toContainText("Cancelled", { timeout: 10_000 });

    expect(
      ((await (
        await page.request.get(`${BASE}/api/commissions`)
      ).json()) as Commission[]).find((c) => c.id === target!.id)?.status,
    ).toBe("cancelled");

    await page.request.patch(`${BASE}/api/commissions/${target!.id}/status`, {
      data: { status: original },
    });
  });
});
