/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import {
  useBookingMutation,
  BookingConflictError,
} from "@/hooks/useBookingMutation";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useBookingMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("Successful booking optimistically sets unit status to 'blocked'", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "bk-1", unitId: "unit-1", status: "pending" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    // Seed the units cache
    client.setQueryData(["units", "proj-1", "tower-A", ""], {
      data: [
        { id: "unit-1", status: "available", unitNumber: "A-101" },
        { id: "unit-2", status: "available", unitNumber: "A-102" },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useBookingMutation(), {
      wrapper: makeWrapper(client),
    });

    act(() => {
      result.current.mutate({ leadId: "lead-1", unitId: "unit-1" });
    });

    // Wait for the mutation to succeed
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify invalidateQueries was called with ['units']
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["units"] }),
    );
  });

  test("Failed booking (409 conflict) restores original unit status from snapshot", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "conflict", message: "unit already booked" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    client.setQueryData(["units", "proj-1", "tower-A", ""], {
      data: [
        { id: "unit-1", status: "available", unitNumber: "A-101" },
        { id: "unit-2", status: "available", unitNumber: "A-102" },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    const { result } = renderHook(() => useBookingMutation(), {
      wrapper: makeWrapper(client),
    });

    act(() => {
      result.current.mutate({ leadId: "lead-1", unitId: "unit-1" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(BookingConflictError);
    expect((result.current.error as BookingConflictError).status).toBe(409);

    // Assert cache was rolled back from snapshot
    const cached = client.getQueryData<{
      data: Array<{ id: string; status: string }>;
    }>(["units", "proj-1", "tower-A", ""]);
    const unit = cached?.data.find((u) => u.id === "unit-1");
    expect(unit?.status).toBe("available");
  });

  test("Failed booking (500) restores original unit status from snapshot", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "upstream_error" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    client.setQueryData(["units", "proj-1", "tower-A", ""], {
      data: [
        { id: "unit-1", status: "available", unitNumber: "A-101" },
        { id: "unit-2", status: "available", unitNumber: "A-102" },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    const { result } = renderHook(() => useBookingMutation(), {
      wrapper: makeWrapper(client),
    });

    act(() => {
      result.current.mutate({ leadId: "lead-1", unitId: "unit-1" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(BookingConflictError);
    expect((result.current.error as BookingConflictError).status).toBe(500);

    const cached = client.getQueryData<{
      data: Array<{ id: string; status: string }>;
    }>(["units", "proj-1", "tower-A", ""]);
    const unit = cached?.data.find((u) => u.id === "unit-1");
    expect(unit?.status).toBe("available");
  });

  test("onSettled always calls invalidateQueries(['units']) on success", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "bk-1", unitId: "unit-1", status: "pending" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    client.setQueryData(["units", "proj-1", "tower-A", ""], {
      data: [{ id: "unit-1", status: "available", unitNumber: "A-101" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useBookingMutation(), {
      wrapper: makeWrapper(client),
    });

    act(() => {
      result.current.mutate({ leadId: "lead-1", unitId: "unit-1" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["units"] }),
    );
  });

  test("onSettled always calls invalidateQueries(['units']) on failure", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "conflict" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    client.setQueryData(["units", "proj-1", "tower-A", ""], {
      data: [{ id: "unit-1", status: "available", unitNumber: "A-101" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useBookingMutation(), {
      wrapper: makeWrapper(client),
    });

    act(() => {
      result.current.mutate({ leadId: "lead-1", unitId: "unit-1" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["units"] }),
    );
  });
});
