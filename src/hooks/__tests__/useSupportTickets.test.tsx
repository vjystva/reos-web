/** @jest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSupportTickets } from '../useSupportTickets';
import { useSupportTicket } from '../useSupportTicket';
import { useCreateTicketMutation } from '../useCreateTicketMutation';
import { useAddReplyMutation } from '../useAddReplyMutation';
import { useUpdateTicketStatusMutation } from '../useUpdateTicketStatusMutation';

function mockFetch(body: unknown, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as jest.Mock;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const TICKET = {
  id: 't1',
  tenantId: 'ten1',
  subject: 'Test Issue',
  description: 'Something broke',
  status: 'open',
  priority: 'high',
  requesterId: null,
  assigneeId: null,
  createdAt: '2026-05-19T10:00:00Z',
  updatedAt: '2026-05-19T10:00:00Z',
};

afterEach(() => jest.clearAllMocks());

describe('useSupportTickets', () => {
  it('fetches and returns ticket list', async () => {
    mockFetch({ data: [TICKET], total: 1, page: 1, limit: 25 });
    const { result } = renderHook(() => useSupportTickets({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].subject).toBe('Test Issue');
  });

  it('passes status filter to API', async () => {
    mockFetch({ data: [], total: 0, page: 1, limit: 25 });
    renderHook(() => useSupportTickets({ status: 'open' }), { wrapper });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('status=open');
  });
});

describe('useSupportTicket', () => {
  it('fetches a single ticket by id', async () => {
    mockFetch({ ...TICKET, replies: [] });
    const { result } = renderHook(() => useSupportTicket('t1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.subject).toBe('Test Issue');
  });
});

describe('useCreateTicketMutation', () => {
  it('POSTs to correct endpoint', async () => {
    mockFetch(TICKET);
    const { result } = renderHook(() => useCreateTicketMutation(), { wrapper });
    await result.current.mutateAsync({
      subject: 'New Issue',
      description: 'Details',
      priority: 'medium',
    });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/support-tickets');
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(opts?.method).toBe('POST');
  });
});

describe('useAddReplyMutation', () => {
  it('POSTs reply to correct ticket endpoint', async () => {
    mockFetch({ id: 'r1', body: 'Reply text' });
    const { result } = renderHook(() => useAddReplyMutation(), { wrapper });
    await result.current.mutateAsync({ ticketId: 't1', body: 'Reply text' });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/support-tickets/t1/replies');
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(opts?.method).toBe('POST');
  });
});

describe('useUpdateTicketStatusMutation', () => {
  it('PATCHes status to correct endpoint', async () => {
    mockFetch({ ...TICKET, status: 'resolved' });
    const { result } = renderHook(() => useUpdateTicketStatusMutation(), { wrapper });
    await result.current.mutateAsync({ ticketId: 't1', status: 'resolved' });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/support-tickets/t1/status');
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(opts?.method).toBe('PATCH');
  });
});

describe('Zod validation — CreateTicketForm fields', () => {
  const { z } = jest.requireActual('zod') as typeof import('zod');
  const schema = z.object({
    subject: z.string().min(1).max(255),
    description: z.string().min(1).max(5000),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
  });

  it('accepts valid input', () => {
    const r = schema.safeParse({ subject: 'Issue', description: 'Details', priority: 'high' });
    expect(r.success).toBe(true);
  });

  it('rejects empty subject', () => {
    const r = schema.safeParse({ subject: '', description: 'Details', priority: 'high' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBeTruthy();
  });

  it('rejects invalid priority', () => {
    const r = schema.safeParse({ subject: 'Issue', description: 'Details', priority: 'critical' });
    expect(r.success).toBe(false);
  });

  it('rejects empty description', () => {
    const r = schema.safeParse({ subject: 'Issue', description: '', priority: 'low' });
    expect(r.success).toBe(false);
  });
});
