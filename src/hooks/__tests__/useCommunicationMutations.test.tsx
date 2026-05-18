/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useCreateTemplateMutation } from "@/hooks/useCreateTemplateMutation";
import { useUpdateTemplateMutation } from "@/hooks/useUpdateTemplateMutation";
import { useDeleteTemplateMutation } from "@/hooks/useDeleteTemplateMutation";
import { useSendCommunicationMutation } from "@/hooks/useSendCommunicationMutation";

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

describe("useCreateTemplateMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success POSTs JSON body and invalidates communication-templates", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: "tpl-1",
        name: "Welcome",
        channel: "email",
        bodyTemplate: "Hello",
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: "Welcome",
        channel: "email",
        bodyTemplate: "Hello",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/communications/templates");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "Welcome",
      channel: "email",
      bodyTemplate: "Hello",
    });

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"communication-templates"'))).toBe(
      true,
    );
  });

  test("throws upstream error message on 400", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Name is required" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          name: "",
          channel: "email",
          bodyTemplate: "x",
        }),
      ).rejects.toThrow("Name is required");
    });
  });
});

describe("useUpdateTemplateMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success PATCHes and invalidates communication-templates", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "t-1",
        name: "Renamed",
        channel: "email",
        bodyTemplate: "Hi",
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateTemplateMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "t-1",
        body: { name: "Renamed" },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/communications/templates/t-1");
    expect(init.method).toBe("PATCH");

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"communication-templates"'))).toBe(
      true,
    );
  });

  test("throws upstream error on 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Template not found" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useUpdateTemplateMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: "missing",
          body: { name: "x" },
        }),
      ).rejects.toThrow("Template not found");
    });
  });
});

describe("useDeleteTemplateMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success DELETEs and invalidates communication-templates", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteTemplateMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "t-9" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/communications/templates/t-9");
    expect(init.method).toBe("DELETE");

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"communication-templates"'))).toBe(
      true,
    );
  });

  test("throws permission error on 403", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "forbidden" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useDeleteTemplateMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: "t-1" }),
      ).rejects.toThrow(/permission/i);
    });
  });
});

describe("useSendCommunicationMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success POSTs to /communications/send and invalidates communication-logs", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "log-1",
        channel: "sms",
        recipient: "+15551234567",
        status: "queued",
        createdAt: "2026-05-18T12:00:00.000Z",
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSendCommunicationMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        channel: "sms",
        recipient: "+15551234567",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/communications/send");
    expect(init.method).toBe("POST");

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"communication-logs"'))).toBe(true);
  });

  test("throws generic error on 500", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useSendCommunicationMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          channel: "email",
          recipient: "a@b.co",
        }),
      ).rejects.toThrow("internal");
    });
  });
});
