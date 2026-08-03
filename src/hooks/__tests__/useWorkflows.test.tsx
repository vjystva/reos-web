/** @jest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWorkflows } from '../useWorkflows';
import { useCreateWorkflowMutation } from '../useCreateWorkflowMutation';
import { useTriggerWorkflowMutation } from '../useTriggerWorkflowMutation';
import { useDeleteWorkflowMutation } from '../useDeleteWorkflowMutation';

function mockFetch(body: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body),
  }) as jest.Mock;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const WORKFLOW = {
  id: 'wf1',
  tenantId: 'ten1',
  name: 'New Lead Welcome',
  triggerEvent: 'lead_stage_changed',
  isActive: true,
  createdAt: '2026-05-19T10:00:00Z',
  updatedAt: '2026-05-19T10:00:00Z',
};

afterEach(() => jest.clearAllMocks());

describe('useWorkflows', () => {
  it('fetches and returns workflow list', async () => {
    mockFetch({ data: [WORKFLOW], total: 1, page: 1, limit: 25 });
    const { result } = renderHook(() => useWorkflows(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].name).toBe('New Lead Welcome');
  });

  it('hits /api/workflows endpoint', async () => {
    mockFetch({ data: [], total: 0, page: 1, limit: 25 });
    renderHook(() => useWorkflows(), { wrapper });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/workflows');
  });
});

describe('useCreateWorkflowMutation', () => {
  it('POSTs new workflow', async () => {
    mockFetch(WORKFLOW);
    const { result } = renderHook(() => useCreateWorkflowMutation(), { wrapper });
    await result.current.mutateAsync({
      name: 'New Lead Welcome',
      triggerEvent: 'lead_stage_changed',
      isActive: true,
    });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/workflows');
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(opts?.method).toBe('POST');
  });
});

describe('useTriggerWorkflowMutation', () => {
  it('POSTs to trigger endpoint', async () => {
    mockFetch({ executionId: 'exec-1', status: 'success' });
    const { result } = renderHook(() => useTriggerWorkflowMutation(), { wrapper });
    await result.current.mutateAsync('wf1');
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/workflows/wf1/trigger');
  });
});

describe('useDeleteWorkflowMutation', () => {
  it('DELETEs the workflow', async () => {
    mockFetch({});
    const { result } = renderHook(() => useDeleteWorkflowMutation(), { wrapper });
    await result.current.mutateAsync('wf1');
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(opts?.method).toBe('DELETE');
  });
});

describe('Zod validation — CreateWorkflowForm', () => {
  const { z } = jest.requireActual('zod') as typeof import('zod');
  const TRIGGER_EVENTS = ['lead_stage_changed', 'booking_status_changed', 'payment_due', 'site_visit_scheduled', 'task_due'] as const;
  const schema = z.object({
    name: z.string().min(1).max(200),
    triggerEvent: z.enum(TRIGGER_EVENTS),
    isActive: z.boolean().optional(),
  });

  it('accepts valid workflow input', () => {
    const r = schema.safeParse({ name: 'My Workflow', triggerEvent: 'lead_stage_changed', isActive: true });
    expect(r.success).toBe(true);
  });

  it('rejects empty name', () => {
    const r = schema.safeParse({ name: '', triggerEvent: 'lead_stage_changed' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBeTruthy();
  });

  it('rejects invalid trigger event', () => {
    const r = schema.safeParse({ name: 'Wf', triggerEvent: 'unknown_trigger' });
    expect(r.success).toBe(false);
  });

  it('accepts all valid trigger events', () => {
    for (const t of TRIGGER_EVENTS) {
      const r = schema.safeParse({ name: 'Wf', triggerEvent: t });
      expect(r.success).toBe(true);
    }
  });
});
