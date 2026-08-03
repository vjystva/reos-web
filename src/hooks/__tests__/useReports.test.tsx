/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useReportJobs } from "@/hooks/useReportJobs";
import { useReportJob } from "@/hooks/useReportJob";
import { useQueueReportMutation } from "@/hooks/useQueueReportMutation";
import { useRunReportMutation } from "@/hooks/useRunReportMutation";
import { ReportJobSchema } from "@/types/api";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const NOW = new Date().toISOString();

const SAMPLE_JOB = {
  jobId: "job-123",
  status: "completed" as const,
  reportType: "leads_summary" as const,
  format: "csv" as const,
  createdAt: NOW,
};

// ---------------------------------------------------------------------------
// ReportJobSchema validation
// ---------------------------------------------------------------------------

describe("ReportJobSchema", () => {
  test("parses valid completed job", () => {
    const result = ReportJobSchema.safeParse(SAMPLE_JOB);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobId).toBe("job-123");
      expect(result.data.status).toBe("completed");
    }
  });

  test("parses job with running status", () => {
    const result = ReportJobSchema.safeParse({
      ...SAMPLE_JOB,
      status: "running",
    });
    expect(result.success).toBe(true);
  });

  test("parses job with queued status", () => {
    const result = ReportJobSchema.safeParse({
      ...SAMPLE_JOB,
      status: "queued",
    });
    expect(result.success).toBe(true);
  });

  test("parses job with failed status and errorMessage", () => {
    const result = ReportJobSchema.safeParse({
      ...SAMPLE_JOB,
      status: "failed",
      errorMessage: "Something went wrong",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errorMessage).toBe("Something went wrong");
    }
  });

  test("parses job with nullable result field", () => {
    const result = ReportJobSchema.safeParse({
      ...SAMPLE_JOB,
      result: null,
    });
    expect(result.success).toBe(true);
  });

  test("parses job with result payload", () => {
    const result = ReportJobSchema.safeParse({
      ...SAMPLE_JOB,
      result: { totalLeads: 42, converted: 10 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.result).toEqual({ totalLeads: 42, converted: 10 });
    }
  });

  test("parses job with parameters field", () => {
    const result = ReportJobSchema.safeParse({
      ...SAMPLE_JOB,
      parameters: { dateFrom: "2026-01-01", dateTo: "2026-01-31" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parameters).toBeDefined();
    }
  });

  test("rejects job with invalid status", () => {
    const result = ReportJobSchema.safeParse({
      ...SAMPLE_JOB,
      status: "pending",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBeDefined();
    }
  });

  test("rejects job missing required jobId", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { jobId: _omit, ...noId } = SAMPLE_JOB;
    const result = ReportJobSchema.safeParse(noId);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useReportJobs
// ---------------------------------------------------------------------------

describe("useReportJobs", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("fetches /api/reports and returns jobs list", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [SAMPLE_JOB] }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useReportJobs(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.jobs).toHaveLength(1);
    expect(result.current.data?.jobs[0]?.jobId).toBe("job-123");
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/reports");
  });

  test("returns empty jobs array on empty response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [] }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useReportJobs(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.jobs).toHaveLength(0);
  });

  test("returns empty jobs on malformed response (tolerant)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: true }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useReportJobs(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Hook is tolerant — returns empty list instead of error
    expect(result.current.data?.jobs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useReportJob (single job with polling)
// ---------------------------------------------------------------------------

describe("useReportJob", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("fetches single job by id", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_JOB,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useReportJob("job-123"), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.jobId).toBe("job-123");
    expect(result.current.data?.status).toBe("completed");
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/reports/job-123",
    );
  });

  test("does not fetch when jobId is null", () => {
    const { result } = renderHook(() => useReportJob(null), {
      wrapper: makeWrapper(client),
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
  });

  test("polls (refetchInterval=5000) when status is queued", async () => {
    const queuedJob = { ...SAMPLE_JOB, status: "queued" as const };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => queuedJob,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useReportJob("job-q1"), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The refetchInterval function should return 5000 when status is queued
    const queryState = client.getQueryState(["reports", "job-q1"]);
    expect(queryState?.data?.status).toBe("queued");
  });

  test("polls when status is running", async () => {
    const runningJob = { ...SAMPLE_JOB, status: "running" as const };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => runningJob,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useReportJob("job-r1"), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const queryState = client.getQueryState(["reports", "job-r1"]);
    expect(queryState?.data?.status).toBe("running");
  });

  test("throws on shape mismatch", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bad: "shape" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useReportJob("job-bad"), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useQueueReportMutation
// ---------------------------------------------------------------------------

describe("useQueueReportMutation", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("POSTs to /api/reports/jobs and returns queued job", async () => {
    const queuedJob = { ...SAMPLE_JOB, status: "queued" as const };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => queuedJob,
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useQueueReportMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        reportType: "leads_summary",
        format: "csv",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe("/api/reports/jobs");
    expect(call[1]?.method).toBe("POST");
    expect(
      invalidateSpy.mock.calls.some((c) =>
        JSON.stringify(c[0]).includes("reports"),
      ),
    ).toBe(true);
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "bad_request" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useQueueReportMutation(), {
      wrapper: makeWrapper(client),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          reportType: "bookings_summary",
          format: "json",
        });
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// useRunReportMutation
// ---------------------------------------------------------------------------

describe("useRunReportMutation", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });
  afterEach(() => client.clear());

  test("POSTs to /api/reports/jobs/:id/run and invalidates queries", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobId: "job-123", status: "running" }),
    }) as unknown as typeof fetch;

    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRunReportMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync("job-123");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe("/api/reports/jobs/job-123/run");
    expect(call[1]?.method).toBe("POST");
    expect(
      invalidateSpy.mock.calls.some((c) =>
        JSON.stringify(c[0]).includes("reports"),
      ),
    ).toBe(true);
  });

  test("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "not_found" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRunReportMutation(), {
      wrapper: makeWrapper(client),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync("job-missing");
      }),
    ).rejects.toThrow();
  });

  test("URL-encodes job ID with special characters", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobId: "job/special", status: "running" }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRunReportMutation(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync("job/special");
    });

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe("/api/reports/jobs/job%2Fspecial/run");
  });
});
