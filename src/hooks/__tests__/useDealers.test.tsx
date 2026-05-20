/** @jest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useDealerPerformance } from "../useDealerPerformance";
import { useDealersPerformance } from "../useDealersPerformance";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  // Override any per-query retry settings so error tests don't time out
  qc.setQueryDefaults(["dealers"], { retry: false });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function mockFetch(body: unknown, ok = true, status = ok ? 200 : 400) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as jest.Mock;
}

afterEach(() => jest.resetAllMocks());

const perfData = {
  dealerId: "d1",
  dealerName: "Acme Realty",
  leadCount: 42,
  bookingCount: 10,
  conversionRate: 0.238,
  revenue: 50000000,
};

describe("useDealerPerformance", () => {
  it("fetches single dealer performance", async () => {
    mockFetch({ performance: perfData });
    const { result } = renderHook(() => useDealerPerformance("d1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.dealerId).toBe("d1");
    expect(result.current.data?.leadCount).toBe(42);
  });

  it("calls correct URL with dealer id", async () => {
    mockFetch({ performance: perfData });
    const { result } = renderHook(() => useDealerPerformance("dealer-abc"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("dealer-abc");
    expect(url).toContain("performance");
  });

  it("does not fetch when dealerId is null", () => {
    global.fetch = jest.fn();
    const { result } = renderHook(() => useDealerPerformance(null), {
      wrapper: wrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not fetch when dealerId is undefined", () => {
    global.fetch = jest.fn();
    const { result } = renderHook(() => useDealerPerformance(undefined), {
      wrapper: wrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("errors on 404", async () => {
    mockFetch({ error: "not_found" }, false, 404);
    const { result } = renderHook(() => useDealerPerformance("ghost"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("errors on schema mismatch", async () => {
    mockFetch({ performance: { wrong: "shape" } });
    const { result } = renderHook(() => useDealerPerformance("d1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "dealer_performance_shape_mismatch",
    );
  });
});

describe("useDealersPerformance", () => {
  it("fetches list of all dealer performances", async () => {
    mockFetch({ performance: [perfData] });
    const { result } = renderHook(() => useDealersPerformance(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].dealerName).toBe("Acme Realty");
  });

  it("includes sortBy query param", async () => {
    mockFetch({ performance: [perfData] });
    const { result } = renderHook(
      () => useDealersPerformance({ sortBy: "revenue" }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("sortBy=revenue");
  });

  it("includes order query param", async () => {
    mockFetch({ performance: [perfData] });
    const { result } = renderHook(
      () => useDealersPerformance({ sortBy: "leadCount", order: "desc" }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("order=desc");
  });

  it("omits query params when not provided", async () => {
    mockFetch({ performance: [] });
    const { result } = renderHook(() => useDealersPerformance(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toBe("/api/dealers/performance");
  });

  it("errors on 401", async () => {
    mockFetch({}, false, 401);
    const { result } = renderHook(() => useDealersPerformance(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("errors on schema mismatch", async () => {
    mockFetch({ notPerformance: [] });
    const { result } = renderHook(() => useDealersPerformance(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "dealers_performance_shape_mismatch",
    );
  });

  it("returns empty array when performance list is empty", async () => {
    mockFetch({ performance: [] });
    const { result } = renderHook(() => useDealersPerformance(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });
});
