# feat-0002: Property Inventory Browser

## What was built
Sales managers and agents need to browse live property inventory, inspect unit pricing, and initiate bookings without leaving REOS. This feature delivers a two-route inventory section (`/dashboard/inventory` and `/dashboard/inventory/[projectId]`) that shows project cards, a tower-and-unit grid (auto-refreshing every 30 s), a pricing-detail slide-over per unit, and a 2-step booking form that reserves a unit against a lead with optimistic UI and 409-conflict handling. The booking flow uses `onMutate`/`onError`/`onSettled` for safe optimistic updates and rolls back on any failure.

## UX changes
A new "Inventory" nav item (Building2 icon) appears between Dashboard and Pipeline in the AppShell sidebar. The projects list page shows a 12-card paginated grid with name, type badge, city, and unit-count summary plus debounced search. The project detail page renders a collapsible tower sidebar (hidden for villa/plotted projects), a responsive unit grid with status-colored tiles, and a slide-over that opens on unit click to show the pricing breakdown table (base + premiums − discount = effective price) and a booking initiation form (lead combobox + amount).

## Architecture decisions
- **BFF tower dispatch via `towerId` presence**: units route checks `?towerId` — present → `/towers/:id/units`, absent → `/projects/:id/availability`. BFF stays stateless; client (TowerSidebar) is responsible for always sending `towerId` for apartment projects.
- **Optimistic booking update via `useMutation` lifecycle**: `onMutate` snapshots all `['units', ...]` cache entries and patches target unit to `status: 'blocked'`; `onError` restores from snapshot; `onSettled` always invalidates for server reconciliation.
- **`BookingConflictError` for 409 vs 5xx distinction**: `postBooking` throws `BookingConflictError(status, body, message)` so `BookingForm` can surface the backend's conflict message vs a generic network-error toast.
- **Price-config `staleTime: 5 min`, units `staleTime: 25 s`**: pricing data changes rarely (no interval polling); unit availability needs 30 s refresh cycle with `refetchIntervalInBackground: false`.
- **`BookingCreatedSchema` strict (no passthrough)**: POST /bookings success response validated strictly — `id` and `unitId` required — so shape mismatch triggers 502 before the optimistic state can diverge.

## Staff review verdicts
| Lens | Arch review | Diff review |
|------|-------------|-------------|
| Backend | approve-with-nits | approve-with-nits |
| Frontend | approve-with-nits | approve-with-nits |
| Quality | approve-with-nits | approve-with-nits |
| Database | approve-with-nits (cost: free) | approve-with-nits (cost: free) |

## Test results
status: pass — 28 tests, 28 passing (5 suites: utils + refreshOrRedirect + logout + useBookingMutation + formatCurrency)

## Files changed
 src/app/api/bookings/route.ts                    |  84 +++++++-
 src/app/api/projects/[projectId]/route.ts        |  51 +++++
 src/app/api/projects/[projectId]/towers/route.ts |  51 +++++
 src/app/api/projects/[projectId]/units/route.ts  |  68 +++++++
 src/app/api/projects/route.ts                    |  42 ++++
 src/app/api/units/[unitId]/price-config/route.ts |  53 +++++
 src/app/dashboard/inventory/[projectId]/page.tsx | 247 +++++++++++++++++++++++
 src/app/dashboard/inventory/page.tsx             | 180 +++++++++++++++++
 src/components/AppShell.tsx                      |   3 +-
 src/components/BookingForm.tsx                   | 216 ++++++++++++++++++++
 src/components/PricingBreakdownTable.tsx         |  71 +++++++
 src/components/ProjectCard.tsx                   |  46 +++++
 src/components/TowerSidebar.tsx                  | 116 +++++++++++
 src/components/UnitGrid.tsx                      |  43 ++++
 src/components/UnitSlideOver.tsx                 | 225 +++++++++++++++++++++
 src/components/UnitStatusBadge.tsx               |  47 +++++
 src/components/UnitTile.tsx                      |  62 ++++++
 src/hooks/__tests__/useBookingMutation.test.tsx  | 220 ++++++++++++++++++++
 src/hooks/useBookingMutation.ts                  | 117 +++++++++++
 src/hooks/useLeadsForBooking.ts                  |  28 +++
 src/hooks/useProject.ts                          |  24 +++
 src/hooks/useProjects.ts                         |  42 ++++
 src/hooks/useTowers.ts                           |  25 +++
 src/hooks/useUnitPriceConfig.ts                  |  39 ++++
 src/hooks/useUnits.ts                            |  59 ++++++
 src/lib/__tests__/formatCurrency.test.ts         |  27 +++
 src/lib/formatCurrency.ts                        |  21 ++
 src/types/api.ts                                 | 112 ++++++++++
 28 files changed, 2317 insertions(+), 2 deletions(-)
