/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useGenerateReportMutation } from "@/hooks/useGenerateReportMutation";
import { useReportJobs } from "@/hooks/useReportJobs";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useGenerateReportMutation", () => {
  let client: QueryClient;
  beforeEach(() => { client = new QueryClient({ defaultOptions: { mutations: { retry: false } } }); jest.clearAllMocks(); });
  afterEach(() => client.clear());

  test("success: POST /api/reports called, invalidates reports", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ jobId: "j1", status: "queued", reportType: "leads", format: "csv", createdAt: new Date().toISOString() }) }) as unknown as typeof fetch;
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useGenerateReportMutation(), { wrapper: makeWrapper(client) });
    await act(async () => { await result.current.mutateAsync({ reportType: "leads", format: "csv" }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/reports");
    expect(invalidateSpy.mock.calls.some((c) => JSON.stringify(c[0]).includes("reports"))).toBe(true);
  });

  test("error (400): throws", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;
    const { result } = renderHook(() => useGenerateReportMutation(), { wrapper: makeWrapper(client) });
    await expect(act(async () => { await result.current.mutateAsync({ reportType: "leads", format: "csv" }); })).rejects.toThrow();
  });
});

describe("useReportJobs", () => {
  let client: QueryClient;
  beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); jest.clearAllMocks(); });
  afterEach(() => client.clear());

  test("success: fetches /api/reports and returns jobs", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ jobs: [{ jobId: "j1", status: "completed", reportType: "leads", format: "csv", createdAt: new Date().toISOString() }] }) }) as unknown as typeof fetch;
    const { result } = renderHook(() => useReportJobs(), { wrapper: makeWrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.jobs).toHaveLength(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/reports");
  });

  test("handles empty response: returns jobs=[]", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ jobs: [] }) }) as unknown as typeof fetch;
    const { result } = renderHook(() => useReportJobs(), { wrapper: makeWrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.jobs).toHaveLength(0);
  });
});
