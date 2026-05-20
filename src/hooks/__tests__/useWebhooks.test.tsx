/** @jest-environment jsdom */
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWebhookEndpoints } from "../useWebhookEndpoints";
import { useWebhookDeliveries } from "../useWebhookDeliveries";
import { useRegisterEndpointMutation } from "../useRegisterEndpointMutation";
import { useDeleteEndpointMutation } from "../useDeleteEndpointMutation";
import { RegisterEndpointRequestSchema } from "@/types/api";

function mockFetch(body: unknown, ok = true, status?: number) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: status ?? (ok ? 200 : 400),
    json: () => Promise.resolve(body),
  }) as jest.Mock;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const ENDPOINT = {
  id: "ep1",
  tenantId: "ten1",
  url: "https://example.com/webhook",
  events: ["lead_created", "booking_created"],
  isActive: true,
  createdAt: "2026-05-19T10:00:00Z",
};

const DELIVERY = {
  id: "del1",
  endpointId: "ep1",
  eventType: "lead_created",
  status: "success",
  attempts: 1,
  responseStatus: 200,
  nextRetryAt: null,
  createdAt: "2026-05-19T10:00:00Z",
};

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// useWebhookEndpoints
// ---------------------------------------------------------------------------

describe("useWebhookEndpoints", () => {
  it("fetches and returns endpoint list", async () => {
    mockFetch({ data: [ENDPOINT], total: 1 });
    const { result } = renderHook(() => useWebhookEndpoints(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].url).toBe("https://example.com/webhook");
  });

  it("hits /api/webhooks/endpoints", async () => {
    mockFetch({ data: [], total: 0 });
    renderHook(() => useWebhookEndpoints(), { wrapper });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("/api/webhooks/endpoints");
  });
});

// ---------------------------------------------------------------------------
// useWebhookDeliveries
// ---------------------------------------------------------------------------

describe("useWebhookDeliveries", () => {
  it("fetches deliveries without filters", async () => {
    mockFetch({ data: [DELIVERY], total: 1 });
    const { result } = renderHook(() => useWebhookDeliveries(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].eventType).toBe("lead_created");
  });

  it("passes endpointId filter in query string", async () => {
    mockFetch({ data: [], total: 0 });
    renderHook(() => useWebhookDeliveries({ endpointId: "ep1" }), { wrapper });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("endpointId=ep1");
  });

  it("passes status filter in query string", async () => {
    mockFetch({ data: [], total: 0 });
    renderHook(
      () => useWebhookDeliveries({ status: "failed" }),
      { wrapper },
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("status=failed");
  });

  it("passes page in query string", async () => {
    mockFetch({ data: [], total: 0 });
    renderHook(() => useWebhookDeliveries({ page: 2 }), { wrapper });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("page=2");
  });
});

// ---------------------------------------------------------------------------
// useRegisterEndpointMutation
// ---------------------------------------------------------------------------

describe("useRegisterEndpointMutation", () => {
  it("POSTs to /api/webhooks/endpoints", async () => {
    mockFetch(ENDPOINT);
    const { result } = renderHook(() => useRegisterEndpointMutation(), {
      wrapper,
    });
    await result.current.mutateAsync({
      url: "https://example.com/webhook",
      secret: "supersecretvalue1234",
      events: ["lead_created"],
    });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("/api/webhooks/endpoints");
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(opts?.method).toBe("POST");
  });

  it("invalidates webhook-endpoints cache on success", async () => {
    mockFetch(ENDPOINT);
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const spy = jest.spyOn(qc, "invalidateQueries");
    const testWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRegisterEndpointMutation(), {
      wrapper: testWrapper,
    });
    await result.current.mutateAsync({
      url: "https://example.com/webhook",
      secret: "supersecretvalue1234",
      events: ["lead_created"],
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["webhook-endpoints"] }),
    );
  });
});

// ---------------------------------------------------------------------------
// useDeleteEndpointMutation
// ---------------------------------------------------------------------------

describe("useDeleteEndpointMutation", () => {
  it("sends DELETE to /api/webhooks/endpoints/:id", async () => {
    mockFetch({ ok: true });
    const { result } = renderHook(() => useDeleteEndpointMutation(), {
      wrapper,
    });
    await result.current.mutateAsync("ep1");
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("/api/webhooks/endpoints/ep1");
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(opts?.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// RegisterEndpointRequestSchema validation
// ---------------------------------------------------------------------------

describe("RegisterEndpointRequestSchema validation", () => {
  it("accepts valid input", () => {
    const result = RegisterEndpointRequestSchema.safeParse({
      url: "https://example.com/hook",
      secret: "thisisavalidsecret",
      events: ["lead_created"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty url", () => {
    const result = RegisterEndpointRequestSchema.safeParse({
      url: "",
      secret: "thisisavalidsecret",
      events: ["lead_created"],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBeTruthy();
  });

  it("rejects invalid url (not a URL)", () => {
    const result = RegisterEndpointRequestSchema.safeParse({
      url: "not-a-url",
      secret: "thisisavalidsecret",
      events: ["lead_created"],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("URL");
  });

  it("rejects secret shorter than 16 characters", () => {
    const result = RegisterEndpointRequestSchema.safeParse({
      url: "https://example.com/hook",
      secret: "tooshort",
      events: ["lead_created"],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/16/);
  });

  it("rejects empty events array", () => {
    const result = RegisterEndpointRequestSchema.safeParse({
      url: "https://example.com/hook",
      secret: "thisisavalidsecret",
      events: [],
    });
    expect(result.success).toBe(false);
  });
});
