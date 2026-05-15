# feat-0001: Builder Dashboard — Login, Metrics, Lead Pipeline, Real-Time Updates

## What was built
Builder admins and sales managers need a single web workspace to monitor their sales pipeline without switching between tools. This feature delivers the complete reos-web frontend: a login page with httpOnly cookie auth, a dashboard home with live metrics cards (total leads, hot leads, bookings, unit availability), a full lead pipeline page with Kanban and table views, URL-synced filters, and a lead detail slide-over — all polling the reos-backend REST API every 30 seconds with a refresh-singleton that prevents concurrent token-expiry races.

## UX changes
Login card redirects to `/dashboard` on success. Dashboard home shows a 4-card MetricsGrid (4-up desktop / 2×2 mobile) plus a 10-row recent leads table. Pipeline page offers a view toggle between sortable table and 7-column Kanban, with stage/temperature/dealer filters synced to URL params and a `?leadId=` slide-over for lead detail. A `PollIndicator` shows "Updated Xs ago" with a spinner while a poll is in-flight, turning amber on error.

## Architecture decisions
- **httpOnly cookie auth + BFF proxy**: All browser fetches hit `/api/**` Next.js routes; `REOS_API_BASE_URL` is server-only. Tokens never touch client JS.
- **`refreshPromise` singleton**: A module-scoped `let refreshPromise` deduplicate concurrent refresh calls from simultaneous 30 s pollers — only one `POST /auth/refresh` fires; all callers await the same promise. `doRefresh` catches all errors and returns `null` (never throws).
- **`Promise.allSettled` in `/api/metrics`**: 6 parallel upstream count-queries (`pageSize=1`) fan out; partial failures return nulls with a `failed[]` array; 502 only when all 6 slots fail.
- **URL-synced filters with `<Suspense>`**: All pipeline filter/sort/page state lives in URL query params; `useSearchParams()` consumers wrapped in `<Suspense>` as required by Next.js App Router.
- **`refetchIntervalInBackground: false`**: Polling stops when browser tab is backgrounded — avoids hammering the backend from idle tabs.

## Staff review verdicts
| Lens | Arch review | Diff review |
|------|-------------|-------------|
| Backend | block → approve-with-nits (3 auth bugs fixed) | approve-with-nits |
| Frontend | approve-with-nits | approve-with-nits |
| Quality | approve-with-nits | approve-with-nits |
| Database | approve-with-nits (cost: free) | approve-with-nits (cost: free) |

## Test results
status: pass — 17 tests, 17 passing (3 suites: utils + refreshOrRedirect + logout)

## Files changed
 .env.local.example                          |     2 +
 jest.config.js                              |    37 +
 next.config.mjs                             |     4 +
 package.json                                |    44 +
 src/app/api/auth/__tests__/logout.test.ts   |    41 +
 src/app/api/auth/login/route.ts             |   101 +
 src/app/api/auth/logout/route.ts            |    29 +
 src/app/api/auth/refresh/route.ts           |    54 +
 src/app/api/bookings/route.ts               |    37 +
 src/app/api/leads/[id]/route.ts             |    51 +
 src/app/api/leads/route.ts                  |    44 +
 src/app/api/metrics/route.ts                |   101 +
 src/app/dashboard/layout.tsx                |    10 +
 src/app/dashboard/page.tsx                  |   110 +
 src/app/dashboard/pipeline/page.tsx         |   190 +
 src/app/layout.tsx                          |    36 +
 src/app/login/page.tsx                      |    30 +
 src/app/page.tsx                            |     5 +
 src/app/providers.tsx                       |    14 +
 src/components/AppShell.tsx                 |    97 +
 src/components/ErrorBanner.tsx              |    45 +
 src/components/LeadKanban.tsx               |    91 +
 src/components/LeadSlideOver.tsx            |   167 +
 src/components/LeadTable.tsx                |   166 +
 src/components/LoginForm.tsx                |   158 +
 src/components/MetricCard.tsx               |    48 +
 src/components/MetricsGrid.tsx              |    59 +
 src/components/PipelineFilters.tsx          |   111 +
 src/components/PollIndicator.tsx            |    61 +
 src/components/SkeletonCard.tsx             |    28 +
 src/components/TemperatureBadge.tsx         |    42 +
 src/components/ui/badge.tsx                 |    30 +
 src/components/ui/button.tsx                |    60 +
 src/components/ui/card.tsx                  |    49 +
 src/components/ui/input.tsx                 |    21 +
 src/components/ui/select.tsx                |    27 +
 src/components/ui/sheet.tsx                 |    84 +
 src/components/ui/skeleton.tsx              |    17 +
 src/hooks/useLead.ts                        |    39 +
 src/hooks/useLeads.ts                       |    44 +
 src/hooks/useMetrics.ts                     |    27 +
 src/lib/__tests__/refreshOrRedirect.test.ts |   174 +
 src/lib/__tests__/utils.test.ts             |    31 +
 src/lib/api.ts                              |   149 +
 src/lib/queryClient.ts                      |    21 +
 src/middleware.ts                           |    54 +
 src/types/api.ts                            |   175 +
 59 files changed, 14759 insertions(+)
