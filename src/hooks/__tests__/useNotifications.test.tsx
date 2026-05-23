/** @jest-environment jsdom */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
} from "@/hooks/useNotifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Mock data
// ---------------------------------------------------------------------------

const mockNotifications = [
  {
    id: "n1",
    type: "lead",
    title: "New lead assigned",
    body: "A lead has been assigned to you.",
    isRead: false,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: "n2",
    type: "booking",
    title: "Booking confirmed",
    body: null,
    isRead: true,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: "n3",
    type: "task",
    title: "Task due",
    body: "A task is due today.",
    isRead: false,
    createdAt: new Date(Date.now() - 120_000).toISOString(),
  },
];

const mockResponse = {
  data: mockNotifications,
  total: mockNotifications.length,
};

// ---------------------------------------------------------------------------
// useNotifications
// ---------------------------------------------------------------------------

describe("useNotifications", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
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
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toBe("/api/notifications");
  });

  test("handles 401 error — isError is true", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain(
      "notifications_fetch_failed_401",
    );
  });

  test("filters by type param — appends type query string", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockNotifications[0]], total: 1 }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useNotifications("lead"), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("type=lead");
  });

  test("handles empty array — data.data is []", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0 }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useMarkRead
// ---------------------------------------------------------------------------

describe("useMarkRead", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("useMarkRead calls correct endpoint — POST /api/notifications/:id/read", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMarkRead(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync("n1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [calledUrl, calledInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(calledUrl).toBe("/api/notifications/n1/read");
    expect((calledInit as RequestInit).method).toBe("POST");
  });

  test("useMarkRead throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMarkRead(), {
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
});

// ---------------------------------------------------------------------------
// useMarkAllRead
// ---------------------------------------------------------------------------

describe("useMarkAllRead", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("useMarkAllRead calls correct endpoint — POST /api/notifications/read-all", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMarkAllRead(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [calledUrl, calledInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(calledUrl).toBe("/api/notifications/read-all");
    expect((calledInit as RequestInit).method).toBe("POST");
  });

  test("useMarkAllRead throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMarkAllRead(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain(
      "mark_all_read_failed_500",
    );
  });
});
