/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useRecordPaymentMutation } from "@/hooks/useRecordPaymentMutation";
import { useBounceMutation } from "@/hooks/useBounceMutation";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useRecordPaymentMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success invalidates milestones, payments, and schedule queries", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "pay-1", receiptNumber: "RCP-001" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRecordPaymentMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        body: {
          bookingId: "bk-1",
          milestoneId: "ms-1",
          amount: 50000,
          paymentDate: "2026-01-05",
          paymentMode: "neft",
        },
        scheduleId: "sched-1",
        bookingId: "bk-1",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => JSON.stringify(c).includes("payment-milestones"))).toBe(true);
    expect(calls.some((c) => JSON.stringify(c).includes('"payments"'))).toBe(true);
    expect(calls.some((c) => JSON.stringify(c).includes("payment-schedule"))).toBe(true);
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: "Milestone already paid" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRecordPaymentMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          body: {
            bookingId: "bk-1",
            milestoneId: "ms-1",
            amount: 1000,
            paymentDate: "2026-01-05",
            paymentMode: "cash",
          },
          scheduleId: "sched-1",
          bookingId: "bk-1",
        }),
      ).rejects.toThrow("Milestone already paid");
    });
  });

  test("throws unauthorized error on 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRecordPaymentMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          body: {
            bookingId: "bk-1",
            milestoneId: "ms-1",
            amount: 1000,
            paymentDate: "2026-01-05",
            paymentMode: "cash",
          },
          scheduleId: "sched-1",
          bookingId: "bk-1",
        }),
      ).rejects.toThrow("unauthorized");
    });
  });
});

describe("useBounceMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success invalidates milestones, payments queries", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useBounceMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        paymentId: "pay-1",
        scheduleId: "sched-1",
        bookingId: "bk-1",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => JSON.stringify(c).includes("payment-milestones"))).toBe(true);
    expect(calls.some((c) => JSON.stringify(c).includes('"payments"'))).toBe(true);
  });

  test("throws on 403 forbidden", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBounceMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          paymentId: "pay-1",
          scheduleId: "sched-1",
          bookingId: "bk-1",
        }),
      ).rejects.toThrow("You do not have permission");
    });
  });
});
