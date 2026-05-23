/** @jest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useProjectUnits } from "@/hooks/useProjectUnits";

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
    },
  });
}

const MOCK_UNITS_RESPONSE = {
  data: [
    {
      id: "unit-1",
      unitNumber: "A-101",
      floor: 1,
      bedrooms: 2,
      area: 850,
      areaSqft: 850,
      status: "available",
      effectivePrice: 8500000,
      listPrice: 8500000,
      projectId: "proj-1",
    },
    {
      id: "unit-2",
      unitNumber: "B-201",
      floor: 2,
      bedrooms: 3,
      area: 1200,
      areaSqft: 1200,
      status: "booked",
      effectivePrice: 12000000,
      listPrice: 12000000,
      projectId: "proj-1",
    },
    {
      id: "unit-3",
      unitNumber: "A-102",
      floor: 1,
      bedrooms: 2,
      area: 900,
      areaSqft: 900,
      status: "sold",
      effectivePrice: 9000000,
      listPrice: null,
      projectId: "proj-1",
    },
  ],
  total: 3,
};

describe("useProjectUnits", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    jest.clearAllMocks();
  });

  afterEach(() => client.clear());

  test("fetches units for a project and returns data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_UNITS_RESPONSE,
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits("proj-1"),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(3);
    expect(result.current.data?.total).toBe(3);
    expect(result.current.data?.data[0].unitNumber).toBe("A-101");
    expect(global.fetch as jest.Mock).toHaveBeenCalledWith(
      "/api/projects/proj-1/units",
    );
  });

  test("applies status filter in the URL query string", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [MOCK_UNITS_RESPONSE.data[0]],
        total: 1,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits("proj-1", { status: "available" }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("status=available");
    expect(result.current.data?.data[0].status).toBe("available");
  });

  test("applies floor filter in the URL query string", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [MOCK_UNITS_RESPONSE.data[0], MOCK_UNITS_RESPONSE.data[2]],
        total: 2,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits("proj-1", { floor: 1 }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("floor=1");
    expect(result.current.data?.data).toHaveLength(2);
  });

  test("applies both status and floor filters together", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [MOCK_UNITS_RESPONSE.data[0]],
        total: 1,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits("proj-1", { status: "available", floor: 1 }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("status=available");
    expect(calledUrl).toContain("floor=1");
  });

  test("handles empty result — returns empty data array", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], total: 0 }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits("proj-1", { status: "blocked" }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(0);
    expect(result.current.data?.total).toBe(0);
  });

  test("handles 401 — enters error state with status in message", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits("proj-1"),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain("401");
  });

  test("handles shape mismatch — throws project_units_shape_mismatch", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ broken: true }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits("proj-1"),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as Error).message).toBe(
      "project_units_shape_mismatch",
    );
  });

  test("does not fetch when projectId is falsy", () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits(null),
      { wrapper: makeWrapper(client) },
    );

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("uses correct base URL without trailing query string when no filters", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_UNITS_RESPONSE,
    }) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useProjectUnits("proj-abc"),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toBe("/api/projects/proj-abc/units");
  });
});
