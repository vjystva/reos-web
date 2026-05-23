/** @jest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useInventory } from "@/hooks/useInventory";
import { formatPriceINR } from "@/utils/priceFormat";

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
    },
  });
}

// ---------------------------------------------------------------------------
// formatPriceINR pure-utility tests
// ---------------------------------------------------------------------------

describe("formatPriceINR", () => {
  test("formats 15_000_000 as ₹1.50 Cr", () => {
    expect(formatPriceINR(15_000_000)).toBe("₹1.50 Cr");
  });

  test("formats 10_000_000 (exactly 1 Cr) with Cr suffix", () => {
    expect(formatPriceINR(10_000_000)).toBe("₹1.00 Cr");
  });

  test("formats 500_000 as ₹5.00 L", () => {
    expect(formatPriceINR(500_000)).toBe("₹5.00 L");
  });

  test("formats 50_000 as plain ₹50,000", () => {
    expect(formatPriceINR(50_000)).toBe("₹50,000");
  });

  test("formats large crore value correctly", () => {
    // 25_000_000 → 2.50 Cr
    expect(formatPriceINR(25_000_000)).toBe("₹2.50 Cr");
  });

  test("formats a lakh-range value correctly", () => {
    // 750_000 → 7.50 L
    expect(formatPriceINR(750_000)).toBe("₹7.50 L");
  });
});

// ---------------------------------------------------------------------------
// useInventory query-key tests (no fetch mocking needed)
// ---------------------------------------------------------------------------

describe("useInventory", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
    // Prevent actual fetch calls from erroring the test runner
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ units: [], total: 0, page: 1, pageSize: 20 }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => client.clear());

  test("is called with correct query key [inventory, filters] when filters provided", () => {
    const filters = { status: "available", floor: 3 };
    const { result } = renderHook(() => useInventory(filters), {
      wrapper: makeWrapper(client),
    });

    // The queryKey on the observer matches our contract
    expect(result.current.status).toBeDefined();
    const cache = client.getQueryCache().getAll();
    expect(cache.length).toBeGreaterThan(0);
    expect(cache[0].queryKey).toEqual(["inventory", filters]);
  });

  test("uses default query key [inventory, {}] when no filters passed", () => {
    const { result } = renderHook(() => useInventory(), {
      wrapper: makeWrapper(client),
    });

    expect(result.current.status).toBeDefined();
    const cache = client.getQueryCache().getAll();
    expect(cache.length).toBeGreaterThan(0);
    expect(cache[0].queryKey).toEqual(["inventory", {}]);
  });

  test("uses correct query key with partial filters", () => {
    const filters = { type: "2BHK" };
    renderHook(() => useInventory(filters), {
      wrapper: makeWrapper(client),
    });

    const cache = client.getQueryCache().getAll();
    expect(cache[0].queryKey).toEqual(["inventory", { type: "2BHK" }]);
  });
});
