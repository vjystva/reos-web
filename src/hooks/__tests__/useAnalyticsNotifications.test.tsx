/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useAnalyticsOverview", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches from /api/analytics/overview and returns parsed data", async () => {
    const mockOverview = {
      totalLeads: 120,
      leadsThisMonth: 12,
      hotLeads: 8,
      totalBookings: 45,
      activeBookings: 30,
      totalRevenue: 10000000,
      collectedRevenue: 7000000,
      pendingRevenue: 3000000,
      totalUnits: 200,
      availableUnits: 60,
      bookedUnits: 140,
      pendingSiteVisits: 5,
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOverview,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAnalyticsOverview(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.totalLeads).toBe(120);
    expect(result.current.data?.collectedRevenue).toBe(7000000);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/analytics/overview",
    );
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAnalyticsOverview(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUnreadCount", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches unread count and returns number", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 7 }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(7);
  });
});

describe("useMarkNotificationRead", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("on success invalidates notifications and unread-count queries", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: makeWrapper(client),
    });

    await result.current.mutateAsync("notif-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k.includes("notifications"))).toBe(true);
  });
});
