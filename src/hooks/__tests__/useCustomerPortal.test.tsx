/** @jest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useCustomerBookings,
  useCustomerBooking,
  useCustomerPayments,
  useCustomerDocuments,
  useCustomerSiteVisits,
} from "../useCustomerPortal";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

const bookingSummary = {
  id: "b1",
  bookingRef: "BK-001",
  status: "confirmed",
  unitId: "u1",
  totalAmount: "500000",
  collectedAmount: "100000",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("useCustomerBookings", () => {
  it("fetches booking list (array)", async () => {
    mockFetch([bookingSummary]);
    const { result } = renderHook(() => useCustomerBookings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("errors on failed fetch", async () => {
    mockFetch({}, false, 401);
    const { result } = renderHook(() => useCustomerBookings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCustomerBooking", () => {
  it("fetches single booking by id", async () => {
    mockFetch(bookingSummary);
    const { result } = renderHook(() => useCustomerBooking("b1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("/b1");
  });

  it("errors on not found", async () => {
    mockFetch({ error: "not_found" }, false, 404);
    const { result } = renderHook(() => useCustomerBooking("ghost"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCustomerPayments", () => {
  it("fetches payment schedule for booking", async () => {
    const schedule = {
      id: "ps1",
      bookingId: "b1",
      totalAmount: "500000",
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      milestones: [],
    };
    mockFetch(schedule);
    const { result } = renderHook(() => useCustomerPayments("b1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("b1");
  });
});

describe("useCustomerDocuments", () => {
  it("fetches documents array for booking", async () => {
    const doc = {
      id: "d1",
      name: "Agreement.pdf",
      type: "agreement",
      mimeType: "application/pdf",
      url: "https://example.com/doc.pdf",
      resourceType: "booking",
      resourceId: "b1",
      createdAt: "2026-01-01T00:00:00Z",
    };
    mockFetch([doc]);
    const { result } = renderHook(() => useCustomerDocuments("b1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe("useCustomerSiteVisits", () => {
  it("fetches site visits array for booking", async () => {
    const visit = {
      id: "v1",
      projectId: "p1",
      unitId: "u1",
      scheduledAt: "2026-06-01T10:00:00Z",
      status: "scheduled",
      notes: null,
    };
    mockFetch([visit]);
    const { result } = renderHook(() => useCustomerSiteVisits("b1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
