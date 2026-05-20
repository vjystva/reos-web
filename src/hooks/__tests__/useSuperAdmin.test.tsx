/** @jest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useTenantsAdmin } from "../useTenantsAdmin";
import { useSystemStats } from "../useSystemStats";
import { useCreateTenantMutation } from "../useCreateTenantMutation";
import { useUpdateTenantMutation } from "../useUpdateTenantMutation";
import { useDeactivateTenantMutation } from "../useDeactivateTenantMutation";
import { CreateTenantRequestSchema, UpdateTenantRequestSchema } from "@/types/api";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function mockFetch(body: unknown, ok = true, status = ok ? 200 : 400) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as jest.Mock;
}

afterEach(() => jest.resetAllMocks());

// --- useTenantsAdmin ------------------------------------------------------

describe("useTenantsAdmin", () => {
  it("fetches tenant list", async () => {
    const payload = { data: [{ id: "t1", name: "Acme", slug: "acme", plan: "starter", isActive: true }], total: 1 };
    mockFetch(payload);
    const { result } = renderHook(() => useTenantsAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
  });

  it("sends plan filter as query param", async () => {
    mockFetch({ data: [], total: 0 });
    const { result } = renderHook(() => useTenantsAdmin({ plan: "enterprise" }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("plan=enterprise");
  });

  it("sends isActive filter as query param", async () => {
    mockFetch({ data: [], total: 0 });
    const { result } = renderHook(() => useTenantsAdmin({ isActive: false }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("isActive=false");
  });

  it("errors when fetch fails", async () => {
    mockFetch({ error: "upstream_error" }, false, 500);
    const { result } = renderHook(() => useTenantsAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// --- useSystemStats -------------------------------------------------------

describe("useSystemStats", () => {
  it("fetches system stats", async () => {
    const stats = { totalTenants: 5, activeTenants: 4, totalLeads: 120, totalBookings: 30 };
    mockFetch(stats);
    const { result } = renderHook(() => useSystemStats(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalTenants).toBe(5);
  });
});

// --- useCreateTenantMutation ----------------------------------------------

describe("useCreateTenantMutation", () => {
  it("posts to /api/super-admin/tenants", async () => {
    const tenant = { id: "t-new", name: "New Corp", slug: "new-corp", plan: "professional", isActive: true };
    mockFetch(tenant, true, 201);
    const { result } = renderHook(() => useCreateTenantMutation(), { wrapper: wrapper() });
    result.current.mutate({ name: "New Corp", slug: "new-corp", plan: "professional" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe("/api/super-admin/tenants");
    expect(call[1].method).toBe("POST");
  });

  it("throws on failure", async () => {
    mockFetch({ error: "conflict" }, false, 409);
    const { result } = renderHook(() => useCreateTenantMutation(), { wrapper: wrapper() });
    result.current.mutate({ name: "X", slug: "x", plan: "starter" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// --- useUpdateTenantMutation ----------------------------------------------

describe("useUpdateTenantMutation", () => {
  it("patches tenant by id", async () => {
    const tenant = { id: "t1", name: "Updated", slug: "acme", plan: "enterprise", isActive: true };
    mockFetch(tenant);
    const { result } = renderHook(() => useUpdateTenantMutation(), { wrapper: wrapper() });
    result.current.mutate({ id: "t1", name: "Updated", plan: "enterprise" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe("/api/super-admin/tenants/t1");
    expect(call[1].method).toBe("PATCH");
  });
});

// --- useDeactivateTenantMutation ------------------------------------------

describe("useDeactivateTenantMutation", () => {
  it("sends DELETE to tenant endpoint", async () => {
    const tenant = { id: "t1", name: "Acme", slug: "acme", plan: "starter", isActive: false };
    mockFetch(tenant);
    const { result } = renderHook(() => useDeactivateTenantMutation(), { wrapper: wrapper() });
    result.current.mutate("t1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe("/api/super-admin/tenants/t1");
    expect(call[1].method).toBe("DELETE");
  });
});

// --- Zod schema validation ------------------------------------------------

describe("CreateTenantRequestSchema", () => {
  it("accepts valid input", () => {
    const r = CreateTenantRequestSchema.safeParse({ name: "Acme", slug: "acme-corp", plan: "starter" });
    expect(r.success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = CreateTenantRequestSchema.safeParse({ name: "", slug: "acme", plan: "starter" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/required/i);
  });

  it("rejects slug with spaces", () => {
    const r = CreateTenantRequestSchema.safeParse({ name: "Acme", slug: "acme corp", plan: "starter" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid plan", () => {
    const r = CreateTenantRequestSchema.safeParse({ name: "Acme", slug: "acme", plan: "gold" });
    expect(r.success).toBe(false);
  });
});

describe("UpdateTenantRequestSchema", () => {
  it("allows partial updates", () => {
    const r = UpdateTenantRequestSchema.safeParse({ plan: "enterprise" });
    expect(r.success).toBe(true);
  });

  it("accepts empty object", () => {
    const r = UpdateTenantRequestSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});
