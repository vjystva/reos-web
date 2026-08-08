/**
 * Site Visits regression suite — the per-booking board and the calendar.
 *
 * Contract mismatches this locks down:
 *
 *  1. `GET /api/site-visits?bookingId=` forwarded `bookingId` (and `limit`)
 *     to `GET /site-visits`. `site_visits` is LEAD-scoped upstream and
 *     `ListSiteVisitsDto` has neither field, so the global
 *     `forbidNonWhitelisted` pipe answered 400 "property bookingId should not
 *     exist, property limit should not exist" — the per-booking visits page
 *     never rendered a row. The BFF now resolves booking -> lead and calls
 *     `GET /leads/:leadId/site-visits`.
 *  2. Cancel sent `{ reason }`; `CancelSiteVisitDto` wants
 *     `{ cancellationReason }` -> 400 on every submit.
 *  3. Reschedule sent `{ visitDate, notes }`; `RescheduleSiteVisitDto` wants
 *     `{ newScheduledAt, note }` -> 400 on every submit.
 *  4. There was no way to SCHEDULE a visit or MARK ONE COMPLETED from the UI
 *     even though `POST /site-visits` and `POST /site-visits/:id/complete`
 *     both exist.
 *  5. `assignedAgentId` was `@IsUUID()`, which rejects the tenant's seeded
 *     (version-0) user ids — i.e. every agent the demo ships with.
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE,
  backendToken,
  createBookingFixture,
  listVisitsForLead,
} from "./helpers";

/**
 * Each visit row carries `data-visit-id` / `data-visit-status`, so assertions
 * can target one specific visit. That matters because the booking fixture
 * reuses the tenant's first lead, which accumulates visits across runs —
 * "the first row" is not stable, the id is.
 */
const ROW = "[data-testid=site-visit-row]";

test.describe("Site visits – per-booking board", () => {
  test("booking-scoped list loads instead of 400ing", async ({
    page,
    request,
  }) => {
    const token = await backendToken(request);
    const fixture = await createBookingFixture(request, token);
    test.skip(!fixture, "no available unit to book");
    if (!fixture) return;

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const api = await page.request.get(
      `${BASE}/api/site-visits?bookingId=${fixture.bookingId}`,
    );
    expect(api.status()).toBe(200);
    const body = (await api.json()) as { data: unknown[]; total: number };
    expect(Array.isArray(body.data)).toBe(true);

    await page.goto(`/dashboard/bookings/${fixture.bookingId}/site-visits`);
    await expect(page.getByText("Failed to load site visits.")).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("full lifecycle: schedule -> confirm -> reschedule -> confirm -> complete", async ({
    page,
    request,
  }) => {
    const token = await backendToken(request);
    const fixture = await createBookingFixture(request, token);
    test.skip(!fixture, "no available unit to book");
    if (!fixture) return;

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/dashboard/bookings/${fixture.bookingId}/site-visits`);

    const before = await listVisitsForLead(request, token, fixture.leadId);

    // --- schedule -----------------------------------------------------------
    await page.getByRole("button", { name: /schedule visit/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The agent select must be prefilled with a real users.id.
    await expect(page.locator("#schedule-visit-agent")).not.toHaveValue("");
    await page.locator("#schedule-visit-notes").fill("E2E scheduled visit");
    await dialog.getByRole("button", { name: /^schedule visit$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    await expect(page.locator(ROW)).toHaveCount(before.length + 1, {
      timeout: 15_000,
    });

    // Pin the visit THIS test created. The fixture reuses the tenant's first
    // lead, which accumulates visits across runs, so every assertion below is
    // scoped to this id rather than to "the first row".
    const knownIds = new Set(before.map((v) => v.id));
    const afterCreate = await listVisitsForLead(request, token, fixture.leadId);
    const mine = afterCreate.find((v) => !knownIds.has(v.id));
    expect(mine, "newly scheduled visit not found").toBeTruthy();
    if (!mine) return;
    const visitId = mine.id;
    const row = page.locator(`${ROW}[data-visit-id="${visitId}"]`);

    const statusOf = async () => {
      const visits = await listVisitsForLead(request, token, fixture.leadId);
      return visits.find((v) => v.id === visitId);
    };

    await expect(row).toHaveAttribute("data-visit-status", "scheduled");
    await page.screenshot({
      path: "test-results/site-visit-scheduled.png",
      fullPage: true,
    });

    // --- confirm ------------------------------------------------------------
    await row.getByRole("button", { name: /^confirm$/i }).click();
    await expect(row).toHaveAttribute("data-visit-status", "confirmed", {
      timeout: 15_000,
    });
    await page.screenshot({
      path: "test-results/site-visit-confirmed.png",
      fullPage: true,
    });

    // --- reschedule ---------------------------------------------------------
    await row.getByRole("button", { name: /^reschedule$/i }).click();
    const rescheduleDialog = page.getByRole("dialog");
    await expect(rescheduleDialog).toBeVisible();
    await page.locator("#reschedule-visit-date").fill("2026-09-15T15:30");
    await page.locator("#reschedule-notes").fill("E2E moved");
    await rescheduleDialog
      .getByRole("button", { name: /^reschedule$/i })
      .click();
    await expect(rescheduleDialog).not.toBeVisible({ timeout: 15_000 });

    // Rescheduling a CONFIRMED visit resets it to scheduled (backend D4) and
    // bumps reschedule_count — the real outcome, not just a closed dialog.
    await expect
      .poll(
        async () => {
          const v = await statusOf();
          return v
            ? `${v.status}|${v.scheduledAt.slice(0, 10)}|${v.rescheduleCount}`
            : "none";
        },
        { timeout: 15_000 },
      )
      .toBe("scheduled|2026-09-15|1");

    // --- confirm again, then complete --------------------------------------
    await row.getByRole("button", { name: /^confirm$/i }).click();
    await expect(row).toHaveAttribute("data-visit-status", "confirmed", {
      timeout: 15_000,
    });

    await row.getByRole("button", { name: /mark completed/i }).click();
    await expect(row).toHaveAttribute("data-visit-status", "completed", {
      timeout: 15_000,
    });

    expect((await statusOf())?.status).toBe("completed");

    await page.screenshot({
      path: "test-results/site-visit-completed.png",
      fullPage: true,
    });
  });

  test("cancelling records the reason on the visit", async ({
    page,
    request,
  }) => {
    const token = await backendToken(request);
    const fixture = await createBookingFixture(request, token);
    test.skip(!fixture, "no available unit to book");
    if (!fixture) return;

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/dashboard/bookings/${fixture.bookingId}/site-visits`);

    const before = await listVisitsForLead(request, token, fixture.leadId);
    const knownIds = new Set(before.map((v) => v.id));

    await page.getByRole("button", { name: /schedule visit/i }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.locator("#schedule-visit-agent")).not.toHaveValue("");
    await dialog.getByRole("button", { name: /^schedule visit$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator(ROW)).toHaveCount(before.length + 1, {
      timeout: 15_000,
    });

    const afterCreate = await listVisitsForLead(request, token, fixture.leadId);
    const mine = afterCreate.find((v) => !knownIds.has(v.id));
    expect(mine, "newly scheduled visit not found").toBeTruthy();
    if (!mine) return;
    const row = page.locator(`${ROW}[data-visit-id="${mine.id}"]`);

    const reason = `E2E cancel ${Date.now()}`;
    await row.getByRole("button", { name: /^cancel$/i }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.locator("#cancel-reason").fill(reason);
    await dialog.getByRole("button", { name: /^cancel visit$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // Real outcome: `cancellationReason` — the field the BFF renames
    // `reason` into — is persisted upstream.
    await expect
      .poll(
        async () => {
          const visits = await listVisitsForLead(request, token, fixture.leadId);
          return visits.find((v) => v.id === mine.id)?.cancellationReason;
        },
        { timeout: 15_000 },
      )
      .toBe(reason);

    await expect(row).toHaveAttribute("data-visit-status", "cancelled");
    await page.screenshot({
      path: "test-results/site-visit-cancelled.png",
      fullPage: true,
    });
  });
});

test.describe("Site visits – calendar", () => {
  test("owner filter accepts seeded agent ids", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/dashboard/site-visits");
    await expect(
      page.getByRole("heading", { name: /site visit calendar/i }),
    ).toBeVisible();

    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/site-visits") && r.status() >= 400) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });

    const owner = page.locator("#visit-owner");
    // The roster arrives from /api/users — wait for it rather than racing it.
    await expect
      .poll(
        async () =>
          (
            await owner.locator("option").evaluateAll((os) =>
              os.map((o) => (o as HTMLOptionElement).value),
            )
          ).filter(Boolean).length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const ids = (
      await owner.locator("option").evaluateAll((os) =>
        os.map((o) => (o as HTMLOptionElement).value),
      )
    ).filter(Boolean);

    // Seeded ids such as c2000000-0000-0000-0000-000000000001 have a version-0
    // nibble and used to 400 against @IsUUID().
    for (const id of ids.slice(0, 3)) {
      await owner.selectOption(id);
      await expect(page.getByText("Failed to load site visits.")).toHaveCount(
        0,
        { timeout: 10_000 },
      );
    }
    expect(failed).toEqual([]);

    await page.screenshot({
      path: "test-results/site-visit-calendar-filtered.png",
      fullPage: true,
    });
  });

  test("status filter round-trips through the calendar BFF", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const s of ["scheduled", "confirmed", "completed", "cancelled"]) {
      const res = await page.request.get(
        `${BASE}/api/site-visits/calendar?status=${s}`,
      );
      expect(res.status(), `status=${s}`).toBe(200);
    }
  });
});
