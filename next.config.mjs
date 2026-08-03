/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Legacy top-level routes → canonical `/dashboard/**` pages.
   *
   * These older routes are exact or near duplicates of pages that now live
   * under `/dashboard` inside `AppShell`. Redirects are declared here rather
   * than by gutting each `page.tsx` so the legacy implementations stay on disk
   * as reference/dead code; Next.js evaluates `redirects()` before filesystem
   * routes, so the old pages are unreachable while the entries below match.
   *
   * `permanent: false` (307/308-free, non-cached) on purpose — a browser-cached
   * 308 would be painful to unwind if any of these consolidations is revisited.
   */
  async redirects() {
    return [
      { source: "/leads/pipeline", destination: "/dashboard/pipeline", permanent: false },
      { source: "/inventory", destination: "/dashboard/inventory", permanent: false },
      { source: "/dealers", destination: "/dashboard/dealers", permanent: false },
      { source: "/analytics", destination: "/dashboard/analytics", permanent: false },
      { source: "/analytics/funnel", destination: "/dashboard/analytics", permanent: false },
      { source: "/reports", destination: "/dashboard/reports", permanent: false },
      { source: "/reports/schedule", destination: "/dashboard/reports", permanent: false },
      { source: "/notifications", destination: "/dashboard/notifications", permanent: false },
      // Dynamic id is preserved; canonical segment is named `[bookingId]`.
      {
        source: "/bookings/:id",
        destination: "/dashboard/bookings/:id/payments",
        permanent: false,
      },
      { source: "/customer/bookings", destination: "/customer-portal", permanent: false },
    ];
  },
};

export default nextConfig;
