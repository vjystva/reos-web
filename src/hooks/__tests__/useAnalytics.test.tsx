/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useLeadsBySource } from "@/hooks/useLeadsBySource";
import { usePaymentsByMonth } from "@/hooks/usePaymentsByMonth";
import { useConversionFunnel } from "@/hooks/useConversionFunnel";
import {
  LeadsBySourceItemSchema,
  BookingsByProjectItemSchema,
  PaymentsByMonthItemSchema,
  ConversionFunnelStageSchema,
  LeadsBySourceResponseSchema,
  BookingsByProjectItemResponseSchema,
  PaymentsByMonthResponseSchema,
  ConversionFunnelSchema,
} from "@/types/api";

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

// ---------------------------------------------------------------------------
// useLeadsBySource
// ---------------------------------------------------------------------------
describe("useLeadsBySource", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("fetches from /api/analytics/leads-by-source and returns parsed data", async () => {
    const mockResponse = {
      data: [
        { source: "referral", count: 42 },
        { source: "organic", count: 17 },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLeadsBySource(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].source).toBe("referral");
    expect(result.current.data?.data[0].count).toBe(42);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/analytics/leads-by-source",
    );
  });

  test("passes dateRange as query params", async () => {
    const mockResponse = { data: [{ source: "social", count: 5 }] };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useLeadsBySource({ from: "2026-01-01", to: "2026-03-31" }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("from=2026-01-01");
    expect(calledUrl).toContain("to=2026-03-31");
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLeadsBySource(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// usePaymentsByMonth
// ---------------------------------------------------------------------------
describe("usePaymentsByMonth", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("fetches from /api/analytics/payments-by-month with year param", async () => {
    const mockResponse = {
      data: [
        { month: 1, year: 2026, totalAmount: 5000000 },
        { month: 2, year: 2026, totalAmount: 6200000 },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => usePaymentsByMonth(2026), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].totalAmount).toBe(5000000);

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("year=2026");
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => usePaymentsByMonth(2026), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useConversionFunnel
// ---------------------------------------------------------------------------
describe("useConversionFunnel", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("fetches from /api/analytics/conversion-funnel and returns stages", async () => {
    const mockResponse = {
      stages: [
        { stage: "enquiry", count: 200, conversionRate: 1.0 },
        { stage: "site_visit", count: 80, conversionRate: 0.4 },
        { stage: "booking", count: 20, conversionRate: 0.1 },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useConversionFunnel(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.stages).toHaveLength(3);
    expect(result.current.data?.stages[0].stage).toBe("enquiry");
    expect(result.current.data?.stages[2].conversionRate).toBe(0.1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/analytics/conversion-funnel",
    );
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useConversionFunnel(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests
// ---------------------------------------------------------------------------
describe("Zod schema validation", () => {
  test("LeadsBySourceItemSchema: valid data parses", () => {
    const result = LeadsBySourceItemSchema.safeParse({
      source: "website",
      count: 10,
    });
    expect(result.success).toBe(true);
  });

  test("LeadsBySourceItemSchema: rejects negative count", () => {
    const result = LeadsBySourceItemSchema.safeParse({
      source: "website",
      count: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBeDefined();
    }
  });

  test("BookingsByProjectItemSchema: valid data parses", () => {
    const result = BookingsByProjectItemSchema.safeParse({
      projectId: "p1",
      projectName: "Tower A",
      count: 5,
    });
    expect(result.success).toBe(true);
  });

  test("BookingsByProjectItemSchema: rejects missing projectName", () => {
    const result = BookingsByProjectItemSchema.safeParse({
      projectId: "p1",
      count: 5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBeDefined();
    }
  });

  test("PaymentsByMonthItemSchema: valid data parses", () => {
    const result = PaymentsByMonthItemSchema.safeParse({
      month: 3,
      year: 2026,
      totalAmount: 1500000,
    });
    expect(result.success).toBe(true);
  });

  test("PaymentsByMonthItemSchema: rejects month > 12", () => {
    const result = PaymentsByMonthItemSchema.safeParse({
      month: 13,
      year: 2026,
      totalAmount: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBeDefined();
    }
  });

  test("PaymentsByMonthItemSchema: rejects month < 1", () => {
    const result = PaymentsByMonthItemSchema.safeParse({
      month: 0,
      year: 2026,
      totalAmount: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBeDefined();
    }
  });

  test("ConversionFunnelStageSchema: valid data parses", () => {
    const result = ConversionFunnelStageSchema.safeParse({
      stage: "enquiry",
      count: 100,
      conversionRate: 0.5,
    });
    expect(result.success).toBe(true);
  });

  test("ConversionFunnelStageSchema: rejects negative count", () => {
    const result = ConversionFunnelStageSchema.safeParse({
      stage: "enquiry",
      count: -5,
      conversionRate: 0.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBeDefined();
    }
  });

  test("LeadsBySourceResponseSchema: wraps data array", () => {
    const result = LeadsBySourceResponseSchema.safeParse({
      data: [{ source: "email", count: 3 }],
    });
    expect(result.success).toBe(true);
  });

  test("BookingsByProjectItemResponseSchema: wraps data array", () => {
    const result = BookingsByProjectItemResponseSchema.safeParse({
      data: [{ projectId: "p2", projectName: "Lake View", count: 7 }],
    });
    expect(result.success).toBe(true);
  });

  test("PaymentsByMonthResponseSchema: wraps data array", () => {
    const result = PaymentsByMonthResponseSchema.safeParse({
      data: [{ month: 6, year: 2025, totalAmount: 250000 }],
    });
    expect(result.success).toBe(true);
  });

  test("ConversionFunnelSchema: wraps stages array", () => {
    const result = ConversionFunnelSchema.safeParse({
      stages: [{ stage: "booking", count: 15, conversionRate: 0.08 }],
    });
    expect(result.success).toBe(true);
  });
});
