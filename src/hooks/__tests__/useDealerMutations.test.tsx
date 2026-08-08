/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useCreateDealerMutation } from "@/hooks/useCreateDealerMutation";
import { useUpdateDealerMutation } from "@/hooks/useUpdateDealerMutation";
import { useDeactivateDealerMutation } from "@/hooks/useDeactivateDealerMutation";

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

describe("useCreateDealerMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success POSTs JSON body and invalidates dealers query", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: "dealer-1",
        tenantId: "tenant-1",
        name: "Acme Realty",
        status: "active",
        createdAt: "2026-05-17T10:00:00.000Z",
        updatedAt: "2026-05-17T10:00:00.000Z",
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateDealerMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: "Acme Realty",
        email: "contact@acme.example",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/dealers");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "Acme Realty",
      email: "contact@acme.example",
    });

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"dealers"'))).toBe(true);
  });

  test("throws with upstream message on 400 response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Name required" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCreateDealerMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        // `email` is part of CreateDealerRequest — the backend's
        // CreateDealerDto requires it and `dealers.email` is NOT NULL. The
        // upstream 400 under test here is about `name`.
        result.current.mutateAsync({ name: "", email: "partner@example.com" }),
      ).rejects.toThrow("Name required");
    });
  });
});

describe("useUpdateDealerMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success PATCHes to /api/dealers/:id and invalidates dealers + dealer queries", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateDealerMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        dealerId: "dealer-42",
        body: { company: "Bengaluru South Realty" },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/dealers/dealer-42");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ company: "Bengaluru South Realty" });

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"dealers"'))).toBe(true);
    expect(calls.some((c) => c.includes('"dealer-42"'))).toBe(true);
  });
});

describe("useDeactivateDealerMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success PATCHes status=inactive to /api/dealers/:id and invalidates dealers query", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeactivateDealerMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ dealerId: "dealer-9" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/dealers/dealer-9");
    // Backend has no DELETE /dealers/:id — deactivation is a status PATCH.
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "inactive" });

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"dealers"'))).toBe(true);
  });
});
