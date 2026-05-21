/** @jest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useUnitPricing, UnitPricingNotFoundError } from "@/hooks/useUnitPricing";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const mockPricingData = {
  unitId: "unit-123",
  estimatedPrice: 5500000,
  pricePerSqft: 5500,
  confidence: 0.87,
  priceRange: { low: 5200000, high: 5800000 },
  adjustmentFactors: ["Corner unit premium", "High floor bonus", "South-facing discount"],
};

describe("useUnitPricing", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches pricing data successfully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPricingData,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useUnitPricing("unit-123"), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.unitId).toBe("unit-123");
    expect(result.current.data?.estimatedPrice).toBe(5500000);
    expect(result.current.data?.pricePerSqft).toBe(5500);
    expect(result.current.data?.confidence).toBe(0.87);
    expect(result.current.data?.priceRange.low).toBe(5200000);
    expect(result.current.data?.priceRange.high).toBe(5800000);
    expect(result.current.data?.adjustmentFactors).toHaveLength(3);
  });

  test("shows loading state before data arrives", async () => {
    let resolvePromise!: (value: unknown) => void;
    const pending = new Promise((res) => { resolvePromise = res; });

    global.fetch = jest.fn().mockReturnValue(pending) as unknown as typeof fetch;

    const { result } = renderHook(() => useUnitPricing("unit-456"), {
      wrapper: makeWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Resolve to avoid open handles
    resolvePromise({ ok: true, status: 200, json: async () => mockPricingData });
  });

  test("handles 404 error — throws UnitPricingNotFoundError", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useUnitPricing("unit-missing"), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(UnitPricingNotFoundError);
    expect((result.current.error as Error).message).toBe("unit_pricing_not_found");
  });

  test("handles non-ok response — throws with status code in message", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useUnitPricing("unit-789"), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain("503");
  });

  test("handles schema mismatch — throws unit_pricing_shape_mismatch", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: "payload", broken: true }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useUnitPricing("unit-bad"), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "unit_pricing_shape_mismatch",
    );
  });

  test("calls the correct URL — /api/pricing/:unitId", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPricingData,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useUnitPricing("unit-123"), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toBe("/api/pricing/unit-123");
  });

  test("does not fetch when unitId is falsy", () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const { result } = renderHook(() => useUnitPricing(null), {
      wrapper: makeWrapper(client),
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
