/** @jest-environment jsdom */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const mockNotifications = [
  {
    id: "n1",
    type: "lead_assigned",
    title: "New lead assigned",
    body: "A lead has been assigned to you.",
    isRead: false,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: "n2",
    type: "booking_created",
    title: "Booking confirmed",
    body: null,
    isRead: true,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: "n3",
    type: "payment_due",
    title: "Payment due",
    body: "A payment milestone is due.",
    isRead: false,
    createdAt: new Date(Date.now() - 120_000).toISOString(),
  },
];

const mockResponse = {
  data: mockNotifications,
  total: mockNotifications.length,
};

describe("useNotifications", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches notifications list from /api/notifications", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(3);
    expect(result.current.data?.data[0].id).toBe("n1");
    expect(result.current.data?.data[0].title).toBe("New lead assigned");
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/notifications",
    );
  });

  test("appends query string when params are provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0 }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useNotifications({ unreadOnly: true, limit: 10 }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("unreadOnly=true");
    expect(calledUrl).toContain("limit=10");
  });

  test("handles errors — isError is true on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  test("handles schema mismatch — throws notifications_shape_mismatch", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: true }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "notifications_shape_mismatch",
    );
  });

  test("unread count computed correctly from data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const unreadCount =
      result.current.data?.data.filter((n) => !n.isRead).length ?? 0;
    expect(unreadCount).toBe(2);
  });
});

describe("useMarkNotificationRead", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("sends PATCH to /api/notifications/:id/read", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync("n1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [calledUrl, calledInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(calledUrl).toBe("/api/notifications/n1/read");
    expect((calledInit as RequestInit).method).toBe("PATCH");
  });

  test("throws on non-ok mark-read response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("n-missing");
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain(
      "mark_read_failed_404",
    );
  });

  test("on success invalidates notifications queries", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync("n2");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k.includes("notifications"))).toBe(true);
  });
});
