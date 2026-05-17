# feat-0003: Payment Management UI — Schedule, Milestones & History

## What was built
Sales staff needed a UI to track and record payments against booking milestones. This feature delivers BFF proxy routes for payment schedules, milestones, and payments; five TanStack Query hooks with 30s stale time; and a composed payments page at `/dashboard/bookings/[bookingId]/payments` featuring a schedule summary card, per-milestone list with Record action, and a payment history table with Bounce action. All mutations invalidate related queries to keep the UI consistent without optimistic updates (financial data).

## Architecture decisions
- **BFF proxy routes** (`/api/payment-schedules`, `/api/payments`) keep credentials server-side; all routes validate response shape with Zod v4 before forwarding to the client.
- **Client-side milestone status derivation** in `usePaymentMilestones` — computes `overdue` from `dueDate < today` when the server omits the flag, making the UI resilient to partial backend data.
- **No optimistic updates** on record/bounce mutations — financial records require confirmed server state; invalidate-on-success pattern used instead.
- **Native `<select>` elements** — keeps UI component surface light (no Radix Select dependency needed for a small form).
- **Sheet slide-over** for RecordPaymentForm — keeps the milestone list visible while entering payment details.

## Staff review verdicts
| Lens | Arch review | Diff review |
|------|-------------|-------------|
| Backend | approve-with-nits | approve-with-nits |
| Frontend | approve-with-nits | approve-with-nits |
| Quality | approve-with-nits | approve-with-nits |
| Database | approve-with-nits (cost: free) | approve-with-nits (cost: free) |

## Test results
status: pass — 33 tests, 33 passing (6 suites: booking mutation + leads + units + metrics + auth + payment mutations)

## Files changed
 .agent/architecture.md                             | 183 +++++++++++++++++++++
 src/app/api/payment-schedules/[scheduleId]/milestones/route.ts |  59 +++++++
 src/app/api/payment-schedules/route.ts             |  60 +++++++
 src/app/api/payments/[paymentId]/bounce/route.ts   |  64 +++++++
 src/app/api/payments/route.ts                      | 142 ++++++++++++++++
 src/app/dashboard/bookings/[bookingId]/payments/page.tsx | 131 +++++++++++++++
 src/components/MilestoneList.tsx                   |  94 +++++++++++
 src/components/PaymentHistoryTable.tsx             | 109 ++++++++++++
 src/components/PaymentScheduleCard.tsx             | 102 ++++++++++++
 src/components/RecordPaymentForm.tsx               | 155 +++++++++++++++++
 src/hooks/__tests__/usePaymentMutations.test.tsx   | 168 +++++++++++++++++++
 src/hooks/useBounceMutation.ts                     |  47 ++++++
 src/hooks/usePaymentMilestones.ts                  |  55 +++++++
 src/hooks/usePaymentSchedule.ts                    |  25 +++
 src/hooks/usePayments.ts                           |  25 +++
 src/hooks/useRecordPaymentMutation.ts              |  48 ++++++
 src/lib/demo.ts                                    | 111 +++++++++++++
 src/types/api.ts                                   |  82 +++++++++
 18 files changed, 1660 insertions(+)
