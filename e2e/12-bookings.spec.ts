/**
 * Bookings regression suite — list filters, lifecycle transitions, payments.
 *
 * Contract mismatches this locks down:
 *
 *  1. The status filter offered draft/registered/confirmed/completed/cancelled.
 *     Only `registered` and `cancelled` exist upstream; the rest answered
 *     400 "status must be one of the following values: …" and blanked the
 *     table.
 *  2. Nothing in the web app ever called `PATCH /bookings/:id/status`, so a
 *     booking could not be moved through its lifecycle from the UI at all.
 *  3. `GET /api/payments?bookingId=` proxied `GET /payments?bookingId=` — no
 *     such endpoint (404). Real route: `GET /bookings/:bookingId/payments`.
 *  4. `GET /api/payment-schedules?bookingId=` returned a single object where
 *     the UI expected a paginated envelope (502), and named the collected
 *     figure `totalConfirmedPaid` where the UI reads `amountPaid`.
 *  5. `GET /api/payment-schedules/:id/milestones` proxied
 *     `GET /payment-schedules/:id/milestones` — no such endpoint (404).
 *     Real route: `GET /bookings/:bookingId/payment-schedule/milestones`.
 *  6. `POST /api/payments` proxied `POST /payments` (404) with `{ mode }` and
 *     no `paymentDate` — both wrong for `RecordPaymentDto`.
 *  7. `POST /api/payments/:id/bounce` proxied a route that does not exist.
 *     Real capability: `PATCH /bookings/:id/payments/:paymentId/status`
 *     with `{ toStatus: 'bounced' }`.
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE,
  BOOKING_LIFECYCLE,
  backendToken,
  createBookingFixture,
  createPaymentScheduleFixture,
  getUnitStatus,
} from "./helpers";

test.describe("Bookings – list filters", () => {
  test("every status filter option the UI offers is accepted upstream", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/dashboard/bookings");

    const filter = page.locator('select[aria-label="Filter by status"]');
    await expect(filter).toBeVisible();

    const values = (
      await filter.locator("option").evaluateAll((os) =>
        os.map((o) => (o as HTMLOptionElement).value),
      )
    ).filter(Boolean);

    // The filter must offer exactly the backend lifecycle — no draft/
    // confirmed/completed, which do not exist upstream.
    expect(values.sort()).toEqual([...BOOKING_LIFECYCLE].sort());

    for (const v of values) {
      const res = await page.request.get(`${BASE}/api/bookings?status=${v}`);
      expect(res.status(), `status=${v} should be accepted`).toBe(200);
    }
  });

  test("selecting a status filter in the UI never shows the error state", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/dashboard/bookings");

    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/bookings") && r.status() >= 400) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });

    const filter = page.locator('select[aria-label="Filter by status"]');
    for (const v of ["application_received", "registered", "cancelled"]) {
      await filter.selectOption(v);
      await expect(page.getByText("Failed to load bookings.")).toHaveCount(0, {
        timeout: 10_000,
      });
    }
    expect(failed).toEqual([]);

    await page.screenshot({
      path: "test-results/bookings-status-filter.png",
      fullPage: true,
    });
  });
});

test.describe("Bookings – lifecycle transitions", () => {
  test("advancing a booking through the UI moves it AND its unit", async ({
    page,
    request,
  }) => {
    const token = await backendToken(request);
    const fixture = await createBookingFixture(request, token);
    test.skip(!fixture, "no available unit to book");
    if (!fixture) return;

    // Booking starts at application_received; unit is blocked by the booking.
    expect(
      await getUnitStatus(request, token, fixture.projectId, fixture.unitId),
    ).toBe("blocked");

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/dashboard/bookings?");

    const row = page.locator("tbody tr", { hasText: fixture.bookingNumber });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("Application received");

    // application_received -> under_review
    await row
      .locator(`select[aria-label="Advance booking ${fixture.bookingId}"]`)
      .selectOption("under_review");
    await expect(
      page.locator("tbody tr", { hasText: fixture.bookingNumber }),
    ).toContainText("Under review", { timeout: 15_000 });

    // under_review -> approved. This is the confirmation point: the backend
    // drives the unit blocked -> booked in the SAME transaction.
    await page
      .locator("tbody tr", { hasText: fixture.bookingNumber })
      .locator(`select[aria-label="Advance booking ${fixture.bookingId}"]`)
      .selectOption("approved");
    await expect(
      page.locator("tbody tr", { hasText: fixture.bookingNumber }),
    ).toContainText("Approved", { timeout: 15_000 });

    // Real business outcome — not just a pill colour change.
    await expect
      .poll(
        () =>
          getUnitStatus(request, token, fixture.projectId, fixture.unitId),
        { timeout: 15_000 },
      )
      .toBe("booked");

    await page.screenshot({
      path: "test-results/bookings-advanced-to-approved.png",
      fullPage: true,
    });
  });

  test("the dropdown only offers transitions the backend allows", async ({
    page,
    request,
  }) => {
    const token = await backendToken(request);
    const fixture = await createBookingFixture(request, token);
    test.skip(!fixture, "no available unit to book");
    if (!fixture) return;

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/dashboard/bookings");

    const row = page.locator("tbody tr", { hasText: fixture.bookingNumber });
    await expect(row).toBeVisible({ timeout: 15_000 });

    const options = (
      await row
        .locator(`select[aria-label="Advance booking ${fixture.bookingId}"] option`)
        .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
    ).filter(Boolean);

    // ALLOWED_BOOKING_TRANSITIONS.application_received
    expect(options.sort()).toEqual(["cancelled", "under_review"]);
  });
});

test.describe("Bookings – payments page", () => {
  test("schedule, milestones and history all load (no 404/502)", async ({
    page,
    request,
  }) => {
    const token = await backendToken(request);
    const fixture = await createBookingFixture(request, token);
    test.skip(!fixture, "no available unit to book");
    if (!fixture) return;
    const schedule = await createPaymentScheduleFixture(
      request,
      token,
      fixture.bookingId,
      5_000_000,
    );
    expect(schedule).not.toBeNull();

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const failed: string[] = [];
    page.on("response", (r) => {
      if (
        r.status() >= 400 &&
        /\/api\/(payments|payment-schedules)/.test(r.url())
      ) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });

    await page.goto(`/dashboard/bookings/${fixture.bookingId}/payments`);

    await expect(page.getByText("Could not load payment schedule.")).toHaveCount(0);
    await expect(page.getByText("Could not load milestones.")).toHaveCount(0);
    await expect(page.getByText("Could not load payment history.")).toHaveCount(0);
    await expect(page.getByText("Booking amount")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("On possession")).toBeVisible();
    // The header must not claim there is no schedule while rendering one.
    await expect(page.getByText("No payment schedule on file")).toHaveCount(0);
    expect(failed).toEqual([]);
  });

  test("recording a payment updates the collected total, the milestone and the history", async ({
    page,
    request,
  }) => {
    const token = await backendToken(request);
    const fixture = await createBookingFixture(request, token);
    test.skip(!fixture, "no available unit to book");
    if (!fixture) return;
    const schedule = await createPaymentScheduleFixture(
      request,
      token,
      fixture.bookingId,
      5_000_000,
    );
    expect(schedule).not.toBeNull();

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/dashboard/bookings/${fixture.bookingId}/payments`);

    const collected = page
      .getByText("Collected", { exact: true })
      .first()
      .locator("xpath=..");
    await expect(collected).toContainText("₹0", { timeout: 15_000 });
    await expect(page.getByText("No payments recorded yet.")).toBeVisible();

    await page.screenshot({
      path: "test-results/payments-before-record.png",
      fullPage: true,
    });

    await page.getByRole("button", { name: /^record$/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // `paymentDate` is prefilled with today and `paymentMode` carries the
    // backend's lowercase values — both were missing/wrong before.
    await expect(page.locator("#payment-date")).not.toHaveValue("");
    await page.locator("#payment-amount").fill("2000000");
    await page.locator("#payment-mode").selectOption("neft");
    await page.locator("#payment-reference").fill(`E2E-${Date.now()}`);
    await dialog.getByRole("button", { name: /record payment/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // Real business outcome: ₹20 L of ₹50 L collected == 40%.
    await expect(collected).toContainText("₹20 L", { timeout: 15_000 });
    await expect(collected).toContainText("40%");

    // …and it shows up in the history table.
    await expect(page.getByText("No payments recorded yet.")).toHaveCount(0);
    await expect(page.getByText("NEFT").first()).toBeVisible();

    await page.screenshot({
      path: "test-results/payments-after-record.png",
      fullPage: true,
    });

    // …and the backend agrees.
    const balance = await request.get(
      `http://localhost:3000/bookings/${fixture.bookingId}/balance`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(balance.ok()).toBe(true);
    const body = (await balance.json()) as {
      totalConfirmedPaid: number;
      outstanding: number;
    };
    expect(body.totalConfirmedPaid).toBe(2_000_000);
    expect(body.outstanding).toBe(3_000_000);
  });

  test("bouncing a payment reverses the collected total", async ({
    page,
    request,
  }) => {
    const token = await backendToken(request);
    const fixture = await createBookingFixture(request, token);
    test.skip(!fixture, "no available unit to book");
    if (!fixture) return;
    const schedule = await createPaymentScheduleFixture(
      request,
      token,
      fixture.bookingId,
      5_000_000,
    );
    test.skip(!schedule, "payment schedule fixture unavailable");
    if (!schedule) return;

    // Seed a confirmed payment straight through the API so the test focuses
    // on the bounce path.
    const recorded = await request.post(
      `http://localhost:3000/bookings/${fixture.bookingId}/payments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          milestoneId: schedule.milestoneIds[0],
          amount: 2_000_000,
          paymentDate: "2026-08-01",
          paymentMode: "rtgs",
          referenceNumber: "E2E-BOUNCE-SEED",
        },
      },
    );
    expect(recorded.ok()).toBe(true);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/dashboard/bookings/${fixture.bookingId}/payments`);

    const collected = page
      .getByText("Collected", { exact: true })
      .first()
      .locator("xpath=..");
    await expect(collected).toContainText("₹20 L", { timeout: 15_000 });

    await page.getByRole("button", { name: /^bounce$/i }).first().click();

    // Real business outcome: collection reverses to zero and the row flips.
    await expect(collected).toContainText("₹0", { timeout: 15_000 });
    await expect(page.getByText("Bounced").first()).toBeVisible();

    await page.screenshot({
      path: "test-results/payments-after-bounce.png",
      fullPage: true,
    });
  });
});
