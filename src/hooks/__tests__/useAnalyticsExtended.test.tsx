/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useBookingsByProject } from "@/hooks/useBookingsByProject";
import { useTopDealers } from "@/hooks/useTopDealers";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useBookingsByProject", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches from /api/analytics/bookings-by-project and returns parsed data", async () => {
    const mockResponse = {
      data: [
        {
          projectId: "proj-1",
          projectName: "Skyline Towers",
          bookingCount: 14,
          totalRevenue: 80000000,
        },
        {
          projectId: "proj-2",
          projectName: "Lakeview Heights",
          bookingCount: 9,
          totalRevenue: 50000000,
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBookingsByProject(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].projectName).toBe("Skyline Towers");
    expect(result.current.data?.data[0].bookingCount).toBe(14);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/analytics/bookings-by-project",
    );
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBookingsByProject(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useTopDealers", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches from /api/analytics/top-dealers and returns parsed data", async () => {
    const mockResponse = {
      dealers: [
        {
          dealerId: "d-1",
          dealerName: "Apex Realty",
          leadCount: 42,
          conversionRate: 0.31,
        },
        {
          dealerId: "d-2",
          dealerName: "Prime Estates",
          leadCount: 30,
          conversionRate: 0.22,
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTopDealers(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.dealers).toHaveLength(2);
    expect(result.current.data?.dealers[0].dealerName).toBe("Apex Realty");
    expect(result.current.data?.dealers[0].leadCount).toBe(42);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/analytics/top-dealers",
    );
  });

  test("returns empty dealers array when BFF maps upstream 404 to { dealers: [] }", async () => {
    // The BFF route returns an empty envelope (200) on upstream 404, so from
    // the browser's perspective the hook sees an ok response with an empty
    // dealers array — no error.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ dealers: [] }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTopDealers(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.dealers).toEqual([]);
    expect(result.current.isError).toBe(false);
  });
});
