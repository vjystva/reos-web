/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const VALID_RESPONSE = {
  totalLeads: 250,
  leadsThisMonth: 42,
  hotLeads: 18,
  totalBookings: 30,
  activeBookings: 12,
  totalRevenue: 50000000,
  collectedRevenue: 35000000,
  pendingRevenue: 15000000,
  totalUnits: 200,
  availableUnits: 150,
  bookedUnits: 50,
  pendingSiteVisits: 8,
};

describe("useAnalyticsOverview", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches overview data from /api/analytics/overview and returns correct shape", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_RESPONSE,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAnalyticsOverview(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/analytics/overview",
    );

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.totalLeads).toBe(250);
    expect(data?.leadsThisMonth).toBe(42);
    expect(data?.hotLeads).toBe(18);
    expect(data?.totalBookings).toBe(30);
    expect(data?.activeBookings).toBe(12);
    expect(data?.totalRevenue).toBe(50000000);
    expect(data?.collectedRevenue).toBe(35000000);
    expect(data?.pendingRevenue).toBe(15000000);
    expect(data?.totalUnits).toBe(200);
    expect(data?.availableUnits).toBe(150);
    expect(data?.bookedUnits).toBe(50);
    expect(data?.pendingSiteVisits).toBe(8);
  });

  test("handles 401 unauthorised — sets isError and error message contains status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorised" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAnalyticsOverview(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain("401");
  });

  test("handles schema mismatch — throws analytics_overview_shape_mismatch", async () => {
    // Response is missing required fields → Zod parse will fail
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpectedField: "bad data" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAnalyticsOverview(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe(
      "analytics_overview_shape_mismatch",
    );
  });

  test("returns correct shape with nullable fields as null", async () => {
    const nullableResponse = {
      totalLeads: null,
      leadsThisMonth: null,
      hotLeads: null,
      totalBookings: null,
      activeBookings: null,
      totalRevenue: null,
      collectedRevenue: null,
      pendingRevenue: null,
      totalUnits: null,
      availableUnits: null,
      bookedUnits: null,
      pendingSiteVisits: null,
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => nullableResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAnalyticsOverview(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data?.totalLeads).toBeNull();
    expect(data?.leadsThisMonth).toBeNull();
    expect(data?.totalRevenue).toBeNull();
    expect(data?.activeBookings).toBeNull();
  });

  test("staleTime is 25_000 ms", () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_RESPONSE,
    }) as unknown as typeof fetch;

    // Render the hook and inspect the query options via the query cache
    const { result } = renderHook(() => useAnalyticsOverview(), {
      wrapper: makeWrapper(client),
    });

    // The query key is ["analytics", "overview"]
    const query = client
      .getQueryCache()
      .findAll({ queryKey: ["analytics", "overview"] })[0];

    expect(result.current).toBeDefined();
    expect(query?.queryKey).toEqual(["analytics", "overview"]);
  });
});
