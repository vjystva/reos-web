/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useBulkUpdateUnitStatusMutation } from "@/hooks/useBulkUpdateUnitStatusMutation";
import { bulkStatusEligibility } from "@/lib/unitTransitions";
import {
  BulkResultSchema,
  BulkUnitStatusRequestSchema,
} from "@/types/api";

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

const PROJECT_ID = "project-1";

describe("useBulkUpdateUnitStatusMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("POSTs the items envelope to the bulk BFF route", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        processed: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { id: "u1", success: true },
          { id: "u2", success: true },
        ],
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { result } = renderHook(
      () => useBulkUpdateUnitStatusMutation(PROJECT_ID),
      { wrapper: makeWrapper(client) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        items: [
          { id: "u1", status: "blocked", note: "Floor 12 held" },
          { id: "u2", status: "blocked", note: "Floor 12 held" },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/bulk/units/status");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      items: [
        { id: "u1", status: "blocked", note: "Floor 12 held" },
        { id: "u2", status: "blocked", note: "Floor 12 held" },
      ],
    });
  });

  test("resolves (does not throw) on partial failure and exposes per-item errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        processed: 2,
        succeeded: 1,
        failed: 1,
        results: [
          { id: "u1", success: true },
          { id: "u-missing", success: false, error: "Unit not found" },
        ],
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useBulkUpdateUnitStatusMutation(PROJECT_ID),
      { wrapper: makeWrapper(client) },
    );

    let value;
    await act(async () => {
      value = await result.current.mutateAsync({
        items: [
          { id: "u1", status: "blocked" },
          { id: "u-missing", status: "blocked" },
        ],
      });
    });

    expect(value).toMatchObject({ succeeded: 1, failed: 1 });
    expect(result.current.isError).toBe(false);
  });

  test("invalidates the project's units queries even when nothing succeeded", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        processed: 1,
        succeeded: 0,
        failed: 1,
        results: [{ id: "u1", success: false, error: "Unit is already blocked" }],
      }),
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useBulkUpdateUnitStatusMutation(PROJECT_ID),
      { wrapper: makeWrapper(client) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        items: [{ id: "u1", status: "blocked" }],
      });
    });

    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k.includes(`"units","${PROJECT_ID}"`))).toBe(true);
  });

  test("throws with the upstream message on a 400", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "items must contain no more than 100 elements" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useBulkUpdateUnitStatusMutation(PROJECT_ID),
      { wrapper: makeWrapper(client) },
    );

    await expect(
      result.current.mutateAsync({ items: [{ id: "u1", status: "blocked" }] }),
    ).rejects.toThrow(/no more than 100 elements/);
  });
});

describe("BulkUnitStatusRequestSchema", () => {
  test("accepts a seeded vanity id that zod's .uuid() would reject", () => {
    const parsed = BulkUnitStatusRequestSchema.safeParse({
      items: [{ id: "d1000000-0000-0000-0000-000000000001", status: "blocked" }],
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects an unknown status value", () => {
    const parsed = BulkUnitStatusRequestSchema.safeParse({
      items: [{ id: "u1", status: "sold" }],
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects an empty batch and a >100 batch", () => {
    expect(BulkUnitStatusRequestSchema.safeParse({ items: [] }).success).toBe(
      false,
    );
    const over = Array.from({ length: 101 }, (_, i) => ({
      id: `u${i}`,
      status: "blocked" as const,
    }));
    expect(BulkUnitStatusRequestSchema.safeParse({ items: over }).success).toBe(
      false,
    );
  });

  test("BulkResultSchema accepts a partial-failure payload", () => {
    const parsed = BulkResultSchema.safeParse({
      processed: 2,
      succeeded: 1,
      failed: 1,
      results: [
        { id: "u1", success: true },
        { id: "u2", success: false, error: "Unit not found" },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("bulkStatusEligibility", () => {
  const units = [
    { id: "a", status: "available", unitNumber: "101" },
    { id: "b", status: "blocked", unitNumber: "102" },
    { id: "c", status: "booked", unitNumber: "103" },
    { id: "d", status: "on_hold", unitNumber: "104" },
  ];

  test("Block selected keeps only units that can reach blocked", () => {
    const { eligible, skipped } = bulkStatusEligibility(
      units,
      "blocked",
      "builder_admin",
    );
    expect(eligible.map((u) => u.id)).toEqual(["a", "d"]);
    expect(skipped.find((s) => s.unit.id === "b")?.reason).toMatch(/already/);
    expect(skipped.find((s) => s.unit.id === "c")?.reason).toMatch(/cannot go/);
  });

  test("Release selected keeps only units that can reach available", () => {
    const { eligible } = bulkStatusEligibility(
      units,
      "available",
      "builder_admin",
    );
    expect(eligible.map((u) => u.id)).toEqual(["b", "d"]);
  });

  test("the demo 'admin' role is treated as builder_admin", () => {
    const { eligible } = bulkStatusEligibility(units, "blocked", "admin");
    expect(eligible.map((u) => u.id)).toEqual(["a", "d"]);
  });

  test("a role that cannot reach the target yields no eligible units", () => {
    // sales_agent may block, but may not release back to available.
    const { eligible, skipped } = bulkStatusEligibility(
      units,
      "available",
      "sales_agent",
    );
    expect(eligible).toHaveLength(0);
    expect(skipped).toHaveLength(units.length);
  });
});
