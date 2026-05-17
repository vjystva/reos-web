/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useUpdateLeadMutation } from "@/hooks/useUpdateLeadMutation";
import { useConvertLeadMutation } from "@/hooks/useConvertLeadMutation";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useUpdateLeadMutation", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("success: PATCH /api/leads/:id called and queries invalidated", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateLeadMutation("lead-1"), { wrapper: makeWrapper(client) });
    await act(async () => { await result.current.mutateAsync({ stage: "contacted" }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/leads/lead-1");
    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k.includes("leads"))).toBe(true);
  });

  test("error (404): throws with status code", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    const { result } = renderHook(() => useUpdateLeadMutation("lead-x"), { wrapper: makeWrapper(client) });
    await expect(act(async () => { await result.current.mutateAsync({ stage: "lost" }); })).rejects.toThrow("update_lead_failed_404");
  });
});

describe("useConvertLeadMutation", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("success: POST /api/leads/:id/convert called and leads invalidated", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useConvertLeadMutation(), { wrapper: makeWrapper(client) });
    await act(async () => { await result.current.mutateAsync("lead-2"); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/leads/lead-2/convert");
    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k.includes("leads"))).toBe(true);
  });

  test("error (409 already converted): throws", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 409 }) as unknown as typeof fetch;
    const { result } = renderHook(() => useConvertLeadMutation(), { wrapper: makeWrapper(client) });
    await expect(act(async () => { await result.current.mutateAsync("lead-3"); })).rejects.toThrow("convert_lead_failed_409");
  });
});
