'use client';

import { useState } from 'react';
import { useHolds, holdStatusLabel, holdStatusClass, holdTimeRemainingLabel, holdIsExpired } from '@/hooks/useHolds';

type StatusFilter = 'all' | 'active' | 'released' | 'converted' | 'expired';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Released', value: 'released' },
  { label: 'Converted', value: 'converted' },
  { label: 'Expired', value: 'expired' },
];

export default function HoldsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const params: Record<string, string> = {};
  if (statusFilter !== 'all') params.status = statusFilter;

  const { data, isLoading, isError } = useHolds(params);

  // The `main` landmark is owned by AppShell (SidebarInset); page padding too.
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Unit Holds</h1>

      <div className="flex gap-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === tab.value
                ? 'bg-primary text-white border-primary'
                : 'border-gray-300 text-gray-600 hover:border-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-red-600">Failed to load holds. Please try again.</p>
      )}

      {data && data.data.length === 0 && (
        <p className="text-gray-500">No holds found.</p>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-2">
          {data.data.map((hold) => (
            <div
              key={hold.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-white"
            >
              <div>
                <p className="font-medium text-sm text-gray-800">
                  Unit: <span className="font-mono">{hold.unitId}</span>
                </p>
                {hold.leadId && (
                  <p className="text-xs text-gray-500">Lead: {hold.leadId}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {hold.status === 'active'
                    ? holdTimeRemainingLabel(hold.expiresAt)
                    : holdIsExpired(hold.expiresAt)
                    ? 'Expired'
                    : `Expires: ${new Date(hold.expiresAt).toLocaleString()}`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`badge ${holdStatusClass(hold.status)}`}>
                  {holdStatusLabel(hold.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <p className="text-xs text-gray-400 mt-4">
          {data.total} total hold{data.total !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
