/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useCreateDocumentMutation } from "@/hooks/useCreateDocumentMutation";
import { useDeleteDocumentMutation } from "@/hooks/useDeleteDocumentMutation";

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

describe("useCreateDocumentMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success POSTs JSON body to /api/documents and invalidates documents query", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: "doc-1",
        tenantId: "tenant-1",
        resourceType: "booking",
        resourceId: "booking-1",
        name: "Sale agreement",
        url: "https://files.example.com/sale.pdf",
        fileType: "pdf",
        fileSize: 102400,
        createdAt: "2026-05-17T10:00:00.000Z",
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateDocumentMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        resourceType: "booking",
        resourceId: "booking-1",
        name: "Sale agreement",
        url: "https://files.example.com/sale.pdf",
        fileType: "pdf",
        fileSize: 102400,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/documents");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({
      resourceType: "booking",
      resourceId: "booking-1",
      name: "Sale agreement",
      url: "https://files.example.com/sale.pdf",
      fileType: "pdf",
      fileSize: 102400,
    });

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"documents"'))).toBe(true);
  });

  test("throws descriptive message on 422 validation error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: "Invalid file URL" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCreateDocumentMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          resourceType: "booking",
          resourceId: "booking-1",
          name: "x",
          url: "https://files.example.com/x.pdf",
          fileType: "pdf",
        }),
      ).rejects.toThrow("Invalid file URL");
    });
  });
});

describe("useDeleteDocumentMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success DELETEs /api/documents/:id and invalidates documents query", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteDocumentMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ documentId: "doc-42" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/documents/doc-42");
    expect(init.method).toBe("DELETE");

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"documents"'))).toBe(true);
    expect(calls.some((c) => c.includes('"document"'))).toBe(true);
  });

  test("throws upstream error on 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Document not found" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useDeleteDocumentMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ documentId: "doc-missing" }),
      ).rejects.toThrow("Document not found");
    });
  });
});
