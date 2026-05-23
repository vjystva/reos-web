/** @jest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useLeadPipeline,
  useUpdateLeadStatus,
  PIPELINE_STATUSES,
  normaliseStatus,
  groupByStatus,
} from "../useLeadPipeline";
import type { Lead } from "@/types/api";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryOnMount: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    name: "Test Lead",
    stage: "new",
    temperature: "warm",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Lead;
}

// --- normaliseStatus unit tests (pure function, no network) ---

describe("normaliseStatus", () => {
  it("maps new → New", () => expect(normaliseStatus("new")).toBe("New"));
  it("maps contacted → Contacted", () => expect(normaliseStatus("contacted")).toBe("Contacted"));
  it("maps site_visit_scheduled → Site Visit", () =>
    expect(normaliseStatus("site_visit_scheduled")).toBe("Site Visit"));
  it("maps site_visit_done → Site Visit", () =>
    expect(normaliseStatus("site_visit_done")).toBe("Site Visit"));
  it("maps negotiation → Negotiation", () =>
    expect(normaliseStatus("negotiation")).toBe("Negotiation"));
  it("maps booking → Converted", () => expect(normaliseStatus("booking")).toBe("Converted"));
  it("maps converted → Converted", () => expect(normaliseStatus("converted")).toBe("Converted"));
  it("maps lost → Lost", () => expect(normaliseStatus("lost")).toBe("Lost"));
  it("unknown stage returns raw string", () =>
    expect(normaliseStatus("something_new")).toBe("something_new"));
});

// --- groupByStatus unit tests (pure function, no network) ---

describe("groupByStatus", () => {
  it("groups leads by normalised status", () => {
    const leads = [
      makeLead({ id: "l1", stage: "new" }),
      makeLead({ id: "l2", stage: "contacted" }),
      makeLead({ id: "l3", stage: "new" }),
    ];
    const cols = groupByStatus(leads);
    expect(cols["New"]).toHaveLength(2);
    expect(cols["Contacted"]).toHaveLength(1);
  });

  it("initialises all 6 canonical columns", () => {
    const cols = groupByStatus([]);
    for (const s of PIPELINE_STATUSES) {
      expect(cols[s]).toHaveLength(0);
    }
  });

  it("unknown stage goes into its own column, not Lost", () => {
    const lead = { ...makeLead(), stage: "custom_stage" } as Lead;
    const cols = groupByStatus([lead]);
    expect(cols["Lost"]).toHaveLength(0);
    expect(cols["custom_stage"]).toHaveLength(1);
  });

  it("site_visit_done maps into Site Visit", () => {
    const cols = groupByStatus([makeLead({ stage: "site_visit_done" })]);
    expect(cols["Site Visit"]).toHaveLength(1);
  });
});

// --- useUpdateLeadStatus hook tests ---

describe("useUpdateLeadStatus", () => {
  beforeEach(() => jest.resetAllMocks());

  it("calls PATCH with correct body", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useUpdateLeadStatus(), { wrapper: makeWrapper() });
    result.current.mutate({ id: "lead-1", status: "Contacted" });

    await waitFor(() => result.current.isSuccess);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/leads/lead-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Contacted" }),
      }),
    );
  });

  it("handles error response", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useUpdateLeadStatus(), { wrapper: makeWrapper() });
    result.current.mutate({ id: "lead-1", status: "Lost" });

    await waitFor(() => result.current.isError);
    expect(result.current.isError).toBe(true);
  });
});
