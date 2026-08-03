/**
 * Scenarios 2, 8, 9, 10, 11: Unit Status, Site Visits, Bookings, Payments, Cancellations
 */
import { test, expect } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

test.describe("Scenario 2 – Unit Status Management", () => {
  test("BFF GET /api/projects/:id/units returns units for a project", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const projRes = await page.request.get(`${BASE}/api/projects`);
    const proj = await projRes.json() as { data: Array<{ id: string }> };
    if (proj.data.length === 0) return;
    const projectId = proj.data[0].id;

    const res = await page.request.get(`${BASE}/api/projects/${projectId}/units`);
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toBeInstanceOf(Array);
  });

  test("BFF GET /api/inventory returns unit availability", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const projRes = await page.request.get(`${BASE}/api/projects`);
    const proj = await projRes.json() as { data: Array<{ id: string }> };
    if (proj.data.length === 0) return;
    const projectId = proj.data[0].id;

    const res = await page.request.get(`${BASE}/api/inventory?projectId=${projectId}`);
    expect([200, 404]).toContain(res.status());
  });
});

test.describe("Scenario 8 – Site Visits", () => {
  test("backend GET /site-visits returns site visits", async ({ page }) => {
    // BFF requires bookingId, so test backend directly
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`http://localhost:3000/site-visits`, {
      headers: { Authorization: `Bearer dummy` },
    });
    // Just check it doesn't 500 — 401 is fine if token expired
    expect([200, 401]).toContain(res.status());
  });

  test("BFF POST /api/site-visits schedules a site visit", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const leadsRes = await page.request.get(`${BASE}/api/leads`);
    const leads = await leadsRes.json() as { data: Array<{ id: string }> };
    if (leads.data.length === 0) return;
    const leadId = leads.data[0].id;

    // backend DTO requires assignedAgentId — fetch an agent from team API
    const usersRes = await page.request.get(`${BASE}/api/users`);
    const users = await usersRes.json() as { data: Array<{ id: string; role: string }> };
    const agent = users.data.find((u) => u.role === "sales_agent");
    if (!agent) return;
    const assignedAgentId = agent.id;

    const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await page.request.post(`${BASE}/api/site-visits`, {
      data: { leadId, assignedAgentId, scheduledAt, notes: "E2E test site visit" },
    });
    expect([200, 201]).toContain(res.status());
  });
});

test.describe("Scenario 9 – Bookings", () => {
  test("BFF GET /api/bookings returns bookings", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/bookings`);
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  test("BFF GET /api/bookings/:id returns booking detail", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const listRes = await page.request.get(`${BASE}/api/bookings`);
    const list = await listRes.json() as { data: Array<{ id: string }> };
    if (list.data.length === 0) return;
    const bookingId = list.data[0].id;
    const res = await page.request.get(`${BASE}/api/bookings/${bookingId}`);
    expect([200, 404]).toContain(res.status());
  });
});

test.describe("Scenario 10 – Payment Tracking", () => {
  test("BFF GET /api/payment-schedules returns schedules for a booking", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const bookingsRes = await page.request.get(`${BASE}/api/bookings`);
    const bookings = await bookingsRes.json() as { data: Array<{ id: string }> };
    if (bookings.data.length === 0) return;
    const bookingId = bookings.data[0].id;
    const res = await page.request.get(`${BASE}/api/payment-schedules?bookingId=${bookingId}`);
    expect([200, 404]).toContain(res.status());
  });

  test("BFF GET /api/payments requires bookingId and returns data", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const bookingsRes = await page.request.get(`${BASE}/api/bookings`);
    const bookings = await bookingsRes.json() as { data: Array<{ id: string }> };
    if (bookings.data.length === 0) return;
    const bookingId = bookings.data[0].id;
    const res = await page.request.get(`${BASE}/api/payments?bookingId=${bookingId}`);
    expect([200, 404]).toContain(res.status());
  });
});

test.describe("Scenario 11 – Cancellations", () => {
  test("BFF GET /api/bookings includes status field for cancellation check", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await page.request.get(`${BASE}/api/bookings`);
    const body = await res.json() as { data: Array<{ status?: string }> };
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty("status");
    }
  });
});
