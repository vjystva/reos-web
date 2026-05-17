# feat-0004 — Site Visits Management UI

**Branch:** `feat-0004-site-visits-management-ui` (off `main`)
**Commit:** `03ea176` — `feat(feat-0004): site visits management UI — list, confirm, reschedule, cancel`
**Status:** committed on feature branch (not merged).

## What shipped

A complete frontend slice for managing site visits attached to a booking:
list visits, confirm them (role-gated), reschedule with date+notes, and
cancel with a reason. All actions live behind a slide-over Sheet on a new
sub-route under the booking detail tree.

## Files

### Types (`src/types/api.ts`)
- Added `SiteVisitStatusSchema`, `SITE_VISIT_STATUSES`, `SiteVisitSchema`,
  `SiteVisitHistorySchema`, `SiteVisitsResponseSchema`,
  `RescheduleVisitRequestSchema`, `CancelVisitRequestSchema` and exported
  type aliases. `SiteVisitSchema` uses `.passthrough()` to stay forward-
  compatible with additional backend fields.

### BFF routes (Next.js App Router, under `src/app/api/site-visits/`)
- `route.ts` — `GET /api/site-visits` proxies to `/site-visits` upstream;
  requires `bookingId` query param (400 otherwise); array → envelope
  normalisation; Zod-validates the response; returns 502 on shape mismatch.
- `[visitId]/route.ts` — `GET /api/site-visits/:id` single-visit fetch.
- `[visitId]/confirm/route.ts` — `POST` with **defence-in-depth role gate**
  for `builder_admin` / `sales_manager` (decoded from JWT in `reos_token`
  cookie via `jose`). 403 returned immediately for other roles; upstream
  body+status passed through on failures.
- `[visitId]/reschedule/route.ts` — `POST` with Zod-validated body
  (`{ visitDate, notes? }`); 400 on validation, upstream body+status
  passthrough otherwise.
- `[visitId]/cancel/route.ts` — `POST` with Zod-validated body
  (`{ reason }`); same passthrough discipline.
- `[visitId]/history/route.ts` — `GET` status history; tolerates both
  bare-array and envelope upstream shapes, always returns
  `{ data, total }` to the browser.

### Hooks (`src/hooks/`)
- `useSiteVisits.ts` — `useQuery`, key `["site-visits", bookingId, status,
  page, limit]`, `staleTime: 25_000`, `refetchInterval: 30_000`.
- `useSiteVisit.ts` — single visit query.
- `useSiteVisitHistory.ts` — history query.
- `useConfirmVisitMutation.ts` — POST `/confirm`, surfaces 403 as
  permission-denied, invalidates site-visits / site-visit / history queries.
- `useRescheduleVisitMutation.ts` — POST `/reschedule` with body; same
  invalidations.
- `useCancelVisitMutation.ts` — POST `/cancel` with body; same invalidations.
- All hooks share the same 401 handler (redirect to `/login`) and lift
  `message` or `error` from upstream JSON for `Error.message`.

### Components (`src/components/`)
- `SiteVisitStatusBadge.tsx` — color + always-visible label (WCAG SC 1.4.1
  parity with existing `UnitStatusBadge` / `TemperatureBadge`):
  scheduled=blue, confirmed=green, completed=slate, cancelled=red.
- `SiteVisitList.tsx` — visit cards with status badge, formatted IST date,
  notes/agent metadata, and per-row action buttons. Actions follow the
  state machine: Confirm only when `scheduled`; Reschedule/Cancel when
  `scheduled` or `confirmed`. Skeleton + `ErrorBanner` retry + empty state.
- `RescheduleForm.tsx` — controlled `datetime-local` + notes input with
  Zod validation (no react-hook-form). Converts the local datetime to an
  ISO string before POST and rehydrates the input from any default ISO.
- `CancelVisitForm.tsx` — controlled reason input with Zod validation;
  destructive submit button labelled "Cancel visit" with a secondary
  "Keep visit" cancel.

### Page (`src/app/dashboard/bookings/[bookingId]/site-visits/page.tsx`)
- `"use client"` page that reads `bookingId` from the route, drives the
  list query, and orchestrates the two slide-over Sheets (single Sheet
  with `sheetMode: 'reschedule' | 'cancel' | null`). Confirm runs inline
  with a per-row `confirmingId` busy state; reschedule/cancel surface
  per-form errors inside the Sheet via `ErrorBanner`.

### Tests (`src/hooks/__tests__/useSiteVisitMutations.test.tsx`)
- 11 cases across the three mutation hooks covering: success path
  invalidations (verified via `invalidateQueries` spy), correct URL +
  method + JSON body, 403 → "You do not have permission", and generic
  upstream error message bubble-up.

## Verification

- `npm test` — 7 suites / **43 tests passing** (11 new).
- `npx tsc --noEmit` — clean.

## Notes

- `state.json` was NOT modified (feature_counter is already 3 per
  orchestration instructions; the workflow that creates the entry for 4
  is owned elsewhere).
- No backend changes; only the frontend slice. Backend endpoints are
  consumed at the documented paths.
- No demo-mode fixtures added for site visits — `isDemoRequest()` is not
  branched in any of the new BFF routes. If demo coverage is required
  later, follow the pattern from `src/app/api/payments/route.ts`.
- Branch is not merged to `main` per orchestration policy — Director
  performs the merge.
