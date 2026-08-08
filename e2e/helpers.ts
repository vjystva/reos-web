import { APIRequestContext, Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@reos.com";
export const ADMIN_PASSWORD = "Admin@123!";
export const BASE = "http://localhost:3001";
/** Nest API. Used only to seed fixtures the BFF has no create-route for. */
export const API = "http://localhost:3000";

/**
 * The real booking lifecycle, copied from
 * `reos-backend/src/bookings/booking.constants.ts`. Deliberately duplicated
 * here rather than imported from `@/types/api` so the spec fails if the app's
 * copy silently drifts from the backend's.
 */
export const BOOKING_LIFECYCLE = [
  "application_received",
  "under_review",
  "approved",
  "payment_received",
  "agreement_signed",
  "registered",
  "cancelled",
] as const;

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 10_000 });
}

export async function apiLogin(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email, password },
  });
  return res;
}

/* ---------------------------------------------------------------------------
 * Backend fixture helpers
 *
 * These talk to the Nest API directly (not the BFF) because several fixtures
 * the booking/site-visit journeys need — a payment schedule, a booking parked
 * at a specific lifecycle status — have no create-route on the BFF. Keeping
 * fixture setup out of the UI also means a spec failure points at the flow
 * under test rather than at setup.
 * ------------------------------------------------------------------------ */

export async function backendToken(
  request: APIRequestContext,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password },
  });
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** First `available` unit across the tenant's projects, or null. */
export async function findAvailableUnit(
  request: APIRequestContext,
  token: string,
): Promise<{ projectId: string; unitId: string } | null> {
  const projRes = await request.get(`${API}/projects?pageSize=50`, {
    headers: auth(token),
  });
  const projects = (await projRes.json()) as { data: Array<{ id: string }> };
  for (const p of projects.data) {
    const uRes = await request.get(
      `${API}/projects/${p.id}/units?status=available&pageSize=1`,
      { headers: auth(token) },
    );
    if (!uRes.ok()) continue;
    const units = (await uRes.json()) as { data: Array<{ id: string }> };
    if (units.data.length > 0) {
      return { projectId: p.id, unitId: units.data[0].id };
    }
  }
  return null;
}

export interface BookingFixture {
  bookingId: string;
  leadId: string;
  unitId: string;
  projectId: string;
  bookingNumber: string;
}

/**
 * Creates a booking at `application_received` (the status `POST /bookings`
 * always produces) against a genuinely available unit.
 */
export async function createBookingFixture(
  request: APIRequestContext,
  token: string,
  bookingAmount = 5_000_000,
): Promise<BookingFixture | null> {
  const unit = await findAvailableUnit(request, token);
  if (!unit) return null;

  const leadsRes = await request.get(`${API}/leads?pageSize=1`, {
    headers: auth(token),
  });
  const leads = (await leadsRes.json()) as { data: Array<{ id: string }> };
  if (leads.data.length === 0) return null;

  const res = await request.post(`${API}/bookings`, {
    headers: auth(token),
    data: { leadId: leads.data[0].id, unitId: unit.unitId, bookingAmount },
  });
  if (!res.ok()) return null;
  const b = (await res.json()) as {
    id: string;
    leadId: string;
    unitId: string;
    bookingNumber: string;
  };
  return {
    bookingId: b.id,
    leadId: b.leadId,
    unitId: b.unitId,
    projectId: unit.projectId,
    bookingNumber: b.bookingNumber,
  };
}

export async function transitionBooking(
  request: APIRequestContext,
  token: string,
  bookingId: string,
  toStatus: string,
  extra: Record<string, string> = {},
): Promise<boolean> {
  const res = await request.patch(`${API}/bookings/${bookingId}/status`, {
    headers: auth(token),
    data: { toStatus, ...extra },
  });
  return res.ok();
}

/**
 * A payment schedule can only exist on a booking that is `approved` or later,
 * so this walks the booking there first.
 */
export async function createPaymentScheduleFixture(
  request: APIRequestContext,
  token: string,
  bookingId: string,
  totalAmount: number,
): Promise<{ scheduleId: string; milestoneIds: string[] } | null> {
  await transitionBooking(request, token, bookingId, "under_review");
  await transitionBooking(request, token, bookingId, "approved");

  const res = await request.post(`${API}/bookings/${bookingId}/payment-schedule`, {
    headers: auth(token),
    data: {
      totalAmount,
      notes: "E2E payment schedule",
      milestones: [
        {
          sequenceOrder: 1,
          name: "Booking amount",
          percentage: 40,
          dueDate: "2026-08-20",
        },
        {
          sequenceOrder: 2,
          name: "On possession",
          percentage: 60,
          dueDate: "2026-12-20",
        },
      ],
    },
  });
  if (!res.ok()) return null;
  const s = (await res.json()) as {
    id: string;
    milestones: Array<{ id: string }>;
  };
  return { scheduleId: s.id, milestoneIds: s.milestones.map((m) => m.id) };
}

/**
 * Unit detail is PROJECT-scoped upstream (`GET /projects/:projectId/units/:id`);
 * there is no bare `GET /units/:id` — that 404s.
 */
export async function getUnitStatus(
  request: APIRequestContext,
  token: string,
  projectId: string,
  unitId: string,
): Promise<string | null> {
  const res = await request.get(`${API}/projects/${projectId}/units/${unitId}`, {
    headers: auth(token),
  });
  if (!res.ok()) return null;
  const u = (await res.json()) as { status?: string };
  return u.status ?? null;
}

export async function listVisitsForLead(
  request: APIRequestContext,
  token: string,
  leadId: string,
): Promise<
  Array<{
    id: string;
    status: string;
    scheduledAt: string;
    rescheduleCount: number;
    cancellationReason: string | null;
  }>
> {
  const res = await request.get(`${API}/leads/${leadId}/site-visits`, {
    headers: auth(token),
  });
  if (!res.ok()) return [];
  return (await res.json()) as Array<{
    id: string;
    status: string;
    scheduledAt: string;
    rescheduleCount: number;
    cancellationReason: string | null;
  }>;
}
