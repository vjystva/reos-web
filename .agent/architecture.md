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
