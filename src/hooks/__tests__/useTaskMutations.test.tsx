/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useCreateTaskMutation } from "@/hooks/useCreateTaskMutation";
import { useCompleteTaskMutation } from "@/hooks/useCompleteTaskMutation";
import { useDeleteTaskMutation } from "@/hooks/useDeleteTaskMutation";

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

describe("useCreateTaskMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success POSTs JSON body and invalidates tasks query", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: "task-1",
        title: "Call customer",
        status: "open",
        priority: "high",
        createdAt: "2026-05-17T10:00:00.000Z",
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateTaskMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        title: "Call customer",
        priority: "high",
        assignedTo: "user-1",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tasks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      title: "Call customer",
      priority: "high",
      assignedTo: "user-1",
    });

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"tasks"'))).toBe(true);
  });

  test("throws with upstream message on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Title is required" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCreateTaskMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: "x",
          priority: "low",
          assignedTo: "user-1",
        }),
      ).rejects.toThrow("Title is required");
    });
  });
});

describe("useCompleteTaskMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success POSTs to /complete and invalidates tasks + task queries", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCompleteTaskMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ taskId: "task-42" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tasks/task-42/complete");
    expect(init.method).toBe("POST");

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"tasks"'))).toBe(true);
    expect(calls.some((c) => c.includes('"task"'))).toBe(true);
  });

  test("throws permission error on 403", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "forbidden" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCompleteTaskMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ taskId: "task-1" }),
      ).rejects.toThrow("You do not have permission");
    });
  });
});

describe("useDeleteTaskMutation", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.clear();
  });

  test("success DELETEs and invalidates tasks + task queries", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteTaskMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ taskId: "task-9" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tasks/task-9");
    expect(init.method).toBe("DELETE");

    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('"tasks"'))).toBe(true);
    expect(calls.some((c) => c.includes('"task"'))).toBe(true);
  });

  test("throws upstream error on 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Task not found" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useDeleteTaskMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ taskId: "task-missing" }),
      ).rejects.toThrow("Task not found");
    });
  });
});
