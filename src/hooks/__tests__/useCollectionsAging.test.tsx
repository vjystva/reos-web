/**
 * @jest-environment jsdom
 */
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useCollectionsAging } from "@/hooks/useCollectionsAging";
import { CollectionsAgingReport } from "@/components/CollectionsAgingReport";
import {
  CollectionsAgingResponseSchema,
  CollectionsAgingItemSchema,
  type CollectionsAgingResponse,
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

function mkItem(over: Partial<CollectionsAgingResponse["items"][number]> = {}) {
  return {
    milestoneId: "m-1",
    milestoneName: "20% on Agreement",
    status: "pending",
    bookingId: "bk-1",
    bookingNumber: "REOS-0001",
    bookingStatus: "approved",
    unitId: "u-1",
    unitNumber: "A-102",
    projectId: "p-1",
    projectName: "Skyline Heights",
    customerName: "Ananya Nair",
    dueDate: "2026-06-30",
    daysOverdue: 81,
    outstanding: 2500000,
    bucket: "60-90" as const,
    ...over,
  };
}

/** Mirrors the real seeded response shape observed from the live endpoint. */
const MOCK_RESPONSE: CollectionsAgingResponse = {
  buckets: [
    { bucket: "<30", count: 0, totalOutstanding: 0 },
    { bucket: "30-60", count: 12, totalOutstanding: 23900000 },
    { bucket: "60-90", count: 1, totalOutstanding: 2500000 },
    { bucket: ">90", count: 0, totalOutstanding: 0 },
  ],
  items: [mkItem()],
  totalCount: 13,
  totalOutstanding: 26400000,
  asOf: "2026-09-19",
};

// ---------------------------------------------------------------------------
// useCollectionsAging
// ---------------------------------------------------------------------------
describe("useCollectionsAging", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("fetches from /api/analytics/collections-aging and returns parsed data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_RESPONSE,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCollectionsAging(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.buckets).toHaveLength(4);
    expect(result.current.data?.buckets.map((b) => b.bucket)).toEqual([
      "<30",
      "30-60",
      "60-90",
      ">90",
    ]);
    expect(result.current.data?.totalCount).toBe(13);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/analytics/collections-aging",
    );
  });

  test("forwards limit as a query param", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_RESPONSE,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCollectionsAging(25), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/analytics/collections-aging?limit=25",
    );
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCollectionsAging(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test("throws on a shape mismatch rather than rendering wrong numbers", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ buckets: [{ bucket: "whenever", count: 1 }] }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCollectionsAging(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
describe("CollectionsAging schemas", () => {
  test("the live response shape parses", () => {
    expect(CollectionsAgingResponseSchema.safeParse(MOCK_RESPONSE).success).toBe(
      true,
    );
  });

  test("rejects an unknown bucket label (backend/frontend contract drift)", () => {
    const bad = {
      ...MOCK_RESPONSE,
      buckets: [{ bucket: "0-30", count: 1, totalOutstanding: 1 }],
    };
    expect(CollectionsAgingResponseSchema.safeParse(bad).success).toBe(false);
  });

  test("accepts null booking/unit/project context (LEFT-joined rows)", () => {
    const result = CollectionsAgingItemSchema.safeParse(
      mkItem({
        bookingId: null,
        bookingNumber: null,
        bookingStatus: null,
        unitId: null,
        unitNumber: null,
        projectId: null,
        projectName: null,
        customerName: null,
      }),
    );
    expect(result.success).toBe(true);
  });

  test("rejects a negative bucket count", () => {
    const bad = {
      ...MOCK_RESPONSE,
      buckets: [{ bucket: "<30", count: -1, totalOutstanding: 0 }],
    };
    expect(CollectionsAgingResponseSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CollectionsAgingReport
// ---------------------------------------------------------------------------
describe("CollectionsAgingReport", () => {
  const noop = () => {};

  test("renders all four bucket labels and the grand totals", () => {
    render(
      <CollectionsAgingReport
        data={MOCK_RESPONSE}
        isLoading={false}
        isError={false}
        onRetry={noop}
      />,
    );

    expect(screen.getByText("Under 30 days")).toBeInTheDocument();
    expect(screen.getByText("30–60 days")).toBeInTheDocument();
    expect(screen.getByText("60–90 days")).toBeInTheDocument();
    expect(screen.getByText("Over 90 days")).toBeInTheDocument();
    // ₹2.64 Cr outstanding across 13 overdue milestones
    expect(screen.getByText("₹2.64 Cr")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  test("renders the detail table with unit, days overdue and amount", () => {
    render(
      <CollectionsAgingReport
        data={MOCK_RESPONSE}
        isLoading={false}
        isError={false}
        onRetry={noop}
      />,
    );

    // Scoped to the table: "₹25 L" is also the 60-90 bucket total.
    const table = within(screen.getByRole("table"));
    expect(table.getByText("A-102")).toBeInTheDocument();
    expect(table.getByText("20% on Agreement")).toBeInTheDocument();
    expect(table.getByText("81")).toBeInTheDocument();
    expect(table.getByText("₹25 L")).toBeInTheDocument();
    expect(table.getByText("30 Jun 2026")).toBeInTheDocument();
  });

  test("notes when the detail list is truncated relative to totalCount", () => {
    render(
      <CollectionsAgingReport
        data={MOCK_RESPONSE}
        isLoading={false}
        isError={false}
        onRetry={noop}
      />,
    );
    // 1 item returned against a totalCount of 13.
    expect(
      screen.getByText("Showing 1 of 13, most overdue first"),
    ).toBeInTheDocument();
  });

  test("shows an explicit nothing-overdue state instead of four empty bars", () => {
    render(
      <CollectionsAgingReport
        data={{
          buckets: [
            { bucket: "<30", count: 0, totalOutstanding: 0 },
            { bucket: "30-60", count: 0, totalOutstanding: 0 },
            { bucket: "60-90", count: 0, totalOutstanding: 0 },
            { bucket: ">90", count: 0, totalOutstanding: 0 },
          ],
          items: [],
          totalCount: 0,
          totalOutstanding: 0,
          asOf: "2026-09-19",
        }}
        isLoading={false}
        isError={false}
        onRetry={noop}
      />,
    );
    expect(screen.getByText(/Nothing overdue/)).toBeInTheDocument();
    expect(screen.queryByText("Under 30 days")).not.toBeInTheDocument();
  });

  test("flags a cancelled booking's receivable rather than hiding it", () => {
    render(
      <CollectionsAgingReport
        data={{
          ...MOCK_RESPONSE,
          items: [mkItem({ bookingStatus: "cancelled" })],
        }}
        isLoading={false}
        isError={false}
        onRetry={noop}
      />,
    );
    expect(screen.getByText("cancelled")).toBeInTheDocument();
    expect(screen.getByText("REOS-0001")).toBeInTheDocument();
  });

  test("renders an em dash for rows with no unit/booking context", () => {
    render(
      <CollectionsAgingReport
        data={{
          ...MOCK_RESPONSE,
          items: [
            mkItem({
              unitNumber: null,
              projectName: null,
              bookingNumber: null,
              customerName: null,
            }),
          ],
        }}
        isLoading={false}
        isError={false}
        onRetry={noop}
      />,
    );
    const table = within(screen.getByRole("table"));
    expect(table.getAllByText("—")).toHaveLength(2);
    // The money is still shown.
    expect(table.getByText("₹25 L")).toBeInTheDocument();
  });

  test("shows an error banner with a retry", () => {
    const onRetry = jest.fn();
    render(
      <CollectionsAgingReport
        data={undefined}
        isLoading={false}
        isError
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load collections aging.",
    );
  });
});
