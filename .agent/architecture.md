# reos-web — Architecture

This document is the living architectural record for `reos-web`, the Next.js 14 frontend for the REOS Real Estate Operating System. Each feature appends a section here.

---

## Project foundations

### Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components for layout, route-level code-split, native middleware for auth, built-in API routes for the BFF proxy. |
| Language | TypeScript (strict) | Spec AC #17 forbids stray `any`. Strict mode catches the slips early. |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) | shadcn gives owned, accessible primitives (Sheet for slide-over, Table, Select, Skeleton, Alert) without a heavyweight component lib. Tailwind keeps tokens consistent across the responsive matrix (375 px → 1440 px). |
| Data fetching | TanStack Query v5 (React Query) | First-class polling (`refetchInterval`), per-query caching, `isFetching` flag drives the poll indicator. |
| Validation | Zod | Required by AC #18 for both form input (login) and API response shapes. Inferred types feed the rest of the app. |
| Auth transport | httpOnly cookies set by Next.js API routes | AC #3 forbids tokens in JS-accessible storage. Cookies set server-side from the BFF satisfy this. |
| Backend access | Next.js API routes (BFF proxy) | Spec data-flow diagram mandates that the browser never learns `REOS_API_BASE_URL`. All `/api/**` routes proxy to `process.env.REOS_API_BASE_URL`. |
| JWT decode (edge) | `jose.decodeJwt` | Pure-JS, edge-runtime safe — required for `middleware.ts` per feasibility risk. No verification on the edge; verification stays on the backend. |

### Cross-cutting conventions

- All client-bound fetches target `/api/**` — never the backend host. The BFF base URL is server-only.
- Environment: `REOS_API_BASE_URL` (server-only). Anything that must reach the browser is prefixed `NEXT_PUBLIC_`.
- Default React Query options for polled queries: `refetchInterval: 30_000`, `refetchIntervalInBackground: false`, `staleTime: 25_000`, `retry: 1`.
- All routes under `/dashboard/**` are protected by `middleware.ts`. `/login` is public.
- All UI components live under `src/components/`; shadcn-generated primitives stay in `src/components/ui/`.
- All Zod schemas (request + response) live in `src/types/api.ts`; types are inferred via `z.infer`.
- Suspense boundaries wrap any subtree that calls `useSearchParams()` (App Router build constraint — feasibility risk).

### Repository layout (project-wide)

```
src/
  app/
    layout.tsx              root layout; QueryClientProvider; global font
    page.tsx                redirect → /dashboard
    login/page.tsx
    dashboard/
      layout.tsx            AppShell (top nav + sidebar)
      page.tsx              dashboard home
      pipeline/
        page.tsx            full pipeline page
    api/
      auth/{login,logout,refresh}/route.ts
      metrics/route.ts
      leads/route.ts
      leads/[id]/route.ts
      bookings/route.ts
  components/
    ui/                     shadcn primitives
    AppShell.tsx
    MetricsGrid.tsx
    MetricCard.tsx
    LeadTable.tsx
    LeadKanban.tsx
    PipelineFilters.tsx
    LeadSlideOver.tsx
    TemperatureBadge.tsx
    SkeletonCard.tsx
    ErrorBanner.tsx
    PollIndicator.tsx
  hooks/
    useMetrics.ts
    useLeads.ts
    useLead.ts
  lib/
    api.ts                  proxyFetch + refreshOrRedirect (singleton refresh promise)
    queryClient.ts
  middleware.ts             route protection via jose.decodeJwt
  types/
    api.ts                  Zod schemas + inferred types
```

---

## feat-0001 — Builder Dashboard with Lead Pipeline, Metrics, and Real-Time Updates

Spec: `/Users/vijaysrivastva/.claude-team/reos-web/specs/feat-0001-spec.md`
Feasibility: `/Users/vijaysrivastva/.claude-team/reos-web/specs/feat-0001-feasibility.md`
UX: `/Users/vijaysrivastva/.claude-team/reos-web/design/feat-0001-ux.md`

This is the first feature. The repo at `/Users/vijaysrivastva/git/reos-web/` is empty (`.git` only), so everything below is a green-field creation and the project-foundation conventions above are established here.

### Decisions

#### D1. Auth flow + token-refresh race serialisation

**Login.** `LoginForm` submits to `/api/auth/login` (Next.js route). The route calls `POST {REOS_API_BASE_URL}/auth/login`. On 2xx it reads `{ accessToken, refreshToken, expiresIn, user }` from the backend response and writes two httpOnly, Secure, SameSite=Lax cookies:

- `reos_token` — access token; `maxAge` = `expiresIn` seconds
- `reos_refresh` — refresh token; longer `maxAge` (default 7 d)

The route returns only `{ user }` to the browser. Tokens never enter the JS heap.

**Middleware.** `src/middleware.ts` (edge runtime) matches `/dashboard/:path*`. It reads `reos_token`. If missing → redirect to `/login`. If present, it uses `jose.decodeJwt(token)` (decode-only — verification stays on the backend) and checks `exp`. If expired it lets the request continue: the BFF proxy will then attempt a refresh on the next data call. If the refresh fails the proxy returns 401 and the client redirects to `/login`. Middleware does **not** attempt refresh itself because the edge runtime is not the right place to mutate cookies for in-flight API calls.

**Refresh-race singleton (feasibility's mandatory constraint).** `src/lib/api.ts` exports:

```ts
type RefreshResult = { accessToken: string } | null;

let refreshPromise: Promise<RefreshResult> | null = null;

export async function refreshOrRedirect(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
```

`doRefresh()` calls `POST {REOS_API_BASE_URL}/auth/refresh` with the `reos_refresh` cookie. On success it rewrites both cookies on the outgoing response **and returns `{ accessToken }`** — the freshly-issued access token string. On any failure (non-2xx, network error, JSON parse failure, malformed body) `doRefresh()` **catches the error and returns `null`** — it never throws. This contract is documented in `src/lib/api.ts` so concurrent `await refreshOrRedirect()` callers always receive a clean `null | { accessToken }` value rather than an unhandled promise rejection.

Any proxy route that sees a 401 from the backend `await refreshOrRedirect()`. All concurrent 30 s pollers share one refresh attempt; the rest await its result. The returned `accessToken` is then used by `proxyFetch` for the retry (see D2) — `req.cookies` is **not** re-read because the new cookie is only on the outgoing response, not the incoming request.

**Logout.** `POST /api/auth/logout` clears both cookies (`maxAge: 0`) and returns 204. The client then `router.push('/login')`.

#### D2. BFF proxy pattern

Every browser fetch hits `/api/**`. The proxy helper `proxyFetch(req: NextRequest, backendPath: string, init?: RequestInit)`:

1. Reads `reos_token` from incoming cookies (initial attempt token).
2. Issues the upstream request with `Authorization: Bearer <token>` to `process.env.REOS_API_BASE_URL + backendPath`.
3. On 401, calls `refreshOrRedirect()`.
   - If it returns `{ accessToken }`, retries the upstream request **once** using `Authorization: Bearer <accessToken>` — the freshly-returned string. The proxy must **not** re-read `req.cookies` here: the new cookie lives only on the outgoing response, not the incoming `NextRequest`.
   - If it returns `null`, propagates 401 to the browser (client redirects to `/login`).
4. Returns the upstream JSON body unchanged (status preserved).

The backend host is never visible to the browser. All proxy routes are thin: they delegate to `proxyFetch` and pass through query params from the incoming `NextRequest.url`.

#### D3. `/api/metrics` fan-out

A single route consolidates the dashboard KPIs to keep client-side polling cheap (one request, not six). It runs all upstream calls in parallel via **`Promise.allSettled`** — not `Promise.all`, which short-circuits on the first rejection and discards already-settled results. Each labelled slot is awaited independently so the route can attribute failures per-call:

```
slot 'totalLeads'      → GET /leads?pageSize=1
slot 'hotLeads'        → GET /leads?temperature=hot&pageSize=1
slot 'bookings'        → GET /bookings?pageSize=1
slot 'unitsAvailable'  → GET /units?status=available&pageSize=1
slot 'unitsBlocked'    → GET /units?status=blocked&pageSize=1
slot 'unitsBooked'     → GET /units?status=booked&pageSize=1
```

Each entry in the `allSettled` result is either `{ status: 'fulfilled', value: number }` or `{ status: 'rejected', reason: Error }`. The route walks the results once, populating fulfilled slots with the integer total and rejected slots with `null`, and collects the rejected slot labels into `failed[]`.

Response shape (validated by `MetricsResponseSchema` in `types/api.ts`):

```ts
{
  totalLeads: number | null;
  hotLeads: number | null;
  bookings: number | null;
  units: {
    available: number | null;
    blocked: number | null;
    booked: number | null;
  };
  failed: string[];   // slot labels that rejected; [] when all succeeded
}
```

Status code policy:
- All slots succeeded → `200` with `failed: []`.
- At least one slot succeeded and at least one failed → `200` with partial nulls and populated `failed[]`. The client renders last-good data per card (React Query keeps the last successful payload) and shows a per-card error state for the null slots; the page-level `ErrorBanner` is *not* triggered because the dashboard is partially live.
- Every slot failed → `502` with `failed[]` listing all six labels; the client surfaces a page-level `ErrorBanner`.

This per-card degradation is only possible because `Promise.allSettled` preserves results across rejections.

#### D4. React Query polling defaults

`src/lib/queryClient.ts` exports a `makeQueryClient()` factory. The default query options:

```ts
{
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  staleTime: 25_000,
  retry: 1,
}
```

`refetchIntervalInBackground: false` is mandatory per feasibility risk — it suppresses background-tab traffic. `staleTime: 25_000` prevents double-fetching when a component remounts between polls.

`QueryClientProvider` is mounted in `src/app/layout.tsx` (the root layout) so every route in the app — including `/login` if it ever needs query data — shares the same client.

Poll status is surfaced via `useIsFetching()` (per query key), driving `PollIndicator`'s "↻ updated 12s ago" / spinner / amber-fail states described in the UX doc.

#### D5. URL-synced filters and sort

Pipeline page state (`stage`, `temperature`, `dealer`, `search`, `sort`, `order`, `page`) lives entirely in URL search params. Components read with `useSearchParams()` and write via `router.push(\`/dashboard/pipeline?${nextParams}\`)`. Benefits:

- Back/forward browser buttons restore prior filter state.
- Shareable URLs.
- React Query keys derive directly from search params, so cache invalidation is free.

The `useSearchParams()` consumers (`PipelineFilters`, `LeadTable`, `LeadSlideOver`) are wrapped in `<Suspense fallback={<SkeletonTable />}>` in `pipeline/page.tsx` — the App Router build will fail otherwise (feasibility risk).

Search input is debounced 300 ms inside `PipelineFilters` before pushing to the URL.

#### D6. Lead slide-over via `?leadId=`

The slide-over is opened by setting `?leadId=<uuid>` on the pipeline URL. `LeadSlideOver` reads the param via `useSearchParams()` and `useLead(leadId)` fetches `/api/leads/[id]`. Close removes the param via `router.push(/dashboard/pipeline?<otherParams>)`. Browser Back closes the panel for free. No separate modal-open state in React.

#### D7. shadcn/ui scaffold

Bootstrap step (must happen before any component is built — feasibility risk on silent import failures):

```
npx shadcn@latest init
npx shadcn@latest add button card badge sheet table select input skeleton alert
```

Then add `sonner` for toasts. Components used: Button, Card, Badge, Sheet (slide-over), Table, Select, Input, Skeleton, Alert.

### Component breakdown

| Component | File | Notes |
|---|---|---|
| AppShell | `src/components/AppShell.tsx` | Top nav (logo, user dropdown, logout) + sidebar; wraps `/dashboard/**`. Logout calls `POST /api/auth/logout` then `router.push('/login')`. |
| LoginForm | `src/components/LoginForm.tsx` | Zod schema; posts to `/api/auth/login`; error banner; password show/hide toggle. |
| MetricsGrid | `src/components/MetricsGrid.tsx` | 2×2 mobile, 4-up desktop. Subscribes to `useMetrics()`. |
| MetricCard | `src/components/MetricCard.tsx` | Label + value (+ optional sub-labels for Units card). Skeleton state. |
| LeadKanban | `src/components/LeadKanban.tsx` | One column per canonical stage. Read-only (no DnD, per feasibility scope check). |
| LeadTable | `src/components/LeadTable.tsx` | Shared between dashboard "table toggle" view (10 rows, link to full pipeline) and full pipeline page (paginated, sortable). Driven by props. |
| PipelineFilters | `src/components/PipelineFilters.tsx` | Stage/Temp/Dealer selects + debounced search. Writes to URL params. |
| LeadSlideOver | `src/components/LeadSlideOver.tsx` | Radix `Sheet`; opens when `leadId` param present; 404 banner if missing. |
| TemperatureBadge | `src/components/TemperatureBadge.tsx` | Hot/Warm/Cold pill — color + text (color never sole identifier, per UX). |
| PollIndicator | `src/components/PollIndicator.tsx` | "↻ updated Ns ago" + spinner when fetching + amber on error. Drives off `useIsFetching` and `dataUpdatedAt`. |
| SkeletonCard / SkeletonRow | `src/components/SkeletonCard.tsx` | Shimmer placeholders matching card/row shape. |
| ErrorBanner | `src/components/ErrorBanner.tsx` | `role="alert"`; optional retry callback. |

### Data model / contracts

No DB. The frontend defines Zod schemas for every backend response shape used. All schemas live in `src/types/api.ts` and are the single source of truth for response validation. Schemas to define for this feature:

- `UserSchema` — `{ id, email, role, tenantId, name }`
- `LoginResponseSchema` — `{ user: UserSchema }` (server-side BFF additionally captures `{ accessToken, refreshToken, expiresIn }` from upstream but does not return them to the browser)
- `LeadSchema` — fields visible in pipeline rows and slide-over: `id, name, phone, email, stage, temperature, aiScore, assignedDealer { id, name }, createdAt, scoreBreakdown?, activity?[]`
- `PaginatedSchema<T>` — `{ data: T[], total: number, page: number, pageSize: number }`
- `LeadsResponseSchema = PaginatedSchema(LeadSchema)`
- `BookingsResponseSchema = PaginatedSchema(BookingSchema)` (only `total` consumed for the metrics card; full schema kept thin for v1)
- `UnitsCountResponseSchema = PaginatedSchema(UnitSchema)` (only `total` consumed)
- `MetricsResponseSchema` — the aggregated shape from D3

Each proxy route runs `.safeParse()` on the upstream JSON before returning; a parse failure yields a 502 with `{ error: 'upstream_shape_mismatch' }` so failures are loud, not silent.

### Files to modify (existing)

None. The product directory `/Users/vijaysrivastva/git/reos-web/` contains only `.git`. Every file below is new.

### New files to create (justified)

All files are necessary because the repo is empty. Grouped by purpose:

**Bootstrap**
- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `.gitignore` — green-field tooling.
- `components.json` — shadcn config (generated by `shadcn init`).

**App shell**
- `src/app/layout.tsx` — root layout, font, `QueryClientProvider`, `Toaster`.
- `src/app/page.tsx` — redirect to `/dashboard`.
- `src/app/globals.css` — Tailwind directives + shimmer keyframe.

**Auth**
- `src/app/login/page.tsx` — server component rendering `<LoginForm/>`.
- `src/components/LoginForm.tsx`.
- `src/app/api/auth/login/route.ts`.
- `src/app/api/auth/logout/route.ts`.
- `src/app/api/auth/refresh/route.ts`.
- `src/middleware.ts` — `/dashboard/**` protection via `jose.decodeJwt`.

**Dashboard**
- `src/app/dashboard/layout.tsx` — `<AppShell>`.
- `src/app/dashboard/page.tsx` — metrics + Kanban/table toggle.
- `src/app/dashboard/pipeline/page.tsx` — full pipeline + slide-over.

**BFF proxy routes**
- `src/app/api/metrics/route.ts` — fan-out per D3.
- `src/app/api/leads/route.ts` — proxies list (query params passed through).
- `src/app/api/leads/[id]/route.ts` — proxies single lead.
- `src/app/api/bookings/route.ts` — proxies bookings list.

**UI components**
- `src/components/AppShell.tsx`
- `src/components/MetricsGrid.tsx`
- `src/components/MetricCard.tsx`
- `src/components/LeadKanban.tsx`
- `src/components/LeadTable.tsx`
- `src/components/PipelineFilters.tsx`
- `src/components/LeadSlideOver.tsx`
- `src/components/TemperatureBadge.tsx`
- `src/components/PollIndicator.tsx`
- `src/components/SkeletonCard.tsx`
- `src/components/ErrorBanner.tsx`
- `src/components/ui/**` — generated by shadcn.

**Hooks**
- `src/hooks/useMetrics.ts` — `useQuery({ queryKey: ['metrics'], queryFn: fetch('/api/metrics') })`.
- `src/hooks/useLeads.ts` — params -> URL query; key includes serialised params.
- `src/hooks/useLead.ts` — single-lead by id; enabled only when `leadId` present.

**Library**
- `src/lib/api.ts` — `proxyFetch`, `doRefresh`, `refreshOrRedirect` singleton.
- `src/lib/queryClient.ts` — `makeQueryClient()` with the D4 defaults.

**Types**
- `src/types/api.ts` — all Zod schemas + inferred types.

**Tests** (Junior writes these in step 7b)
- `tests/refreshOrRedirect.test.ts` — see test plan below.
- `tests/zod-schemas.test.ts` — parses fixture payloads.
- `tests/middleware.test.ts` — redirect on missing/expired `reos_token`.
- `tests/api-auth-logout.test.ts` — see test plan below.
- `tests/api-auth-login.test.ts` — see test plan below.
- `tests/api-metrics.test.ts` — see test plan below.
- `tests/api-leads.test.ts` — see test plan below.

### Test plan (Junior task specs)

Each entry below is the contract Junior must satisfy when writing the test file. All tests are Vitest (or Jest) + `next/server` mock helpers; upstream backend calls are mocked via `vi.fn()` on global `fetch`.

**`tests/refreshOrRedirect.test.ts` — concurrent refresh singleton**
- `doRefresh()` is mocked. Two callers `await refreshOrRedirect()` in the same tick (no `await` between them).
- Assert: the underlying `doRefresh()` mock is called **exactly once**.
- Assert: both callers resolve to the same `{ accessToken: '...' }` object reference.
- Second test: after the first refresh settles, a third `refreshOrRedirect()` call invokes `doRefresh()` again (singleton is released by `finally`).
- Third test: when `doRefresh()` is mocked to reject (network error / 5xx), `refreshOrRedirect()` resolves to `null` for **all** concurrent waiters — no unhandled rejection escapes. Assert `process.on('unhandledRejection')` is never triggered during the test.

**`tests/api-auth-logout.test.ts` — `/api/auth/logout` cookie clearing**
- POST to the route handler with both `reos_token` and `reos_refresh` cookies set on the incoming `NextRequest`.
- Assert: response status is 204.
- Assert: response `Set-Cookie` headers clear both cookies — `reos_token` and `reos_refresh` are each emitted with `Max-Age=0` (or `Expires` in the past) and matching `Path=/`, `HttpOnly`, `SameSite=Lax` attributes.
- Assert: no upstream backend call is made (logout is local).
- Negative case: GET to the route returns 405.

**`tests/api-auth-login.test.ts` — `/api/auth/login` proxy**
- POST with valid `{ email, password }` body; mocked upstream returns `{ accessToken, refreshToken, expiresIn: 900, user }`.
- Assert: response status 200, body is `{ user }` only — no `accessToken` or `refreshToken` in the JSON body.
- Assert: `Set-Cookie` writes `reos_token` (HttpOnly, SameSite=Lax, `Max-Age` ≈ `expiresIn`) and `reos_refresh` (HttpOnly, SameSite=Lax, `Max-Age = 7 * 24 * 60 * 60`).
- Assert: outgoing upstream request hits `${REOS_API_BASE_URL}/auth/login` with the JSON body forwarded.
- Negative case: upstream 401 → response is 401 with `{ error }`; no cookies set.
- Negative case: malformed request body (fails Zod) → 400, no upstream call made.

**`tests/api-metrics.test.ts` — `/api/metrics` fan-out**
- All six upstream calls succeed → response 200, every slot populated with the mocked `total`, `failed: []`.
- One slot rejects (mock `fetch` to throw for the `hotLeads` URL) → response 200, `hotLeads: null`, other slots numeric, `failed: ['hotLeads']`.
- Two slots reject → response 200, both null, `failed` length 2 with both labels present.
- All six slots reject → response 502, `failed` length 6.
- Critical correctness assertion: when one slot rejects, the response **still contains** the values of the other five slots. (This is the regression test for the `Promise.all` → `Promise.allSettled` fix; `Promise.all` would lose those values.)
- 401 from any upstream triggers `refreshOrRedirect()` and a single retry with the returned `accessToken`.

**`tests/api-leads.test.ts` — `/api/leads` and `/api/leads/[id]` proxy**
- GET `/api/leads?stage=qualified&page=2` → upstream is called with the same query string appended to `${REOS_API_BASE_URL}/leads`. Response JSON is passed through and validated against `LeadsResponseSchema` (Zod). Status mirrored.
- Authorization header on upstream call is `Bearer ${reos_token cookie value}`.
- Upstream 401 → `refreshOrRedirect()` is invoked; on success the retry uses the **returned** `accessToken` (not the original cookie value). On null, route returns 401 to the browser.
- Upstream returns shape that fails `LeadsResponseSchema.safeParse()` → route returns 502 with `{ error: 'upstream_shape_mismatch' }`.
- GET `/api/leads/[id]` with `id` path param: upstream `${REOS_API_BASE_URL}/leads/${id}` is called; same auth + retry behaviour.

### Response to review

Each blocking issue from `/Users/vijaysrivastva/.claude-team/reos-web/reviews/feat-0001-staff-backend.md` is addressed above. Summary of changes:

- **B1 — `proxyFetch` token-after-refresh bug.** Fixed in D1 and D2. `doRefresh()` now returns `{ accessToken: string } | null` (typed `RefreshResult`). `refreshOrRedirect()` relays that value. D2 step 3 explicitly states `proxyFetch` uses the returned `accessToken` for the retry `Authorization` header and does **not** re-read `req.cookies` (the new cookie is only on the outgoing response, never on the incoming `NextRequest`).
- **B2 — `Promise.all` cannot attribute failures.** Fixed in D3. The fan-out now uses `Promise.allSettled`. Each slot is labelled; fulfilled entries supply integer totals, rejected entries become `null` in the response and have their label appended to `failed[]`. The response shape is updated to `number | null` per slot, with documented 200 (all-ok or partial) vs 502 (all-failed) policy. The DB reviewer's `Promise.allSettled` nit is the same fix and is therefore resolved by the same change.
- **B3 — `refreshOrRedirect` error path.** Fixed in D1. The contract is now: `doRefresh()` catches every error (network, non-2xx, parse failure, malformed body) and returns `null` — it never throws. `refreshOrRedirect()` therefore always resolves to `null | { accessToken }`. Concurrent waiters always see a clean signal; no unhandled rejection can propagate to callers. This contract is documented in `src/lib/api.ts` and is asserted by `tests/refreshOrRedirect.test.ts` (third test case, above).

Quality concerns also incorporated:

- Concurrent-refresh singleton test spec added (`tests/refreshOrRedirect.test.ts`).
- Logout cookie-clearing test spec added (`tests/api-auth-logout.test.ts`).
- BFF proxy test specs added for `/api/auth/login` (`tests/api-auth-login.test.ts`), `/api/metrics` (`tests/api-metrics.test.ts`), and `/api/leads` + `/api/leads/[id]` (`tests/api-leads.test.ts`).

Non-blocking suggestions N1–N5 from the review are tracked but deferred to implementation-time clarification in 7a; they do not change the architecture's structural decisions.

### Rejected alternatives

- **Pages Router** — rejected. App Router gives streaming, native middleware on the edge, and server components, all of which we use.
- **NextAuth.js** — rejected. We already have a backend `/auth/login` + `/auth/refresh`. NextAuth adds a parallel session model and obscures the refresh-race control we explicitly need.
- **Tokens in `localStorage`** — rejected, contradicts AC #3.
- **SWR** — rejected. TanStack Query's `refetchInterval` + `useIsFetching` per query key is a closer fit for the UX poll indicator.
- **Redux / Zustand for filter state** — rejected. URL-synced filters (D5) cover every requirement and give back/forward + shareable URLs for free.
- **Middleware-side token refresh** — rejected. Edge runtime cookie mutation interacts awkwardly with in-flight API calls; refresh stays in the BFF proxy where the singleton can dedupe (D1).
- **One React Query hook per metric (4 queries)** — rejected. Four parallel pollers quadruple traffic and complicate the poll indicator. One `/api/metrics` route fan-out (D3) is simpler and lower-load.
- **Kanban with drag-and-drop** — rejected. Out of scope (feasibility's stakeholder-expectation check). v1 Kanban is read-only.

---

## feat-0002 — Property Inventory Browser

Spec: `/Users/vijaysrivastva/.claude-team/reos-web/specs/feat-0002-spec.md`
Feasibility: `/Users/vijaysrivastva/.claude-team/reos-web/specs/feat-0002-feasibility.md`
UX: `/Users/vijaysrivastva/.claude-team/reos-web/design/feat-0002-ux.md`

Surfaces the reos-backend inventory + booking APIs (feat-0003) in the web frontend. Adds a two-route inventory section (`/dashboard/inventory`, `/dashboard/inventory/[projectId]`), a unit detail slide-over with pricing breakdown, and a booking initiation mini-form. Builds entirely on the feat-0001 foundation — `proxyFetch`, `refreshOrRedirect`, `QueryClientProvider`, `PollIndicator`, `ErrorBanner`, `SkeletonCard`, `Pagination` are reused verbatim. Conventions established in feat-0001 (BFF proxy, httpOnly cookies, Zod-inferred types, URL-synced filters, polling defaults) carry forward unchanged.

### Codebase survey results

- `src/app/api/bookings/route.ts` — exists with `GET` handler only. **Extend** with `POST` (do not create a parallel file).
- `src/app/api/leads/route.ts` — exists. **Reuse** for the booking-form lead dropdown (`useLeadsForBooking` calls `/api/leads?pageSize=50`).
- `src/lib/api.ts` — `proxyFetch` + `refreshOrRedirect` are the canonical proxy helpers; every new route uses them.
- `src/types/api.ts` — already exports `UnitSchema` (thin `passthrough` shape from feat-0001's metrics card) and `paginatedSchema()`. **Extend** by widening `UnitSchema` and adding the new project/tower/price-config/booking-create schemas.
- `src/components/AppShell.tsx` — has a `NAV` array at module top. **Extend** by appending an "Inventory" entry between Dashboard and Pipeline.
- `src/hooks/` — `useLeads.ts`, `useLead.ts`, `useMetrics.ts` exist. Add new hooks alongside.
- `src/components/` — `PollIndicator`, `ErrorBanner`, `SkeletonCard` exist and are reused.
- No existing `src/app/dashboard/inventory/` tree — new pages.
- No `src/lib/formatCurrency.ts` — new utility.

### Decisions

#### D1. BFF proxy routes (new + one extension)

All routes use `proxyFetch(req, backendPath)` and follow the feat-0001 contract: 401 from upstream auto-refreshes once; upstream JSON `.safeParse()` against the corresponding Zod schema; shape mismatch yields `502 { error: 'upstream_shape_mismatch' }`.

| Route | Method | File | Upstream |
|---|---|---|---|
| `/api/projects` | GET | `src/app/api/projects/route.ts` (new) | `GET /projects?page=&pageSize=&search=` (query passthrough) |
| `/api/projects/[projectId]` | GET | `src/app/api/projects/[projectId]/route.ts` (new) | `GET /projects/:id` |
| `/api/projects/[projectId]/towers` | GET | `src/app/api/projects/[projectId]/towers/route.ts` (new) | `GET /projects/:id/towers` |
| `/api/projects/[projectId]/units` | GET | `src/app/api/projects/[projectId]/units/route.ts` (new) | dispatches based on `?towerId` presence (see below) |
| `/api/units/[unitId]/price-config` | GET | `src/app/api/units/[unitId]/price-config/route.ts` (new) | `GET /units/:id/price-config` |
| `/api/bookings` | POST | `src/app/api/bookings/route.ts` (**extend** existing GET route) | `POST /bookings` with `{ leadId, unitId }` JSON body |
| `/api/leads` | GET | (existing — reused unchanged) | `GET /leads?pageSize=50` for booking-form dropdown |

**Units dispatch rule (per feasibility):** the BFF route at `/api/projects/[projectId]/units` inspects only the incoming `?towerId` query param:
- `towerId` present → upstream `GET /projects/:id/towers/:towerId/units?<remainingQS>` (apartment path)
- `towerId` absent → upstream `GET /projects/:id/availability?<remainingQS>` (villa/plot path)

No `project.type` lookup on the server. The client (via `TowerSidebar` auto-selecting the first tower for apartment projects) is responsible for always sending `towerId` when the project has towers. This keeps the BFF stateless and matches the feasibility's "tower dispatch via `towerId` presence is clean" guidance.

**Pass-through query params for units:** `status`, `bedrooms`, `floorMin`, `floorMax`, `priceMin`, `priceMax`, `sortBy`, `page`, `pageSize`, `towerId`. The BFF forwards the request's search string verbatim (after stripping `towerId` from the path-dispatched apartment route to avoid duplication).

**POST `/api/bookings`** (extension of existing GET route in the same file):
- Validates incoming JSON body against `CreateBookingRequestSchema` (`{ leadId: string, unitId: string }`); 400 on failure.
- Forwards via `proxyFetch(req, '/bookings', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })`.
- Parses upstream success body against `BookingCreatedSchema`; 502 on shape mismatch.
- 409 from upstream (concurrent booking conflict) passes through with body intact so the client toast can surface the message.

#### D2. Optimistic update — `useMutation` lifecycle (corrected per feasibility risk)

Feasibility explicitly inverts the spec's `onSuccess` pattern. Implementation in `useCreateBooking`:

```ts
useMutation({
  mutationFn: ({ leadId, unitId }) => fetch('/api/bookings', { method: 'POST', body: JSON.stringify({ leadId, unitId }) }),

  // 1. Snapshot + apply optimistic patch BEFORE the request.
  onMutate: async ({ unitId }) => {
    await queryClient.cancelQueries({ queryKey: ['units'] });           // halt in-flight refetches
    const snapshots = queryClient.getQueriesData({ queryKey: ['units'] }); // capture every matching cache entry
    queryClient.setQueriesData({ queryKey: ['units'] }, (old) =>
      old ? { ...old, data: old.data.map((u) => u.id === unitId ? { ...u, status: 'blocked' } : u) } : old,
    );
    return { snapshots };                                                // returned to onError as `context`
  },

  // 2. Rollback every snapshot on failure. (Toast handled at component level.)
  onError: (_err, _vars, context) => {
    context?.snapshots.forEach(([key, value]) => queryClient.setQueryData(key, value));
  },

  // 3. Always reconcile with server truth — fires on both success and error.
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['units'] });
  },
});
```

`setQueriesData` (plural) is used, not `setQueryData`, because the units cache is keyed by `['units', projectId, towerId, filtersHash]` and the optimistic patch must apply across every cached filter permutation that contains the target unit. The same applies to the `getQueriesData` snapshot and the `invalidateQueries`.

#### D3. Pages, components, hooks layout

**Pages** (server components, thin):
- `src/app/dashboard/inventory/page.tsx` — renders `<ProjectsList />` inside `<Suspense>` (any consumer of `useSearchParams` must be Suspended per App Router constraint).
- `src/app/dashboard/inventory/[projectId]/page.tsx` — extracts `projectId` from `params`, renders `<ProjectDetail projectId={...} />` inside `<Suspense>`. The detail subtree reads `?towerId=`, `?unitId=`, and all filter params from the URL.

**Role guard:** both server pages perform a role check via the decoded JWT cookie (`role in ['builder_admin','sales_manager','sales_agent']`) and `redirect('/dashboard')` otherwise. The check is server-side (not middleware) because middleware is generic for `/dashboard/:path*` and adding role logic there would couple all future feature additions. A small helper `src/lib/requireRole.ts` reads the cookie via `cookies()` from `next/headers` and centralises the role check.

**Components** (all under `src/components/inventory/`):

| Component | File | Role |
|---|---|---|
| `ProjectsList` | `src/components/inventory/ProjectsList.tsx` | Reads `?search=`, `?page=` params; calls `useProjects`; renders search input, card grid, `Pagination`. |
| `ProjectCard` | `src/components/inventory/ProjectCard.tsx` | name + type badge + city only (no unit-count chips per feasibility scope cut). Entire card is a `<Link>`. |
| `ProjectSearch` | `src/components/inventory/ProjectSearch.tsx` | 300 ms debounced text input writing `?search=` and resetting `?page=`. |
| `ProjectDetail` | `src/components/inventory/ProjectDetail.tsx` | Top-level project detail layout; orchestrates `useProject`, `useTowers`, `useUnits`. |
| `TowerSidebar` | `src/components/inventory/TowerSidebar.tsx` | Hidden when `project.type !== 'apartment'`. Auto-selects first tower on mount when `?towerId` is absent (feasibility risk). `aria-pressed` for selected state. |
| `UnitFilters` | `src/components/inventory/UnitFilters.tsx` | Status / bedrooms / floor range / price range / sort. All write to URL params. |
| `UnitGrid` | `src/components/inventory/UnitGrid.tsx` | Responsive CSS grid. Loading → `SkeletonGrid`. Error → `ErrorBanner`. Renders `PollIndicator` driven by `useIsFetching({ queryKey: ['units', projectId] })`. |
| `UnitCell` | `src/components/inventory/UnitCell.tsx` | Unit tile; sets `?unitId=` on click. |
| `UnitStatusBadge` | `src/components/inventory/UnitStatusBadge.tsx` | Colour + text label (per WCAG; colour never sole indicator). |
| `UnitDetailPanel` | `src/components/inventory/UnitDetailPanel.tsx` | Radix `Sheet`, `side="right"` desktop / `side="bottom"` mobile. Two steps gated by local `step` state (`'detail' \| 'booking' \| 'success'`). Closes by clearing `?unitId=`. |
| `PricingBreakdownTable` | `src/components/inventory/PricingBreakdownTable.tsx` | Five pricing rows + effective price total. INR formatted. Skeleton rows while `useUnitPriceConfig` loads. |
| `BookingForm` | `src/components/inventory/BookingForm.tsx` | Lead combobox (client-side filtered from `useLeadsForBooking`) + booking amount + Confirm/Cancel. Calls `useCreateBooking`. |
| `SkeletonGrid` | `src/components/SkeletonGrid.tsx` | New shared skeleton variant (20 unit-tile placeholders). |

**Hooks** (all under `src/hooks/`):

| Hook | Query key | Polling |
|---|---|---|
| `useProjects(params)` | `['projects', { search, page }]` | none |
| `useProject(projectId)` | `['project', projectId]` | none |
| `useTowers(projectId)` | `['towers', projectId]` | none |
| `useUnits(projectId, params)` | `['units', projectId, towerId, filtersHash]` | `refetchInterval: 30_000`, `refetchIntervalInBackground: false` |
| `useUnitPriceConfig(unitId)` | `['unit-price-config', unitId]` | none; `enabled: !!unitId` (fires only when slide-over open) |
| `useLeadsForBooking()` | `['leads', { pageSize: 50, forBooking: true }]` | none; reuses `/api/leads` route. JWT auto-scopes to current user (per feasibility — no `assignedTo` param). |
| `useCreateBooking()` | mutation | n/a — see D2 |

**Utilities:**
- `src/lib/formatCurrency.ts` — `formatINR(value: number): string` using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
- `src/lib/requireRole.ts` — server-only role guard helper.

#### D4. Zod schemas (extend `src/types/api.ts`)

Additions (existing `UnitSchema` is **widened**, not replaced — feat-0001 only reads `total` from paginated units so the wider shape is backward-compatible):

```ts
ProjectTypeSchema = z.enum(['apartment', 'villa', 'plot'])

ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ProjectTypeSchema,
  city: z.string(),
  tenantId: z.string().optional(),
})

TowerSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string(),
  floorCount: z.number().int().nonnegative().optional(),
})

UnitStatusSchema = z.enum(['available', 'blocked', 'booked', 'sold', 'held'])

// WIDENED — feat-0001 UnitSchema was passthrough with id + optional status only.
UnitSchema = z.object({
  id: z.string(),
  unitNumber: z.string().optional(),
  floor: z.number().int().optional(),
  bedrooms: z.number().int().optional(),
  area: z.number().optional(),
  facing: z.string().optional(),
  isCorner: z.boolean().optional(),
  status: z.string().optional(),
  projectId: z.string().optional(),
  towerId: z.string().optional(),
  effectivePrice: z.number().optional(),
}).passthrough()

UnitPriceConfigSchema = z.object({
  unitId: z.string(),
  basePrice: z.number(),
  floorPremium: z.number(),
  facingPremium: z.number(),
  cornerPremium: z.number(),
  discount: z.number(),
  effectivePrice: z.number(),
})

CreateBookingRequestSchema = z.object({
  leadId: z.string().min(1),
  unitId: z.string().min(1),
})

BookingCreatedSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  leadId: z.string().optional(),
  status: z.string().optional(),
}).passthrough()

ProjectsResponseSchema = paginatedSchema(ProjectSchema)
TowersResponseSchema = z.object({ data: z.array(TowerSchema) }).or(z.array(TowerSchema))
// UnitsResponseSchema already exists from feat-0001 and remains paginatedSchema(UnitSchema)
```

Feasibility flagged that `GET /units/:id/price-config` may not yet be implemented backend-side. If `useUnitPriceConfig` returns 404/501, `PricingBreakdownTable` falls back to a single-row display of `unit.effectivePrice` (already in `UnitSchema`) with a small "Breakdown unavailable" caption. This fallback is implemented in the component, not the hook — keeping the query path honest about the upstream state.

#### D5. AppShell navigation extension

`src/components/AppShell.tsx` — append one entry to the existing `NAV` array between Dashboard and Pipeline:

```ts
{ href: "/dashboard/inventory", label: "Inventory", icon: Building2 }
```

Import `Building2` from `lucide-react`. No structural changes to the component.

#### D6. URL state for project detail

Tower selection and slide-over open/close are entirely URL-driven, consistent with feat-0001 D5 + D6:

| Param | Purpose |
|---|---|
| `?towerId` | Selected tower (apartment projects only) |
| `?unitId` | Open unit slide-over |
| `?status`, `?bedrooms`, `?floorMin`, `?floorMax`, `?priceMin`, `?priceMax`, `?sortBy` | Unit filters |
| `?page`, `?pageSize` | Unit grid pagination |

Benefits: browser Back closes the slide-over / switches tower / clears a filter, depending on the most recent param change. Shareable URLs encode the full filter+selection state. React Query keys derive directly from `useSearchParams()` output, so cache invalidation is automatic.

**Suspense boundary:** every `useSearchParams()` consumer (`ProjectsList`, `ProjectSearch`, `ProjectDetail`, `TowerSidebar`, `UnitFilters`, `UnitGrid`, `UnitDetailPanel`) is wrapped in `<Suspense fallback={...}>` at the page level. The App Router build fails otherwise (feat-0001 D5 constraint carries over).

**Filter persistence across tower switches:** when `TowerSidebar` writes a new `?towerId`, all other params are preserved via `new URLSearchParams(currentParams)` merge. Filters do not reset.

### Component breakdown summary

(See D3 table above for the full list with files and roles.)

### Data model / contracts

No DB. All contracts are Zod schemas defined in `src/types/api.ts` (per D4). Each new proxy route runs `.safeParse()` on the upstream JSON before returning; mismatch yields `502 { error: 'upstream_shape_mismatch' }`. The `UnitSchema` widening is additive — feat-0001's metrics card (which reads only `total` from `paginatedSchema(UnitSchema)`) is unaffected because the new fields are all `.optional()` and the schema retains `.passthrough()`.

### Files to modify (existing)

- `src/app/api/bookings/route.ts` — add `POST` handler alongside existing `GET`. POST validates body against `CreateBookingRequestSchema`, forwards via `proxyFetch`, parses success body against `BookingCreatedSchema`, returns 502 on shape mismatch.
- `src/types/api.ts` — append `ProjectTypeSchema`, `ProjectSchema`, `TowerSchema`, `UnitPriceConfigSchema`, `CreateBookingRequestSchema`, `BookingCreatedSchema`, `ProjectsResponseSchema`, `TowersResponseSchema`. Widen the existing `UnitSchema` (add optional `unitNumber`, `floor`, `bedrooms`, `area`, `facing`, `isCorner`, `projectId`, `towerId`, `effectivePrice`).
- `src/components/AppShell.tsx` — add `{ href: "/dashboard/inventory", label: "Inventory", icon: Building2 }` to the `NAV` array between Dashboard and Pipeline; import `Building2` from `lucide-react`.

### New files to create (justified)

Each new file fills a hole no existing file covers.

**BFF proxy routes** (no existing route handles these upstream paths):
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[projectId]/route.ts`
- `src/app/api/projects/[projectId]/towers/route.ts`
- `src/app/api/projects/[projectId]/units/route.ts` (also houses the towerId-presence dispatch)
- `src/app/api/units/[unitId]/price-config/route.ts`

**Pages** (no existing inventory tree):
- `src/app/dashboard/inventory/page.tsx`
- `src/app/dashboard/inventory/[projectId]/page.tsx`

**Components** (all inventory-specific; no existing component covers them):
- `src/components/inventory/ProjectsList.tsx`
- `src/components/inventory/ProjectCard.tsx`
- `src/components/inventory/ProjectSearch.tsx`
- `src/components/inventory/ProjectDetail.tsx`
- `src/components/inventory/TowerSidebar.tsx`
- `src/components/inventory/UnitFilters.tsx`
- `src/components/inventory/UnitGrid.tsx`
- `src/components/inventory/UnitCell.tsx`
- `src/components/inventory/UnitStatusBadge.tsx`
- `src/components/inventory/UnitDetailPanel.tsx`
- `src/components/inventory/PricingBreakdownTable.tsx`
- `src/components/inventory/BookingForm.tsx`
- `src/components/SkeletonGrid.tsx` (new shared skeleton variant; `SkeletonCard` is card-shaped, not grid-shaped)

**Hooks** (each wraps a distinct query key):
- `src/hooks/useProjects.ts`
- `src/hooks/useProject.ts`
- `src/hooks/useTowers.ts`
- `src/hooks/useUnits.ts`
- `src/hooks/useUnitPriceConfig.ts`
- `src/hooks/useLeadsForBooking.ts`
- `src/hooks/useCreateBooking.ts`

**Utilities** (genuinely new concerns):
- `src/lib/formatCurrency.ts` — INR formatting; no existing currency utility.
- `src/lib/requireRole.ts` — server-side role guard; no existing helper. Centralises the role check so future role-gated pages reuse one function.

### Rejected alternatives

- **Separate modal page for booking (`/dashboard/inventory/[id]/book/[unitId]`).** Rejected. Adds a third route, an extra navigation, and breaks the "stay in flow" UX of the slide-over. Two-step in-Sheet flow keeps focus, preserves URL state (`?unitId=`), and matches the feat-0001 slide-over pattern (D6).
- **Eager `useUnitPriceConfig` fetch on grid render.** Rejected. The slide-over is opened for at most one unit at a time. Pre-fetching pricing for every visible tile multiplies upstream load by the grid size (often 100+ units) for data the user usually does not see. `enabled: !!unitId` gates the query to slide-over opens only.
- **Polling on the projects list (`useProjects`).** Rejected. Projects rarely change minute-to-minute, and the projects list is a navigational surface — polling adds traffic with no UX benefit. The 30 s poll lives only on `useUnits` where status churn is real.
- **Project-type lookup in the units BFF route to choose the upstream endpoint.** Rejected. Would require an extra upstream `GET /projects/:id` per units call (latency + traffic). The `towerId`-presence rule from feasibility is simpler, stateless, and pushes the project-type knowledge to the client (`TowerSidebar` auto-selects the first tower for apartments, so `towerId` is always present when towers exist).
- **`setQueryData` (singular) on a single cache entry for the optimistic update.** Rejected. The units cache is keyed by `['units', projectId, towerId, filtersHash]` — multiple filter permutations may have the unit cached. `setQueriesData` (plural) patches every matching entry; the singular form would leave stale entries in other filter views.
- **Filter state in React component state instead of URL params.** Rejected. Breaks browser Back/forward, breaks share-by-URL, and forces ad-hoc query-key wiring. Consistent with feat-0001 D5.
- **Single `useUnitDetail(unitId)` hook bundling unit + price config.** Rejected. Unit data is already in the grid cache (no extra fetch); price config is a separate upstream call gated by slide-over open. Bundling them would re-fetch unit data unnecessarily on every slide-over open and remove the ability to render unit details immediately while pricing loads.
- **Middleware-level role check for `/dashboard/inventory/**`.** Rejected. Middleware runs on every `/dashboard/:path*` request and would need a path-to-roles map maintained per feature. A server-component guard (`requireRole`) in each inventory page keeps the role policy co-located with the feature and avoids middleware sprawl.
- **Combobox with server-side lead search.** Rejected for v1 (feasibility note). Client-side filter on a `pageSize=50` payload is sufficient for the common case; the "(showing first 50)" label surfaces the cap when the response total exceeds 50. Full server-side combobox deferred to v2.

---

## feat-0003 — Payment Management UI

Spec: `/Users/vijaysrivastva/.claude-team/reos-web/specs/feat-0003-spec.md`
Feasibility: `/Users/vijaysrivastva/.claude-team/reos-web/specs/feat-0003-feasibility.md`
UX: `/Users/vijaysrivastva/.claude-team/reos-web/design/feat-0003-ux.md`

Adds a dedicated Payments page reachable from the `UnitSlideOver` booking-success screen. Covers payment schedule with milestones, record-payment form (Sheet), payment history table, receipt slide-over, and bounce action (role-gated). Built entirely on the existing foundation (proxyFetch, TanStack Query v5, Zod, httpOnly cookies, Radix Sheet / AlertDialog, Tailwind, formatCurrency).

### Decisions

#### D1. Page placement and booking-ID flow

**URL:** `/dashboard/inventory/[projectId]/bookings/[bookingId]/payments`

`projectId` is already in the URL context from the inventory browser. `bookingId` comes from the `BookingCreated` response when the user completes the `UnitSlideOver` booking form (step `success`). The success step now renders a "View Payments" button that `router.push`es to the payments page.

For units already in `booked` / `blocked` status, the slide-over detail step (step `detail`) surfaces the booking ID via `unit.bookingId` (a new optional field added to `UnitSchema` with `.passthrough()` — backward-compatible). If `bookingId` is present, the detail footer shows a "View Payments" link.

The payments page itself is a server component that extracts both params from `{ params }`, renders `<PaymentsView projectId bookingId />` inside `<Suspense>`, and applies `requireRole` (any of `builder_admin | sales_manager | sales_agent`).

#### D2. New BFF routes

All routes follow the feat-0001 D2 contract: `proxyFetch` with `reos_token` cookie, 401 auto-refresh once, `.safeParse()` on the upstream JSON body, 502 on shape mismatch.

| BFF route | Method | File | Upstream | Shape schema |
|---|---|---|---|---|
| `/api/payment-schedules` | GET | `src/app/api/payment-schedules/route.ts` | `GET /payment-schedules?bookingId=` | `PaymentSchedulesResponseSchema` |
| `/api/payment-schedules/[scheduleId]/milestones` | GET | `src/app/api/payment-schedules/[scheduleId]/milestones/route.ts` | `GET /payment-schedules/:id/milestones` | `MilestonesResponseSchema` |
| `/api/payments` | GET | `src/app/api/payments/route.ts` | `GET /payments?bookingId=` | `PaymentsResponseSchema` |
| `/api/payments` | POST | same file (POST handler) | `POST /payments` body `{ milestoneId, amount, mode, notes? }` | `RecordPaymentResponseSchema` |
| `/api/payments/[paymentId]/bounce` | POST | `src/app/api/payments/[paymentId]/bounce/route.ts` | `POST /payments/:id/bounce` | passthrough (empty or `{ status }`) |

**Role enforcement on bounce (Feasibility MC-1):** The BFF bounce route decodes `reos_token` with `jose.decodeJwt`, checks `role`. If not in `['builder_admin', 'sales_manager']`, returns `403 { error: 'forbidden' }` immediately without calling the upstream. This is a defence-in-depth layer — the backend enforces the same role independently.

Query param pass-through: all GET routes forward the full incoming `req.url` search string (e.g., `?bookingId=`) to the upstream path.

#### D3. New hooks

| Hook | Query key | File | Enabled guard |
|---|---|---|---|
| `usePaymentSchedule(bookingId)` | `['payment-schedule', bookingId]` | `src/hooks/usePaymentSchedule.ts` | `!!bookingId` |
| `usePaymentMilestones(scheduleId)` | `['payment-milestones', scheduleId]` | `src/hooks/usePaymentMilestones.ts` | `!!scheduleId` |
| `usePayments(bookingId)` | `['payments', bookingId]` | `src/hooks/usePayments.ts` | `!!bookingId` |
| `useRecordPaymentMutation()` | mutation | `src/hooks/useRecordPaymentMutation.ts` | n/a |
| `useBounceMutation()` | mutation | `src/hooks/useBounceMutation.ts` | n/a |

No polling on payment hooks — payments are not real-time; manual refetch on mutation success is sufficient.

`usePaymentMilestones` computes a client-side `derivedStatus` field as a fallback (Feasibility R2): if `milestone.overdue` field is absent and `milestone.amountPaid < milestone.dueAmount` and `milestone.dueDate < today`, `derivedStatus = 'overdue'`; if `amountPaid >= dueAmount`, `derivedStatus = 'paid'`; else `derivedStatus = 'pending'`. The `overdue` field from the server takes precedence when present.

On `useRecordPaymentMutation` success and `useBounceMutation` success: invalidate `['payment-milestones', scheduleId]` and `['payments', bookingId]`. No optimistic updates — payments are financial; wait for server confirmation (UX principle).

#### D4. New components

| Component | File | Description |
|---|---|---|
| `PaymentScheduleCard` | `src/components/PaymentScheduleCard.tsx` | Schedule summary card: name, total, paid, outstanding. Skeleton + ErrorBanner states. |
| `MilestoneList` | `src/components/MilestoneList.tsx` | Table of milestones. Status badge per row (Paid/Overdue/Pending). Row click opens RecordPaymentForm sheet (pending/overdue only). |
| `RecordPaymentForm` | `src/components/RecordPaymentForm.tsx` | Radix Sheet (right side). Fields: milestone select, amount, mode select, reference, notes. Zod validation. Calls useRecordPaymentMutation. |
| `PaymentHistoryTable` | `src/components/PaymentHistoryTable.tsx` | Table of payments sorted newest-first. Status badge. "Bounce" button (role-gated). Receipt number clickable (opens ReceiptSlideOver). |
| `ReceiptSlideOver` | `src/components/ReceiptSlideOver.tsx` | Radix Sheet (right side). Displays receipt details. Opened via `?receipt=` URL param. |
| Payments page | `src/app/dashboard/inventory/[projectId]/bookings/[bookingId]/payments/page.tsx` | Server component. `requireRole`. Renders `<PaymentsView>` in `<Suspense>`. |

#### D5. Zod schemas (extend `src/types/api.ts`)

```ts
PaymentModeSchema = z.enum(['cheque', 'NEFT', 'RTGS', 'cash', 'UPI'])

MilestoneStatusSchema = z.enum(['paid', 'overdue', 'pending'])

PaymentScheduleSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  bookingId: z.string(),
  totalAmount: z.number(),
  amountPaid: z.number(),
  outstanding: z.number().optional(),   // may be computed client-side
}).passthrough()

MilestoneSchema = z.object({
  id: z.string(),
  scheduleId: z.string().optional(),
  name: z.string(),
  dueDate: z.string(),
  dueAmount: z.number(),
  amountPaid: z.number(),
  status: MilestoneStatusSchema.optional(),
  overdue: z.boolean().optional(),
}).passthrough()

PaymentSchema = z.object({
  id: z.string(),
  bookingId: z.string().optional(),
  milestoneId: z.string().optional(),
  amount: z.number(),
  mode: PaymentModeSchema,
  referenceNumber: z.string().nullable().optional(),
  receiptNumber: z.string().optional(),
  status: z.enum(['cleared', 'bounced']).optional(),
  createdAt: z.string(),
}).passthrough()

RecordPaymentRequestSchema = z.object({
  milestoneId: z.string().min(1),
  amount: z.number().positive(),
  mode: PaymentModeSchema,
  referenceNumber: z.string().optional(),
  notes: z.string().max(500).optional(),
})

RecordPaymentResponseSchema = z.object({
  id: z.string(),
  receiptNumber: z.string().optional(),
  status: z.string().optional(),
}).passthrough()

PaymentSchedulesResponseSchema = paginatedSchema(PaymentScheduleSchema)
  // backend may return array; wrap in paginatedSchema and handle both shapes in the BFF route

MilestonesResponseSchema = paginatedSchema(MilestoneSchema)

PaymentsResponseSchema = paginatedSchema(PaymentSchema)
```

All schemas use `.passthrough()` on the outer object to tolerate backend schema evolution (Feasibility R1).

#### D6. Demo data extension

`src/lib/demo.ts` is extended with:
- `DEMO_PAYMENT_SCHEDULE` — one schedule for `bk-1` with three milestones (paid, overdue, pending).
- `DEMO_MILESTONES` — three milestone objects.
- `DEMO_PAYMENTS` — two payment records (one cleared, one bounced).
- `getDemoPaymentSchedule(bookingId)`, `getDemoMilestones(scheduleId)`, `getDemoPayments(bookingId)` — helpers used by the BFF routes when `isDemoRequest`.
- Bounce route in demo mode: returns `200 { status: 'bounced' }` without touching demo data (stateless).

#### D7. UnitSlideOver extension (existing file modification)

`src/components/UnitSlideOver.tsx` — two minimal changes:
1. **Success step:** add a "View Payments" button below the success message. Navigates to `/dashboard/inventory/${projectId}/bookings/${createdBooking.id}/payments`. `projectId` is read from the URL via `useParams()` (App Router).
2. **Detail step (booked/blocked unit):** if `unit.bookingId` is present, render a "View Payments" link in the footer alongside or replacing the "Book this unit" button.

No structural changes to the component's step machine or sheet layout.

### Files to modify (existing)

- `src/types/api.ts` — append 7 new schemas + types.
- `src/components/UnitSlideOver.tsx` — add "View Payments" entry point (D7).
- `src/lib/demo.ts` — extend with payment fixture data (D6).

### New files to create

**BFF routes:**
- `src/app/api/payment-schedules/route.ts`
- `src/app/api/payment-schedules/[scheduleId]/milestones/route.ts`
- `src/app/api/payments/route.ts`
- `src/app/api/payments/[paymentId]/bounce/route.ts`

**Page:**
- `src/app/dashboard/inventory/[projectId]/bookings/[bookingId]/payments/page.tsx`

**Components:**
- `src/components/PaymentScheduleCard.tsx`
- `src/components/MilestoneList.tsx`
- `src/components/RecordPaymentForm.tsx`
- `src/components/PaymentHistoryTable.tsx`
- `src/components/ReceiptSlideOver.tsx`

**Hooks:**
- `src/hooks/usePaymentSchedule.ts`
- `src/hooks/usePaymentMilestones.ts`
- `src/hooks/usePayments.ts`
- `src/hooks/useRecordPaymentMutation.ts`
- `src/hooks/useBounceMutation.ts`

### Rejected alternatives

- **Slide-over extension instead of a full page.** Rejected. The payments surface has three distinct data sections (schedule, milestones, history) plus a form and a receipt slide-over. Nesting all of that inside the existing `UnitSlideOver` Sheet would be unacceptably cramped and would break URL shareability. A dedicated page at a stable URL gives bookmarking, breadcrumb navigation, and a clean focus surface.
- **`useSearchParams` for receipt open/close.** The receipt slide-over is opened via `?receipt=<receiptNumber>` URL param, consistent with the D6 slide-over pattern from feat-0001/0002. The `ReceiptSlideOver` consumer is wrapped in `<Suspense>` per App Router constraint (Feasibility MC-2).
- **Optimistic update on record/bounce.** Rejected per UX principle 5 (payments are financial — wait for server confirmation). Stale UI after a failed payment is actively harmful.
- **Client-side role enforcement only.** Rejected per Feasibility MC-1. BFF bounce route enforces role server-side; the client-side hidden button is a UX nicety, not a security control.
