/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useConfirmVisitMutation } from "@/hooks/useConfirmVisitMutation";
import { useRescheduleVisitMutation } from "@/hooks/useRescheduleVisitMutation";
import { useCancelVisitMutation } from "@/hooks/useCancelVisitMutation";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

describe("useConfirmVisitMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success invalidates site-visits, site-visit, and history queries", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useConfirmVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ visitId: "v-1", bookingId: "bk-1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes("site-visits"))).toBe(true);
    expect(calls.some((c) => c.includes('"site-visit"'))).toBe(true);
    expect(calls.some((c) => c.includes("site-visit-history"))).toBe(true);
  });

  test("calls POST /api/site-visits/<id>/confirm", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { result } = renderHook(() => useConfirmVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ visitId: "v-42", bookingId: "bk-1" });
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/site-visits/v-42/confirm");
    expect(init.method).toBe("POST");
  });

  test("throws permission error on 403", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "forbidden" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useConfirmVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ visitId: "v-1", bookingId: "bk-1" }),
      ).rejects.toThrow("You do not have permission");
    });
  });

  test("throws on non-ok response with upstream message", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: "Visit already confirmed" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useConfirmVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ visitId: "v-1", bookingId: "bk-1" }),
      ).rejects.toThrow("Visit already confirmed");
    });
  });
});

describe("useRescheduleVisitMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success invalidates site-visits and per-visit queries", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRescheduleVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        visitId: "v-1",
        bookingId: "bk-1",
        body: { visitDate: "2026-06-01T10:00:00.000Z", notes: "moved" },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes("site-visits"))).toBe(true);
    expect(calls.some((c) => c.includes("site-visit-history"))).toBe(true);
  });

  test("posts JSON body to reschedule endpoint", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { result } = renderHook(() => useRescheduleVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        visitId: "v-7",
        bookingId: "bk-1",
        body: { visitDate: "2026-06-01T10:00:00.000Z" },
      });
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/site-visits/v-7/reschedule");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ visitDate: "2026-06-01T10:00:00.000Z" });
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: "Visit date in the past" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRescheduleVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          visitId: "v-1",
          bookingId: "bk-1",
          body: { visitDate: "2020-01-01T00:00:00.000Z" },
        }),
      ).rejects.toThrow("Visit date in the past");
    });
  });
});

describe("useCancelVisitMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success invalidates site-visits and per-visit queries", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCancelVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        visitId: "v-1",
        bookingId: "bk-1",
        body: { reason: "Customer not interested" },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes("site-visits"))).toBe(true);
    expect(calls.some((c) => c.includes('"site-visit"'))).toBe(true);
  });

  test("posts reason to cancel endpoint", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { result } = renderHook(() => useCancelVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        visitId: "v-9",
        bookingId: "bk-1",
        body: { reason: "Customer not interested" },
      });
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/site-visits/v-9/cancel");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ reason: "Customer not interested" });
  });

  test("throws on non-ok response with error string", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Cannot cancel completed visit" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCancelVisitMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          visitId: "v-1",
          bookingId: "bk-1",
          body: { reason: "test" },
        }),
      ).rejects.toThrow("Cannot cancel completed visit");
    });
  });
});
