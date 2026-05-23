/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useConversionFunnel } from "@/hooks/useConversionFunnel";
import { ConversionFunnelSchema } from "@/types/api";

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

const MOCK_FUNNEL_RESPONSE = {
  stages: [
    { stage: "new", count: 500, conversionRate: 1.0 },
    { stage: "contacted", count: 350, conversionRate: 0.7 },
    { stage: "site_visited", count: 200, conversionRate: 0.4 },
    { stage: "negotiating", count: 120, conversionRate: 0.24 },
    { stage: "booked", count: 60, conversionRate: 0.12 },
    { stage: "completed", count: 45, conversionRate: 0.09 },
  ],
};

describe("useConversionFunnel", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches funnel data successfully from /api/analytics/conversion-funnel", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_FUNNEL_RESPONSE,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useConversionFunnel(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      "/api/analytics/conversion-funnel",
    );
  });

  test("returns stages array with all pipeline stages", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_FUNNEL_RESPONSE,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useConversionFunnel(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.stages).toHaveLength(6);
    expect(result.current.data?.stages[0].stage).toBe("new");
    expect(result.current.data?.stages[0].count).toBe(500);
    expect(result.current.data?.stages[0].conversionRate).toBe(1.0);
    expect(result.current.data?.stages[4].stage).toBe("booked");
    expect(result.current.data?.stages[5].stage).toBe("completed");
    expect(result.current.data?.stages[5].conversionRate).toBe(0.09);
  });

  test("handles 401 error by entering error state", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useConversionFunnel(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain("401");
  });

  test("handles schema mismatch by entering error state", async () => {
    const malformedResponse = {
      stages: [
        { stage: "new", count: -1, conversionRate: 1.0 }, // count must be nonneg
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => malformedResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useConversionFunnel(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe(
      "conversion_funnel_shape_mismatch",
    );
  });

  test("ConversionFunnelSchema validates correctly shaped data", () => {
    const result = ConversionFunnelSchema.safeParse(MOCK_FUNNEL_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stages).toHaveLength(6);
    }
  });

  test("ConversionFunnelSchema rejects missing stages field", () => {
    const result = ConversionFunnelSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  test("ConversionFunnelSchema rejects negative count in a stage", () => {
    const result = ConversionFunnelSchema.safeParse({
      stages: [{ stage: "new", count: -10, conversionRate: 1.0 }],
    });
    expect(result.success).toBe(false);
  });
});
